# `/utilization` Page — Target Utilization Calibration

**Status:** design approved, ready for implementation plan
**Date:** 2026-05-20
**Owner:** Brix-Morpho simulator

## Problem

The Morpho `USDM` market's `targetUtilization` (`u_target`) controls how aggressively the AdaptiveCurveIRM pins realized utilization. The simulator currently exposes it as a sidebar number with no guidance.

Two competing forces set the "right" value:

1. **Lender redemption liquidity.** Higher `u_target` → thinner cash buffer `(1 − u) × TVL` → withdrawals can block until borrowers repay.
2. **Looper economics.** Borrowers only borrow USDM if they can profitably loop into more wiTRY: their net APY after fees must beat just holding wiTRY (loyal user base assumed — no external DeFi alternatives modeled). With wiTRY paying 6.31% (trailing 7d) and 19.31% (trailing 30d) USD APY, the borrow rate at `u_target` must sit comfortably below the conservative 7d figure, accounting for slippage and HF buffer cost.

The IRM's only non-linearity is the kink at `u = 0.9`: above 0.9 the rate quadruples within `Δu = 0.1`. Sitting `u_target` too close to 0.9 means normal volatility tips realized `u` over the kink and kills loop profitability.

The page must let the operator choose `u_target` knowing all three constraints simultaneously, with interactive sliders for the assumptions that aren't pinned by data.

## Non-goals

- Monte Carlo withdrawal flow (deterministic stress only in v1).
- Multi-market vault allocation.
- FX-correlated borrow-demand collapse (covered by existing FX section).
- Auto-tuning `r_target` (shown as a sensitivity, user-adjustable slider).
- Modeling external DeFi yield competition.
- Adding sidebar inputs (page is self-contained).

## User Experience

Route: `/utilization`. Sidebar is unchanged. The page reads existing URL state (LLTV, wiTRY TVL, r_target, slippage, etc.) so it stays consistent with the main simulation, but adds three page-local sliders for assumptions:

| Slider | Default | Range | Purpose |
| --- | --- | --- | --- |
| Stress withdrawal % of supply | 20% | 5%–50% | One-day worst-case redemption test |
| Looper HF buffer | 1.5 | 1.1–2.5 | How conservative loopers are (debt ≤ max/HFbuffer) |
| r_target (override) | URL value | 0.01–0.10 | Sensitivity check on the IRM target rate |

### Top: Recommendation card

A single hero card showing:

