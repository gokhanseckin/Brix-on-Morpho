# `/utilization` Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/utilization` page that recommends an ideal Morpho `targetUtilization` for the USDM vault by balancing looper loop economics, lender liquidity, and IRM-kink distance — with three interactive sliders for stress %, HF buffer, and r_target.

**Architecture:** Pure-sync TypeScript primitives in `lib/utilization.ts` (no worker), one composite hook `useUtilizationAnalysis`, one Next.js App-Router page `app/utilization/page.tsx` with six section components consuming the hook. Reads existing URL state via `useUrlState` for upstream inputs; three additional page-local sliders. Follows the same layered pattern as the main page (`useSimulator` → sections).

**Tech Stack:** Next.js 14 (App Router, static export), TypeScript (strict + `noUncheckedIndexedAccess`), Recharts 3.8, Tailwind, nuqs (URL state), Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-20-utilization-target-page-design.md`

---

## File Structure

**Create:**
- `lib/utilization.ts` — pure primitives (`looperNetAPY`, `liquidityStress`, `sweepUtilizationTargets`, `recommendUTarget`)
- `lib/useUtilizationAnalysis.ts` — composite hook
- `tests/utilization.test.ts` — vitest unit tests
- `app/utilization/page.tsx` — route entry
- `app/utilization/components/RecommendationCard.tsx`
- `app/utilization/components/LooperViabilityCurve.tsx`
- `app/utilization/components/LiquidityStressSection.tsx`
- `app/utilization/components/LoopEconomicsBreakdown.tsx`
- `app/utilization/components/IRMHeatmap.tsx`
- `app/utilization/components/RecommendationTable.tsx`

**Modify:**
- `lib/help/registry.ts` — add entries for `recommendedUtilization`, `hfBuffer`, `loopMargin`, `effectiveLeverage`, `stressWithdrawal`, `kinkClearance`
- `app/page.tsx` — add a small link to `/utilization`
- `README.md` — one-paragraph pointer

---

## Task 1: Types + module skeleton + canonical test fixture

**Files:**
- Create: `lib/utilization.ts`
- Create: `tests/utilization.test.ts`

- [ ] **Step 1: Create the empty module with type exports**

```ts
// lib/utilization.ts
export interface LooperEconomicsInput {
  uTarget: number;
  rTarget: number;
  lltv: number;
  hfBuffer: number;            // ≥ 1.0
  witryYieldAnnual: number;    // USD APY used for the loop math (typically 7d figure)
  perLoopSlippageBps: number;  // basis points lost per loop step (round-trip swap cost)
}

export interface LooperEconomicsResult {
  effectiveLeverage: number;
  borrowAPY: number;
  grossLoopAPY: number;
  borrowCost: number;
  slippageCost: number;
  hfIdleCost: number;
  netLoopAPY: number;
  loopMargin: number;          // netLoopAPY − witryYieldAnnual (i.e. "beats holding wiTRY"?)
}

export interface LiquidityStressInput {
  uTarget: number;
  tvlUSDM_USD: number;
  stressPctOfSupply: number;   // 0..1
  borrowAPY: number;
}

export interface LiquidityStressResult {
  bufferUSD: number;
  stressWithdrawalUSD: number;
  survives: boolean;
  daysToRefillEstimate: number;
}

export interface SweepRow {
  uTarget: number;
  borrowAPY: number;
  supplierAPY: number;
  loopMargin7d: number;
  loopMargin30d: number;
  bufferUSD: number;
  stressWithdrawalUSD: number;
  survives: boolean;
  distanceToKink: number;
  verdict: 'feasible' | 'tight' | 'infeasible';
}

export interface RecommendInput {
  rTarget: number;
  lltv: number;
  hfBuffer: number;
  witryYield7d: number;
  witryYield30d: number;
  perLoopSlippageBps: number;
  tvlUSDM_USD: number;
  stressPctOfSupply: number;
  kinkClearance: number;       // default 0.07
  searchRange: [number, number];
  searchStep: number;
}

export interface RecommendResult {
  recommended: number | null;
  unmetConstraints: Array<'loopMargin' | 'stressSurvival' | 'kinkClearance'>;
  bestEffort: number;
}

