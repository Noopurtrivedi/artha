# Artha — Work-in-Progress Requirements

**Status:** Recovered from interrupted session
**Date:** 2026-05-18
**Source:** Reconstructed from uncommitted changes and untracked files on `main`. None of this work is committed yet — last commit is `6b9568d feat: MCP Audit Log & Permissioning`.

This document captures the seven feature workstreams that were in progress when the previous Claude Code session crashed. Each section describes the intended capability, the files implementing it, the data shapes introduced, and what remains to wire up or validate.

---

## 1. Web & Embedded Browser Integration

Give the agent first-class web access and an embedded Chromium tab it can co-pilot with the user.

### Goals
- Let the agent fetch arbitrary URLs, search the web, and drive a real browser without external API keys.
- Allow the agent to hand control back to the user mid-task (login, captcha, 2FA) and resume cleanly afterwards.
- Make every page the agent touches auditable and citable.

### Capabilities
- **Embedded browser pane** powered by Electron `BrowserView`, with a driving-mode latch shared between agent and user.
- **Browser automation tools** (registered via `tools/browser.ts`):
  - `browser_navigate`, `browser_back`, `browser_forward`, `browser_reload`
  - `browser_click`, `browser_type`, `browser_read_dom`, `browser_screenshot`, `browser_wait_for`
  - `browser_request_user` — pauses the agent and surfaces a `HandoffBanner` with a custom reason + Resume button.
- **Web fetch & search tools** (no API keys required):
  - `web_fetch` — pulls a URL through Mozilla Readability, converts to compact markdown, caches result.
  - `web_search` — SearXNG-backed metasearch with configurable instance.
  - Respects `robots.txt` by default; configurable in Web settings.
- **Readability pipeline** (`tools/readability.ts`) strips boilerplate and produces compact markdown; cached in `web_cache` with TTL (default 1 hour).
- **Citation tracking** — every fetch/search records `{url, title, fetched_at}` into a per-workflow buffer that flushes to `messages.citations_json` when the message finalizes.

### Files
- Main: `packages/app/src/browser/{actions,controller}.ts`, `packages/app/src/tools/{browser,web,readability,searxng}.ts`
- Renderer: `packages/renderer/src/components/Browser/{BrowserPane,BrowserToolbar,HandoffBanner}.tsx`, `packages/renderer/src/stores/browser.ts`
- Settings UI: `packages/renderer/src/components/Settings/WebPanel.tsx`

### Open items
- Confirm `BrowserController.bindWindow` is wired in `main.ts` and lifecycle events (close, navigation, crash) are handled.
- Verify SearXNG default instance and cache TTL defaults are correct for shipped configuration.

---

## 2. Bundles — Portable, Signed Workflow Packages

Allow a user to export a completed agent run as a single `.artha-bundle` file that another Artha install can import, verify, and replay.

### Goals
- Make runs portable and reviewable outside the originating machine.
- Guarantee tamper-evidence via signature over the immutable inputs.
- Surface missing local dependencies (MCP servers) before replay.

### Capabilities
- **Export format:** gzip-compressed JSON containing:
  - Signed manifest: `bundleId`, prompt, model, MCP server list, `goldenContentHash`
  - Full step trace from `agent_steps`
  - Optional attached artifacts (generated doc + receipt)
- **Signature:** SHA-256 over `(prompt, model, mcpServers, goldenContentHash)`.
- **Import flow:** decompresses to `{imports_dir}/{bundleId}/`, verifies signature, reports any required MCP servers that are missing locally.
- **UI:** `BundlesPanel` lists imported bundles, lets the user inspect contents, and reveals the extracted directory.

### Files
- Main: `packages/app/src/bundles/bundle.ts`
- Renderer: `packages/renderer/src/components/Settings/BundlesPanel.tsx`
- IPC: `bundles.export(runId, docId?)`, `bundles.import()`, `bundles.openExtracted(dir)`

