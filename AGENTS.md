# **Project brief: Credit Runner (working title)**

A short, replayable endless-runner game that teaches young professionals how credit cards work. The player runs through a mall corridor across a 3-month simulation. Each month ends with decision screens (statement, repayment plan, unexpected expense, instalment offers) and a short quiz. All amounts, dates and offers are fictional.

Read this whole file before writing code. Build in the order given under "Milestones". Do not skip ahead.

---

## **1\. Stack**

| Layer | Choice | Notes |
| ----- | ----- | ----- |
| Language | TypeScript (strict) | `"strict": true`, no `any` without a comment |
| Build | Vite | Single-page app, no SSR needed |
| UI | React 18 | DOM overlays for all decision cards and HUD |
| Renderer | Three.js (direct, not R3F) | Game loop must not live in React state |
| State | Zustand | UI and session state only; per-frame values stay in plain objects |
| Finance logic | Pure TS package, zero dependencies | No React, no Three.js, no DOM imports |
| Validation | Zod | Scenario JSON schemas, runtime validated at load |
| Styling | Tailwind CSS \+ CSS variables for design tokens | Tokens match the mockups (green primary, cream cards, dark HUD) |
| Audio | Howler.js | Unlock on first tap |
| Persistence | IndexedDB via `idb` | Progress, settings, best scores |
| PWA | vite-plugin-pwa (Workbox) | Offline-first, installable |
| Native wrap | Capacitor | Android APK/AAB and iOS later; do not start until PWA is stable |
| Testing | Vitest (unit), Playwright (e2e) | Finance engine needs near-total coverage |
| Lint/format | ESLint \+ Prettier | Run in CI |
| Package manager | pnpm workspaces | Monorepo layout below |
| CI | GitHub Actions | lint, typecheck, test, build on every PR |
| Analytics | Thin `track(event, props)` interface | Console adapter now; vendor adapter later |
| Hosting | Any static host (Cloudflare Pages / Netlify / Vercel) | No backend in v1 |

No physics engine. Collision is custom AABB in lane space.

---

## **2\. Repo layout**

credit-runner/

  package.json

  pnpm-workspace.yaml

  tsconfig.base.json

  packages/

    finance-engine/        \# pure TS, no UI imports

      src/

        types.ts

        month-cycle.ts     \# state machine

        statement.ts

        repayment.ts       \# full / half / minimum / none

        interest.ts

        offers.ts          \# instalment offer evaluation

        events.ts          \# unexpected expenses

        scoring.ts

        index.ts

      test/

    scenarios/             \# content as JSON \+ zod schemas

      schema.ts

      data/

        starter-3-month.json

    game-core/             \# runner logic, no React

      src/

        loop.ts            \# fixed/clamped timestep

        track-generator.ts \# pooled chunks

        player.ts          \# lane, jump, roll, stumble state machine

        collision.ts       \# AABB

        input.ts           \# swipe \+ keyboard, with input buffering

        pools.ts

    ui/                    \# React components for HUD and decision cards

  apps/

    web/                   \# Vite app, wires everything together, PWA config

      src/

        scenes/            \# Three.js scene setup, horizon-curve shader

        screens/           \# Title, Run, Statement, PayPlan, Event, Offer, Quiz, Summary

        store/

        analytics/

        audio/

        persistence/

  docs/

    decisions.md           \# log of architectural decisions

Rule: dependencies point downward only. `apps/web` may import everything. `ui` may import `finance-engine` types. `finance-engine` imports nothing from the repo.

---

## **3\. Game design essentials**

**Session shape:** 3 months, roughly 60 to 90 seconds of running per month, then decision screens. Whole run about 6 to 8 minutes. Replayable with different scenarios.

**Month cycle (state machine):** `RUNNING` → `OFFER_CHECK` (optional, triggered by pickup) → `EVENT` (optional unexpected expense) → `STATEMENT_READY` → `PLAN_PAYMENT` → `MONTH_SUMMARY` → next month or `FINAL_QUIZ` → `RUN_SUMMARY`

**Runner mechanics:**

* 3 lanes, swipe left/right to change lane, swipe up to jump, swipe down to roll  
* Player stays near the origin; the world scrolls toward the camera  
* Coins give points. Points are a separate scale from rand and must never be displayed in a way that resembles currency  
* Obstacles (wet floor sign, cleaning cart) cause a stumble first, crash on second hit  
* A glowing shopping-bag pickup triggers an offer screen  
* Lane choices should affect the money model later (spend vs save lane); stub this, do not build it in v1

**Learning goals (each must map to a quiz question and a tracked event):**

1. Statement closing date vs payment due date  
2. Minimum payment avoids a missed payment but remaining debt can attract interest  
3. Interest-free period applies only when the full statement balance is paid by the due date  
4. Check total payable on instalment offers, not only the monthly amount  
5. Emergency savings vs borrowing for unexpected costs  
6. Credit utilisation as a guide, not a rule

**Rules for content:**

* Every screen with money shows a "fictional learning scenario" disclaimer  
* Do not label the best option "Recommended" before the player chooses. Reveal comparison after the choice  
* No real product names, rates, or quotations. Interest rate is a scenario parameter  
* Show concrete consequences, not "before applicable interest". After a minimum-only choice, show next month's balance computed by the engine

---

## **4\. Finance engine spec**

All money is integer cents internally. Display layer formats as `R1,240`.

Core types (starting point, refine as needed):

type Cents \= number;

interface ScenarioConfig {

