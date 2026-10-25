# Architectural decisions

Newest entries at the bottom. Each entry: date, decision, reason.

## 2026-10-25 — Milestone 1: repo scaffold

### Toolchain versions

- Node 26 (`.nvmrc`), pnpm 12.15.0 pinned via `packageManager`.
- **TypeScript 6.0.3, not 7.x.** TypeScript 7.0.2 is the latest release, but the latest stable
  `typescript-eslint` (8.72.0) supports only `>=4.8.4 <6.1.0`. Type-aware linting is part of the
  quality bar, so we stay on 6.0 until `typescript-eslint` supports 7. The version lives in the
  pnpm `catalog` in `pnpm-workspace.yaml`, so upgrading is a one-line change.
- ESLint 10 (flat config), Vitest 5 with V8 coverage, Prettier 3, Vite 8.

### Source-first internal packages

Workspace packages export `./src/index.ts` directly and have no build step. Vite, Vitest and `tsc`
(with `moduleResolution: "Bundler"`) all consume TypeScript source. This removes a build/watch
step between packages. Only `apps/web` produces a build artefact. Revisit if a package is ever
published or consumed outside this repo.

### One Vitest run at the root

A single `vitest.config.ts` at the root collects tests from every package. This gives one coverage
report and lets the finance-engine 95% threshold be set as a per-path threshold. Packages that later
need a different environment (for example `jsdom` for UI tests) can be split into Vitest
`projects`.

### Enforcing the dependency direction

Allowed workspace dependencies:

| Package          | May depend on                        |
| ---------------- | ------------------------------------ |
| `finance-engine` | nothing in the repo                  |
| `scenarios`      | `finance-engine`                     |
| `game-core`      | nothing in the repo                  |
| `ui`             | `finance-engine` (type imports only) |
| `apps/web`       | everything                           |

`scenarios -> finance-engine` is an interpretation: scenario schemas need the engine's
`ScenarioConfig` and related types. Enforcement is layered:

1. pnpm's strict `node_modules` means a package cannot import anything not listed in its own
   `package.json`.
2. `@typescript-eslint/no-restricted-imports` rules in `eslint.config.js` block forbidden workspace
   imports and React/Three.js where they do not belong. `ui` may only use `import type` from
   `finance-engine`.
3. `finance-engine` and `scenarios` compile with `lib: ["ES2023"]` and no DOM types, so DOM usage
   fails typecheck.

### Strictness

`tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`verbatimModuleSyntax`, and unused-locals/parameters checks. `any` is a lint error
(`@typescript-eslint/no-explicit-any`); an intentional `any` needs an
`eslint-disable-next-line` comment explaining why.

## 2026-10-25 — Milestone 2: finance engine

### Money and rounding

- All amounts are integer cents. Every public function validates its inputs with guards in
  `guards.ts` and throws a `RangeError` on bad data, so wrong input fails loudly.
- Rounding rules:
  - The minimum payment rounds **up** to the cent and is capped at the balance.
  - "Pay half" rounds **up** and is never less than the minimum.
  - Interest rounds half-up.
- A small epsilon in `money.ts` absorbs floating-point noise (for example `124000 * 0.05`) so it
  cannot move a result by a whole cent.
- `formatRand` displays `R1,240` for whole rands and `R1,201.56` otherwise.

### Additions to the brief's types

- `ScenarioConfig.latePaymentFee`: a fictional fee charged when less than the minimum is paid. This
  makes "minimum payment avoids a missed payment" (learning goal 2) concrete.
- `MonthState.monthlyAfterEssentials` and `MonthState.instalments`. `evaluateOffer(offer, state)`
  needs the monthly budget, and accepted instalments must count down and drop off.

### Signature change: `buildStatement(state, purchases, terms)`

The brief lists `buildStatement(state, purchases)`. The minimum rate, credit limit and dates live
in the scenario, not in the month state. Rather than copy them into every `MonthState`, the caller
passes `StatementTerms` (built with `statementTerms(config)`). Each statement keeps a copy of its
terms, so `applyRepayment` and `projectAlternate` keep the brief's signatures.

### Simplified interest model

- Paying the full statement balance by the due date means no interest.
- Otherwise, a flat fictional monthly rate applies to what is still owed after the repayment.
- Interest and any late fee are posted when the repayment is applied, so the next month opens with
  a concrete balance (content rule: "show concrete consequences").
- There is no daily compounding or backdated interest on purchases. That is deliberate, for
  teaching, and the rate is a scenario parameter.

### Funds and shortfalls

- Repayments come only from the spending account and never exceed it. Any gap is returned as an
  explicit `shortfall`, and paying below the minimum counts as a missed payment.
- An unexpected expense is paid from the chosen source as far as it can cover it. The rest goes on
  the card, and `fellBackToCard` reports this.
- `startNextMonth` pays in the month's money and deducts commitments. If commitments exceed the
  available money, the spending account stops at zero and the gap is reported as
  `budgetShortfall`.

### Offers

Accepting an offer adds its monthly cost (instalment plus monthly fee) to commitments from the next
month and charges any upfront fee to the card. `totalPayable` and `extraCostVsCash` include every
fee (learning goal 4).

### Two state machines

- `MonthState` plus the pure functions model the money.
- `CycleState` plus `transition()` model the screen flow from AGENTS.md section 3.

Keeping them separate lets the UI drive screens without coupling them to the money calculations.
Invalid transitions throw `InvalidTransitionError`, and `canTransition` checks a move without
throwing.

### Scoring

`DECISION_SCORES` holds placeholder point values until the owner decides the points scale (open
question). Points are a plain number and are never formatted as currency.

### Property tests without a new dependency

The property tests use a small seeded generator (mulberry32) in `test/helpers.ts` instead of adding
`fast-check`. Runs are reproducible from their seed, and the checks cover:

- no negative balances,
- payments never exceed available funds,
- every cent of an expense is accounted for,
- determinism across whole multi-month simulations.

## 2026-10-25 — Milestone 3: scenario schema and starter scenario

### File format

Each scenario is one JSON file in `packages/scenarios/data/`:

```json
{ "schemaVersion": 1, "title": "...", "summary": "...", "config": { ...ScenarioConfig } }
```

- `config` matches the engine's `ScenarioConfig` exactly, including `latePaymentFee`.
- `title` and `summary` are display copy for the scenario picker, kept outside `config` so the
  engine never sees content text.
- `schemaVersion` lets a later build reject (or migrate) files it does not understand.

### Validation (Zod 4)

- Schemas live in `packages/scenarios/src/schema.ts` and mirror the engine guards: whole,
  non-negative cents; rates from 0 to 1; days 1 to 31; at least one month; a positive credit limit.
- Objects are strict, so a misspelt field (`creditLimt`) is an error instead of being silently
  dropped.
- Cross-field rules: commitments cannot exceed the monthly money after essentials; events and
  offers must fall inside the scenario's months; event and offer ids must be unique (they share one
  namespace so analytics and saves can refer to either).
- `parseScenario` reports **every** problem at once as `ScenarioValidationError`, one line per
  issue with its field path, so an author can fix a file in one pass. It then runs the engine's
  `validateScenarioConfig` as well, so the schema and engine cannot drift apart silently.

### Adding a scenario without code changes

`registry.ts` uses Vite's `import.meta.glob('../data/*.json', { eager: true })`. Any new JSON file
in `data/` is bundled and validated at load time, and an invalid file fails loudly with its file
name. Vitest runs on Vite, so the same mechanism works in tests. The package compiles with
`types: ["vite/client"]` for the `import.meta.glob` typings, and `vite` is a dev dependency of
`scenarios` (type-only; Vite is not imported at runtime).

### Starter scenario

`starter-3-month.json` uses the mockup figures (R1,900 after essentials, R579 commitments, R500
savings, R5,000 limit, 5% minimum) plus fictional terms: 2% monthly interest and a R150 late fee.
It has one unexpected expense per month and two instalment offers (fee-free). The tests check the
mockup fixtures against this file and that a cautious full-payment run has no shortfalls. The
other scenario variants from AGENTS.md section 5 come later.

## 2026-10-25 — Milestone 4: decision UI ("decisions only" mode)

### Where the brief and the mockups disagree, the brief wins

- No option is labelled "Recommended". The full comparison of choices appears only after the
  player confirms (offer, event and repayment screens).
- No "before applicable interest or fees" wording. After a choice, the month summary shows the
  engine's concrete figures, including next month's opening balance with interest.
- Product-quotation wording from the mockups is dropped; everything is a fictional scenario.

### Engine additions for the screens

- `ScenarioConfig.startMonth` and `purchases` (card spending per month), so statements have real
  dates and charges without the runner.
- `Statement.closeDate` and `dueDate`. The due date is the next `paymentDueDay` after the close
  day, computed with plain integer calendar maths (no `Date` or `Intl`, so it is deterministic).
- Formatters: `formatPoints` ("340 pts", no currency sign or separator), `formatPercent` (rates
  from 0 to 1) and `formatWholePercent` for engine-computed whole percentages such as
  utilisation. The last one allows values above 100%, because a balance can go over the limit.
- `RunRecord` and `RunSummary` collect decisions across the run for the summary screen.

### Layering

- `packages/ui` is presentational only: components take display-ready strings. It imports
  nothing at runtime from the engine.
- `apps/web/src/session/session.ts` is a pure module that drives the engine and both state
  machines. Screens call its helpers and the engine formatters; they do no arithmetic.
- `apps/web/src/store/game-store.ts` is a thin Zustand wrapper around the session functions.
- Quiz content lives in `apps/web/src/content/quiz.ts`: one question per learning goal, with no
  amounts in the text so it cannot drift from the engine.

### Screen flow and accessibility

- One screen per cycle phase, plus a title screen. `screenKey(session)` keys the phase screen so
  each new screen remounts and its `h1` takes focus.
- Offer and event screens keep the choice in local state, reveal the result in a `status`
  Callout after confirming, then dispatch to the store. The pay plan confirms straight to the
  store; the month summary shows the comparison and a "What if I paid only the minimum?" toggle
  (hidden when the player already paid the minimum).
- `ChoiceGroup` uses a real `fieldset` of radio inputs and disables it with `fieldset disabled`
  once a choice is confirmed. Every money screen renders the `Disclaimer` (role `note`).

### Tests

- `session.test.ts` checks the mockup fixtures through the session flow and plays a full run.
- `App.test.tsx` (jsdom, opted in per file) plays month 1 through the real screens and checks the
  disclaimer, the absence of "Recommended", and that comparisons appear only after confirming.
- Vitest occasionally times out starting a jsdom worker on Windows on a cold start; a rerun
  passes. If this becomes frequent, raise the pool start-up timeout rather than skipping tests.

## 2026-10-25 — Decision screens restyled to the `art-direction/` mockups

### Mockups vs brief

- Layout, colours, icons and spacing follow the mockups one-to-one. Where a mockup conflicts with
  the brief, the brief wins: no "Recommended" badge, no "before applicable interest or fees"
  wording (we say "is charged interest"), no product-quotation copy and no real brands.
- Comparisons and interest figures stay hidden until the player confirms. On the offer and event
  screens this adds a Confirm step that the mockups do not show; it is the only deliberate
  difference from `check-offer-screen.png`.
- The pay plan follows `choose-your-repayment-screen.png`; `repayment-screen.png` is not used.
- The title and month screens have no mockup, so they reuse the shared visual language.

### Screens

- **Offer:** `tag` badge, sofa card plus "Your budget impact" card, `tiles` radios ("Take the
  offer" / "Not this month"). "Compare the commitment" is a `ToggleTile` that reveals an
  `InfoCard`. The result `Callout` tone depends on the outcome (solid when declined; danger on a
  shortfall, warning when dearer than cash, otherwise card).
- **Event:** red alert badge, `OptionCard`s for savings (green) and card (amber). Choosing locks
  the option, then shows the result and Continue.
- **Month summary** (`see-the-consequence-screen.png`): character art, headline panel, value list
  beside an "essentials covered" card, and the "What if I paid only the minimum?" `Switch`. "Review
  your plan" toggles the comparison (`aria-expanded`).
- **Finish** (`finish-with-understanding-screen.png`): one `FinishScreen` covers FINAL_QUIZ and
  RUN_SUMMARY. `screenKey` maps both to the same key so it does not remount between them. Quiz
  options use `aria-pressed`, lock once answered and reveal an explanation in a `status` region.
  Quiz text uses `{statementCloses}`/`{paymentDue}` placeholders filled from the engine's dates.
  The store auto-completes the quiz after the last answer. `QuizScreen` and `RunSummaryScreen`
  were removed.
- Points display as "1240 pts" with a coin icon: no separator, so they never resemble rand.

### UI primitives

- Icons are inline SVGs in `packages/ui/src/Icon.tsx`. `IconTile` has five tones and a
  `shape` of `square` or `round`.
- New `Switch` (`role="switch"`, `aria-checked`, `aria-controls`); `ValueRow` gained `hint` and
  `unit`; `Hud` gained `monthNote` and `complete` (the bar fills and shows "Simulation complete").
- Scenario art is mapped by scenario ID in `apps/web/src/screens/art.ts`, with an icon-tile
  fallback, so new scenarios work without art.
- Tailwind 4 uses the suffix important syntax (`px-4!`).

### Verification

- CM Browser driving became unreliable (stale refs on every click, empty screenshots), so the
  flow was verified through `App.test.tsx` and by comparing each screen's code with its mockup.
- The Vitest forks pool times out starting workers on this Windows machine; `--pool=threads`
  runs reliably and is used for local runs.

## 2026-10-26 — Milestone 5: runner prototype

### Game core (`packages/game-core`, no React or Three.js)

- Lane space: x runs across the lanes (`laneWidth` 1.6), y is up and z is the distance ahead. The
  player stays at z = 0 and the world scrolls toward it.
- Loop: fixed step of 1/60 s, frames clamped to 0.1 s, with `STEP_EPSILON = 1e-9`. The render
  callback gets an interpolation `alpha`, so motion stays smooth between steps.
- Track: seeded (mulberry32) and pooled, with 8 chunks of 24 m and 96 entities. The first chunk
  holds only coins. Every 10th chunk is `OFFER_PATTERN`, with the bag in lane 1, and
  `TrackPattern.offerLane` marks the pink lane.
- Obstacles: `WET_FLOOR` is jumped, `BANNER` is rolled under (its bottom is at 1.1 m) and `CART`
  needs a lane change. Collision is custom AABB, with no physics engine.
- Hits: the first hit is a stumble (0.7× speed for 4 s). A second hit during the stumble is a
  crash. Hits within 0.8 s of the first are ignored.
- Input: swipes and arrow keys, with one buffered action, so a swipe made mid-jump still counts.
- The app hooks in through `RunnerEvents` (`onCoin`, `onStumble`, `onCrash`, `onBag`). Per-frame
  values stay in plain `RunnerState` objects.
- ESLint bans React and `three` in `game-core`. Its coverage is 100%.

### Scene (`apps/web/src/scenes`)

- The existing art can't be used in 3D:
  - `mall-background.jpg` has the HUD baked in.
  - `character-back.png` is cut off at the legs.
- The mall and the runner are therefore low-poly geometry that follows `gameplay-screen.png`:
  - Tiled floor, white lane lines and the pink offer lane.
  - Shopfronts on two levels, balconies, pillars, lamps and a skylight.
  - Coins, wet-floor signs, cleaning carts, sale banners and the glowing bag.
  - A green-shirt runner seen from behind.
- Signs have no text and show no real brands.
- Each entity kind is one merged, vertex-coloured `InstancedMesh`, so it costs one draw call.
- Decor scrolls in a seamless loop, and the floor texture's offset scrolls with it.
- Frames don't allocate: scratch objects are reused and instance matrices are written in place.
- DPR is capped at 2.
- `createMallScene` throws when WebGL is unavailable. The run screen then offers decisions-only
  play, which also keeps the jsdom tests working without WebGL.

### Run screen and store

- `RunScreen` owns the scene, simulation and loop in refs, created and disposed in an effect, which
  handles StrictMode's double mount. React state holds only the overlay, the stumble notice and
  the coin points.
- The offer label follows the bag through a DOM transform, written only when its position changes.
- The game surface has `touch-action: none` and `overscroll-behavior: none`.
- Pausing:
  - The pause button, Escape or P pause the run, and so does hiding the tab.
  - The pause card has Resume, "See the offer" (when there is one) and "Finish shopping".
  - The crash card has "Run again" and "Finish shopping".
- The store has a `mode` (`RUNNER` or `DECISIONS`). `start(mode?)` keeps the current mode when
  replaying, and `setMode` switches without ending the run.
- The title screen has "Start running" and "Decisions only".
- Coin points are banked through the engine's `awardPoints` (`bankRunPoints`, `finishRun`,
  `openRunOffer`). The HUD shows the banked points plus the unbanked coins.
- In this milestone the bag is a visual marker; the offer opens from the pause card. Automatic
  triggers from the runner, and a month timer, belong to milestone 6.

### Verification and follow-ups

- 365 tests pass. Statements, functions and lines are at 100% coverage, branches at 99.8%.
- CM Browser couldn't take screenshots, so the scene hasn't been compared visually with
  `gameplay-screen.png` yet. It still needs a check in a real browser and on a low-end Android
  device.
- With Three.js the main chunk is about 887 kB (241 kB gzipped), so Vite warns about chunk size.
  Code-splitting the run screen with `import()` is planned for the PWA milestone.
