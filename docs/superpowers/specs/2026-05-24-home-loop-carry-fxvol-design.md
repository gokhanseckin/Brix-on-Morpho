# Home Page Loop Economics — Carry / FX-Vol Reframe (Phase B)

**Status:** Design — awaiting approval before implementation plan.
**Date:** 2026-05-24
**Predecessor:** PR #88 (`feat/utilization-carry-fxvol-loop`, squash `98a5409`) which applied this reframe to `/utilization`.

## 1. Goal

Apply the carry-trade loop framing established on `/utilization` to the home-page Market Simulator (`app/page.tsx` → `LiquidityStrategy` section). Drop the expected-TRY-depreciation surcharge from the borrow-cost formula. Use Monte Carlo USD/TRY paths (already generated for the FX section) to produce a **per-path realized loop APY distribution** as the home page's edge over `/utilization`'s deterministic vol band. Surface borrower incentives as an additive overlay, not a viability input.

## 2. Why

The current home-page formula (`lib/simulator.ts:651-678`):

```
leverageLoopAPY = witryYieldAnnual − netBorrowAPY × (1 + 0.30)
```

double-counts FX risk: `witryYieldAnnual` is already TRY-denominated yield on a TRY-denominated NAV (wiTRY ≈ Turkish MMF growing at ~38%/year), and the `× (1 + 0.30)` surcharge re-charges expected TRY depreciation on the USDM debt. In a closed carry model the looper is paid the carry (`y_TRY − r_USDM`) and bears FX *risk*, not expected FX *cost*. Phase A established this for `/utilization`; Phase B brings the home page in line.

The home page also has an asset `/utilization` lacks: a Monte Carlo FX-path generator (`lib/simulation.worker.ts`). We use those paths to compute a **realized** loop-APY distribution (P5/P50/P95 across ~1000 paths, plus a liquidation rate) instead of `/utilization`'s closed-form `effectiveLeverage × σ × √(30/365) × z` vol band.

## 3. Architecture

Single composite hook `useSimulator` remains the only orchestration layer (per `CLAUDE.md`). New loop math is consumed by section components via `useSimulator`'s output, not imported directly.

```
URL state (useUrlState) ──┐
                          ├──> useSimulator ──┬──> looperNetAPY (lib/utilization.ts)  → carry-only KPIs
                          │                   ├──> useSimulationWorker ──> simulation.worker.ts
                          │                   │       ├─ existing: FX paths, badDebt cascade
                          │                   │       └─ NEW: looperPathPnL(paths, …) → per-path APY array
                          │                   └──> strategy output (gutted leverageLoopAPY, replaced by netLoopAPY)
                          └──────────────────> Sidebar (NEW: hfBuffer slider)
```

`looperNetAPY` and a new `looperPathPnL` both live in `lib/utilization.ts` (per Q1 decision: keep loop math in `utilization.ts`; home imports directly). The filename is acknowledged-suboptimal but avoids file churn and keeps `/utilization` imports untouched.

## 4. Loop Math

### 4.1 Carry-only deterministic baseline (already on `/utilization`)

Reused as-is from `lib/utilization.ts:81-116`:

```
borrowFraction      = lltv / hfBuffer
effectiveLeverage   = 1 / (1 − borrowFraction)
borrowedShare       = effectiveLeverage − 1
grossLoopAPY        = effectiveLeverage × witryYieldAnnual
borrowCost          = borrowedShare × borrowAPY        // USD APY, no FX surcharge
slippageCost        = borrowedShare × perLoopSlippageBps/10_000
hfIdleCost          = witryYieldAnnual × (1 − 1/hfBuffer) × borrowedShare
netLoopAPY          = grossLoopAPY − borrowCost − slippageCost − hfIdleCost
loopMargin          = netLoopAPY − witryYieldAnnual    // carry beats hold?
```

The home page consumes this directly. No new code in `lib/utilization.ts` for the deterministic side.

### 4.2 Path-aware realized loop P&L (NEW)