  id: string;

  months: number;

  creditLimit: Cents;

  monthlyAfterEssentials: Cents;   // e.g. 190000

  existingCommitments: Cents;      // e.g. 57900

  emergencySavings: Cents;         // e.g. 50000

  minimumPaymentRate: number;      // e.g. 0.05

  monthlyInterestRate: number;     // scenario parameter, fictional

  statementCloseDay: number;

  paymentDueDay: number;

  events: ScenarioEvent\[\];

  offers: ScenarioOffer\[\];

}

interface MonthState {

  monthIndex: number;

  cardBalance: Cents;

  spendingAccount: Cents;

  emergencySavings: Cents;

  commitments: Cents;

  carriedForward: Cents;

  points: number;

}

type RepaymentChoice \= 'FULL' \| 'HALF' \| 'MINIMUM' \| 'NONE';

Required functions, all pure and deterministic:

* `buildStatement(state, purchases): Statement`  
* `minimumDue(statement, rate): Cents`  
* `applyRepayment(state, statement, choice): { next: MonthState; outcome: RepaymentOutcome }`  
* `projectAlternate(state, statement, choice): RepaymentOutcome` (powers the "What if I paid only the minimum?" toggle)  
* `evaluateOffer(offer, state): OfferImpact` (monthly cost, total payable, budget remaining)  
* `applyEvent(state, event, fundingSource): MonthState`  
* `scoreDecision(decision): number`

**Test fixtures from the mockups (must pass):**

* After essentials 1,900 − commitments 579 \= available 1,321  
* Card 760 \+ pharmacy 480 \= statement balance 1,240  
* Minimum \= 5% of 1,240 \= 62; remaining owed after minimum \= 1,178  
* Pay half \= 620; remaining 620  
* Spending account after full payment \= 1,321 − 1,240 \= 81  
* Utilisation \= 1,240 / 5,000 ≈ 25%  
* Offer: R250 × 12 \= R3,000 total; commitments 579 → 829; leaves 1,071 before card repayments

Property tests: balances never go negative unexpectedly; repayment never exceeds available funds without an explicit shortfall result; same input always yields same output.

---

## **5\. Scenario format**

Scenarios are JSON validated by Zod. A content author must be able to add a scenario without touching code. Include at least these variants after the starter:

* Instalment offer with fees (tests whether players check total cost)  
* Lower income, tighter budget  
* Two unexpected expenses in one month

---

## **6\. Analytics events**

Typed event union, sent through `track()`: `run_started`, `month_started`, `offer_viewed`, `offer_decision`, `event_viewed`, `event_funding_choice`, `statement_viewed`, `repayment_choice`, `alternate_outcome_toggled`, `quiz_answered` (with question id and correct flag), `run_completed`, `run_abandoned`, `scenario_replayed`.

No personal data. Session id is random and local.

---

## **7\. Technical rules**

1. Game loop runs on `requestAnimationFrame` with a clamped timestep. Never push per-frame values through React state  
2. Pool track chunks, obstacles, coins. Reuse vectors. No allocations in the hot path  
3. Use `InstancedMesh` for coins and repeated props  
4. Cap `devicePixelRatio` at 2\. Test on a low-end Android device  
5. Pointer events with `touch-action: none` and `overscroll-behavior: none` on the game surface  
6. Audio and vibration require a user gesture; add a "Tap to start" screen  
7. Respect `prefers-reduced-motion`; provide a non-runner "decisions only" mode  
8. Accessibility: all decision cards keyboard-navigable, proper roles and labels, contrast at AA or better, text scalable  
9. Every number shown in the UI comes from the finance engine. No arithmetic in components  
10. Mobile first: design at 390 px width, scale up

---

## **8\. Milestones**

Complete each one, with tests passing, before starting the next.

1. **Repo scaffold:** pnpm workspace, TS config, lint, Vitest, CI, empty packages  
2. **Finance engine:** types, month cycle, statement, repayment, interest, offers, events, with the fixtures above passing  
3. **Scenario schema \+ starter scenario:** Zod validation, loader, one 3-month scenario  
4. **Decision UI:** React screens for Statement, PayPlan, Event, Offer, Month Summary, Quiz, Run Summary, driven by the engine, no runner yet. This is a playable "decisions only" mode  
5. **Runner prototype:** Three.js scene, box player, 3 lanes, swipe/keyboard input, pooled chunk spawner, AABB collisions, stumble state  
6. **Integration:** runner triggers events and offers, month timer drives the cycle, HUD reads from the store  
7. **PWA:** manifest, service worker, offline cache, install flow, tap-to-start  
8. **Polish:** horizon-curve shader, audio, particles, mall art pass, reduced-motion mode  
9. **Analytics \+ persistence:** event adapter, IndexedDB saves, replay with scenario selection  
10. **Capacitor wrap:** Android APK for testing, then store builds; iOS via TestFlight

---

## **9\. Definition of done per milestone**

* Typecheck, lint and tests pass in CI  
* New behaviour has tests; the finance engine stays above 95% coverage  
* `docs/decisions.md` updated for any architectural choice  
* A short note in the PR describing what changed and how to run it

---

## **10\. Open questions (ask the owner, do not guess)**

* Final scenario rates and the compliance review process for copy  
* Points scale (must not resemble rand amounts)  
* Art direction and asset source (hand-modelled, kitbashed, or generated)  
* Whether lane choice should affect the money model in v1  
* Backend needs (accounts, leaderboards, organisation-level reporting)