### Open items
- Decide whether `goldenContentHash` is mandatory or optional at export time.
- Confirm save-dialog default filename / extension filter.

---

## 3. Router — Adaptive Per-Task Model Selection

Pick the best local Ollama model for each phase of a run (`plan`, `tool_args`, `synthesis`) based on measured quality and latency.

### Goals
- Avoid forcing the user to choose one model for everything.
- Make routing decisions data-driven and re-runnable.
- Allow manual pinning to override the auto-selection.

### Capabilities
- **Benchmark harness** (`router/benchmark.ts`) probes every installed Ollama model on three canonical tasks:
  - `plan` — JSON array of three-step plans; scored on length + structure.
  - `tool_args` — JSON object field generation; scored on correctness (e.g., `/Desktop` match).
  - `synthesis` — two-sentence prose; scored on length + sentence count.
- **Profile storage** in `model_profiles` table; results sorted descending by quality per task.
- **User overrides** in `router_overrides` table — one pinned model per task type, or cleared for auto-selection.
- **LLM client integration** — `getActiveLLMClient(taskType)` reads profiles/overrides to pick the model for that step.
- **Settings UI** — `RouterPanel` triggers benchmarks, streams per-model progress, lists profiles, and exposes pin/clear controls.

### Files
- Main: `packages/app/src/router/benchmark.ts`, modifications to `packages/app/src/llm/client.ts`
- Renderer: `packages/renderer/src/components/Settings/RouterPanel.tsx`
- IPC: `router.benchmark`, `router.listProfiles`, `router.listOverrides`, `router.setOverride`
- Streaming event: `router:benchmarkProgress`

### Open items
- Define what happens when no profile exists for a task (fallback model? error?).
- Decide cadence for re-benchmarking when a new model is pulled into Ollama.

---

## 4. Time Travel — Fork & Replay Agent Runs

Persist every step of an agent run and let the user fork a new run from any snapshot, optionally with a different model.

### Goals
- Make debugging and iteration cheap: re-try a single step instead of restarting the whole run.
- Visualize lineage so forks aren't lost.

### Capabilities
- **Step persistence:** every step (`system`, `user`, `assistant`, `tool_call`, `tool_result`, `final`) is logged to `agent_steps` with payload JSON, ordinal `idx`, and an optional `messages_snapshot` (captured only at `assistant`/`system` steps).
- **Forking:** `forkFromStep(stepId, modelOverride?)` rehydrates the full `ChatCompletionMessageParam[]` from the snapshot and resumes the orchestrator from that exact context.
- **Lineage:** `agent_runs.parent_run_id` and `forked_from_step` track ancestry; UI highlights forked runs with a branch icon.
- **Timeline UI:** each step shows kind, a preview excerpt, and a Fork button (enabled only on steps that carry a snapshot).

### Files
- Main: `packages/app/src/agent/orchestrator.ts` (extensive additions)
- Renderer: `packages/renderer/src/components/Settings/TimeTravelPanel.tsx`
- IPC: `timetravel.listRuns(sessionId?)`, `timetravel.getSteps(runId)`, `timetravel.fork(stepId, modelOverride?)`

### Open items
- Cap on run-list size (currently 200) — confirm pagination strategy if needed.
- Snapshot size on disk — decide if periodic compaction is required.

---

## 5. Provenance — Source Anchoring for Generated Documents

Every generated artifact (`docx`, `pptx`, `xlsx`, `pdf`) records where each section came from (RAG, tool output, LLM, or user input).

### Goals
- Make generated documents defensible and verifiable.
- Provide a receipt sidecar so verification works without the Artha app.

### Capabilities
- **Document registration:** every artifact (`generated_documents.doc_id`) records content hash, title, prompt hash, model name at generation time.
- **Anchor records:** each section/cell/slide/paragraph links to an `anchor_id` resolving to a `provenance_records` row with:
  - `source_type`: `rag` | `tool` | `llm` | `user`
  - `source_ref`: chunk ID / tool name / etc.
  - `excerpt`: snippet
