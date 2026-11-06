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

## 2026-10-26 — Vercel deployment (services mode)

- `vercel.json` at the root defines one service, `web` (`apps/web`, Vite). A catch-all rewrite
  makes it public at `/`.
- The auto-detected `scenarios` service was dropped. `packages/scenarios` is a source-first
  library with no build step; `apps/web` bundles its JSON at build time through
  `import.meta.glob`. Deploying it separately would build nothing useful.
- No bindings: v1 has no backend, and no package makes HTTP calls to another. If a backend is
  added later (for example leaderboards or organisation reporting, both open questions), add it
  as an internal service and give `web`'s server-side functions a binding to it. Bindings are not
  available in the browser bundle or at build time.
- `engines.node` is `>=24.15.0`, not `>=26`. Vercel does not offer Node 26 yet and rejected the
  build. Every dependency supports Node 24; the strictest is jsdom (`^24.15.0`). We did not use
  `24.x`, because pnpm refuses to install when the running Node does not match the root
  `engines`, which would break local Node 26. `.nvmrc` and CI stay on Node 26.

## 2026-10-26 — Mall art pass (runner scene and app background)

A visual pass before milestone 6. Gameplay, finance logic, scenarios, copy, disclaimers, the HUD
and the pause, crash, retry and decisions-only flows are unchanged. Offers still open only from
the pause card, and there is still no month timer.

### Assets (`apps/web/src/assets/mall/`)

- `scripts/prepare-mall-assets.py` builds every runtime file from the untouched sources in
  `3D-assets/` and writes `manifest.json`. Rerun it rather than editing the outputs.
- Cut-outs get real alpha. The painted checkerboard is removed, including enclosed gaps, without
  losing real white or grey detail. Edge colour is decontaminated, resizing is premultiplied and
  colour bleeds into the padding, so there are no halos on light or dark backgrounds.
- 11 files, 459.6 KiB to download. Scene textures are about 10.8 MiB on the GPU, with mipmaps.
  Each background is about 3 MiB decoded, and only one is used at a time.

| File                                           | Size                 | Used for                       |
| ---------------------------------------------- | -------------------- | ------------------------------ |
| `coin.webp`                                    | 17.7 KiB             | `COIN` billboard               |
| `bucket.webp`                                  | 32.4 KiB             | `CART` (now a wheeled bucket)  |
| `wet-floor.webp`                               | 27.8 KiB             | `WET_FLOOR`                    |
| `plant.webp`, `bench.webp`, `sale-board.webp`  | 41.9, 40.2, 13.3 KiB | Side decor                     |
| `runner-atlas.webp`                            | 124.0 KiB            | Six-frame runner (800 × 984)   |
| `floor-tile.webp`, `floor-band.webp`           | 13.2, 2.5 KiB        | Generated floor and side bands |
| `mall-background-desktop.webp`, `-mobile.webp` | 81.7, 65.0 KiB       | CSS app background             |

- `floor.png` is a perspective illustration, so it can't be tiled. A seamless 2 × 2 cream tile
  (3.2 m square, 160 px per metre) and a 0.4 m terracotta and charcoal band were generated from
  its palette. The floor's u = 0 sits at x = laneWidth / 2, so grout lines fall on lane edges.
- The backgrounds come from `mall-background.png`, whose floor had a grey checkerboard painted
  in (an export artefact: real stone tiles survive only near the shopfronts). The owner chose to
  keep replacing those pixels with the generated floor in perspective; shops, pillars and benches
  are untouched. There is a 9:16 crop for phones and a 16:9 crop for wide screens.
  `mall-background.jpg` (HUD baked in) was removed.
- The coin is `coin-3d.png` exactly as supplied, emblem included (owner decision, 2026-11-06).
  Only its edges are cleaned and it is resized. The earlier plain-star replacement was dropped.
- The HUD uses the same art (2026-11-06). The script also writes two small DOM images, outside
  `assets/mall/` so the scene manifest and its pinned file list are unchanged:
  - `packages/ui/src/assets/coin.webp` (96 × 96, from `coin-3d.png`). `CoinIcon` is now a
    decorative `<img>` of it instead of the gold star SVG, in the HUD and on the offer screen.
    `packages/ui/src/assets.d.ts` types `*.webp` imports, since the UI package has no Vite types.
  - `apps/web/src/assets/art/runner-avatar.webp` (33 × 72, from the first runner atlas frame) for
    the timeline avatar. The hand-cropped `runner-avatar.png` it replaces was fully opaque, with a
    pale band baked into its lower rows, which showed as a strip under the avatar.
