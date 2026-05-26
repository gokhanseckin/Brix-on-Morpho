# Assignment Slides Math-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the `/assignment` slide deck to reflect three new ground truths (1-day drawdown, liquidator exit menu beyond AMM, rTarget as binding parameter) without touching any other code.

**Architecture:** All slide JSX lives in one file (`app/assignment/page.tsx`). Phase 1 runs a one-off script that calls `simulateBadDebt` directly with canonical inputs to capture fresh 1-day bad-debt numbers for slide 13. Phase 2 dispatches 7 parallel Sonnet sub-agents (one per changing slide) as **text generators** — each returns a new JSX block between sentinels rather than calling `Edit` on the shared file. The main session then applies all 7 edits sequentially with the `Edit` tool. Phase 3 verifies via lint + tests + build + visual spot-check.

**Tech Stack:** Next.js 14 (static export), React, TypeScript strict, vitest, Playwright. Plan-time tooling: `tsx` for the script, the `Agent` tool with `subagent_type: "claude"` and `model: "sonnet"` for the slide writers.

**Source spec:** `docs/superpowers/specs/2026-05-26-assignment-slides-math-refresh-design.md`

**Branch:** `chore/assignment-slides-math-refresh` (already created, off `main` at `2a699fe`).

**Worktree:** `/Users/gokhanseckin/claude-projects/Brix-Morpho/.claude/worktrees/elated-johnson-b864ae` — all commands assume this is `pwd`.

---

## Task 1: Pre-flight check

**Files:** none modified.

- [ ] **Step 1: Confirm worktree, branch, and clean state.**

Run:
```bash
git status --short && git branch --show-current
```
Expected:
```
?? docs/superpowers/plans/2026-05-26-assignment-slides-math-refresh.md
chore/assignment-slides-math-refresh
```
(The plan file is untracked because it was just written. No other modified files.)

If anything else shows up modified, stop and investigate before proceeding.

- [ ] **Step 2: Confirm the deck file exists at the expected length.**

Run:
```bash
wc -l app/assignment/page.tsx
```
Expected: `1307 app/assignment/page.tsx` (matches the gap-audit baseline).

---

## Task 2: Write the slide-13 simulator script

**Files:**
- Create: `scripts/slide13-baddebt.mts`

- [ ] **Step 1: Create the script.**

Write to `scripts/slide13-baddebt.mts`:

```ts
/**
 * One-off calibration script for slide 13 of /assignment.
 *
 * Runs simulateBadDebt with the canonical sidebar defaults to capture
 * fresh 1-day-drawdown bad-debt P95 numbers (with and without pre-liq).
 *
 * Inputs mirror lib/useUrlState.ts defaults verbatim — change them here
 * only if the sidebar defaults change.
 *
 * Run: npx tsx scripts/slide13-baddebt.mts
 */
import { blockBootstrapPaths } from '../lib/fxModel';
import { loadFxRows, windowRows, dailyLogReturns } from '../lib/fxData';
import {
  simulateBadDebt,
  buildPreLiquidationScenario,
  sampleBetaLtvFractions,
} from '../lib/simulator';
import { buildLadderFromInputs } from '../lib/poolPreset';

// Sidebar defaults (lib/useUrlState.ts, 2026-05-26)
const DEFAULTS = {
  witryTVL_USD: 5_000_000,
  lltv: 0.86,
  borrowerLTVAlpha: 4.6,
  borrowerLTVBeta: 2,
  witryYieldAnnual: 0.38,
  usdtryBaseline: 45,
  historicalPeriod: 5,
  simulationHorizonDays: 30,
  pathCount: 1000,
  seed: 42,
  preLLTVOffset: 0.05,
  preLCF1: 0.05,
  preLCF2: 0.5,
  preLIF1: 1.01,
  poolFeeTier: 3000,
  poolTVL_USD: 500_000,
  bandSplitCore: 0.3,
  bandSplitAbsorb: 0.5,
  bandCoreLowerPct: -0.05,
  bandCoreUpperPct: +0.05,
  bandAbsorbLowerPct: -0.15,
  bandAbsorbUpperPct: -0.05,
  bandTailLowerPct: -0.9,
  bandTailUpperPct: +0.3,
} as const;

const BORROWER_POPULATION_SAMPLES = 1000;
const BOOTSTRAP_BLOCK_LENGTH_DAYS = 5;
const DEFAULT_GAS_COST_USD = 5;

function run(preLiqEnabled: boolean) {
  const rows = windowRows(loadFxRows(), DEFAULTS.historicalPeriod);
  const returns = dailyLogReturns(rows);
  const paths = blockBootstrapPaths({
    returns,
    blockLength: BOOTSTRAP_BLOCK_LENGTH_DAYS,
    S0: DEFAULTS.usdtryBaseline,
    horizonDays: DEFAULTS.simulationHorizonDays,
    paths: DEFAULTS.pathCount,
    seed: DEFAULTS.seed,
  });
  const ltvFractions = sampleBetaLtvFractions({
    alpha: DEFAULTS.borrowerLTVAlpha,
    beta: DEFAULTS.borrowerLTVBeta,
    n: BORROWER_POPULATION_SAMPLES,
    seed: DEFAULTS.seed,
  });
  const spot = 1 / DEFAULTS.usdtryBaseline;
  const preset = buildLadderFromInputs(spot, DEFAULTS as never);
  const out = simulateBadDebt({
    paths,
    ltvFractions,
    lltv: DEFAULTS.lltv,
    tvl_USD: DEFAULTS.witryTVL_USD,
    preset,
    spot,
    gasCost_USD: DEFAULT_GAS_COST_USD,
    witryYieldAnnual: DEFAULTS.witryYieldAnnual,
    preLiquidation: buildPreLiquidationScenario({
      enabled: preLiqEnabled,
      lltv: DEFAULTS.lltv,
      preLLTVOffset: DEFAULTS.preLLTVOffset,
      preLCF1: DEFAULTS.preLCF1,
      preLCF2: DEFAULTS.preLCF2,
      preLIF1: DEFAULTS.preLIF1,
    }),
  });
  const pctOfPathsWithAnyBadDebt =
    out.badDebtByPath.filter((v) => v > 0).length / out.badDebtByPath.length;
  return {
    p95_USD: out.badDebtP95_USD,
    p95_pct: out.badDebtP95Pct,
    anyBadDebtRate: pctOfPathsWithAnyBadDebt,
  };
}

const off = run(false);
const on = run(true);

const fmt = (v: number, digits = 2) => v.toFixed(digits);
console.log('=== slide-13 calibration ===');
console.log(`canonical inputs: LLTV ${DEFAULTS.lltv}, TVL $${DEFAULTS.witryTVL_USD.toLocaleString()},`);
console.log(`historical window ${DEFAULTS.historicalPeriod}y, horizon ${DEFAULTS.simulationHorizonDays}d,`);
console.log(`paths ${DEFAULTS.pathCount}, seed ${DEFAULTS.seed}`);
console.log('');
console.log('PRE-LIQ OFF:');
console.log(`  P95 bad debt: $${off.p95_USD.toLocaleString()} (${fmt(off.p95_pct * 100)}% of TVL)`);
console.log(`  paths with any bad debt: ${fmt(off.anyBadDebtRate * 100, 1)}%`);
console.log('');
console.log('PRE-LIQ ON:');
console.log(`  P95 bad debt: $${on.p95_USD.toLocaleString()} (${fmt(on.p95_pct * 100)}% of TVL)`);
console.log(`  paths with any bad debt: ${fmt(on.anyBadDebtRate * 100, 1)}%`);
```

- [ ] **Step 2: Add `scripts/` to `.gitignore` exemptions? No — commit the script.**

Verify there's no existing `scripts/` dir convention that excludes it:
```bash
test -d scripts && ls scripts || echo "scripts dir does not exist yet"
```
Either result is fine. The new file lives at `scripts/slide13-baddebt.mts`.

---

## Task 3: Run the script and capture numbers

**Files:** none modified (output captured to a comment).

- [ ] **Step 1: Execute the script.**

Run:
```bash
npx tsx scripts/slide13-baddebt.mts 2>&1 | tee /tmp/slide13-output.txt
```

Expected: ~5–15 seconds runtime; output contains two "PRE-LIQ OFF" / "PRE-LIQ ON" blocks with USD amount, % of TVL, and any-bad-debt rate.

If the script errors on imports, the most likely cause is `tsx` not interpreting the `@/` path alias. Fall back to relative imports (already used above) — if errors persist, inspect:
```bash
npx tsx --version
```
and ensure it's installed (`npm i -D tsx` if missing).

- [ ] **Step 2: Manually record the numbers in the plan execution notes.**

