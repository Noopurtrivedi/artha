# Artha — Session Progress & Resume Log

**Last updated:** 2026-05-26
**Branch:** `chore/release-0.2.0` (PR #3 open) · `main` @ `bbe4c73` after PRs #1 + #2 merged
**Tests:** 73 passing (`npm test`) · **Typecheck:** clean · **Lint:** clean
**Repo:** https://github.com/Noopurtrivedi/artha (PUBLIC)

> Resume point for the next session. Read this first to know exactly where we left off.

---

## 2026-05-26 — per-chat scopes + install fix; `v0.2.0` prepped (NOT yet tagged)

### TL;DR — pick up here on restart
The big feature (per-chat folder scopes) and the broken-install fix are **merged to `main`**. The release is **staged but not shipped**: PR #3 bumps to 0.2.0 + adds the CHANGELOG. To finish the release: **merge PR #3, then `git tag v0.2.0 && git push --tags`** (that tag is the only thing that triggers the installer build — nothing ships until you push it).

### What was built this session (3 workstreams)

**1. Per-chat folder/file scopes — PR #1 (MERGED, `3885dbe`+`bbe4c73`).**
The headline feature. Replaces the old global "project switcher" with folders/files attached **per chat**.
- Attach folders + individual files from the composer (chip row: Add Folder / Add File, per-folder re-index ↻). Sidebar is now a flat session list.
- **Hard filesystem sandbox**: when a chat has scopes, file tools reject reads/writes outside them (folder = subtree, file = exact path). Unscoped chats keep home-dir-wide access.
- **Folder-scoped RAG**: `rag_search` / `rag_list_indexes` / doc grounding confined to the chat's folder indexes when scoped (Cowork-style — but keeps semantic vector search). Folders auto-index in the background; folder workspaces reuse the `projects` table (deduped by path) to share one index + cross-session memory.
- **Folder-tree context** (`agent/folderTree.ts`): the agent now answers "what is this app?" by reading the injected file tree (README/manifests) directly — works even before the index finishes building. This fixed the "no relevant passages" bug the owner hit.
- New files: `db/scopes.ts`, `agent/folderTree.ts`, `session_scopes` table. Tests: `filesystem.sandbox` (7) + `rag.scope` (6, mocked) + `folderTree` (6).

**2. Broken-install fix — PR #2 (MERGED, `5d62d1e`).**
`@nut-tree/nut-js@^4.2.0` was removed from public npm (404) → `npm install`/`npm ci` failed for everyone (incl. release CI). Swapped to the maintained, API-compatible fork **`@nut-tree-fork/nut-js@^4.2.6`** as an **optionalDependency**; native rebuild moved into root `scripts/rebuild-native.js` (guarded, non-fatal). Desktop control is the only consumer (lazy, opt-in) — nothing else affected.

**3. Release prep — PR #3 (OPEN, `chore/release-0.2.0`).**
All workspace `package.json` → **0.2.0**; added `CHANGELOG.md` (Keep a Changelog; backfilled 0.1.0/0.1.1); refreshed this log + `SITEMAP.md`. **Why 0.2.0, not 0.1.1:** `v0.1.1` is already tagged + the current GitHub "Latest" release; many features landed since (team mode, cloud integrations, per-chat scopes, 70B models) → minor bump. (Switch to 0.1.2 if you'd rather call it a patch — it's just the branch.)

### PENDING — ordered, to resume
1. **Review + merge PR #3** (release bump + CHANGELOG). https://github.com/Noopurtrivedi/artha/pull/3
2. **Ship 0.2.0:** `git tag v0.2.0 && git push --tags` → `release.yml` builds DMG/EXE/DEB + auto-update feeds → GitHub Release. *(Only do this when ready to publish.)*
3. **Re-test the folder chat** on `main`: attach a folder, ask "tell me about this app" — should read README/manifest directly now.
4. **`ollama pull nomic-embed-text`** — required for semantic `rag_search` to return passages; without it, scoped chats fall back to direct file reads (still works, no embeddings).

### Backlog / optional (not blocking)
- **UX:** "indexing…" indicator on folder chips until the RAG index is ready (the last bit of confusion from the bug report).
- **Dependabot:** 14 `next` alerts are stale (main already on 16.2.6) and should auto-close; the lone `postcss` alert is `next`'s bundled build-time copy in the static landing site — non-exploitable. No code action needed.
- **RAG scope nuance:** retrieval is confined to the chat's folders, but the underlying `searchAllIndexes` still ranks globally when unscoped — fine as-is.

### Gotchas / notes for next session
- Working dir is on `chore/release-0.2.0` with the nut-js fork installed. `main` is clean at `bbe4c73`.
- Earlier this session local `main` had a duplicate team-mode commit (`2bc3b89`) vs remote (`a0abd86`) — resolved by `reset --hard origin/main` (identical trees, nothing lost). If history looks odd, trust `origin/main`.
- `docs/gtm/` is untracked and **not mine** (owner's GTM drafts) — left alone, never committed.
- Desktop control's `desktop_find_on_screen` is a no-op until an image-matching provider is installed (pre-existing, unchanged).

---

## 2026-05-21 (later) — post-launch polish (unreleased, on `main`)

Three follow-ups done after v0.1.0; **not yet tagged** — candidates for a `v0.1.1`:

- **Branded app icons** (`a2133a0`): diya-lamp mark for mac/win/linux, generated by a dependency-free `scripts/gen-icon.js` (supersampled vector render + hand-rolled PNG encoder; sips/iconutil derive icns/ico/png). Build config icon refs restored; local pack confirms the `.app` embeds it (no more default-Electron-icon warning). Regenerate with `node scripts/gen-icon.js`.
- **Crash-recovery hardening + tests** (`3ce9eca`): extracted the crashloop-guard + target-selection into pure `browser/recovery.ts` (7 unit tests); `main.ts` now logs update-available / up-to-date outcomes, not just errors.
- **RAG polish** (`a2cd443`): boundary-aware chunking (`rag/chunk.ts`, 7 tests) — breaks on sentence/word boundaries instead of fixed 512-char slices; ChatWindow shows a `📚 N indexes · M chunks — type /ask` badge near the composer.

**Tests now 51 passing; typecheck clean.** Auto-update was verified to the extent automatable: feeds (`latest*.yml`) valid + reachable, `app-update.yml` correct, wiring sound — but the live runtime log line couldn't be captured (macOS detaches a packaged GUI app's stdout). **Crash-recovery overlay still needs one manual confirmation**: in a dev build, load `chrome://crash` in the browser pane and confirm the reload→overlay path.

---

## 2026-05-21 session — v0.1.0 SHIPPED 🚀

The first public release is live and the launch loose ends are closed:

- **`v0.1.0` released** → https://github.com/Noopurtrivedi/artha/releases/tag/v0.1.0 — macOS dmg (arm64 + x64), Windows nsis `.exe`, Linux `.deb`, plus auto-update `latest*.yml`. Verified anonymously: `releases/latest` 200, `.dmg` 200.
- **Release CI fix** (`96a1427`): first tag failed on all 3 OSes — root `package.json` had no `main` field so electron-builder looked for `index.js`. Added `"main": "packages/app/dist/main.js"` + `author`; dropped `mac/win/linux` icon refs (empty `assets/` → default Electron icon). Verified locally with a real `--dir` pack before re-tagging.
- **BrowserView crash recovery** (`797a890`): `render-process-gone` → one silent reload of last URL → recovery overlay + `browser:recover` IPC if it recrashes within 10s. (Resolves the §1/§10 open item in `docs/requirement.md`.)
- **Smoke test passed** on real hardware (Ollama, `qwen2.5:7b` chosen as the agent default — best tool-calling/streaming of the installed models). Boots clean, DB seeds the 5 built-in skills, streaming/skills/RAG confirmed good by owner.
- **Landing page deployed** → https://artha-zeta-five.vercel.app (Vercel project `artha`; bare `artha.vercel.app` was taken). Download button points at `releases/latest` (now live).
- **Repo made public** after a clean secret scan (working tree + full history: no keys, no committed `.env`). Enabled secret scanning + push protection + Dependabot alerts.

### Decisions made this session
- **GitHub org**: owner chose **stay personal** (`Noopurtrivedi/artha`) for v0.1.0 — §8's deferred org migration is now explicitly punted past launch (note the auto-update-URL caveat if migrating after installs exist).

### Follow-ups (not blocking)
- **Branded app icons**: `assets/` is empty; v0.1.0 ships the default Electron icon. Add `icon.icns/.ico/.png` and restore the icon refs in `package.json` build config before a polished release.
- **Crash recovery is unverified live**: implemented + typechecks, but never exercised against a real renderer crash. Restart the dev app (main process needs reload) and force a page crash to confirm the overlay + reload path.
- macOS/Windows builds are **unsigned** (CI logged skipped code signing) — Gatekeeper/SmartScreen warnings on install until signing is set up (Phase 2 per §8).

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