- **Receipt sidecar:** `<filename>.artha-receipt.json` written alongside each artifact, containing the manifest + full anchor list for offline verification.
- **UI:** `ProvenancePanel` — left sidebar lists generated docs; right pane shows receipt + per-anchor breakdown with source-type badges (rag=blue, tool=violet, llm=amber, user=green).

### Files
- Main: changes to `packages/app/src/docs/generator.ts`
- Renderer: `packages/renderer/src/components/Settings/ProvenancePanel.tsx`
- IPC: `provenance.listDocs`, `provenance.listAnchors(docId)`, `provenance.getReceipt(docId)`

### Open items
- Verify anchor coverage requirement — must every paragraph have an anchor, or only "factual" claims?
- Decide receipt schema versioning strategy.

---

## 6. Citations & Inline Tool Calls — Chat UI Enhancements

Surface the agent's reasoning trail inline in the chat transcript.

### Capabilities
- **`Citations.tsx`:** renders numbered source chips `[1] sitename · domain` under any assistant message that used `web_fetch`/`web_search`. Click opens URL in the default browser.
- **`ToolCallInline.tsx`:** collapsible "N tool calls" footer expands to show invoke/result pairs with args (JSON up to 300 chars) and truncated outputs (250 chars). Success ✓ (green) / error ✗ (red) icons.
- Both components stay pinned to the message that produced them, keeping reasoning visible and linkable.

### Files
- `packages/renderer/src/components/Chat/Citations.tsx`
- `packages/renderer/src/components/Chat/ToolCallInline.tsx`
- Integration in `packages/renderer/src/components/Chat/ChatWindow.tsx`

---

## 7. Schema & Data Model Changes

`packages/app/src/db/schema.ts` adds the storage backing for everything above.

### New tables
| Table | Purpose |
|---|---|
| `generated_documents` | Registry of generated artifacts (doc_id, file_path, doc_type, title, prompt_hash, content_hash, model, receipt_path) |
| `provenance_records` | Per-anchor source attribution (record_id, doc_id, anchor_id, source_type, source_ref, excerpt) |
| `agent_runs` | Run lineage (run_id, session_id, workflow_id, parent_run_id, forked_from_step, goal, model, status, created_at) |
| `agent_steps` | Full step trace (step_id, run_id, idx, kind, payload, messages_snapshot, ts) |
| `model_profiles` | Benchmark results (ollama_name, task_type, latency_ms, quality, benchmarked_at) |
| `router_overrides` | User-pinned model per task type |
| `web_cache` | URL → readable markdown cache (url PK, title, content, content_type, etag, fetched_at) |

### Column additions
- `messages.citations_json` — JSON array of `{url, title, fetched_at}` from web tools.

### Pragmas
- WAL journal mode for concurrent reads during writes.
- `foreign_keys = ON` for CASCADE deletes on `chat_sessions`.

---

## 8. IPC / Preload Surface

`packages/app/src/preload.ts` and `packages/app/src/ipc/handlers.ts` add the following namespaces. All renderer access goes through these.

### `bundles`
- `export(runId, docId?)` → `{bundleId, outPath, size}`
- `import()` → `ImportResult` (signature validity, missing MCP servers)
- `openExtracted(dir)` → reveals folder via `shell.openPath`

### `router`
- `benchmark()` (streams `router:benchmarkProgress`)
- `listProfiles()`, `listOverrides()`, `setOverride(taskType, ollamaName | null)`

### `timetravel`
- `listRuns(sessionId?)` (200-run cap)
- `getSteps(runId)`, `fork(stepId, modelOverride?)`

### `provenance`
- `listDocs()`, `listAnchors(docId)`, `getReceipt(docId)`

### `browser`
- Actions: `attach(bounds)`, `detach()`, `navigate(url)`, `back/forward/reload/stop()`
- Co-pilot: `takeWheel()`, `resumeAgent()`, `cancelHandoff()`, `getState()`
- Events: `onState`, `onAutoOpen`, `onHandoffRequested`, `onHandoffResolved`

