# Credit Runner

An endless-runner game that teaches young professionals how credit cards work. All amounts, dates
and offers are fictional. See `AGENTS.md` for the full brief and `docs/decisions.md` for the
architectural decision log.

## Requirements

- Node 26 (see `.nvmrc`)
- pnpm 12 (`npm install -g pnpm@12.15.0`)

## Commands

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `pnpm install`       | Install all workspace dependencies             |
| `pnpm dev`           | Start the web app dev server                   |
| `pnpm lint`          | ESLint across the repo (zero warnings allowed) |
| `pnpm typecheck`     | `tsc` for every package                        |
| `pnpm test`          | Run all Vitest tests once                      |
| `pnpm test:coverage` | Tests with coverage and thresholds             |
| `pnpm build`         | Production build of `apps/web`                 |
| `pnpm format`        | Format with Prettier                           |
| `pnpm format:check`  | Check formatting (used in CI)                  |

## Layout

```
packages/finance-engine  pure TS money logic (no UI, DOM or Three.js)
packages/scenarios       scenario JSON + Zod schemas
packages/game-core       runner logic (no React)
packages/ui              React HUD and decision cards
apps/web                 Vite app that wires everything together
docs/decisions.md        architectural decision log
```