- The bench and bucket are drawn from above, so their far feet and wheels sit higher in the image
  than the near ones. Standing them on the lowest pixel left the far ones floating. The script's
  `ground_contact` finds each foot or wheel and puts the pivot on the highest one; the manifest
  records them as `groundContacts`. The near ones reach below the floor line (bench about 0.5 m,
  bucket about 0.3 m), so the floor is drawn first (`renderOrder = -1`) without writing depth, and
  those parts show over it.
- The sale board was rebuilt without text; its light-grey edge is the metal frame, not a halo.
  The bucket keeps its small "CAUTION" sticker. Shop signs stay text-free.
- These are prototype assets, not signed-off production art.
- `manifest.json` is in `.prettierignore` because Python's JSON output and Prettier disagree on
  short arrays. `mall-manifest.ts` validates it with a small hand-written parser (no Zod in the
  web app) and derives `rectQuad`, `propQuad` and `runnerQuads` from it.

### Scene

- Hybrid rendering: a real 3D corridor (floor, shopfronts on two levels with recessed glazed or
  display-bay entrances, balconies with glass rails, pillars, lamps, skylight ribs) plus
  camera-facing cut-out billboards. There is no screenshot or stretched backdrop.
- Cut-outs use `MeshBasicMaterial` (unlit, fogged), `alphaTest: 0.5`, `alphaToCoverage` and
  front faces only. Billboards turn to the camera with `yawToward`.
- Repeats are `InstancedMesh`. Atlas frames change by swapping prebuilt geometry with its own UVs;
  texture offsets are never mutated, so textures stay shared.
- Entity changes:
  - `CART` art is the wheeled bucket, normalised to 1.2 w × 1.5 h × 1.4 d with a ground pivot
    and a shadow decal. Its mechanics are unchanged.
  - `WET_FLOOR` art and hitbox are now 1.0 m tall (was 0.7 m), because at 0.7 m the sign could be
    mistaken for a coin. It has a puddle decal at hitbox width. The jump (velocity 8, gravity 24)
    peaks at 1.33 m and stays above 1.0 m for about 0.33 s, so it is still cleared by jumping. The
    procedural fallback model is scaled to the same height.
  - `COIN` keeps its entity, hitbox and points. It only faces the camera, bobs and shimmers, so
    its edge and mirrored back never show.
  - `BANNER` stays a hanging banner: teal cloth with a cream stripe on a charcoal rod with long
    cords, keeping its 1.1 m clearance readable.
  - The bag is emissive pink with a halo.
- Floor and bands scroll by moving their group (`position.z = distance % period`) instead of a
  texture offset. The strip runs one period past the far end, so the wrap has no seam or pop.
- Decor uses a hash of the slot index (`decorAt`), not the track's seeded RNG, so gameplay
  randomness is untouched. Every 8 slots hold 3 plants, 2 benches, 1 sale board and 2 gaps.
  Props sit at x 3.9 to 4.9, outside `propClearance` (2.8), so they never look like they block
  a lane.

### Runner sprite

- Frames come from alpha bounds, not equal cells, and are packed into a padded atlas with one
  ground pivot per cell. 460 px of standing height maps to 1.75 m.
- The run cycle follows distance (one cycle every 4.8 m), so it freezes when paused or crashed.
- The source has only run frames, so other poses are adapted:
  - Jump: frame 2 while rising, frame 5 while falling.
  - Roll: squashed to 55% height.
  - Stumble: a wobble (off with reduced motion) plus the grace-period flash.
  - Crash: the current frame held and tipped by 1.3 rad.
- `createRunnerFigure` keeps its contract; the procedural figure is still the fallback.

### Loading and lifecycle

- `preloadMallArt()` starts in `main.tsx`, outside the game loop. `RunScreen` takes
  `loadedMallArt()` when a run starts. Until the art has loaded, or if it fails (a warning is
  logged), the run uses the procedural mall, so visuals never swap mid-run and no hazard is ever
  invisible.