For each Monte Carlo USD/TRY path `S[0..H]` (H = simulation horizon, e.g. 90 days):

```
At t=0:
  equity0_USD       = 1                                  // arbitrary unit; output is a return ratio
  collateral0_TRY   = effectiveLeverage / S[0]           // collateral measured in TRY (wiTRY units, NAV=1)
  debt0_USD         = borrowedShare                      // USDM denominated
  S0                = S[0]

At each step t ∈ [1, H]:
  collateralNAV_t   = (1 + witryYieldAnnual)^(t/365)     // wiTRY NAV growth in TRY terms
  collateralUSD_t   = collateral0_TRY × collateralNAV_t × S0/S[t]   // mark-to-USD via inverse of USD/TRY
  debt_t            = debt0_USD × (1 + borrowAPY)^(t/365)
  equity_t          = collateralUSD_t − debt_t − slippageCost × t/365
  HF_t              = collateralUSD_t × lltv / debt_t

If HF_t ≤ 1 at any t:
  recordLiquidation(path): position closed at t, terminal equity = max(0, equity_t − LIF-haircut)
                            where LIF-haircut = (LIF(lltv) − 1) × debt_t   // bonus paid to liquidator
  // Note: ignoring AMM slippage at liquidation — that's covered in /Section 4 of the home
  //       page (LiquidationDesign). Here we only need a "got liquidated" flag and an approximate
  //       residual equity. Approximation is acceptable; precise residual is not the KPI.

At horizon t = H:
  if not liquidated:
    equity_H = collateralUSD_H − debt_H − slippageCost × H/365
  loopReturn_path = equity_H / equity0_USD              // gross multiplier
  loopAPY_path    = loopReturn_path^(365/H) − 1         // annualized
```

Output across N paths:
```
{
  apyByPath:        number[]    // length N; NaN or 0 for liquidated paths (we'll use 0)
  liquidatedByPath: boolean[]   // length N
  apyP5, apyP50, apyP95: number // sorted percentiles over apyByPath (incl. liquidated zeros)
  liquidationRate:  number      // fraction of paths liquidated before horizon
}
```

This goes in `lib/utilization.ts` as `export function looperPathPnL(input: LooperPathPnLInput): LooperPathPnLResult` and is called from `lib/simulation.worker.ts`.

### 4.3 Borrower incentives as overlay (not viability input)

`netLoopAPY` stays carry-only. We compute one additional figure:

```
netLoopAPY_withIncentives = netLoopAPY + borrowerIncentiveAPY × borrowedShare
```

