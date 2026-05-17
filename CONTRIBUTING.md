# Contributing to Artha

Thank you for your interest in contributing! Artha is MIT-licensed and community-driven.

## Getting Started

1. Fork the repo and clone locally
2. Install prerequisites: Node.js 22+, Ollama, Docker Desktop
3. `npm install` from the root
4. `npm run dev` to start the dev build
5. Make your changes, test locally, open a PR

## Areas We Most Need Help With

- **MCP server integrations** — GitHub, Notion, Calendar, Slack connectors
- **Document templates** — Better DOCX/PPTX styling and default layouts  
- **Hardware detection** — GPU VRAM detection on Windows/Linux for model recommendations
- **Testing** — Unit tests for the agent orchestrator and document generators
- **Windows/Linux compatibility** — Most dev happens on macOS; parity testing welcome

## Code Style

- TypeScript strict mode throughout
- No `any` types without a comment explaining why
- All IPC channels must be registered in `preload.ts` — never expose raw `ipcRenderer`
- New features touching the agent loop should include a description in `docs/architecture.md`

## Commit Convention

We use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

## Questions?

Open a GitHub Discussion or file an issue.