- Each scene clones the textures it uses (`cloneArtTextures`) and disposes only those clones, so
  StrictMode remounts and late callbacks can't break the shared source images.
- `?perf` shows a frame-time and draw-call readout (`frame-timer.ts`). It restarts when the loop
  resumes.
- The app background is static CSS: the mobile crop by default and the desktop crop at
  `min-aspect-ratio: 4/5`. Nothing animates behind decisions-only mode.

### Verification and follow-ups

- 404 tests in 38 files pass (39 new, including the `CoinIcon` image test). Coverage is unchanged: 100% statements, functions and
  lines, 99.8% branches.
- The main chunk is 911.8 kB (251.9 kB gzipped), 25.3 kB (11.3 kB gzipped) more than before.
- Real WebGL with `?perf` on a desktop GPU: 60 fps, avg 16.7 ms, p95 17.4 ms, 27 draws, 29.4k
  tris. Headless Chrome captures at 390 × 844 portrait, 1280 × 720 desktop and 844 × 390
  landscape confirm grounded props, no checkerboard, distinct wet-floor signs, and that the HUD
  coin and avatar load. (The points coin is hidden below `sm`, like every `StatPill` icon.)
- Still to do: frame times on a low-end Android device.

## 2026-11-06 — Milestone 6: integration

The runner now drives the month cycle. A month of running ends the shopping and opens the
statement, and the glowing bag opens the month's offer. The HUD reads its values from the store.

### Month timer

- A month runs for `MONTH_RUN_SECONDS = 75`, inside the brief's 60 to 90 seconds.
- `Session.runSeconds` banks the month's simulated seconds. It is capped at 75 and reset to 0 by
  `finishMonth`.
- Only simulation steps count, so paused and crashed time does not use up the month.
- `runSecondsLeft(session, unbanked)` and `isMonthRunOver(session, unbanked)` take the runner's
  unbanked `runner.time`. The loop can check the timer every step without writing to the store.

### Banking run progress

- `RunProgress` is `{ points, seconds }`. `bankRun` adds both to the session.
- Store actions: `bankRun`, `finishRun` (bank, then `endMonthRun`) and `openRunOffer` (bank, then
  `openOffer`). They replace the old points-only banking action.
- "Run again" after a crash banks the crashed run, then resets the runner. `resetRunner` zeroes
  `runner.time`, so those seconds are not counted twice. The pause and crash cards use
  `finishRun(progress())` and `openRunOffer(progress())`.

### Handing off from the loop

- `update` sets a local `handoff` (`'OFFER'` or `'FINISH'`) and skips further steps once set.
- `render` then stops the loop once and calls `handOffMonth` through `queueMicrotask`. It does
  nothing unless the phase is still `RUNNING`, so a late or repeated call is harmless.
- Stopping inside `render` is safe: `frame()` requests the next frame before it calls `update`
  and `render`, so `stop()` cancels that request. Stopping inside a step would not be.
- `sessionRef` gives the loop the latest banked time without re-creating the loop on each store
  change.
- `onBag` fires even when the bag is hidden, so `RunScreen` opens an offer only when the month
  still has one (`hasOfferRef.current`).

### HUD timeline and time left

- The timeline still runs from statement close (0) to payment due (1), and the runner does not
  move the avatar. All of a month's shopping happens before the statement closes; moving the
  avatar during the run would suggest shopping time counts toward the due date, which undercuts
  learning goal 1 (closing date vs due date).
- A separate "Shopping time left" readout (`role="timer"`) shows the month timer.
  `wholeRunSecondsLeft` rounds up, so it reads 0:00 only when time is up, and
  `formatRunTimeLeft` gives "1:15".
- The loop writes the readout's text only when the whole second changes. React renders no
  children in that element, so React and the loop never write to the same node, and no per-frame
  value goes through React state.

### Verification and follow-ups

- 416 tests in 39 files pass, including the new `run-timer.test.ts` and store tests for
  `bankRun`, `finishRun` and `openRunOffer`. Typecheck, lint and the format check are clean.
- Still to do: a `RunScreen` test for the bag-to-offer and timer-to-statement handoffs, and a
  hand check in the browser of a full 75-second month.
