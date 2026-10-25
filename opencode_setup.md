# **opencode setup for Credit Runner**

## **1\. Files to place in the repo root**

* Save `AGENT_BRIEF.md` as `AGENTS.md` (opencode loads `AGENTS.md` automatically as project rules)  
* Add `opencode.json` (agents and commands, already written)  
* Replace the three `REPLACE_WITH_...` model IDs with real `provider/model` strings (run `opencode models` to list what your account exposes)

## **2\. Model routing (by risk, not by brand)**

| Role | Why | Suggested model |
| ----- | ----- | ----- |
| `engine` | Money logic; a wrong number teaches the wrong lesson | Strongest reasoning model (Opus 5.5) |
| `runner` | Performance-sensitive, fiddly 3D and input code | Your second-strongest coder |
| `ui` | High-volume React screens, lower risk | Faster, cheaper model |
| `reviewer` | Should not share blind spots with the author | A different model family from whoever wrote the code |

I can't speak to how astra6 or argon compare, so don't assign them on reputation. Run the same small task (milestone 2's `buildStatement` and `applyRepayment` plus tests) on each, then keep the model that passes the fixtures with the fewest retries and give it the `engine` role.

## **3\. Workflow**

1. Start in **plan** mode (Tab to switch) and ask for a plan for the milestone. Read it before approving.  
2. Switch to **build** and run `/milestone 1`, then `/milestone 2`, and so on.  
3. After milestone 2, run `/check-fixtures`.  
4. Commit after each green milestone. One milestone per session keeps context clean; start a fresh session for the next one.  
5. From milestone 4 onward, open the app yourself and compare against your mockups before moving on.

## **4\. Guardrails worth keeping**

* Keep the `reviewer` read-only (already set in the config)  
* Never let `ui` or `runner` edit `packages/finance-engine`; if they need a new function, they ask `engine`  
* Do not start Capacitor (milestone 10\) until the PWA passes on a low-end Android phone  
* Keep API keys out of the repo; there is no backend in v1, so none should be needed

## **5\. First prompt to paste (if you prefer not to use the command)**

> Read AGENTS.md fully. Implement milestone 1 only: pnpm workspace, strict TS config, ESLint, Prettier, Vitest, GitHub Actions CI, and empty packages matching the layout in section 2\. Do not write any game or finance code yet. Make sure `pnpm install`, `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass, then stop and summarise.