Write the output verbatim into the task notes for use in Task 6. The slide-13 agent prompt will reference these numbers.

- [ ] **Step 3: Thesis sanity check.**

The spec's slide-9 conclusion is "very low bad debt risk if the three exit paths are available." Slide 13's role is to show how pre-liq reduces bad debt vs. baseline.

Sanity gate:
- If **PRE-LIQ ON · P95 bad debt %** is < 1% AND **PRE-LIQ OFF** is materially higher (> 2× ON), the thesis holds — proceed.
- If numbers contradict the thesis (e.g. ON ≥ OFF, or ON is itself > 3%), **STOP** and report to the user. Do not dispatch the slide-13 agent until the discrepancy is resolved.

- [ ] **Step 4: Commit the script.**

```bash
git add scripts/slide13-baddebt.mts docs/superpowers/plans/2026-05-26-assignment-slides-math-refresh.md
git commit -m "$(cat <<'EOF'
chore(scripts): add slide-13 bad-debt calibration script + impl plan

One-off calibration. Reproduces the simulator's bad-debt cascade with
the canonical defaults so slide 13's numbers can be refreshed under the
1-day drawdown window. Run via: npx tsx scripts/slide13-baddebt.mts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Capture current slide source for each changing slide

**Files:** none modified (data captured to memory / agent prompts).

- [ ] **Step 1: Extract the exact line ranges and source text for the 7 changing slides.**

Run:
```bash
grep -n "^  {$" app/assignment/page.tsx | head -20
```

Expected output (slide-object opening braces):
```
120:  {
150:  {
171:  {
229:  {
268:  {
328:  {
376:  {
419:  {
488:  {
592:  {
641:  {
688:  {
756:  {
805:  {
```

The line ranges for each changing slide:
- **Slide 5 (Attracting liquidity):** lines 268–326 (slide-5 starts at 268, slide-6 starts at 328 → slide-5 ends at 326)
- **Slide 8 (Liquidations):** lines 419–486
- **Slide 9 (5× rule → retitled):** lines 488–589
- **Slide 10 (Slippage & pool sizing):** lines 592–639
- **Slide 12 (Profitable liquidations + parameters):** lines 688–754
- **Slide 13 (Pre-liquidations):** lines 756–803
- **Slide 14 (Recap + next steps):** lines 805–848

- [ ] **Step 2: Read each block into a known string variable for the agent prompts.**

For each slide, run `Read` on the file with the offset/limit pair above. Hold the verbatim source for the next task — every agent prompt must contain the exact current source as ground truth.

(If executing inline, skip the explicit extraction — just reference the line ranges in each agent prompt and let the agent re-read the file.)

---

## Task 5: Dispatch 7 parallel slide-writer agents

**Files:** none modified (agents return text, not edits).

- [ ] **Step 1: Build the shared "common context" block** — included verbatim in every agent prompt.

```
COMMON CONTEXT (same for every slide agent)
============================================

You are rewriting ONE slide block in app/assignment/page.tsx for the
Brix-Morpho /assignment deck.

DO NOT use Edit, Write, or any file-modifying tool. Your final response
MUST be the new JSX slide object, bracketed by these exact sentinels on
their own lines:

<<<SLIDE_START>>>
  { ... slide object literal ... }
<<<SLIDE_END>>>

No commentary outside the sentinels. The block between the sentinels is
what the main session will paste verbatim into the file.

Three new ground truths the deck must reflect:

1. Drawdown window is **1-day** (was 3-day). Anywhere the deck says "3-day"
   referring to a TRY drawdown, change to "1-day".

2. 90% IRM kink is **soft**, not a hard ceiling. Borrow rate keeps rising
   above 90% (exponential, continuous in lib/morphoMath.ts). Above-kink is
   intentional: lender yield rises, and Merkl + Brix rewards subsidize
   borrowers through the steep zone so loops stay profitable vs holding
   wiTRY.

3. AMM is **not the only liquidator exit**. Three paths exist:
   - AMM swap on Kumbaya (slippage 1% calm, 3–4% stress)
   - wiTRY vault redemption (small fee, can be subsidized for liquidators)
   - Long-USD-3d cooldown hedge (only cost: funding rate)
   → Bad-debt risk no longer pins to AMM depth alone.

4. **rTarget (IRM rate at target utilization) is the real binding
   parameter.** Morpho market params are immutable post-deploy. rTarget = 4%
   default. It must keep borrowing profitable for loopers at 85–90%
   utilization *even without rewards* — otherwise borrowers migrate to a
   parallel vault with lower rTarget and our utilization collapses.

Style guardrails:
- Match the existing slide voice: terse, declarative, no marketing fluff.
- Reuse the existing component primitives only: Card, H1, H2, Body,
  Kicker, Tag, Accent, SL, Footnote, NumberBlock, StatusPill,
  IncentiveLayer, SlippageTable. DO NOT introduce new components, new
  imports, or new Tailwind utilities not already used in the file.
- Use <Accent>…</Accent> for load-bearing numbers and concepts.
- Use <SL n={N}>…</SL> for cross-slide references.
- Preserve the slide's existing `id` string. The slide's slot index (its
  position in the slides array) is also preserved.
- If you keep parts of the current source verbatim, that is fine and
  encouraged — only change what the brief calls out.

Non-goals (DO NOT touch):
- Any file other than the slide block you are returning.
- Slide ordering, IDs, or count.
- Component definitions, helpers, or the deck shell (`Deck`, `slides`
  array wiring, keyboard handlers).
```

- [ ] **Step 2: Per-slide briefs.**

For each slide, the agent's full prompt = `COMMON CONTEXT` + `SLIDE-SPECIFIC BRIEF` + the verbatim current source from Task 4.

**Slide 5 (Attracting liquidity, lines 268–326):**
```
SLIDE-SPECIFIC BRIEF — Slide 5
==============================
Intensity: MINOR.

Add one sentence (in the appropriate IncentiveLayer "detail" or the
closing paragraph at the bottom of the slide) tying Merkl + Brix rewards
to the "loops profitable even above kink" thesis. The Merkl rewards rail
exists precisely so loopers stay profitable when borrow rate > raw wiTRY
yield. This is intentional, not a stopgap.

Do NOT restructure the IncentiveLayer cards or the three-rail story.
```

**Slide 8 (Liquidations, lines 419–486):**
```
SLIDE-SPECIFIC BRIEF — Slide 8
==============================
Intensity: MINOR.

Add a single line or short <Footnote> to the 4-step atomic flow making
clear that AMM swap is one of several viable exits — full treatment lives
on slide 9 (cross-link via <SL n={9} />). Do not enumerate the three
paths here; that's slide 9's job.

Keep the 4-step flow (call → swap → settle → pocket LIF) intact.
```

**Slide 9 (lines 488–589) — MAJOR REWRITE:**
```
SLIDE-SPECIFIC BRIEF — Slide 9
==============================
Intensity: MAJOR — full rewrite of the slide body. Keep the slide
object's `id` (currently `'pool-rule'`) so cross-references survive.

Working title: "The constraints that actually bind" (or similar:
"What's binding, what's not" / "Past the 5× rule"). Final wording at
your discretion, but DO NOT title it "The 5× rule" anymore.

Kicker: short tagline, e.g. "09 · What pins the market". Final wording
at your discretion.

H2 heading conveys: LLTV + LIF + rTarget are immutable; AMM depth is
comfortable, not binding. Final wording at your discretion within that
meaning.

Layout: keep the existing two-column grid (`grid grid-cols-[1.1fr_1fr]
gap-6`) for visual continuity with the rest of the deck.

LEFT CARD — "Liquidation paths":
List the three exit routes liquidators can choose, with cost basis for
each.

  - AMM swap (Kumbaya wiTRY/USDM) — slippage 1% calm, 3–4% stress. Fast
    but eats into LIF.
  - wiTRY vault redemption — flat redemption fee. Brix can subsidize for
    liquidators if it becomes a chokepoint. Sidesteps AMM slippage; trades
    it for the redemption fee.
  - Long-USD cooldown hedge — liquidator longs USD on a perp / forward
    for 3 days, waits out the wiTRY cooldown, redeems at par. Only cost:
    funding rate over 3 days.

Concluding line (paraphrase encouraged, keep the meaning):
"If we assume these paths are available to liquidators, bad-debt risk
for the protocol is very low." Use <Accent> on "very low".

RIGHT COLUMN — three NumberBlocks + small Card:
Use the existing <NumberBlock> component pattern (see current slide 9
source for the exact prop shape).

  - NumberBlock: LLTV 86% — "Morpho governance tier. Immutable once
    deployed."
  - NumberBlock: LIF 4.38% — "Direct function of LLTV. Immutable."
  - NumberBlock: rTarget 4% — "IRM rate at target utilization.
    Immutable. The real binding parameter."

Small <Card> below the NumberBlocks — title "Why rTarget matters":
"Market params can't be changed post-deploy. At 85–90% utilization, the
borrow rate must stay profitable for loopers without relying on rewards
— otherwise borrowers migrate to a vault with a lower rTarget and our
utilization collapses. Above the 90% kink, the rate climbs fast on
purpose: lenders earn more, and Merkl + Brix rewards subsidize borrowers
through the steep zone."

You may include a brief footer line about above-kink not being a cliff.
```

**Slide 10 (Slippage & pool sizing, lines 592–639):**
```
SLIDE-SPECIFIC BRIEF — Slide 10
===============================
Intensity: MINOR.

Add one sentence (in the closing footnote/paragraph below the
SlippageTable) noting that pool sizing here is a conservative comfort
target because liquidators have non-AMM exits (cross-link via
<SL n={9} />). The numbers in the SlippageTable stay as-is.
```

**Slide 12 (Profitable liquidations + parameters, lines 688–754):**
```
SLIDE-SPECIFIC BRIEF — Slide 12
===============================
Intensity: MINOR (two small changes).

1. Label the `profit = (LIF − 1) × seized − slippage − gas` formula as
   AMM-swap-specific. Add a parenthetical or footnote noting that this is
   the AMM-route P&L; redemption and cooldown-hedge exits have different
   cost structures (cross-link <SL n={9} />).

2. Add an rTarget row to the parameter table. Find the existing table of
   tuples (LLTV, LIF, market borrow cap, per-wallet target). Insert a new
   row: `['rTarget (IRM rate-on-target)', '4%', <>Immutable post-deploy.
   Sized so borrowing stays profitable at 85–90% util even without
   rewards. <SL n={9}>Slide 9</SL>.</>]` — match the exact tuple shape
   of the existing rows (the third element is a React node).

DO NOT rewrite other rows or the closing paragraph.
```

**Slide 13 (Pre-liquidations, lines 756–803) — MAJOR:**
```
SLIDE-SPECIFIC BRIEF — Slide 13
===============================
Intensity: MAJOR.

1. Replace every "3-day" mention with "1-day". The Kpi `hint` at the
   existing 3-day-drawdown line is the canonical case.

2. Refresh the bad-debt probability numbers using the fresh simulator
   output below. Replace the current "3–6% per year" / "~1% with pre-liq"
   ranges with the new numbers, framed in the same style.

  >>> SIMULATOR OUTPUT (canonical defaults, 1-day drawdown, P95) <<<
  PRE-LIQ OFF:
    P95 bad debt:  $<<<USD_OFF>>>  (<<<PCT_OFF>>>% of TVL)
    paths with any bad debt:  <<<ANY_OFF>>>%
  PRE-LIQ ON:
    P95 bad debt:  $<<<USD_ON>>>  (<<<PCT_ON>>>% of TVL)
    paths with any bad debt:  <<<ANY_ON>>>%
  Inputs: LLTV 86%, util 85%, TVL $5M, 5y historical window,
          1000 paths, seed 42.

  >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

   Use the "% of TVL" numbers in the slide body (matches the deck's
   monetary scale). Frame as "without pre-liq → X% / with pre-liq → Y%"
   alongside the existing "cliff-to-underwater" narrative.

3. Light copy edit to align with slide 9's softened framing of the
   constraint (don't lean on "5× rule" or "pool depth is binding").

Keep the recommendation: pre-liq on, day 1.
```

**Slide 14 (Recap + next steps, lines 805–848):**
```
SLIDE-SPECIFIC BRIEF — Slide 14
===============================
Intensity: MINOR.

Find the recap bullet currently reading roughly "Pool depth is the
binding constraint. 5× rule." Soften to reflect slide 9's new framing
— something like: "AMM depth is a comfort target, not a binding
constraint — liquidators have multiple exits." (Final wording at your
discretion within that meaning.)

DO NOT touch the action-items list at the bottom.
```

- [ ] **Step 3: Substitute the slide-13 numbers into the brief.**

Take the Task 3 output and substitute the placeholders `<<<USD_OFF>>>`,
`<<<PCT_OFF>>>`, `<<<ANY_OFF>>>`, `<<<USD_ON>>>`, `<<<PCT_ON>>>`,
`<<<ANY_ON>>>` in the slide-13 brief with the actual numbers. The other
six briefs have no placeholders.

- [ ] **Step 4: Dispatch 7 agents in a single tool-use turn.**

Use the `Agent` tool 7 times in a single message (so they run in
parallel). For each call:

- `description`: "Rewrite slide N" (one short phrase per agent)
- `subagent_type`: `"claude"`
- `model`: `"sonnet"`
- `prompt`: `COMMON CONTEXT` + slide-specific brief + verbatim current
  source from Task 4

Do NOT pass `run_in_background: true` — the main session needs all 7
results before proceeding. Parallel dispatch in one message gives
concurrency without backgrounding.

- [ ] **Step 5: Collect the 7 returned JSX blocks.**

Each agent's result will contain a `<<<SLIDE_START>>>` / `<<<SLIDE_END>>>`
pair. Extract the text between them for each slide. If any agent fails
to follow the format (no sentinels, or commentary mixed in), re-dispatch
that single agent with a tighter prompt before continuing.

---

## Task 6: Apply all 7 edits sequentially

**Files:**
- Modify: `app/assignment/page.tsx` (7 slide blocks)

- [ ] **Step 1: Apply edits in reverse line order.**

To avoid line-number drift between edits, apply them bottom-up:
slide 14 → 13 → 12 → 10 → 9 → 8 → 5.

For each slide, use the `Edit` tool with:
- `file_path`: `app/assignment/page.tsx`
- `old_string`: the verbatim current slide source from Task 4 (the
  full slide-object literal, opening `{` through closing `},` — pick
  enough surrounding context to make it unique in the file)
- `new_string`: the verbatim agent output (the contents between the
  `<<<SLIDE_START>>>` / `<<<SLIDE_END>>>` sentinels)

- [ ] **Step 2: Spot-check line count.**

```bash
wc -l app/assignment/page.tsx
```

Line count will change — slide 9's rewrite is the biggest delta. As long
as the file still parses and the line count is in a reasonable range
(±200 lines of the original 1307), proceed.

- [ ] **Step 3: Visual diff scan.**

```bash
git diff --stat app/assignment/page.tsx
```

Expected: only `app/assignment/page.tsx` modified.

```bash
git diff app/assignment/page.tsx | head -300
```

Eyeball the diff: confirm no stray imports, no new components, no
unrelated edits. The `<<<SLIDE_START>>>` / `<<<SLIDE_END>>>` sentinels
themselves must NOT appear in the diff — those are agent-prompt scaffolding,
not code.

---

## Task 7: Lint

**Files:** none modified.

- [ ] **Step 1: Run the linter.**

```bash
npm run lint 2>&1 | tail -20
```

Expected: `✔ No ESLint warnings or errors`.

If lint fails:
- A new JSX import the agent introduced → strip it and re-dispatch that
  slide's agent with a stricter "no new imports" guardrail.
- Unclosed JSX tag → eyeball the offending slide and patch manually.
- Unused variable → likely an agent referenced something that no longer
  exists (e.g. a `lltvDerivation` import) — fix inline.

---

## Task 8: Unit tests

**Files:** none modified.

- [ ] **Step 1: Run the test suite.**

```bash
npm test 2>&1 | tail -15
```

Expected: all 219 tests pass (slide content is not under test, so this
is a sanity check that nothing leaked into `lib/`).

If a test fails, inspect — the most likely cause is an accidental edit
outside the assignment file. Revert via `git checkout` on the affected
file.

---

## Task 9: Build

**Files:** none modified.

- [ ] **Step 1: Static-export build.**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds; `/assignment` listed in the Static prerender
output; no TypeScript errors.

If build fails on a TS error in the assignment file, the agent likely
returned malformed JSX or referenced a missing prop. Fix inline.

---

## Task 10: Visual spot-check

**Files:** none modified.

- [ ] **Step 1: Start dev server.**

```bash
npm run dev
```
(run in background — note the URL: http://localhost:3000)

- [ ] **Step 2: Open the deck.**

Open http://localhost:3000/assignment in a browser. Navigate to:

- **Slide 9** — confirm the new "Liquidation paths" left card renders
  with three exit routes; right column shows three NumberBlocks (LLTV /
  LIF / rTarget); "Why rTarget matters" card below. No layout breakage
  vs. neighboring slides.
- **Slide 13** — confirm "1-day" appears wherever "3-day" used to;
  refreshed bad-debt percentages render in their intended slots.
- **Slide 5, 8, 10, 12, 14** — quick scan that minor edits landed and
  nothing visually broke.

If anything is off, decide:
- Cosmetic (spacing, wording) → edit inline.
- Structural (component shape wrong) → re-dispatch the specific slide
  agent with a clarifying brief.

- [ ] **Step 3: Stop dev server.**

Kill the background process.

---

## Task 11: Commit slide changes

**Files:** none modified (commit only).

- [ ] **Step 1: Stage and commit.**

```bash
git add app/assignment/page.tsx
git commit -m "$(cat <<'EOF'
feat(assignment): refresh slide deck for 1-day drawdown + liquidator exit menu

Updates the /assignment deck to reflect three new ground truths:

- 1-day drawdown is canonical (slide 13 relabeled, numbers refreshed
  from scripts/slide13-baddebt.mts).
- AMM is one of three liquidator exit paths (AMM swap, wiTRY redemption,
  long-USD-3d cooldown hedge). Slide 9 rewritten around the exit menu;
  slides 8, 10, 12 cross-link.
- rTarget (IRM rate at target utilization) is the real immutable binding
  parameter. Slide 9 surfaces it alongside LLTV + LIF; slide 12 adds an
  rTarget row to the params table; slide 5 ties Merkl rewards to
  "loops profitable through the kink".
- Slide 14 recap softened to match.

Spec: docs/superpowers/specs/2026-05-26-assignment-slides-math-refresh-design.md
Plan: docs/superpowers/plans/2026-05-26-assignment-slides-math-refresh.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Confirm commit landed.**

```bash
git log --oneline -3
```

Expected: top commit is the slide-deck refresh; second is the Task 3
script/plan commit; third is `2a699fe feat(sidebar): show pre-liquidation
status (#94)`.

---

## Task 12: Push branch and open PR

**Files:** none modified.

- [ ] **Step 1: Push.**

```bash
git push -u origin chore/assignment-slides-math-refresh
```

- [ ] **Step 2: Open PR via `gh`.**

```bash
gh pr create --title "Refresh /assignment deck: 1-day drawdown, liquidator exit menu, rTarget" --body "$(cat <<'EOF'
## Summary
- Rewrites slide 9 around the liquidator exit menu (AMM / redemption / cooldown hedge) and surfaces rTarget as the real binding parameter alongside LLTV + LIF.
- Refreshes slide 13's bad-debt %s using the simulator's current 1-day drawdown window. Numbers reproducible via `npx tsx scripts/slide13-baddebt.mts`.
- Minor copy alignment on slides 5, 8, 10, 12, 14.
- No `lib/*`, no math, no test changes. Only `app/assignment/page.tsx` and the new calibration script.

## Test plan
- [x] `npm run lint` clean
- [x] `npm test` — 219/219 pass
- [x] `npm run build` succeeds
- [x] `npm run dev` — slide 9 and slide 13 render correctly; neighbors unaffected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return the PR URL.**

The `gh pr create` output includes the URL. Report it to the user.

---

## Self-Review Notes (plan author)

Spec coverage: ✓
- §"Slide 9 detailed spec" → Task 5 slide-9 brief carries the left card,
  right column, NumberBlocks, and "Why rTarget matters" card verbatim.
- §"Slide 13 detailed spec" → Task 2 + 3 produce numbers; Task 5
  slide-13 brief substitutes them.
- §"Orchestration" → Task 5 dispatches 7 parallel Sonnet agents as text
  generators; Task 6 applies edits sequentially in reverse line order.
- §"Acceptance criteria" → Tasks 7–10 cover lint / test / build / visual.

Placeholder scan: ✓
- The slide-13 brief has explicit substitution placeholders
  (`<<<USD_OFF>>>` etc.) — these are intentional and substituted in
  Task 5 Step 3 before dispatch.
- No "TBD" / "implement later" elsewhere.

Type consistency: ✓
- `simulateBadDebt` signature taken directly from
  `lib/simulator.ts:383`.
- `BadDebtArgs` fields all populated; `preLiquidation` built via
  `buildPreLiquidationScenario` (same as worker).
- Component primitive list in COMMON CONTEXT matches the actual exports
  in `app/assignment/page.tsx` (Card, H1, H2, Body, Kicker, Tag, Accent,
  SL, Footnote, NumberBlock, StatusPill, IncentiveLayer, SlippageTable).
