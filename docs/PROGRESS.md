# Artha — Session Progress & Resume Log

**Last updated:** 2026-05-19
**Branch:** `main` — in sync with `origin/main` (everything pushed)
**Tests:** 37 passing (`npm test`) · **Typecheck:** clean (`npm run typecheck`)
**Repo:** https://github.com/Noopurtrivedi/artha

> Resume point for the next session. Read this first to know exactly where we left off.

---

## TL;DR — where we are

A productive session shipped **production launch infra + a Skills system + a complete local-RAG feature + agent UX upgrades**, all committed and pushed in 7 feature commits. Everything is verified by **typecheck + unit tests**, but **NOT by a live UI run** (the Electron app needs Ollama running locally, which couldn't be exercised in this environment). The single most valuable thing to do on resume is a **manual smoke test on real hardware**.

---

## What shipped this session (newest first)

| Commit | What |
|---|---|
| `5f17816` | **Skill import/export** — share skills as portable `.artha-skill.json`; collision-safe import (unique-slug). |
| `14a0b73` | **Incremental RAG indexing** — per-file MD5 manifest; rebuild only re-embeds changed files. |
| `f7df443` | **Streaming token output** — ReAct loop streams text live via `streamComplete`; `agent:streamReset` suppresses tool-step preamble & verified-summary swaps. |
| `0cdbda1` | **Real text extraction for RAG** — pdf-parse / mammoth / xlsx instead of raw UTF-8 (fixes garbage embeddings for PDF/DOCX). |
| `94c0d62` | **RAG Index panel** — create/rebuild/delete indexes from the UI (native folder picker). |
| `0bb47f7` | **`rag_search` agent tool** — query & cite indexed files in any chat + `/ask` built-in skill. |
| `a6cc9eb` | **Skills system + 4 levers + launch infra** (the big one — see breakdown below). |

### Breakdown of `a6cc9eb` (the foundational commit)
- **Skills system** (Claude-style): `skills` table + `SkillRegistry`; resolve per message via explicit `/slug` or LLM auto-match; instructions injected into plan + execute prompts; optional tool allowlist (prefix-aware). Built-ins: `research`, `organize`, `summarize`, `report` (+ `ask` added later). UI: `SkillsPanel`, chat `/` slash-menu, active-skill badge.
- **Lever 1 — `docs_generate` agent tool**: produce DOCX/PPTX/XLSX/PDF mid-workflow via the provenance engine; `use_rag` grounds reports in indexed files (cited by filename).
- **Lever 2 — BYOK cloud fallback**: cloud models as `llm_models` rows (OpenAI / Anthropic / custom OpenAI-compatible); opt-in, local Ollama stays default; keys stored locally. UI in Models panel.
- **Lever 3 — first-run onboarding**: detect Ollama, recommend+pull a model by RAM with live progress, or pick installed model (`Onboarding.tsx`).
- **Lever 4 — test harness**: Vitest + pure extracted helpers (`skills/util.ts`, `tools/docPath.ts`).
- **Launch infra**: `electron-builder` GitHub publish config + `.github/workflows/release.yml`; `electron-updater` (notification-only) in `main.ts`; Next.js landing page in `landing/`; `REQUIREMENTS.md`.

---

## The RAG feature is now complete end-to-end
A user can: pull `nomic-embed-text` → **index a folder** (RAG panel) → **`/ask`** questions about their files → or generate a **`/report`** grounded in them, with filename citations throughout. Indexing handles real PDF/DOCX/XLSX text and rebuilds incrementally.

---

## Key files added this session
- `packages/app/src/skills/registry.ts`, `skills/util.ts` (+ `.test.ts`)
- `packages/app/src/tools/docs.ts`, `tools/docPath.ts`, `tools/rag.ts`, `tools/ragFormat.ts` (+ tests)
- `packages/app/src/rag/extract.ts`, `rag/indexFormat.ts` (+ tests); `rag/indexer.ts` extended
- `packages/app/src/llm/streamMerge.ts` (+ test); `llm/client.ts` `streamComplete`
- `packages/renderer/src/components/Settings/SkillsPanel.tsx`, `RAGPanel.tsx`; `Onboarding/Onboarding.tsx`
- `REQUIREMENTS.md`, `landing/`, `.github/workflows/release.yml`, `vitest.config.ts`
- `packages/app/src/types/rag-extractors.d.ts`

Full annotated map: workspace `SITEMAP.md` (lives in the parent `Projects/` dir, **outside this repo**, so its updates are on disk but not git-tracked here).

---

## ⚠️ Resume checklist — DO THESE FIRST

1. **Smoke test on real hardware** (`npm run dev`, Ollama running):
   - Onboarding overlay appears on first launch; pulling a model shows live progress.
   - **Streaming**: plain Q&A streams token-by-token. **Watch for flicker** on tool-heavy runs — the `agent:streamReset` path clears preamble when a turn becomes a tool call; on a real local model that emits text-before-tool-call, this could flash. This is the #1 thing to validate.
   - Skills: `/` slash-menu lists skills; `/report ...` and `/ask ...` work; active-skill badge shows.
   - RAG: pull `nomic-embed-text`, index a folder of real PDFs/Word docs, then `/ask` about them — confirm citations point to real filenames.
2. The DB schema gained tables/seeds (`skills`, cloud `llm_models`, etc.) — first launch after this code runs the idempotent migrations/seeds automatically.

## Open decisions / loose ends (not blocking)
- **GitHub org**: deferred decision (see `REQUIREMENTS.md` §8). Must be made **before tagging the first public release `v0.1.0`**, else shipped installers' auto-update URL points at a personal account. Not urgent until release.
- **Release not yet cut**: launch infra exists but no `v*.*.*` tag has been pushed. Repo is public-ready (secret scan passed earlier).
- **`docs/requirement.md`**: shows as modified in the working tree but is a pre-existing change NOT authored this session — intentionally left uncommitted.
- **Local cleanup**: streaming added `agent:streamReset`; if flicker is bad on real models, consider buffering the first N content deltas before emitting (noted as a possible refinement).

## Candidate next tasks (pick on resume)
1. Verify/refine streaming on real hardware (see checklist #1).
2. Cut the first preview release (decide GitHub org first; tag `v0.1.0`; CI builds installers).
3. Deploy the `landing/` page to Vercel (Root Directory = `landing`).
4. RAG polish: chunk on token boundaries / better PDF layout handling; surface index status in chat.
5. Crash recovery for the BrowserView (`render-process-gone`) — flagged in `docs/requirement.md` as unhandled.

---

## How to run / verify
```bash
npm install            # root (workspaces)
npm run typecheck      # tsc -b for app + renderer  → must be clean
npm test               # vitest → 37 passing
npm run dev            # launch Electron app (needs Ollama: `ollama serve`)
# landing page:
cd landing && npm install && npm run dev
```