(The incentive is paid on the looper's debt notional, hence the `× borrowedShare`.) This is rendered as the third bar in the LiquidityStrategy stack ("Loop + incentives"). The viability gate (`netLoopAPY > witryYieldAnnual`) does **not** use this number — incentives are explicitly modeled as a marketing layer on top of structural viability.

## 5. Type & API Changes

### 5.1 `lib/utilization.ts` — additions

```typescript
export interface LooperPathPnLInput {
  paths: number[][];               // worker output; paths[i][t] = USD/TRY at step t
  lltv: number;
  hfBuffer: number;
  witryYieldAnnual: number;        // typically witryYieldUSD_7d for the realized run
  borrowAPY: number;               // adaptiveCurveIRM(targetUtilization, rTarget)
  perLoopSlippageBps: number;
}

export interface LooperPathPnLResult {
  apyByPath: number[];             // per-path annualized realized loop APY
  liquidatedByPath: boolean[];
  apyP5: number;
  apyP50: number;
  apyP95: number;
  liquidationRate: number;         // fraction of paths liquidated before horizon
}

export function looperPathPnL(i: LooperPathPnLInput): LooperPathPnLResult;
```

Existing `looperNetAPY`, `LooperEconomicsInput`, `LooperEconomicsResult` unchanged.

### 5.2 `lib/simulator.ts` — `computeStrategy` rewrite

**StrategyArgs (remove field):**
- ❌ remove `expectedTRYDepreciation_annual: number`

**StrategyArgs (additions to enable carry-only loop):**
- ➕ `hfBuffer: number`
- ➕ `perLoopSlippageBps: number`  // pass `30` from `useSimulator`, matches `/utilization`
- ➕ `lltv: number`                 // already implicit but now needed by loop math

**StrategyOut (rename + new fields):**
- ❌ remove `leverageLoopAPY: number`
- ➕ `netLoopAPY: number`                    // carry-only, no FX surcharge
- ➕ `netLoopAPY_withIncentives: number`     // overlay
- ➕ `effectiveLeverage: number`
- ➕ `loopDebtPerCollateral: number`         // borrowedShare / effectiveLeverage = lltv/hfBuffer
- ✅ keep `leverageLoopsViable: boolean`     // now driven by `netLoopAPY > witryYieldAnnual`

**Body:** delegate to `looperNetAPY` from `lib/utilization.ts`. Drop the in-place formula. Supply/borrow APY blocks untouched.

### 5.3 `types/simulator.ts` — `LiquidityStrategyOutput`

Mirror the `StrategyOut` changes. Add a new optional `loopPath` field for the Monte Carlo overlay:

```typescript
export interface LiquidityStrategyOutput {
  borrowAPY: number;
  grossSupplyAPY: number;
  netSupplyAPY: number;
  supplyIncentiveAPY: number;
  totalSupplyAPY: number;
  borrowerIncentiveAPY: number;
  netBorrowAPY: number;
  netLoopAPY: number;                       // RENAMED from leverageLoopAPY
  netLoopAPY_withIncentives: number;        // NEW
  effectiveLeverage: number;                // NEW
  loopDebtPerCollateral: number;            // NEW
  leverageLoopsViable: boolean;
  loopPath?: {                              // NEW; undefined until first worker run completes
    apyP5: number;
    apyP50: number;
    apyP95: number;
    liquidationRate: number;
    apyHistogram: Array<{ bucketLo: number; bucketHi: number; count: number }>;  // for UI rendering
  };
}
```

### 5.4 `lib/useUrlState.ts` — add `hfBuffer`

```typescript
hfBuffer: parseAsFloat.withDefault(1.5),
```

Promote `hfBuffer` from `/utilization`'s local React state to URL state. Add a sidebar slider on home (range 1.0–3.0, step 0.05, label "HF buffer (looper)"). Migrate `/utilization/page.tsx` from local `useState(1.5)` to `useUrlState`. This unifies the parameter across pages without breaking either.

### 5.5 `types/simulator.ts` — `SidebarInputs`

Add `hfBuffer: number`.

### 5.6 `lib/simulation.worker.ts` — extend `WorkerOutput`

```typescript
export interface WorkerOutput {
  // ...existing fields...
  loopPath: {
    apyByPath: number[];          // raw — for histogram render
    apyP5: number;
    apyP50: number;
    apyP95: number;
    liquidationRate: number;
  };
}
```

In the worker `run()`, after FX paths are generated and before returning, call:

```typescript
const loopPath = looperPathPnL({
  paths,
  lltv: inputs.lltv,
  hfBuffer: inputs.hfBuffer,
  witryYieldAnnual: inputs.witryYieldUSD_7d,    // use 7d realized for realized P&L
  borrowAPY,                                     // either re-derive or thread through WorkerInput
  perLoopSlippageBps: 30,
});
```

`borrowAPY` is currently computed in `useSimulator` (not the worker). Cleanest: extend `WorkerInput` to include `borrowAPY` (the home page passes it in alongside `inputs`). Avoids re-importing `adaptiveCurveIRM` and `rTargetIRM` paths into the worker.

### 5.7 `lib/useSimulator.ts` — wire-up changes

- ❌ Delete `const DEFAULT_TRY_DEPRECIATION_ANNUAL = 0.30;`
- ➕ Compute `fxAnnualVol = historicalAnnualizedVol(returnsWindow)` (already imported pattern from `/utilization`).
- Update the `computeStrategy` call:
  ```typescript
  computeStrategy({
    borrowAPY,
    targetUtilization: s.targetUtilization,
    performanceFee: s.performanceFee,
    managementFee: s.managementFee,
    requiredUSDM: requiredUSDMPrecursor,
    supplyIncentiveBudgetMonthly_USD: s.supplyIncentiveBudgetMonthly_USD,
    borrowerIncentiveBudgetMonthly_USD: s.borrowerIncentiveBudgetMonthly_USD,
    expectedBorrow_USD: expectedBorrowPrecursor,
    witryYieldAnnual: s.witryYieldAnnual,
    // NEW (carry inputs):
    hfBuffer: s.hfBuffer,
    perLoopSlippageBps: 30,
    lltv: s.lltv,
  })
  ```
- Pass `borrowAPY` and `hfBuffer` through to the worker invocation (`run({...inputs, borrowAPY})` shape change).
- On worker completion, fold `result.loopPath` into the `strategy` output shape: build `apyHistogram` (e.g. 12 fixed buckets from −50% to +200% APY) from `apyByPath` and attach as `strategy.loopPath`.

### 5.8 `app/components/sections/LiquidityStrategy.tsx` — rewrite viability card

Three-row layout. Existing supplier APY / supply-incentive bar (top half) is kept. The loop section (bottom half) is rewritten:

```
┌─ Supplier APY ─────────────────────────────────────────────────────┐
│   (unchanged: net base + supply incentives stack, benchmark chart) │
└────────────────────────────────────────────────────────────────────┘

┌─ Loop economics (deterministic, carry-only) ────────────────────────┐
│   Three side-by-side bars:                                          │
│     ① Hold wiTRY:        witryYieldAnnual                           │
│     ② Loop wiTRY:        netLoopAPY                                 │
│     ③ Loop + incentives: netLoopAPY_withIncentives                  │
│   KPIs to the right: effectiveLeverage, loopDebtPerCollateral,      │
│                     impliedLooperDebt_USD                           │
│   Viability badge: green if netLoopAPY > witryYieldAnnual, red else │
└─────────────────────────────────────────────────────────────────────┘

┌─ Loop realized P&L (Monte Carlo, FX risk overlay) ──────────────────┐
│   Three KPIs:  P5 loop APY  |  P50 loop APY  |  P95 loop APY        │
│   One KPI:     liquidation rate (% of paths underwater pre-horizon) │
│   Optional:    APY histogram (recharts BarChart over 12 buckets)    │
│   Spinner / "—" placeholders until first worker run completes       │
└─────────────────────────────────────────────────────────────────────┘
```

`impliedLooperDebt_USD` is a display-only convenience: `s.witryTVL_USD × loopDebtPerCollateral × (looperPenetration)`, where `looperPenetration` is left at a constant `1.0` for this PR (deferred per Q4 to a follow-up that introduces an actual looperEquity sidebar input).

### 5.9 `lib/help/kpiKeys.ts` — registry updates

Remove:
- `leverageLoopAPY` (from `KPI_KEYS` and `KPI_SECTION`)

Add to `KPI_KEYS` (section `'strategy'`):
- `netLoopAPY`
- `netLoopAPYWithIncentives`
- `effectiveLeverageStrategy`
- `loopDebtPerCollateral`
- `loopAPYP5`
- `loopAPYP50`
- `loopAPYP95`
- `loopLiquidationRate`

Naming: `effectiveLeverageStrategy` (not `effectiveLeverage`) to avoid collision with any future `/utilization` registry key. `loopAPYP{5,50,95}` follows the existing `oneDayMaxDrawdownP{50,95}` convention.

### 5.10 `lib/help/content/strategy.ts` — content rewrite

- ❌ Remove `leverageLoopAPY` entry.
- ➕ Add `netLoopAPY` entry: carry-only formula, explanation of why TRY depreciation isn't subtracted, link to FX overlay row.
- ➕ Add `netLoopAPYWithIncentives` entry: borrower-incentive math, viability rationale.
- ➕ Add `effectiveLeverageStrategy`, `loopDebtPerCollateral`: leverage stack mechanics.
- ➕ Add `loopAPYP5/P50/P95`, `loopLiquidationRate`: realized-distribution interpretation, "% of paths liquidated before horizon" definition.
- Update `STRATEGY_KPIS` export to include the new entries.

## 6. Test Plan

### 6.1 `tests/utilization.test.ts` (existing) — extend

Add a new `describe('looperPathPnL', …)` block with three cases:
1. **Flat path (`S[t] = S[0]` for all t)** — realized APY ≈ carry-only `netLoopAPY` within tolerance (≤ 1pp). Locks the no-FX-move identity.
2. **Strongly depreciating path (linear glide from S0 to 1.5·S0 over horizon)** — most paths liquidated; `liquidationRate > 0.9`; P5 APY ≪ 0.
3. **Slightly appreciating path** — realized APY > `netLoopAPY` (looper benefits from TRY strength). Locks sign convention.

Use a fixed seed in path construction (deterministic glides; no RNG needed).

### 6.2 `tests/simulator.test.ts` (existing) — rewrite loop assertions

The two `computeStrategy` test cases at lines 442/462 currently assert `leverageLoopAPY > 0.38` using the old formula. Rewrite them to:
1. Drop the `expectedTRYDepreciation_annual` field from inputs.
2. Add the new fields (`hfBuffer`, `perLoopSlippageBps`, `lltv`).
3. Assert `netLoopAPY` equals the carry-only formula (tight `toBeCloseTo` against a hand-calculated value).
4. Assert `netLoopAPY_withIncentives > netLoopAPY` when `borrowerIncentiveAPY > 0`.
5. Assert `effectiveLeverage = 1 / (1 − lltv/hfBuffer)` exactly.

### 6.3 `tests/sanity.test.ts` — keep green

End-to-end sanity test runs through `useSimulator`-shaped inputs. Update its input fixture for the new `hfBuffer` URL field and confirm `strategy.netLoopAPY` is defined.

### 6.4 `tests-e2e/perf.spec.ts` — recheck ceiling

The worker now does an extra O(paths × horizon) loop in `looperPathPnL`. On ~1000 paths × 90 days that's 90k extra ops — trivial compared to bad-debt cascade. We expect no measurable hit, but the perf ceiling test (6s for first KPI) may move a few hundred ms. If it does, raise the ceiling in the same PR with a one-line justification.

### 6.5 Help registry test — `tests/help/kpiKeys.test.ts` (or wherever it lives)

`/utilization` Phase A added a registry-completeness test (`Help registry test enforces completeness` — observation 3083). Run it; every new KPI key must have a `STRATEGY_KPIS` entry. This is enforced by CI.

## 7. Out of Scope (per Phase A pattern)

- Looper-equity sidebar input + folding into `expectedBorrow_USD` denominator (Q4 deferred).
- Path-aware loop economics on `/utilization` (would re-introduce the worker dependency we deliberately avoided there).
- Multi-asset / multi-market vault allocation.
- LayerZero, custodian, regulatory risk (out per `CLAUDE.md`).
- Loop-APY ribbon over time (rejected per Q2; per-path scalar is the chosen shape).
- External-facing API back-compat (none; this is a static-export client-side app).

## 8. Risks & Mitigations

1. **Worker output size grows by ~N floats (apyByPath, ~1000 numbers).** Negligible — already shipping `paths: number[][]` of size N×H. Mitigation: send only percentiles + histogram if we observe Comlink slowness; the raw `apyByPath` is useful for the histogram render and nothing else.
2. **`hfBuffer` URL state migration breaks `/utilization`.** Mitigation: change `/utilization/page.tsx:26` from `useState(1.5)` to `useUrlState()` in the same PR; one-line change.
3. **Help-registry completeness test fails until all new KPIs are added.** Mitigation: write the registry entries first (TDD); the test enforces correctness.
4. **`leverageLoopAPY` removal breaks downstream readers.** Mitigation: grep'd — only callers are `useSimulator.ts`, `LiquidityStrategy.tsx`, `tests/simulator.test.ts`, `lib/help/content/strategy.ts`. All updated in the same PR.
5. **Liquidation modeling in `looperPathPnL` differs from `simulateBadDebt`.** `looperPathPnL` is intentionally cruder (no AMM slippage, no LIF haircut beyond a constant) because it represents the *looper's* P&L, not the protocol's bad-debt exposure. They're disjoint concerns. Document this in the help entry for `loopLiquidationRate`.

## 9. Estimated Scope

| Area | Net lines |
|---|---|
| `lib/utilization.ts` — add `looperPathPnL` | +120 |
| `lib/simulator.ts` — gut `computeStrategy.leverageLoopAPY` | −15 / +25 |
| `lib/useSimulator.ts` — wire fxAnnualVol, new fields, drop DEFAULT_TRY | −10 / +30 |
| `lib/simulation.worker.ts` — call `looperPathPnL`, extend output | +40 |
| `lib/useUrlState.ts` — add `hfBuffer` | +1 |
| `types/simulator.ts` — `SidebarInputs`, `LiquidityStrategyOutput` updates | +15 |
| `app/components/sections/LiquidityStrategy.tsx` — rewrite loop card | −60 / +220 |
| `app/components/Sidebar.tsx` — add hfBuffer slider | +15 |
| `app/utilization/page.tsx` — migrate hfBuffer to URL state | −3 / +3 |
| `lib/help/kpiKeys.ts` — registry diffs | −1 / +12 |
| `lib/help/content/strategy.ts` — content rewrite | −80 / +180 |
| `tests/utilization.test.ts` — `looperPathPnL` cases | +90 |
| `tests/simulator.test.ts` — rewrite loop assertions | −20 / +50 |
| `tests/sanity.test.ts` — fixture bump | +5 |
| **Total** | **~+700 net** |

Matches Phase A handoff estimate. Single PR remains tractable.

## 10. Acceptance Criteria

1. `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` all green.
2. Visit home with default params; LiquidityStrategy section renders three rows: Supplier APY, Loop economics (3 bars), Loop realized P&L (3 KPIs + liquidation rate).
3. With `borrowerIncentiveBudgetMonthly_USD = 0`, bars ② and ③ are equal. With a positive budget, bar ③ exceeds bar ②.
4. Toggle `hfBuffer` slider in sidebar from 1.2 → 2.0: `effectiveLeverage` and all loop APYs change immediately on both the home page and `/utilization`.
5. Visit `/utilization` after the PR lands: `hfBuffer` slider still works, value persists across page navigation via URL.
6. `leverageLoopAPY` symbol does not appear anywhere in the codebase (`grep` clean).
7. Help registry test passes with no missing-KPI errors.
8. PR description includes a side-by-side screenshot of the old vs new LiquidityStrategy section at default sidebar values.

## 11. Implementation Order (for the executing session)

Suggested order to keep CI green throughout:

1. Add `hfBuffer` to `useUrlState`, `SidebarInputs`, sidebar UI.
2. Migrate `/utilization/page.tsx` to read `hfBuffer` from URL state. Test that `/utilization` still works.
3. Add `looperPathPnL` + tests to `lib/utilization.ts`.
4. Extend `WorkerInput` / `WorkerOutput` and call `looperPathPnL` in the worker.
5. Rewrite `computeStrategy` (drop drift formula, delegate to `looperNetAPY`).
6. Update `types/simulator.ts` (`LiquidityStrategyOutput`).
7. Wire `useSimulator` to new fields + worker `loopPath`.
8. Rewrite `LiquidityStrategy.tsx`.
9. Update help registry (`kpiKeys.ts`, `content/strategy.ts`).
10. Update tests (`simulator.test.ts`, `sanity.test.ts`).
11. Smoke-test, screenshot, open PR.