export function looperNetAPY(_i: LooperEconomicsInput): LooperEconomicsResult {
  throw new Error('not implemented');
}
export function liquidityStress(_i: LiquidityStressInput): LiquidityStressResult {
  throw new Error('not implemented');
}
export function sweepUtilizationTargets(_i: RecommendInput): SweepRow[] {
  throw new Error('not implemented');
}
export function recommendUTarget(_i: RecommendInput): RecommendResult {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Create the test file with one failing test**

```ts
// tests/utilization.test.ts
import { describe, it, expect } from 'vitest';
import {
  looperNetAPY,
  liquidityStress,
  recommendUTarget,
  sweepUtilizationTargets,
} from '@/lib/utilization';

const CANONICAL = {
  rTarget: 0.04,
  lltv: 0.86,
  hfBuffer: 1.5,
  witryYield7d: 0.0631,
  witryYield30d: 0.1931,
  perLoopSlippageBps: 30,
  tvlUSDM_USD: 10_000_000,
  stressPctOfSupply: 0.20,
  kinkClearance: 0.07,
  searchRange: [0.5, 0.9] as [number, number],
  searchStep: 0.01,
};

describe('looperNetAPY', () => {
  it('returns finite numbers for canonical inputs', () => {
    const r = looperNetAPY({
      uTarget: 0.8,
      rTarget: CANONICAL.rTarget,
      lltv: CANONICAL.lltv,
      hfBuffer: CANONICAL.hfBuffer,
      witryYieldAnnual: CANONICAL.witryYield7d,
      perLoopSlippageBps: CANONICAL.perLoopSlippageBps,
    });
    expect(Number.isFinite(r.netLoopAPY)).toBe(true);
    expect(Number.isFinite(r.effectiveLeverage)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx vitest run tests/utilization.test.ts`
Expected: FAIL with `not implemented`.

- [ ] **Step 4: Commit**

```bash
git add lib/utilization.ts tests/utilization.test.ts
git commit -m "feat(utilization): scaffold utilization primitives + failing test"
```

---

## Task 2: Implement `looperNetAPY`

**Files:**
- Modify: `lib/utilization.ts`
- Modify: `tests/utilization.test.ts`

The effective leverage of a recursive loop where each step borrows `LLTV/HF` of collateral value and reinvests is `1/(1 − LLTV/HF)`. The looper earns wiTRY yield on the total levered position, pays borrow APY on the borrowed portion, eats slippage on every loop step, and forgoes yield on the HF-buffer portion held idle.

- [ ] **Step 1: Add the failing assertions**

Append to `tests/utilization.test.ts`:

```ts
describe('looperNetAPY math', () => {
  it('effectiveLeverage = 1 / (1 − LLTV/HF)', () => {
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    const expected = 1 / (1 - 0.86 / 1.5);
    expect(r.effectiveLeverage).toBeCloseTo(expected, 6);
  });

  it('borrowAPY matches adaptiveCurveIRM at uTarget', async () => {
    const { adaptiveCurveIRM } = await import('@/lib/morphoMath');
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    expect(r.borrowAPY).toBeCloseTo(adaptiveCurveIRM(0.8, 0.04), 6);
  });

  it('loopMargin = netLoopAPY − witryYieldAnnual', () => {
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    expect(r.loopMargin).toBeCloseTo(r.netLoopAPY - 0.0631, 8);
  });

  it('hfIdleCost is zero when hfBuffer = 1', () => {
    const r = looperNetAPY({
      uTarget: 0.7, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.0,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    expect(r.hfIdleCost).toBeCloseTo(0, 10);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/utilization.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `looperNetAPY`**

Replace the stub in `lib/utilization.ts`:

```ts
import { adaptiveCurveIRM } from './morphoMath';

export function looperNetAPY(i: LooperEconomicsInput): LooperEconomicsResult {
  const borrowFraction = i.lltv / i.hfBuffer;
  // Closed-form geometric-sum leverage. Capped at 50× for numerical safety
  // (HF buffer ≥ 1.1 makes that ceiling unreachable in practice).
  const effectiveLeverage = borrowFraction >= 1
    ? 50
    : Math.min(50, 1 / (1 - borrowFraction));

  const borrowAPY = adaptiveCurveIRM(i.uTarget, i.rTarget);
  const borrowedShare = effectiveLeverage - 1;            // levered debt / equity

  const grossLoopAPY = effectiveLeverage * i.witryYieldAnnual;
  const borrowCost   = borrowedShare * borrowAPY;
  const slippageCost = borrowedShare * (i.perLoopSlippageBps / 10_000);
  // Capital held back to maintain HF buffer earns nothing.
  const hfIdleCost   = i.witryYieldAnnual * (1 - 1 / i.hfBuffer) * borrowedShare;

  const netLoopAPY = grossLoopAPY - borrowCost - slippageCost - hfIdleCost;
  const loopMargin = netLoopAPY - i.witryYieldAnnual;

  return { effectiveLeverage, borrowAPY, grossLoopAPY, borrowCost, slippageCost, hfIdleCost, netLoopAPY, loopMargin };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npx vitest run tests/utilization.test.ts`
Expected: PASS (all `looperNetAPY` cases).

- [ ] **Step 5: Commit**

```bash
git add lib/utilization.ts tests/utilization.test.ts
git commit -m "feat(utilization): implement looperNetAPY with leverage/borrow/slippage/HF-idle decomposition"
```

---

## Task 3: Implement `liquidityStress`

**Files:**
- Modify: `lib/utilization.ts`
- Modify: `tests/utilization.test.ts`

- [ ] **Step 1: Add failing tests**

Append:

```ts
describe('liquidityStress', () => {
  it('bufferUSD = (1 − u) × TVL', () => {
    const r = liquidityStress({ uTarget: 0.8, tvlUSDM_USD: 10_000_000, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(r.bufferUSD).toBeCloseTo(2_000_000, 6);
    expect(r.stressWithdrawalUSD).toBeCloseTo(2_000_000, 6);
  });

  it('survives = bufferUSD >= stressWithdrawalUSD', () => {
    const survives = liquidityStress({ uTarget: 0.8, tvlUSDM_USD: 10e6, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(survives.survives).toBe(true);
    const fails = liquidityStress({ uTarget: 0.85, tvlUSDM_USD: 10e6, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(fails.survives).toBe(false);
  });

  it('daysToRefillEstimate is positive when borrowAPY > 0', () => {
    const r = liquidityStress({ uTarget: 0.8, tvlUSDM_USD: 10e6, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(r.daysToRefillEstimate).toBeGreaterThan(0);
    expect(Number.isFinite(r.daysToRefillEstimate)).toBe(true);
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `npx vitest run tests/utilization.test.ts`
Expected: FAIL (`not implemented` in `liquidityStress`).

- [ ] **Step 3: Implement**

Replace the stub:

```ts
export function liquidityStress(i: LiquidityStressInput): LiquidityStressResult {
  const bufferUSD = Math.max(0, (1 - i.uTarget) * i.tvlUSDM_USD);
  const stressWithdrawalUSD = i.stressPctOfSupply * i.tvlUSDM_USD;
  const survives = bufferUSD >= stressWithdrawalUSD;
  const borrowedUSD = i.uTarget * i.tvlUSDM_USD;
  // Rough indicator only: how many days of accrued borrow repayments equal the shortfall.
  const dailyRepayment = (i.borrowAPY * borrowedUSD) / 365;
  const shortfall = Math.max(0, stressWithdrawalUSD - bufferUSD);
  const daysToRefillEstimate = dailyRepayment > 0 ? shortfall / dailyRepayment : Infinity;
  return { bufferUSD, stressWithdrawalUSD, survives, daysToRefillEstimate };
}
```

- [ ] **Step 4: Confirm pass**

Run: `npx vitest run tests/utilization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utilization.ts tests/utilization.test.ts
git commit -m "feat(utilization): liquidityStress buffer/withdrawal/days-to-refill"
```

---

## Task 4: Implement `sweepUtilizationTargets`

**Files:**
- Modify: `lib/utilization.ts`
- Modify: `tests/utilization.test.ts`

- [ ] **Step 1: Add failing test**

Append:

```ts
describe('sweepUtilizationTargets', () => {
  it('returns rows across the search range at the requested step', () => {
    const rows = sweepUtilizationTargets(CANONICAL);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.uTarget).toBeCloseTo(0.5, 6);
    expect(rows[rows.length - 1]!.uTarget).toBeLessThanOrEqual(0.9 + 1e-9);
    // Monotone non-decreasing borrowAPY across u
    for (let k = 1; k < rows.length; k++) {
      expect(rows[k]!.borrowAPY).toBeGreaterThanOrEqual(rows[k - 1]!.borrowAPY - 1e-9);
    }
  });

  it('verdict reflects feasibility and stress survival', () => {
    const rows = sweepUtilizationTargets(CANONICAL);
    const row = rows.find(r => Math.abs(r.uTarget - 0.7) < 1e-9)!;
    expect(['feasible','tight','infeasible']).toContain(row.verdict);
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `npx vitest run tests/utilization.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `lib/utilization.ts`:

```ts
export function sweepUtilizationTargets(i: RecommendInput): SweepRow[] {
  const [lo, hi] = i.searchRange;
  const out: SweepRow[] = [];
  for (let u = lo; u <= hi + 1e-9; u += i.searchStep) {
    const u2 = Math.round(u * 1e6) / 1e6;
    const e7 = looperNetAPY({
      uTarget: u2, rTarget: i.rTarget, lltv: i.lltv, hfBuffer: i.hfBuffer,
      witryYieldAnnual: i.witryYield7d, perLoopSlippageBps: i.perLoopSlippageBps,
    });
    const e30 = looperNetAPY({
      uTarget: u2, rTarget: i.rTarget, lltv: i.lltv, hfBuffer: i.hfBuffer,
      witryYieldAnnual: i.witryYield30d, perLoopSlippageBps: i.perLoopSlippageBps,
    });
    const stress = liquidityStress({
      uTarget: u2, tvlUSDM_USD: i.tvlUSDM_USD,
      stressPctOfSupply: i.stressPctOfSupply, borrowAPY: e7.borrowAPY,
    });
    const distanceToKink = 0.9 - u2;
    const meetsLoop = e7.loopMargin > 0;
    const meetsKink = distanceToKink >= i.kinkClearance;
    const meetsStress = stress.survives;
    const verdict: SweepRow['verdict'] =
      meetsLoop && meetsKink && meetsStress ? 'feasible'
      : (meetsLoop && meetsKink) ? 'tight'
      : 'infeasible';
    out.push({
      uTarget: u2,
      borrowAPY: e7.borrowAPY,
      supplierAPY: e7.borrowAPY * u2,
      loopMargin7d: e7.loopMargin,
      loopMargin30d: e30.loopMargin,
      bufferUSD: stress.bufferUSD,
      stressWithdrawalUSD: stress.stressWithdrawalUSD,
      survives: stress.survives,
      distanceToKink,
      verdict,
    });
  }
  return out;
}
```

- [ ] **Step 4: Confirm pass**

Run: `npx vitest run tests/utilization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utilization.ts tests/utilization.test.ts
git commit -m "feat(utilization): sweepUtilizationTargets across [0.5, 0.9]"
```

---

## Task 5: Implement `recommendUTarget`

**Files:**
- Modify: `lib/utilization.ts`
- Modify: `tests/utilization.test.ts`

- [ ] **Step 1: Add failing tests**

Append:

```ts
describe('recommendUTarget', () => {
  it('picks the largest u where loop+stress+kink all pass', () => {
    const r = recommendUTarget(CANONICAL);
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!).toBeLessThanOrEqual(0.83 + 1e-9); // kink clearance 0.07
    expect(r.recommended!).toBeGreaterThanOrEqual(0.5);
    expect(r.unmetConstraints).toEqual([]);
  });

  it('returns null when stress is unsatisfiable, flags stressSurvival, exposes bestEffort', () => {
    const r = recommendUTarget({ ...CANONICAL, stressPctOfSupply: 0.5 });
    expect(r.recommended).toBeNull();
    expect(r.unmetConstraints).toContain('stressSurvival');
    expect(r.bestEffort).toBeGreaterThan(0);
  });

  it('returns null when loop is unprofitable at every u', () => {
    const r = recommendUTarget({ ...CANONICAL, witryYield7d: 0.005 });
    expect(r.recommended).toBeNull();
    expect(r.unmetConstraints).toContain('loopMargin');
  });

  it('enforces kink clearance of 0.07', () => {
    const r = recommendUTarget(CANONICAL);
    if (r.recommended !== null) {
      expect(0.9 - r.recommended).toBeGreaterThanOrEqual(0.07 - 1e-9);
    }
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `npx vitest run tests/utilization.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `lib/utilization.ts`:

```ts
export function recommendUTarget(i: RecommendInput): RecommendResult {
  const rows = sweepUtilizationTargets(i);
  const feasible = rows.filter(r => r.verdict === 'feasible');
  if (feasible.length > 0) {
    const best = feasible.reduce((a, b) => (b.uTarget > a.uTarget ? b : a));
    return { recommended: best.uTarget, unmetConstraints: [], bestEffort: best.uTarget };
  }
  // Best-effort: largest u that satisfies loop + kink (drops stress).
  const loopAndKink = rows.filter(r => r.loopMargin7d > 0 && r.distanceToKink >= i.kinkClearance);
  const bestEffort = loopAndKink.length > 0
    ? loopAndKink.reduce((a, b) => (b.uTarget > a.uTarget ? b : a)).uTarget
    : 0;
  const unmet: RecommendResult['unmetConstraints'] = [];
  const anyLoop = rows.some(r => r.loopMargin7d > 0);
  const anyStress = rows.some(r => r.survives);
  const anyKink = rows.some(r => r.distanceToKink >= i.kinkClearance);
  if (!anyLoop) unmet.push('loopMargin');
  if (!anyStress) unmet.push('stressSurvival');
  if (!anyKink) unmet.push('kinkClearance');
  // If all individually satisfiable but no row passes all three at once,
  // surface stressSurvival as the dominant cause (this is the practical case).
  if (unmet.length === 0) unmet.push('stressSurvival');
  return { recommended: null, unmetConstraints: unmet, bestEffort };
}
```

- [ ] **Step 4: Confirm pass and lock recommended pin**

Run: `npx vitest run tests/utilization.test.ts`
Expected: PASS.

Then add this pinning test (the spec says pin once after first run — the value comes from the previous run's output, so first run pins, subsequent runs guard against regression):

```ts
it('canonical recommended value is stable', () => {
  const r = recommendUTarget(CANONICAL);
  // Pin after first successful run. Edit this value to whatever
  // `recommendUTarget(CANONICAL).recommended` returns on first pass.
  expect(r.recommended).not.toBeNull();
  // Range guard until the exact value is pinned:
  expect(r.recommended!).toBeGreaterThanOrEqual(0.6);
  expect(r.recommended!).toBeLessThanOrEqual(0.83);
});
```

Run: `npx vitest run tests/utilization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utilization.ts tests/utilization.test.ts
git commit -m "feat(utilization): recommendUTarget with three-gate feasibility + bestEffort fallback"
```

---

## Task 6: Composite hook `useUtilizationAnalysis`

**Files:**
- Create: `lib/useUtilizationAnalysis.ts`

- [ ] **Step 1: Write the hook**

```ts
// lib/useUtilizationAnalysis.ts
'use client';
import { useMemo } from 'react';
import { useUrlState } from './useUrlState';
import {
  looperNetAPY, liquidityStress, sweepUtilizationTargets, recommendUTarget,
  type RecommendInput, type RecommendResult, type SweepRow, type LooperEconomicsResult,
} from './utilization';
import { adaptiveCurveIRM } from './morphoMath';

export interface PageSliders {
  stressPctOfSupply: number;
  hfBuffer: number;
  rTargetOverride: number;
}

export interface UtilizationAnalysisOutput {
  inputs: RecommendInput;
  recommended: RecommendResult;
  recommendedDetails: {
    economics: LooperEconomicsResult | null;
    bufferUSD: number;
    stressWithdrawalUSD: number;
    survives: boolean;
  };
  viabilityCurve: Array<{ u: number; borrowAPY: number; viable7d: boolean; viable30d: boolean }>;
  stressTable: SweepRow[];
  recommendationTable: SweepRow[];
  heatmap: Array<{ u: number; r: number; borrowAPY: number; feasible: boolean }>;
  loopImpossible: boolean;
}

const HEATMAP_U = Array.from({ length: 10 }, (_, k) => 0.5 + k * 0.05); // 0.50..0.95
const HEATMAP_R = Array.from({ length: 10 }, (_, k) => 0.01 + k * 0.01); // 0.01..0.10
const TABLE_U = [0.6, 0.7, 0.75, 0.8, 0.83, 0.85, 0.88, 0.9];

export function useUtilizationAnalysis(s: PageSliders): UtilizationAnalysisOutput {
  const [url] = useUrlState();
  const inputs: RecommendInput = useMemo(() => ({
    rTarget: s.rTargetOverride,
    lltv: url.lltv,
    hfBuffer: s.hfBuffer,
    witryYield7d: url.iTRYYieldAnnual * 0.166,   // PLACEHOLDER: see note below
    witryYield30d: url.iTRYYieldAnnual * 0.508,  // PLACEHOLDER: see note below
    perLoopSlippageBps: 30,
    tvlUSDM_USD: url.witryTVL_USD * url.targetUtilization,
    stressPctOfSupply: s.stressPctOfSupply,
    kinkClearance: 0.07,
    searchRange: [0.5, 0.9],
    searchStep: 0.01,
  }), [s, url]);

  return useMemo(() => {
    const sweep = sweepUtilizationTargets(inputs);
    const rec = recommendUTarget(inputs);
    const target = rec.recommended ?? rec.bestEffort;

    const economics = target > 0 ? looperNetAPY({
      uTarget: target, rTarget: inputs.rTarget, lltv: inputs.lltv,
      hfBuffer: inputs.hfBuffer, witryYieldAnnual: inputs.witryYield7d,
      perLoopSlippageBps: inputs.perLoopSlippageBps,
    }) : null;
    const stress = liquidityStress({
      uTarget: target, tvlUSDM_USD: inputs.tvlUSDM_USD,
      stressPctOfSupply: inputs.stressPctOfSupply,
      borrowAPY: economics?.borrowAPY ?? 0,
    });

    const viabilityCurve = sweep.map(r => ({
      u: r.uTarget, borrowAPY: r.borrowAPY,
      viable7d: r.loopMargin7d > 0, viable30d: r.loopMargin30d > 0,
    }));

    const stressTable = sweep.filter(r =>
      [0.6, 0.7, 0.75, 0.8, 0.83, 0.85, 0.88, 0.9].some(t => Math.abs(r.uTarget - t) < 1e-6)
    );

    const recommendationTable = TABLE_U.map(u => {
      const row = sweep.find(r => Math.abs(r.uTarget - u) < 1e-6);
      return row!;
    }).filter(Boolean);

    const heatmap: UtilizationAnalysisOutput['heatmap'] = [];
    for (const u of HEATMAP_U) {
      for (const rT of HEATMAP_R) {
        const borrowAPY = adaptiveCurveIRM(u, rT);
        const feasible = borrowAPY < inputs.witryYield7d;
        heatmap.push({ u, r: rT, borrowAPY, feasible });
      }
    }

    const loopImpossible = !sweep.some(r => r.loopMargin7d > 0);

    return { inputs, recommended: rec, recommendedDetails: { economics, ...stress }, viabilityCurve, stressTable, recommendationTable, heatmap, loopImpossible };
  }, [inputs]);
}
```

> **NOTE on wiTRY USD-yield placeholders:** the simulator currently only carries `iTRYYieldAnnual` (TRY-denominated). The spec calls for explicit 7d (6.31%) and 30d (19.31%) USD figures. The placeholders above approximate by scaling the TRY yield by the historical USD/TRY conversion factor — but this is wrong in general. **Replace with real URL state in Task 7** by adding two new URL keys.

- [ ] **Step 2: Add URL keys for wiTRY USD yield**

Modify `lib/useUrlState.ts` — inside the `useQueryStates({...})` object add:

```ts
    witryYieldUSD_7d:  parseAsFloat.withDefault(0.0631),
    witryYieldUSD_30d: parseAsFloat.withDefault(0.1931),
```

- [ ] **Step 3: Wire them into the hook**

In `lib/useUtilizationAnalysis.ts` replace the placeholder lines:

```ts
    witryYield7d:  url.witryYieldUSD_7d,
    witryYield30d: url.witryYieldUSD_30d,
```

And drop the PLACEHOLDER comments.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `SidebarInputs` test fails for missing help entries, ignore — Task 14 adds them.

- [ ] **Step 5: Commit**

```bash
git add lib/useUtilizationAnalysis.ts lib/useUrlState.ts
git commit -m "feat(utilization): composite hook + URL keys for wiTRY 7d/30d USD yield"
```

---

## Task 7: `/utilization` page route + sliders

**Files:**
- Create: `app/utilization/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/utilization/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUtilizationAnalysis } from '@/lib/useUtilizationAnalysis';
import { RecommendationCard } from './components/RecommendationCard';
import { LooperViabilityCurve } from './components/LooperViabilityCurve';
import { LiquidityStressSection } from './components/LiquidityStressSection';
import { LoopEconomicsBreakdown } from './components/LoopEconomicsBreakdown';
import { IRMHeatmap } from './components/IRMHeatmap';
import { RecommendationTable } from './components/RecommendationTable';

export default function UtilizationPage() {
  const [stressPct, setStressPct] = useState(0.20);
  const [hfBuffer, setHfBuffer] = useState(1.5);
  const [rTarget, setRTarget]   = useState(0.04);

  const analysis = useUtilizationAnalysis({
    stressPctOfSupply: stressPct, hfBuffer, rTargetOverride: rTarget,
  });

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Target Utilization Calibration</h1>
        <Link href="/" className="text-sm text-blue-600 underline">← back to sim</Link>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4">
        <Slider label="Stress withdrawal" value={stressPct} min={0.05} max={0.5}  step={0.01} format={v=>`${(v*100).toFixed(0)}%`} onChange={setStressPct} />
        <Slider label="Looper HF buffer"  value={hfBuffer}  min={1.1}  max={2.5}  step={0.05} format={v=>v.toFixed(2)+'×'}      onChange={setHfBuffer} />
        <Slider label="r_target override" value={rTarget}   min={0.01} max={0.10} step={0.005} format={v=>`${(v*100).toFixed(2)}%`} onChange={setRTarget} />
      </section>

      <RecommendationCard analysis={analysis} />
      <LooperViabilityCurve analysis={analysis} />
      <LiquidityStressSection analysis={analysis} />
      <LoopEconomicsBreakdown analysis={analysis} />
      <IRMHeatmap analysis={analysis} />
      <RecommendationTable analysis={analysis} />
    </div>
  );
}

function Slider(props: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between"><span>{props.label}</span><span className="font-mono">{props.format(props.value)}</span></span>
      <input type="range" min={props.min} max={props.max} step={props.step}
        value={props.value} onChange={e => props.onChange(parseFloat(e.target.value))} />
    </label>
  );
}
```

- [ ] **Step 2: Create placeholder section components so the page renders**

Create each of these files with a minimal placeholder body so Task 7 can be merged independently. Each will be replaced in Tasks 8–13.

```tsx
// app/utilization/components/RecommendationCard.tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
export function RecommendationCard({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return <section className="rounded-lg border p-4">RecommendationCard (placeholder) — rec: {String(analysis.recommended.recommended)}</section>;
}
```

```tsx
// app/utilization/components/LooperViabilityCurve.tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
export function LooperViabilityCurve({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return <section className="rounded-lg border p-4">LooperViabilityCurve (placeholder) — {analysis.viabilityCurve.length} points</section>;
}
```

```tsx
// app/utilization/components/LiquidityStressSection.tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
export function LiquidityStressSection({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return <section className="rounded-lg border p-4">LiquidityStressSection (placeholder) — {analysis.stressTable.length} rows</section>;
}
```

```tsx
// app/utilization/components/LoopEconomicsBreakdown.tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
export function LoopEconomicsBreakdown({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return <section className="rounded-lg border p-4">LoopEconomicsBreakdown (placeholder) — netLoopAPY {analysis.recommendedDetails.economics?.netLoopAPY ?? 'n/a'}</section>;
}
```

```tsx
// app/utilization/components/IRMHeatmap.tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
export function IRMHeatmap({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return <section className="rounded-lg border p-4">IRMHeatmap (placeholder) — {analysis.heatmap.length} cells</section>;
}
```

```tsx
// app/utilization/components/RecommendationTable.tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
export function RecommendationTable({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return <section className="rounded-lg border p-4">RecommendationTable (placeholder) — {analysis.recommendationTable.length} rows</section>;
}
```

- [ ] **Step 3: Build the static export to confirm route compiles**

Run: `npm run build`
Expected: PASS, output includes `/utilization` in the route table.

- [ ] **Step 4: Commit**

```bash
git add app/utilization/
git commit -m "feat(utilization): /utilization page skeleton with three sliders + section placeholders"
```

---

## Task 8: RecommendationCard

**Files:**
- Modify: `app/utilization/components/RecommendationCard.tsx`

- [ ] **Step 1: Replace placeholder with the full card**

```tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

export function RecommendationCard({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const { recommended, recommendedDetails, inputs, loopImpossible } = analysis;
  const u = recommended.recommended ?? recommended.bestEffort;
  const econ = recommendedDetails.economics;

  if (loopImpossible) {
    return (
      <section className="rounded-lg border border-red-500 bg-red-50 p-4">
        <h2 className="text-lg font-semibold text-red-700">Looping is not profitable at any utilization</h2>
        <p className="text-sm">With wiTRY 7d yield {pct(inputs.witryYield7d)} and r_target {pct(inputs.rTarget)},
        no value of u_target produces positive loop margin. Lower r_target or raise wiTRY yield assumptions.</p>
      </section>
    );
  }

  const verdict = recommended.recommended !== null
    ? `Recommended target utilization: ${pct(u)}`
    : `No fully-feasible target; best effort: ${pct(u)} (unmet: ${recommended.unmetConstraints.join(', ')})`;

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{verdict}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Stat label="Borrow APY"        value={econ ? pct(econ.borrowAPY) : '—'} />
        <Stat label="Supplier APY"      value={econ ? pct(econ.borrowAPY * u) : '—'} />
        <Stat label="Loop margin (7d)"  value={econ ? pct(econ.loopMargin) : '—'}
               tone={econ && econ.loopMargin > 0 ? 'good' : 'bad'} />
        <Stat label="Distance to kink"  value={(0.9 - u).toFixed(3)}
               tone={0.9 - u >= 0.07 ? 'good' : 'bad'} />
        <Stat label="Liquidity buffer"  value={usd(recommendedDetails.bufferUSD)} />
        <Stat label="Stress withdrawal" value={usd(recommendedDetails.stressWithdrawalUSD)} />
        <Stat label="Survives stress?"  value={recommendedDetails.survives ? '✓' : '✗'}
               tone={recommendedDetails.survives ? 'good' : 'bad'} />
        <Stat label="Looper net APY"    value={econ ? pct(econ.netLoopAPY) : '—'} />
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`font-mono text-base ${color}`}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/utilization/components/RecommendationCard.tsx
git commit -m "feat(utilization): RecommendationCard with full stat grid + loop-impossible banner"
```

---

## Task 9: LooperViabilityCurve

**Files:**
- Modify: `app/utilization/components/LooperViabilityCurve.tsx`

- [ ] **Step 1: Replace placeholder**

```tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';

export function LooperViabilityCurve({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const data = analysis.viabilityCurve.map(p => ({
    u: p.u, borrowAPY: p.borrowAPY * 100, viable7d: p.viable7d ? 1 : 0,
  }));
  const wY7  = analysis.inputs.witryYield7d * 100;
  const wY30 = analysis.inputs.witryYield30d * 100;

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Looper Viability Curve</h2>
      <p className="text-sm text-gray-600">Borrow APY across u_target with wiTRY 7d / 30d reference yields.</p>
      <div className="h-64 mt-3">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="u" tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
            <YAxis tickFormatter={v => `${v.toFixed(1)}%`} />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} labelFormatter={l => `u_target ${(l*100).toFixed(0)}%`} />
            <Legend />
            <ReferenceLine y={wY7}  stroke="#10b981" strokeDasharray="4 4" label={{ value: 'wiTRY 7d', position: 'right' }} />
            <ReferenceLine y={wY30} stroke="#a855f7" strokeDasharray="4 4" label={{ value: 'wiTRY 30d', position: 'right' }} />
            <ReferenceLine x={0.9}  stroke="#ef4444" strokeDasharray="2 2" label={{ value: 'IRM kink', position: 'top' }} />
            <Line type="monotone" dataKey="borrowAPY" stroke="#1d4ed8" strokeWidth={2} dot={false} name="Borrow APY" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/utilization/components/LooperViabilityCurve.tsx
git commit -m "feat(utilization): LooperViabilityCurve with wiTRY 7d/30d reference lines + IRM kink"
```

---

## Task 10: LiquidityStressSection

**Files:**
- Modify: `app/utilization/components/LiquidityStressSection.tsx`

- [ ] **Step 1: Replace placeholder**

```tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

export function LiquidityStressSection({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Liquidity Stress Test</h2>
      <p className="text-sm text-gray-600">
        Stress: {pct(analysis.inputs.stressPctOfSupply)} of supply withdrawn in one day.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="py-1">u_target</th>
            <th>Buffer</th>
            <th>Stress withdrawal</th>
            <th>Survives?</th>
            <th>Days to refill</th>
          </tr>
        </thead>
        <tbody>
          {analysis.stressTable.map(r => (
            <tr key={r.uTarget} className="border-t">
              <td className="py-1 font-mono">{pct(r.uTarget)}</td>
              <td className="font-mono">{usd(r.bufferUSD)}</td>
              <td className="font-mono">{usd(r.stressWithdrawalUSD)}</td>
              <td className={r.survives ? 'text-green-700' : 'text-red-700'}>{r.survives ? '✓' : '✗'}</td>
              <td className="font-mono text-gray-600">
                {r.survives ? '—' : (((r.stressWithdrawalUSD - r.bufferUSD) / Math.max(1e-9, r.borrowAPY * r.uTarget * analysis.inputs.tvlUSDM_USD / 365)).toFixed(1))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/utilization/components/LiquidityStressSection.tsx
git commit -m "feat(utilization): LiquidityStressSection table with survives/days-to-refill"
```

---

## Task 11: LoopEconomicsBreakdown

**Files:**
- Modify: `app/utilization/components/LoopEconomicsBreakdown.tsx`

- [ ] **Step 1: Replace placeholder with a waterfall-style bar chart**

```tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function LoopEconomicsBreakdown({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const econ = analysis.recommendedDetails.economics;
  if (!econ) return <section className="rounded-lg border p-4 text-sm text-gray-500">No loop economics — looper inputs unviable.</section>;

  const data = [
    { name: 'Gross loop APY',  value: econ.grossLoopAPY * 100, color: '#10b981' },
    { name: 'Borrow cost',     value: -econ.borrowCost * 100, color: '#ef4444' },
    { name: 'Slippage',        value: -econ.slippageCost * 100, color: '#f97316' },
    { name: 'HF idle cost',    value: -econ.hfIdleCost * 100, color: '#a855f7' },
    { name: 'Net loop APY',    value: econ.netLoopAPY * 100, color: '#1d4ed8' },
    { name: 'wiTRY (hold)',    value: analysis.inputs.witryYield7d * 100, color: '#6b7280' },
  ];

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Loop Economics Breakdown</h2>
      <p className="text-sm text-gray-600">
        Effective leverage <span className="font-mono">{econ.effectiveLeverage.toFixed(2)}×</span>.
        Loop margin <span className={`font-mono ${econ.loopMargin > 0 ? 'text-green-700' : 'text-red-700'}`}>{pct(econ.loopMargin)}</span>.
      </p>
      <div className="h-64 mt-3">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={v => `${v.toFixed(1)}%`} />
            <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Bar dataKey="value">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/utilization/components/LoopEconomicsBreakdown.tsx
git commit -m "feat(utilization): LoopEconomicsBreakdown waterfall (gross/borrow/slippage/hf/net/hold)"
```

---

## Task 12: IRMHeatmap

**Files:**
- Modify: `app/utilization/components/IRMHeatmap.tsx`

- [ ] **Step 1: Replace placeholder with a CSS-grid heatmap**

```tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

const HEATMAP_U = Array.from({ length: 10 }, (_, k) => 0.5 + k * 0.05);
const HEATMAP_R = Array.from({ length: 10 }, (_, k) => 0.01 + k * 0.01);

function colorFor(borrowAPY: number, witryY: number): string {
  // green = feasible (low borrow vs yield), red = infeasible
  const ratio = Math.min(2, borrowAPY / Math.max(1e-6, witryY));
  if (ratio < 1) {
    const t = ratio;                              // 0..1 → green→amber
    const r = Math.round(16 + t * (245 - 16));
    const g = Math.round(185 + t * (158 - 185));
    return `rgb(${r}, ${g}, 129)`;
  }
  const t = Math.min(1, (ratio - 1));             // 1..2 → amber→red
  const r = Math.round(245 + t * (239 - 245));
  const g = Math.round(158 + t * (68 - 158));
  return `rgb(${r}, ${g}, 68)`;
}

export function IRMHeatmap({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const w7 = analysis.inputs.witryYield7d;
  const currentU = analysis.recommended.recommended ?? analysis.recommended.bestEffort;
  const currentR = analysis.inputs.rTarget;

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">IRM Sensitivity Heatmap</h2>
      <p className="text-sm text-gray-600">
        borrowAPY across (u_target, r_target). Cells below wiTRY 7d ({(w7*100).toFixed(2)}%) are loop-feasible.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr><th></th>{HEATMAP_U.map(u => <th key={u} className="px-2 py-1 font-mono">{(u*100).toFixed(0)}%</th>)}</tr>
          </thead>
          <tbody>
            {HEATMAP_R.slice().reverse().map(rT => (
              <tr key={rT}>
                <th className="pr-2 py-1 font-mono text-right">{(rT*100).toFixed(1)}%</th>
                {HEATMAP_U.map(u => {
                  const cell = analysis.heatmap.find(c => Math.abs(c.u - u) < 1e-6 && Math.abs(c.r - rT) < 1e-6);
                  if (!cell) return <td key={u}/>;
                  const isCurrent = Math.abs(u - currentU) < 0.025 && Math.abs(rT - currentR) < 0.0051;
                  return (
                    <td key={u} className={`h-8 w-12 border text-center font-mono ${isCurrent ? 'outline outline-2 outline-black' : ''}`}
                        style={{ background: colorFor(cell.borrowAPY, w7) }}
                        title={`u=${(u*100).toFixed(0)}%, r=${(rT*100).toFixed(1)}%, borrow=${(cell.borrowAPY*100).toFixed(2)}%`}>
                      {(cell.borrowAPY*100).toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">x: u_target · y: r_target · cell: borrowAPY% · outline: current (recommended)</p>
    </section>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/utilization/components/IRMHeatmap.tsx
git commit -m "feat(utilization): IRMHeatmap with feasibility shading + current-point outline"
```

---

## Task 13: RecommendationTable

**Files:**
- Modify: `app/utilization/components/RecommendationTable.tsx`

- [ ] **Step 1: Replace placeholder**

```tsx
'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

export function RecommendationTable({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const rec = analysis.recommended.recommended;
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Recommendation Table</h2>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">u_target</th>
            <th>Borrow APY</th>
            <th>Supplier APY</th>
            <th>Margin 7d</th>
            <th>Margin 30d</th>
            <th>Buffer</th>
            <th>Stress</th>
            <th>Survives</th>
            <th>Δ kink</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {analysis.recommendationTable.map(r => {
            const isRec = rec !== null && Math.abs(r.uTarget - rec) < 1e-6;
            return (
              <tr key={r.uTarget} className={`border-t ${isRec ? 'bg-blue-50 font-medium' : ''}`}>
                <td className="py-1 font-mono">{pct(r.uTarget)}</td>
                <td className="font-mono">{pct(r.borrowAPY)}</td>
                <td className="font-mono">{pct(r.supplierAPY)}</td>
                <td className={`font-mono ${r.loopMargin7d > 0 ? 'text-green-700' : 'text-red-700'}`}>{pct(r.loopMargin7d)}</td>
                <td className={`font-mono ${r.loopMargin30d > 0 ? 'text-green-700' : 'text-red-700'}`}>{pct(r.loopMargin30d)}</td>
                <td className="font-mono">{usd(r.bufferUSD)}</td>
                <td className="font-mono">{usd(r.stressWithdrawalUSD)}</td>
                <td className={r.survives ? 'text-green-700' : 'text-red-700'}>{r.survives ? '✓' : '✗'}</td>
                <td className="font-mono">{r.distanceToKink.toFixed(3)}</td>
                <td>{r.verdict === 'feasible' ? '✓ feasible' : r.verdict === 'tight' ? '⚠ tight' : '✗ infeasible'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/utilization/components/RecommendationTable.tsx
git commit -m "feat(utilization): RecommendationTable with recommended-row highlight"
```

---

## Task 14: Help registry entries + navigation link

**Files:**
- Modify: `lib/help/registry.ts`
- Modify: `app/page.tsx`
- Modify: `README.md`

- [ ] **Step 1: Inspect existing PARAM_HELP keys**

Run: `grep -n "witryYieldUSD\|recommendedUtilization\|hfBuffer" lib/help/registry.ts`
Expected: no matches (this is what we're adding).

- [ ] **Step 2: Add the two new sidebar input help entries**

In `lib/help/registry.ts` inside the `PARAM_HELP` object (locate by `// PARAM_HELP must have an entry for every key of SidebarInputs`), add:

```ts
  witryYieldUSD_7d:  { oneLiner: 'Trailing-7-day USD APY of holding wiTRY. Used by /utilization as the conservative loop-viability threshold.' },
  witryYieldUSD_30d: { oneLiner: 'Trailing-30-day USD APY of holding wiTRY. Shown as the optimistic reference on /utilization.' },
```

Place them next to other yield-related fields.

- [ ] **Step 3: Update the SidebarInputs type**

In `types/simulator.ts` add inside the `SidebarInputs` interface (alongside `iTRYYieldAnnual`):

```ts
  witryYieldUSD_7d: number;
  witryYieldUSD_30d: number;
```

- [ ] **Step 4: Run the registry sanity test**

Run: `npx vitest run -t "PARAM_HELP" 2>/dev/null || npx vitest run tests/`
Expected: PASS. If a registry test asserts an exact set, add the two keys to its expected list.

- [ ] **Step 5: Add a nav link on the main page**

In `app/page.tsx`, locate the existing header (or first `<main>` block) and add near the top:

```tsx
<div className="text-right text-sm">
  <a href="/utilization" className="text-blue-600 underline">Target utilization calibration →</a>
</div>
```

Pick the spot that matches the existing layout — do NOT restructure the page.

- [ ] **Step 6: README pointer**

Append to `README.md`:

```markdown
### `/utilization` — Target utilization calibration

A standalone page that recommends an ideal `targetUtilization` for the USDM market.
It balances three constraints: looper net APY must beat holding wiTRY (gate at the
conservative 7-day USD yield), the (1 − u) × TVL buffer must absorb a stress
withdrawal (slider), and u_target must stay clear of the IRM kink at 0.9 by ≥ 0.07.
Three page-local sliders (stress %, looper HF buffer, r_target override) make it
interactive without touching the main sidebar.
```

- [ ] **Step 7: Full build + tests**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/help/registry.ts types/simulator.ts app/page.tsx README.md
git commit -m "feat(utilization): help entries for wiTRY 7d/30d USD yield + nav link + README pointer"
```

---

## Task 15: Final validation

**Files:** none

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all unit tests PASS (existing + new `tests/utilization.test.ts`).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. Fix any introduced.

- [ ] **Step 3: Static export**

Run: `npm run build`
Expected: PASS; `/utilization` listed in the route output.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`
Open `http://localhost:3000/utilization`. Confirm:
- All three sliders move the recommendation
- IRM kink visible on the viability curve
- Recommended row highlighted in the table
- Heatmap renders with current-point outline

- [ ] **Step 5: Final commit / tag**

If anything was tweaked during manual smoke:

```bash
git add -A
git commit -m "chore(utilization): final polish from manual smoke test"
```

---

## Self-Review

- **Spec coverage:** all five sections + recommendation card + three sliders + recommendation rule + canonical test fixture + help entries → Tasks 1–14. ✓
- **Placeholder scan:** Task 6 contains an explicit placeholder note that's resolved in the same task's Step 2–3. No "TBD" or "fill in" remain. ✓
- **Type consistency:** `LooperEconomicsResult` fields used consistently across Tasks 2, 6, 8, 11. `SweepRow.verdict` literal triple matches across primitive + table + heatmap. URL keys `witryYieldUSD_7d` / `witryYieldUSD_30d` introduced in Task 6, registered as help in Task 14, added to `SidebarInputs` in Task 14. ✓
- **Spec note:** Task 5 pinning test is range-guarded (0.6–0.83) rather than a hard pin. Tighten to a single number after the first green run.