### `agent`
- `onStreamEnd`, `onWorkflowStart`, `onCitations`

### `sessions`
- `onTitleUpdated` — fires when main auto-titles a session from its first message.

### `settings` / `web`
- `getWebConfig()`, `setWebConfig(patch)`
- `web.clearCache()`, `web.getCacheStats()`

---

## 9. Renderer Routing

`packages/renderer/src/App.tsx` adds these views to the existing nav:
- `chat` — ChatWindow + (BrowserPane OR ExecutionLog, mutually exclusive)
- `models` (existing)
- `mcp` (existing)
- `web` — new `WebPanel` (SearXNG instance, cache TTL, robots.txt toggle)
- `provenance` — new `ProvenancePanel`
- `timetravel` — new `TimeTravelPanel`
- `bundles` — new `BundlesPanel`
- `router` — new `RouterPanel`

Sidebar (`Sidebar.tsx`) and event wiring in `App.tsx` subscribe to: `agent:token`, `agent:toolCall`, `agent:planReady`, `agent:streamEnd`, `agent:workflowStart`, `agent:citations`, `session:titleUpdated`, browser auto-open / handoff events. Each `on*` subscription returns an unsubscribe function used on unmount.

---

## 10. Remaining Work & Validation Checklist

Before any of this can ship:
- [ ] Type-check entire workspace (`npm run typecheck`) — likely broken given the surface area touched.
- [ ] Run the app end-to-end: launch agent, exercise each new tool, confirm DB tables populate.
- [ ] Verify Electron `BrowserView` lifecycle (creation, attach/detach, crash recovery).
- [ ] Confirm SearXNG configurability (no hardcoded instance shipped).
- [ ] Test bundle round-trip: export → fresh install → import → verify signature.
- [ ] Benchmark harness: confirm graceful behavior with zero installed Ollama models.
- [ ] Time-travel fork: regression-test that snapshots replay deterministically.
- [ ] Provenance: confirm receipt sidecar is written for every supported doc type.
- [ ] Citations: verify `messages.citations_json` is populated on real web-tool runs.
- [ ] Decide commit strategy: split into per-feature commits (recommended) vs. one large WIP commit.

---

## Appendix — File Inventory

**Untracked (new) files (~3,500 LOC):**
- `packages/app/src/browser/{actions,controller}.ts`
- `packages/app/src/bundles/bundle.ts`
- `packages/app/src/router/benchmark.ts`
- `packages/app/src/tools/{browser,readability,searxng,web}.ts`
- `packages/renderer/src/components/Browser/{BrowserPane,BrowserToolbar,HandoffBanner}.tsx`
- `packages/renderer/src/components/Chat/{Citations,ToolCallInline}.tsx`
- `packages/renderer/src/components/Settings/{BundlesPanel,ProvenancePanel,RouterPanel,TimeTravelPanel,WebPanel}.tsx`
- `packages/renderer/src/stores/browser.ts`

**Heavily modified (+2,000 LOC across them):**
- `packages/app/src/agent/orchestrator.ts` (+559)
- `packages/renderer/src/components/Settings/MCPToolsPanel.tsx` (+415)
- `packages/app/src/docs/generator.ts` (+312)
- `packages/app/src/ipc/handlers.ts` (+305)
- `packages/renderer/src/components/Chat/ChatWindow.tsx` (+301)
- `packages/app/src/preload.ts` (+151)
- `packages/app/src/db/schema.ts` (+133)
- `packages/renderer/src/components/Sidebar/Sidebar.tsx` (+124)
- Plus smaller edits to `main.ts`, `llm/client.ts`, `mcp/registry.ts`, `rag/indexer.ts`, `tools/filesystem.ts`, `App.tsx`, `PlanApproval.tsx`, `ExecutionLog.tsx`, `ModelsPanel.tsx`, `stores/chat.ts`, `vite.config.ts`, `tailwind.config.js`, both `package.json` files.
