# Artha — Architecture Guide

## Stack Overview

Artha is a TypeScript-first Electron application. The deliberate choice to use a single runtime (Node.js/TypeScript) across both the main process and the build pipeline eliminates the cross-language IPC complexity of alternative designs (Rust + Python + ZeroMQ).

## Module Responsibility Map

| Module | Location | Responsibility |
|---|---|---|
| Electron shell | `packages/app/src/main.ts` | Window management, app lifecycle |
| IPC bridge | `packages/app/src/preload.ts` | Typed, sandboxed renderer↔main bridge |
| IPC handlers | `packages/app/src/ipc/handlers.ts` | Routes IPC calls to backend modules |
| Agent Orchestrator | `packages/app/src/agent/orchestrator.ts` | ReAct loop, planning mode, self-correction |
| LLM Client | `packages/app/src/llm/client.ts` | Single OpenAI-compat REST adapter |
| MCP Registry | `packages/app/src/mcp/registry.ts` | MCP server connections, tool schemas, invocation |
| RAG Indexer | `packages/app/src/rag/indexer.ts` | File indexing, vector similarity search |
| Document Generator | `packages/app/src/docs/generator.ts` | DOCX / PPTX / XLSX / PDF generation |
| Database | `packages/app/src/db/schema.ts` | SQLite schema, migrations |
| React UI | `packages/renderer/src/` | Chat, Sidebar, Execution Log, Plan Approval |
| Chat Store | `packages/renderer/src/stores/chat.ts` | Zustand — messages, streaming, execution log |

## LLM Interface Design

The LLM Client uses a single OpenAI-compatible REST client (`openai` npm package). All supported backends expose this API:

| Backend | Default URL | Notes |
|---|---|---|
| Ollama | `http://localhost:11434/v1` | Primary target |
| LM Studio | `http://localhost:1234/v1` | Drop-in compatible |
| llama.cpp server | `http://localhost:8080/v1` | Drop-in compatible |
| OpenAI | `https://api.openai.com/v1` | Cloud fallback (opt-in) |

No per-backend code is required. Switching providers is a config change, not a code change.

## Agent Orchestration (ReAct Loop)

```
User message
    │
    ▼
[Generate Plan]  ──── LLM call with system prompt + tool list
    │
    ▼
requiresApproval? ──yes──▶ Emit planReady → UI shows PlanApproval modal
    │                                              │
    │no                                     user approves/cancels
    ▼                                              │
[Execute Loop] ◀────────────────────────────────────
    │
    ├─▶ LLM decides: respond in text OR call a tool
    │       │
    │   tool call ──▶ MCPRegistry.invokeTool() ──▶ result ──▶ back to LLM
    │       │
    │   text ──▶ stream tokens to renderer ──▶ finalise message
    │
    ├─▶ failure? ──▶ self-correct (retry up to 3x, replan if needed)
    │
    └─▶ all steps done ──▶ mark workflow completed
```

## MCP Tool System

MCP (Model Context Protocol) is the first-class tool protocol. The `MCPRegistry` class:
1. Loads all enabled MCP servers from SQLite on startup
2. Connects via `StdioClientTransport` (spawns the server process)
3. Fetches tool schemas and converts them to OpenAI function definitions
4. Routes tool invocations to the correct server by tool name

Adding a new tool = installing a new MCP server. No custom code.

## Document Generation Pipeline

```
Natural language prompt
    │
    ▼
LLMClient.complete()  ──▶  structured JSON (title, sections, tables, bullets)
    │
    ▼
Format renderer:
  docx  ──▶  docx npm (Packer.toBuffer → .docx file)
  pptx  ──▶  pptxgenjs (.pptx file)
  xlsx  ──▶  xlsx npm (XLSX.writeFile → .xlsx file)
  pdf   ──▶  pdf-lib (PDFDocument.save → .pdf file)
    │
    ▼
File written to user's chosen output path
    │
    ▼
shell.openPath() — opens file in native app
```

## Database

SQLite via `better-sqlite3`. WAL mode enabled. All writes are synchronous (intentional — avoids async complexity in main process).

See `packages/app/src/db/schema.ts` for the full table definitions matching PRD v2.0.

## v2 Rust Core (Future)

Once v1 is shipped and product-market fit established, the `agent/orchestrator.ts` and `mcp/registry.ts` hot paths can be rewritten in Rust using:
- **Rig** — modular LLM abstractions
- **AutoAgents** — multi-agent orchestration (actor model via Ractor)

The TypeScript layer becomes a thin IPC/UI shell. This is a performance optimisation, not a v1 requirement.