- **Recommended `u_target`** (the page's primary answer)
- `borrowAPY` at that target (from `adaptiveCurveIRM`)
- **Loop margin (7d):** `wiTRY_7d − borrowAPY − per-loop slippage − HF buffer cost` (must be > 0)
- **Supplier APY** at the recommended target
- **Stress survival:** ✓ / ✗ vs the slider value
- **Distance to IRM kink:** `0.9 − u_target`
- Short verdict sentence

Recommendation rule (run inside `lib/utilization.ts`, deterministic, snapped to 0.01):

```
recommend the largest u_target ∈ [0.50, 0.90] satisfying ALL:
  (a) looperNetAPY(u_target) > wiTRY_yield_7d
  (b) (1 − u_target) × TVL ≥ stressWithdrawalUSD
  (c) 0.9 − u_target ≥ 0.07
```

If no value satisfies all three, return the highest `u_target` that satisfies (a) and (c), and flag (b) as unmet — the page surfaces the unmet constraint in the verdict.

### Section 1 — Looper Viability Curve

Line chart: `u_target` on x ∈ [0.5, 0.95] vs `borrowAPY` on y. Two horizontal reference lines: wiTRY 7d yield (6.31%) and 30d yield (19.31%) — both read from the existing wiTRY-yield input in the URL state, defaulting to those numbers. Shade the region where `borrowAPY + slippage_cost + HF_cost < wiTRY_7d` (the "loopable" zone). The IRM cliff above 0.9 will be visually obvious.

### Section 2 — Liquidity Stress Test

Given the stress-withdrawal slider, for each candidate `u_target` show:

- Buffer: `(1 − u_target) × TVL_USDM`
- Stress withdrawal absolute value: `stressPct × TVL_USDM`
- Survives? ✓ if buffer ≥ stress
- Time-to-refill estimate (informational): `stress / (borrowAPY × TVL × u_target / 365)` — a rough "days of accrued repayments at current rate" figure, clearly labelled as a rough indicator, not a guarantee.

Rendered as a compact table with green/red verdict cells.

### Section 3 — Loop Economics Breakdown

For the recommended `u_target` (and a few neighbours), decompose the looper PnL:

```
effective_leverage = 1 / (1 − LLTV / HF_buffer)
gross_loop_APY   = effective_leverage × wiTRY_yield_7d
borrow_cost      = (effective_leverage − 1) × borrowAPY(u_target, r_target)
slippage_cost    = (effective_leverage − 1) × per_loop_slippage      // existing slippage model
hf_idle_cost     = wiTRY_yield × (1 − 1/HF_buffer) × (effective_leverage − 1)
net_loop_APY     = gross_loop_APY − borrow_cost − slippage_cost − hf_idle_cost
```

Display a stacked-bar / waterfall chart and a numeric breakdown table. `net_loop_APY > wiTRY_yield_7d` is the "looping beats holding" check from constraint (a).

### Section 4 — IRM Sensitivity Heatmap

Heatmap grid: `u_target` (x, 0.50–0.95 step 0.05) × `r_target` (y, 0.01–0.10 step 0.01). Cell value: `borrowAPY = adaptiveCurveIRM(u_target, r_target)`. Overlay isocurve where `borrowAPY = wiTRY_yield_7d` — anything left/below is feasible for loopers; anything right/above kills the loop. The current `(u_target, r_target)` from URL state marked with a crosshair.

### Section 5 — Recommendation Table

Rows: candidate `u_target` ∈ {0.60, 0.70, 0.75, 0.80, 0.83, 0.85, 0.88, 0.90}.
Columns:

- `u_target`
- `borrowAPY` at target
- Loop margin (7d wiTRY)
- Loop margin (30d wiTRY)
- Supplier APY
- Required TVL (`expectedBorrow / u_target`)
- Buffer at stress (USD)
- Stress survival ✓/✗
- Distance to kink
- Verdict (✓ feasible / ⚠ tight / ✗ infeasible)

The recommended row is highlighted.

## Architecture

Follows the existing simulator layering pattern (see `CLAUDE.md`):

```
URL state ──┐
            ├──> useUtilizationAnalysis (composite hook)
page sliders┘            │
                         ├──> lib/utilization.ts  (pure sync primitives)
                         │       — sweepUtilizationTargets
                         │       — looperNetAPY
                         │       — liquidityStress
                         │       — recommendUTarget
                         │
                         └──> 5× section components (read-only)
```

**No worker.** All math is sync and cheap (a sweep of ~10 `u_target` × ~10 `r_target` × `adaptiveCurveIRM`). Keeps `simulation.worker.ts` untouched.

### New module — `lib/utilization.ts`

Pure functions, no React, fully unit-testable:

```ts
export interface LooperEconomicsInput {
  uTarget: number; rTarget: number; lltv: number;
  hfBuffer: number;                       // ≥1.0
  witryYieldAnnual: number;               // 7d figure for the gate
  perLoopSlippageBps: number;             // from existing slippage model
}

export interface LooperEconomicsResult {
  effectiveLeverage: number;
  borrowAPY: number;
  grossLoopAPY: number;
  borrowCost: number;
  slippageCost: number;
  hfIdleCost: number;
  netLoopAPY: number;
  loopMargin: number;                     // netLoopAPY − witryYieldAnnual
}

export interface LiquidityStressInput {
  uTarget: number; tvlUSDM_USD: number; stressPctOfSupply: number;
  borrowAPY: number;
}

export interface LiquidityStressResult {
  bufferUSD: number;
  stressWithdrawalUSD: number;
  survives: boolean;
  daysToRefillEstimate: number;           // informational
}

export interface RecommendInput {
  rTarget: number; lltv: number; hfBuffer: number;
  witryYield7d: number; witryYield30d: number;
  perLoopSlippageBps: number;
  tvlUSDM_USD: number;
  stressPctOfSupply: number;
  kinkClearance: number;                  // default 0.07
  searchRange: [number, number];          // default [0.50, 0.90]
  searchStep: number;                     // default 0.01
}

export interface RecommendResult {
  recommended: number | null;
  unmetConstraints: ('loopMargin'|'stressSurvival'|'kinkClearance')[];
  bestEffort: number;                     // largest u meeting (a)+(c)
}

export function looperNetAPY(i: LooperEconomicsInput): LooperEconomicsResult;
export function liquidityStress(i: LiquidityStressInput): LiquidityStressResult;
export function sweepUtilizationTargets(/* … */): SweepRow[];
export function recommendUTarget(i: RecommendInput): RecommendResult;
```

### New hook — `lib/useUtilizationAnalysis.ts`

Composite hook. Reads URL state via existing `useUrlState`, takes the three local slider values as args, returns a single bundle the page renders:

```ts
{
  recommended: RecommendResult,
  recommendedDetails: LooperEconomicsResult & LiquidityStressResult,
  viabilityCurve: { u: number; borrowAPY: number; viable: boolean }[],
  stressTable: { u: number; … }[],
  economicsBreakdown: LooperEconomicsResult,
  heatmapGrid: { u: number; r: number; borrowAPY: number; feasible: boolean }[],
  recommendationTable: SweepRow[],
}
```

### New page — `app/utilization/page.tsx`

- Reuses sidebar's URL state for the upstream inputs (display only, link back to `/` for editing).
- Three local sliders for stress%, HF buffer, r_target override.
- 5 section components in `app/utilization/components/`:
  - `RecommendationCard.tsx`
  - `LooperViabilityCurve.tsx`
  - `LiquidityStressSection.tsx`
  - `LoopEconomicsBreakdown.tsx`
  - `IRMHeatmap.tsx`
  - `RecommendationTable.tsx`
- Recharts for all visualizations (matches existing sections).

### Help registry

Add help entries in `lib/help/registry.ts` for each new concept: `hfBuffer`, `loopMargin`, `effectiveLeverage`, `stressWithdrawal`, `kinkClearance`, `recommendedUtilization`.

## Data Flow

```
URL (witryTVL, lltv, witryYield, r_target, slippage, …)
   │
   ├──> useUtilizationAnalysis(localSliders)
   │       │
   │       ├──> recommendUTarget(...)         → RecommendResult
   │       ├──> sweepUtilizationTargets(...)  → SweepRow[]
   │       ├──> looperNetAPY(...) for each u  → LooperEconomicsResult
   │       └──> liquidityStress(...) for each → LiquidityStressResult
   │
   └──> page reads: { recommended, viabilityCurve, stressTable,
                      economicsBreakdown, heatmapGrid, recommendationTable }
```

## Error / Edge Cases

- `u_target = 0`: division by zero in `requiredUSDM`. Guard: clamp candidates to ≥ 0.01.
- `HF buffer ≤ 1.0`: liquidation imminent; treat as invalid. Slider min = 1.1.
- `LLTV ≥ 1`: invalid Morpho config. Existing validation in main page catches this; page assumes valid LLTV.
- No `u_target` satisfies all constraints: `recommended = null`, surface the `bestEffort` value with explicit warning ("no value satisfies the stress test at this TVL — increase TVL or lower stress %").
- `wiTRY 7d yield < r_target/4`: loop is infeasible at every `u_target`. Show explicit "looping is not profitable at any utilization" banner; suppress the recommendation card numeric.

## Testing

`tests/utilization.test.ts` (vitest, jsdom not required):

1. **Recommended value pinning** — canonical inputs `(lltv=0.86, TVL=$10M, r_target=0.04, wiTRY_7d=0.0631, slippage=30bps, hfBuffer=1.5, stress=20%)` → `recommended === 0.80` (exact value TBD by computation; pin once after first implementation run).
2. **Monotonicity** — `borrowAPY(u_target)` non-decreasing; `supplierAPY ≈ borrowAPY × u` non-decreasing up to the kink.
3. **Loop margin sign flip** — there exists a `u_target` where `loopMargin` crosses zero; recommended value must sit on the positive side.
4. **Kink clearance** — `recommended ≤ 0.83` whenever `kinkClearance = 0.07`.
5. **Stress unmet** — with `stress = 50%`, recommended must be `null` and `unmetConstraints` must include `'stressSurvival'`.
6. **No-loop-possible** — set `wiTRY_7d = 0.005` (below `r_target/4`); `recommended = null` and banner state surfaces.
7. **Heatmap feasibility region** — every cell's `feasible` flag equals `borrowAPY < wiTRY_7d − slippage − hfCost`.
8. **`effectiveLeverage` matches closed form** — `1 / (1 − LLTV/HF)`.

Numeric tolerances: `toBeCloseTo(_, 6)` for IRM-derived rates, `toBeCloseTo(_, 4)` for derived APYs.

No new e2e is strictly required for v1; if added, smoke-test the page loads and the recommendation card renders a number.

## Implementation Order

1. `lib/utilization.ts` + `tests/utilization.test.ts` (red → green).
2. `lib/useUtilizationAnalysis.ts`.
3. `app/utilization/page.tsx` skeleton + recommendation card.
4. Five section components, one at a time, each verified in browser.
5. Help registry entries.
6. Manual run through `/utilization` against the main sim for consistency.
7. Update README with a one-paragraph pointer to the new page.

## Out of Scope (deferred)

- Stochastic withdrawal model (Poisson + heavy tail) — could be a v2 toggle.
- Cross-market USDM allocation across multiple Morpho markets.
- Borrow-demand drift driven by external rates.
- Live FX coupling between the two pages' models.
