# Home Page Loop Carry / FX-Vol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page's drift-based `leverageLoopAPY` formula with the carry-only loop math now used on `/utilization` (PR #88), and add a Monte-Carlo-path-based realized loop APY distribution (`P5/P50/P95` + liquidation rate) computed inside the existing FX worker.

**Architecture:** A single composite hook (`useSimulator`) remains the only orchestration layer. Loop math stays in `lib/utilization.ts` (per Phase B decision — home imports directly). A new `looperPathPnL(paths, …)` primitive computes realized loop APY along each Monte Carlo FX path inside `lib/simulation.worker.ts`. The `LiquidityStrategy` section is rewritten into three rows: Supplier APY (unchanged), deterministic loop bars (Hold / Loop / Loop+incentives), realized P&L distribution (P5/P50/P95 + liquidation rate). `hfBuffer` is promoted from `/utilization`'s local React state to URL state so both pages share it.

**Tech Stack:** Next.js 14 (static export), TypeScript strict, React hooks, nuqs (URL state), Comlink (web worker), Recharts, Vitest + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-24-home-loop-carry-fxvol-design.md`

**Branch:** `feat/home-loop-carry-fxvol` (off `main` post-PR-#88, commit `4008f1d`).

---

## File Structure

**Created (none — loop math stays in `lib/utilization.ts` per Q1 decision).**

**Modified — `lib/`:**
- `lib/utilization.ts` — add `looperPathPnL` function and its `Input`/`Result` types
- `lib/simulator.ts` — rewrite `computeStrategy` to delegate carry math to `looperNetAPY`; remove `expectedTRYDepreciation_annual`; rename `leverageLoopAPY` → `netLoopAPY`; add `netLoopAPY_withIncentives`, `effectiveLeverage`, `loopDebtPerCollateral` to `StrategyOut`
- `lib/simulation.worker.ts` — extend `WorkerInput` with `borrowAPY`, `hfBuffer`; extend `WorkerOutput` with `loopPath`; call `looperPathPnL` in `run()`
- `lib/useSimulator.ts` — drop `DEFAULT_TRY_DEPRECIATION_ANNUAL`; wire new `computeStrategy` args; thread `borrowAPY` + `hfBuffer` into worker payload; fold `result.loopPath` into `strategy.loopPath`
- `lib/useUrlState.ts` — add `hfBuffer: parseAsFloat.withDefault(1.5)`
- `lib/help/kpiKeys.ts` — drop `leverageLoopAPY`; add `netLoopAPY`, `netLoopAPYWithIncentives`, `effectiveLeverageStrategy`, `loopDebtPerCollateral`, `loopAPYP5`, `loopAPYP50`, `loopAPYP95`, `loopLiquidationRate`
- `lib/help/content/strategy.ts` — drop the old `leverageLoopAPY` entry; add 8 new entries; update `STRATEGY_KPIS` export

**Modified — `types/`:**
- `types/simulator.ts` — add `hfBuffer` to `SidebarInputs`; rewrite `LiquidityStrategyOutput` (rename + add fields + add optional `loopPath`)

**Modified — `app/`:**
- `app/components/Sidebar.tsx` — add `hfBuffer` slider (range 1.0–3.0, step 0.05)
- `app/components/sections/LiquidityStrategy.tsx` — full rewrite of the loop card portion (three-row layout)
- `app/utilization/page.tsx` — migrate local `useState(1.5)` for `hfBuffer` to URL state via `useUrlState`

**Modified — `tests/`:**
- `tests/utilization.test.ts` — add `describe('looperPathPnL', …)` block (3 cases)
- `tests/simulator.test.ts` — rewrite both `computeStrategy` test cases against new shape
- `tests-e2e/perf.spec.ts` — bump ceiling only if needed (one-line change)

---

## Task 1: Add `hfBuffer` to URL state and Sidebar

**Why first:** Foundational data plumbing. All later tasks read `s.hfBuffer`. Cleanly stands alone.

**Files:**
- Modify: `lib/useUrlState.ts`
- Modify: `types/simulator.ts`
- Modify: `app/components/Sidebar.tsx`
- Modify: `app/utilization/page.tsx`

- [ ] **Step 1: Add `hfBuffer` to `SidebarInputs`**

Edit `types/simulator.ts`. Find the `SidebarInputs` interface (line ~7) and insert `hfBuffer` after `witryYieldUSD_30d`:

```typescript
export interface SidebarInputs {
  // ...existing fields above...
  witryYieldUSD_30d: number;
  hfBuffer: number;            // looper health-factor safety buffer (≥ 1.0)
  usdtryBaseline: number;
  // ...existing fields below...
}
```

- [ ] **Step 2: Add `hfBuffer` default to `useUrlState`**

Edit `lib/useUrlState.ts`. Find the line declaring `witryYieldUSD_30d` (line ~35) and add directly below:

```typescript
witryYieldUSD_30d: parseAsFloat.withDefault(0.1931),
hfBuffer:          parseAsFloat.withDefault(1.5),
```

- [ ] **Step 3: Run build to verify type plumbing**

```bash
npm run lint
```

Expected: Pass. (`Sidebar.tsx` and `app/utilization/page.tsx` haven't been touched yet but TypeScript only enforces presence; we're adding a field, not removing.)

If lint surfaces errors in places that destructure `SidebarInputs`, those are pre-existing issues — flag and fix only those.

- [ ] **Step 4: Add the `hfBuffer` slider to `Sidebar`**

Edit `app/components/Sidebar.tsx`. Find the block that renders the `witryYieldAnnual` slider (around line 109) and insert a sibling slider directly after it. Match the existing slider component pattern used in the file (a `<NumberInput>` or similar — copy the exact JSX shape of `witryYieldAnnual` and adapt). The label should read "HF buffer (looper)" with range 1.0–3.0, step 0.05.

Concrete pattern to insert (adapt component name to whatever the file uses — read the surrounding JSX first):

```tsx
<NumberInput
  label="HF buffer (looper)"
  helpKey="hfBufferInput"
  value={s.hfBuffer}
  onChange={(v) => setS({ hfBuffer: v })}
  min={1.0}
  max={3.0}
  step={0.05}
/>
```

Note `helpKey="hfBufferInput"` — that key already exists in `kpiKeys.ts` (section `'utilization'`). Re-using it is acceptable; the help popover content is identical regardless of which page hosts the slider.

- [ ] **Step 5: Migrate `/utilization` `hfBuffer` from local state to URL state**

Edit `app/utilization/page.tsx`. Line 26 currently reads:

```typescript
const [hfBuffer, setHfBuffer] = useState(1.5);
```

Replace it with a destructure from `useUrlState`. Use the existing `useUrlState` import pattern in this file (if not yet imported, add `import { useUrlState } from '@/lib/useUrlState';` at the top with the other lib imports). Then:

```typescript
const [url, setUrl] = useUrlState();
const hfBuffer = url.hfBuffer;
const setHfBuffer = (v: number) => setUrl({ hfBuffer: v });
```

(Keep the `setHfBuffer` shape so existing call sites in the file don't need changing.) Verify the file compiles — there may be other places `hfBuffer` is referenced; they should still work because the variable name is preserved.

- [ ] **Step 6: Smoke-test both pages locally**

```bash
npm run dev
```

Open `http://localhost:3000` — verify the new "HF buffer (looper)" slider appears in the sidebar with default 1.5. Move it to 2.0 — URL gains `?hfBuffer=2`.

Open `http://localhost:3000/utilization` — verify the `/utilization` HF buffer slider on that page shares the same URL parameter (move it, check URL updates; reload page, value persists).

Stop the dev server.

- [ ] **Step 7: Run unit tests to confirm nothing regressed**

```bash
npm test
```

Expected: PASS (no test currently asserts `hfBuffer` semantics, so this just confirms the type plumbing didn't break anything).

- [ ] **Step 8: Commit**

```bash
git add lib/useUrlState.ts types/simulator.ts app/components/Sidebar.tsx app/utilization/page.tsx
git commit -m "$(cat <<'EOF'
feat(urlstate): promote hfBuffer to URL state; add sidebar slider

Adds hfBuffer (looper health-factor safety buffer) to SidebarInputs
and useUrlState with default 1.5. Adds a sidebar slider on home.
Migrates /utilization/page.tsx from local useState(1.5) to URL state
so both pages share the parameter via URL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `looperPathPnL` to `lib/utilization.ts` (TDD)

**Why second:** Pure function with no UI / worker deps. Test first, lock the math, then later tasks consume it.

**Files:**
- Modify: `lib/utilization.ts`
- Modify: `tests/utilization.test.ts`

- [ ] **Step 1: Write the three failing tests**

Append to `tests/utilization.test.ts`. If the file doesn't yet import `looperPathPnL`, add it to the existing import line:

```typescript
import { looperNetAPY, looperPathPnL } from '@/lib/utilization';
```

Then append at the end of the file:

```typescript
describe('looperPathPnL', () => {
  const H = 90;
  const N = 100;
  // Build N identical paths of length H+1 with S(t) = S0 (no FX move).
  function flatPaths(S0: number): number[][] {
    return Array.from({ length: N }, () =>
      Array.from({ length: H + 1 }, () => S0),
    );
  }

  it('flat FX paths produce realized APY ≈ deterministic netLoopAPY', () => {
    const S0 = 30;
    const deterministic = looperNetAPY({
      uTarget: 0.80,
      rTarget: 0.04,
      lltv: 0.86,
      hfBuffer: 1.5,
      witryYieldAnnual: 0.38,
      perLoopSlippageBps: 30,
      fxAnnualVol: 0,
      fxStressZ: 0,
    });
    const out = looperPathPnL({
      paths: flatPaths(S0),
      lltv: 0.86,
      hfBuffer: 1.5,
      witryYieldAnnual: 0.38,
      borrowAPY: deterministic.borrowAPY,
      perLoopSlippageBps: 30,
    });
    expect(out.liquidationRate).toBe(0);
    expect(out.apyP50).toBeCloseTo(deterministic.netLoopAPY, 1);
    expect(out.apyP5).toBeCloseTo(deterministic.netLoopAPY, 1);
    expect(out.apyP95).toBeCloseTo(deterministic.netLoopAPY, 1);
  });

  it('strongly depreciating TRY liquidates most positions', () => {
    // Linear glide from S0=30 to S0=45 (TRY weakens 50% over horizon).
    const S0 = 30;
    const Send = 45;
    const paths: number[][] = Array.from({ length: N }, () =>
      Array.from({ length: H + 1 }, (_, t) => S0 + ((Send - S0) * t) / H),
    );
    const out = looperPathPnL({
      paths,
      lltv: 0.86,
      hfBuffer: 1.5,
      witryYieldAnnual: 0.38,
      borrowAPY: 0.04,
      perLoopSlippageBps: 30,
    });
    expect(out.liquidationRate).toBeGreaterThan(0.9);
    expect(out.apyP5).toBeLessThan(-0.3); // wiped positions tank the lower tail
  });

  it('slightly appreciating TRY boosts realized APY above carry', () => {
    // Linear glide from S0=30 to S0=29 (TRY strengthens ~3% over horizon).
    const S0 = 30;
    const Send = 29;
    const paths: number[][] = Array.from({ length: N }, () =>
      Array.from({ length: H + 1 }, (_, t) => S0 + ((Send - S0) * t) / H),
    );
    const deterministic = looperNetAPY({
      uTarget: 0.80,
      rTarget: 0.04,
      lltv: 0.86,
      hfBuffer: 1.5,
      witryYieldAnnual: 0.38,
      perLoopSlippageBps: 30,
      fxAnnualVol: 0,
      fxStressZ: 0,
    });
    const out = looperPathPnL({
      paths,
      lltv: 0.86,
      hfBuffer: 1.5,
      witryYieldAnnual: 0.38,
      borrowAPY: deterministic.borrowAPY,
      perLoopSlippageBps: 30,
    });
    expect(out.liquidationRate).toBe(0);
    expect(out.apyP50).toBeGreaterThan(deterministic.netLoopAPY);
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
npx vitest run tests/utilization.test.ts
```

Expected: Three new tests fail with `looperPathPnL is not a function` (or similar export-missing error).

- [ ] **Step 3: Implement `looperPathPnL` in `lib/utilization.ts`**

Append to `lib/utilization.ts` (after the `recommendUTarget` function, before the file ends):

```typescript
export interface LooperPathPnLInput {
  paths: number[][];               // worker output; paths[i][t] = USD/TRY at step t
  lltv: number;
  hfBuffer: number;
  witryYieldAnnual: number;        // typically witryYieldUSD_7d
  borrowAPY: number;               // adaptiveCurveIRM(targetUtilization, rTarget)
  perLoopSlippageBps: number;
}

export interface LooperPathPnLResult {
  apyByPath: number[];
  liquidatedByPath: boolean[];
  apyP5: number;
  apyP50: number;
  apyP95: number;
  liquidationRate: number;
}

/**
 * Walk each Monte Carlo USD/TRY path forward, marking the levered wiTRY
 * position to market at each step. wiTRY NAV grows in TRY at witryYieldAnnual;
 * the USD value swings with 1/S[t]. Debt accrues at borrowAPY. If health
 * factor hits 1.0 at any step the position is closed; we charge an LIF
 * haircut proxy and freeze equity. At horizon the survivors are annualized.
 *
 * Output is per-path scalar realized APY plus distribution percentiles.
 * Crude vs simulateBadDebt: ignores AMM slippage at liquidation and assumes
 * a single liquidator-bonus haircut. That's intentional — this represents
 * the looper's expected P&L, not the protocol's bad-debt exposure.
 */
export function looperPathPnL(i: LooperPathPnLInput): LooperPathPnLResult {
  const borrowFraction = i.lltv / i.hfBuffer;
  const effectiveLeverage = borrowFraction >= 1
    ? 50
    : Math.min(50, 1 / (1 - borrowFraction));
  const borrowedShare = effectiveLeverage - 1;
  const slippageDragAnnual = borrowedShare * (i.perLoopSlippageBps / 10_000);

  // Constant liquidator-bonus haircut proxy (LIF − 1 of seized debt).
  // At LLTV = 0.86 / β = 0.3, LIF ≈ 1.0625; haircut ≈ 6.25% of debt.
  // We import LIF lazily to keep this file dep-light.
  const lif = lifApprox(i.lltv);
  const liqHaircutFracOfDebt = Math.max(0, lif - 1);

  const apyByPath: number[] = [];
  const liquidatedByPath: boolean[] = [];

  for (const path of i.paths) {
    if (path.length < 2) {
      apyByPath.push(0);
      liquidatedByPath.push(false);
      continue;
    }
    const S0 = path[0]!;
    const H = path.length - 1;        // horizon in steps (days)
    const equity0 = 1;
    const collateralTRY = effectiveLeverage;     // collateral measured in iTRY units
    const debt0_USD = borrowedShare;

    let liquidated = false;
    let liquidationStep = -1;
    let terminalEquity = 0;

    for (let t = 1; t <= H; t++) {
      const St = path[t]!;
      if (!Number.isFinite(St) || St <= 0) continue;
      const nav = Math.pow(1 + i.witryYieldAnnual, t / 365);
      const collateralUSD = collateralTRY * nav * (S0 / St);
      const debtUSD = debt0_USD * Math.pow(1 + i.borrowAPY, t / 365);
      const dragUSD = slippageDragAnnual * (t / 365);
      const equity = collateralUSD - debtUSD - dragUSD;
      // HF = (collateral × lltv) / debt; HF ≤ 1 ⇒ liquidation.
      const hf = debtUSD > 0 ? (collateralUSD * i.lltv) / debtUSD : Infinity;
      if (hf <= 1) {
        liquidated = true;
        liquidationStep = t;
        // Terminal equity after LIF-haircut, floored at 0.
        terminalEquity = Math.max(0, equity - liqHaircutFracOfDebt * debtUSD);
        break;
      }
      if (t === H) terminalEquity = equity;
    }

    const horizonForAnnualize = liquidated ? liquidationStep : H;
    const ratio = terminalEquity / equity0;
    const apy =
      horizonForAnnualize > 0 && ratio > 0
        ? Math.pow(ratio, 365 / horizonForAnnualize) - 1
        : -1;                          // wiped positions report −100% APY
    apyByPath.push(apy);
    liquidatedByPath.push(liquidated);
  }

  const sorted = [...apyByPath].sort((x, y) => x - y);
  const at = (q: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor(q * (sorted.length - 1))),
    );
    return sorted[idx]!;
  };
  const liqRate = liquidatedByPath.filter(Boolean).length / Math.max(1, liquidatedByPath.length);

  return {
    apyByPath,
    liquidatedByPath,
    apyP5: at(0.05),
    apyP50: at(0.50),
    apyP95: at(0.95),
    liquidationRate: liqRate,
  };
}

/** Local LIF approximation: avoids cyclic import with morphoMath in test fixtures. */
function lifApprox(lltv: number): number {
  // Same formula as lib/morphoMath.ts: LIF = min(LIF_CAP, 1/(βL + (1−β))).
  // Keep BETA / LIF_CAP local-shadowed to mirror morphoMath constants.
  const BETA_LOCAL = 0.3;
  const LIF_CAP_LOCAL = 1.15;
  const denom = BETA_LOCAL * lltv + (1 - BETA_LOCAL);
  const raw = 1 / denom;
  return Math.min(LIF_CAP_LOCAL, raw);
}
```

Note on `lifApprox`: import `LIF` directly from `./morphoMath` instead if it works without circular-import noise. Try that first:

```typescript
import { adaptiveCurveIRM, LIF } from './morphoMath';
```

Then in `looperPathPnL`, use `LIF(i.lltv)` instead of the helper. Drop `lifApprox` if the direct import works.

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
npx vitest run tests/utilization.test.ts
```

Expected: All three new tests pass, plus all pre-existing tests in the file pass.

If the flat-path tolerance fails by more than 1pp, the most likely culprit is the slippage drag — adjust the test's `toBeCloseTo` precision down to 0 (i.e., 1pp tolerance) rather than tightening the implementation.

- [ ] **Step 5: Commit**

```bash
git add lib/utilization.ts tests/utilization.test.ts
git commit -m "$(cat <<'EOF'
feat(loop): add looperPathPnL — realized loop APY per FX path

Walks each Monte Carlo USD/TRY path forward, marks the levered wiTRY
position to market step by step, charges debt accrual + slippage drag,
liquidates if HF hits 1.0 (with LIF-haircut proxy), and annualizes
terminal equity. Returns per-path scalar APY plus P5/P50/P95 and a
liquidation rate.

Tests lock three identities: flat path ≈ deterministic netLoopAPY;
strongly depreciating TRY → >90% liquidation rate, P5 deep negative;
slightly appreciating TRY → realized APY above carry baseline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire `looperPathPnL` into the Monte Carlo worker

**Files:**
- Modify: `lib/simulation.worker.ts`

- [ ] **Step 1: Extend `WorkerInput` and `WorkerOutput`**

Edit `lib/simulation.worker.ts`. Find the `WorkerInput` interface (line ~32) and add `borrowAPY`:

```typescript
export interface WorkerInput {
  inputs: SidebarInputs;
  returnsWindow: number[];
  borrowAPY: number;                 // NEW: derived in useSimulator from rTargetIRM + targetUtilization
}
```

Find the `WorkerOutput` interface (line ~37) and add `loopPath`:

```typescript
export interface WorkerOutput {
  paths: number[][];
  p5: number[]; p50: number[]; p95: number[]; p99: number[];
  oneDayDD: number[];
  threeDayDD: number[];
  badDebt: {
    badDebtByPath: number[];
    badDebtP95_USD: number;
    badDebtP95Pct: number;
    liquidatedCountByPath: number[];
    liquidatedVolumeByPath: number[];
    expectedLiquidationVolumeP95_USD: number;
  };
  annualizedVol: number;
  loopPath: {                         // NEW
    apyByPath: number[];
    apyP5: number;
    apyP50: number;
    apyP95: number;
    liquidationRate: number;
  };
}
```

- [ ] **Step 2: Import `looperPathPnL` and call it in `run()`**

In the same file, find the existing import:

```typescript
import { simulateBadDebt, sampleBetaLtvFractions } from './simulator';
```

Add a second import directly below:

```typescript
import { looperPathPnL } from './utilization';
```

Then inside `api.run()`, after the `badDebtOut` block and before the existing `return { paths, p5, p50, ... }`, insert:

```typescript
const loopPathOut = looperPathPnL({
  paths,
  lltv: inputs.lltv,
  hfBuffer: inputs.hfBuffer,
  witryYieldAnnual: inputs.witryYieldUSD_7d,
  borrowAPY: input.borrowAPY,
  perLoopSlippageBps: 30,
});
```

Then in the return block, add a `loopPath` field at the end:

```typescript
return {
  paths,
  p5, p50, p95, p99,
  oneDayDD, threeDayDD,
  badDebt: { /* unchanged */ },
  annualizedVol,
  loopPath: {
    apyByPath: loopPathOut.apyByPath,
    apyP5: loopPathOut.apyP5,
    apyP50: loopPathOut.apyP50,
    apyP95: loopPathOut.apyP95,
    liquidationRate: loopPathOut.liquidationRate,
  },
};
```

- [ ] **Step 3: Run typecheck / lint**

```bash
npm run lint
```

Expected: FAIL — `useSimulator.ts` calls `run({ inputs, returnsWindow })` without the new `borrowAPY` field. The lint failure is the signal that Task 4 needs to follow immediately. **Do not commit yet** — Tasks 3 and 4 land together in one commit because the WorkerInput shape change is breaking.

- [ ] **Step 4: Defer commit; proceed to Task 4 in the same working tree**

No commit yet. Move to Task 4.

---

## Task 4: Rewrite `computeStrategy` (drop drift, add carry) and update `LiquidityStrategyOutput`

**Files:**
- Modify: `lib/simulator.ts`
- Modify: `types/simulator.ts`

- [ ] **Step 1: Update `LiquidityStrategyOutput` in `types/simulator.ts`**

Edit `types/simulator.ts`. Find the `LiquidityStrategyOutput` interface (around line 79) and replace its body:

```typescript
export interface LiquidityStrategyOutput {
  borrowAPY: number;
  grossSupplyAPY: number;
  netSupplyAPY: number;
  supplyIncentiveAPY: number;
  totalSupplyAPY: number;
  borrowerIncentiveAPY: number;
  netBorrowAPY: number;
  netLoopAPY: number;                       // RENAMED from leverageLoopAPY (carry-only)
  netLoopAPY_withIncentives: number;        // NEW
  effectiveLeverage: number;                // NEW
  loopDebtPerCollateral: number;            // NEW
  leverageLoopsViable: boolean;
  loopPath?: {                              // NEW; populated by worker
    apyP5: number;
    apyP50: number;
    apyP95: number;
    liquidationRate: number;
    apyHistogram: Array<{ bucketLo: number; bucketHi: number; count: number }>;
  };
}
```

- [ ] **Step 2: Update `StrategyArgs` and `StrategyOut` in `lib/simulator.ts`**

Edit `lib/simulator.ts`. Find `StrategyArgs` (line ~623) and `StrategyOut` (line ~637). Replace both:

```typescript
export interface StrategyArgs {
  borrowAPY: number;
  targetUtilization: number;
  performanceFee: number;
  managementFee: number;
  requiredUSDM: number;
  supplyIncentiveBudgetMonthly_USD: number;
  borrowerIncentiveBudgetMonthly_USD: number;
  expectedBorrow_USD: number;
  witryYieldAnnual: number;
  // NEW (carry inputs):
  hfBuffer: number;
  perLoopSlippageBps: number;
  lltv: number;
}

export interface StrategyOut {
  borrowAPY: number;
  grossSupplyAPY: number;
  netSupplyAPY: number;
  supplyIncentiveAPY: number;
  totalSupplyAPY: number;
  borrowerIncentiveAPY: number;
  netBorrowAPY: number;
  netLoopAPY: number;                        // RENAMED
  netLoopAPY_withIncentives: number;         // NEW
  effectiveLeverage: number;                 // NEW
  loopDebtPerCollateral: number;             // NEW
  leverageLoopsViable: boolean;
}
```

- [ ] **Step 3: Rewrite `computeStrategy` body**

In the same file, replace the `computeStrategy` function body (around lines 651–679):

```typescript
import { looperNetAPY } from './utilization';   // ADD this at the top of lib/simulator.ts if not present

export function computeStrategy(a: StrategyArgs): StrategyOut {
  const grossSupplyAPY = a.borrowAPY * a.targetUtilization;
  const netSupplyAPY = grossSupplyAPY * (1 - a.performanceFee) - a.managementFee;
  const supplyIncentiveAPY =
    a.requiredUSDM > 0 ? (a.supplyIncentiveBudgetMonthly_USD * 12) / a.requiredUSDM : 0;
  const totalSupplyAPY = netSupplyAPY + supplyIncentiveAPY;
  const borrowerIncentiveAPY =
    a.expectedBorrow_USD > 0
      ? (a.borrowerIncentiveBudgetMonthly_USD * 12) / a.expectedBorrow_USD
      : 0;
  const netBorrowAPY = a.borrowAPY - borrowerIncentiveAPY;

  // Delegate carry math to the shared primitive. fxAnnualVol/fxStressZ are
  // set to 0 here because the FX stress overlay is computed separately via
  // the Monte Carlo loopPath; the deterministic flag would otherwise gate
  // viability redundantly.
  const loop = looperNetAPY({
    uTarget: a.targetUtilization,
    rTarget: 0,                                // unused — we pass borrowAPY directly via override below
    lltv: a.lltv,
    hfBuffer: a.hfBuffer,
    witryYieldAnnual: a.witryYieldAnnual,
    perLoopSlippageBps: a.perLoopSlippageBps,
    fxAnnualVol: 0,
    fxStressZ: 0,
  });
  // looperNetAPY recomputes borrowAPY internally via adaptiveCurveIRM; we
  // want to use the caller-supplied borrowAPY (which may differ if e.g.
  // targetUtilization snapshot is mid-tick). Override the components:
  const effectiveLeverage = loop.effectiveLeverage;
  const borrowedShare = effectiveLeverage - 1;
  const grossLoopAPY = effectiveLeverage * a.witryYieldAnnual;
  const borrowCost   = borrowedShare * a.borrowAPY;
  const slippageCost = borrowedShare * (a.perLoopSlippageBps / 10_000);
  const hfIdleCost   = a.witryYieldAnnual * (1 - 1 / a.hfBuffer) * borrowedShare;
  const netLoopAPY   = grossLoopAPY - borrowCost - slippageCost - hfIdleCost;

  // Borrower-incentive overlay: paid on the looper's debt notional.
  const netLoopAPY_withIncentives = netLoopAPY + borrowerIncentiveAPY * borrowedShare;
  const loopDebtPerCollateral = a.lltv / a.hfBuffer;
  const leverageLoopsViable = netLoopAPY > a.witryYieldAnnual;

  return {
    borrowAPY: a.borrowAPY,
    grossSupplyAPY, netSupplyAPY, supplyIncentiveAPY, totalSupplyAPY,
    borrowerIncentiveAPY, netBorrowAPY,
    netLoopAPY, netLoopAPY_withIncentives,
    effectiveLeverage, loopDebtPerCollateral,
    leverageLoopsViable,
  };
}
```

**Note on the "override" pattern:** `looperNetAPY` is convenient for the deterministic path but re-derives `borrowAPY` from `(uTarget, rTarget)`. `computeStrategy` already has `borrowAPY` upstream (computed once in `useSimulator`). To stay DRY long-term we'd refactor `looperNetAPY` to accept `borrowAPY` directly; for this PR the override above is acceptable and keeps the diff focused. Flag as follow-up if you'd like to clean it up.

- [ ] **Step 4: Run lint — expect failures in `useSimulator.ts` and `LiquidityStrategy.tsx`**

```bash
npm run lint
```

Expected: FAIL.

- `useSimulator.ts` passes `expectedTRYDepreciation_annual` (removed); missing `hfBuffer`, `perLoopSlippageBps`, `lltv`.
- `LiquidityStrategy.tsx` reads `strategy.leverageLoopAPY` (removed).
- `tests/simulator.test.ts` likewise.

These are intentional. They get fixed in Tasks 5, 6, 7. **Do not commit yet** — Tasks 3+4+5+6+7 all chain.

---

## Task 5: Update `useSimulator` (drop DEFAULT_TRY, wire new args, thread loopPath)

**Files:**
- Modify: `lib/useSimulator.ts`

- [ ] **Step 1: Remove `DEFAULT_TRY_DEPRECIATION_ANNUAL`**

Edit `lib/useSimulator.ts`. Delete line 32:

```typescript
const DEFAULT_TRY_DEPRECIATION_ANNUAL = 0.30;     // rough estimate, out of scope
```

- [ ] **Step 2: Update the `computeStrategy` call**

In the same file, find the `computeStrategy({...})` call (around line 97–108). Replace it:

```typescript
const strategy = useMemo(
  () =>
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
      hfBuffer: s.hfBuffer,
      perLoopSlippageBps: 30,
      lltv: s.lltv,
    }),
  [s, requiredUSDMPrecursor, expectedBorrowPrecursor, borrowAPY],
);
```

- [ ] **Step 3: Thread `borrowAPY` into the worker `run()` call**

Find the `useEffect` block that calls `run({ inputs: s, returnsWindow })` (search for `run({`). Update it:

```typescript
run({ inputs: s, returnsWindow, borrowAPY });
```

Make sure `borrowAPY` is in the dependency array of that `useEffect`.

- [ ] **Step 4: Fold `result.loopPath` into the strategy output**

In the same file, find the `return { liquidity, fx, strategy, … }` block at the bottom of `useSimulator`. Just before the return, add:

```typescript
const loopPathOverlay = useMemo(() => {
  if (!result?.loopPath) return undefined;
  const { apyByPath, apyP5, apyP50, apyP95, liquidationRate } = result.loopPath;
  // Build a 12-bucket histogram from −50% to +200% APY.
  const buckets = 12;
  const lo = -0.5;
  const hi = 2.0;
  const step = (hi - lo) / buckets;
  const apyHistogram = Array.from({ length: buckets }, (_, k) => {
    const bucketLo = lo + k * step;
    const bucketHi = bucketLo + step;
    const count = apyByPath.filter(
      (a) => a >= bucketLo && (k === buckets - 1 ? a <= bucketHi : a < bucketHi),
    ).length;
    return { bucketLo, bucketHi, count };
  });
  return { apyP5, apyP50, apyP95, liquidationRate, apyHistogram };
}, [result]);

const strategyWithLoopPath = useMemo(
  () => ({ ...strategy, loopPath: loopPathOverlay }),
  [strategy, loopPathOverlay],
);
```

Then update the returned `strategy` slice to use `strategyWithLoopPath`:

```typescript
return {
  liquidity, fx, strategy: strategyWithLoopPath, liquidation, vault,
  inputs: s, running,
};
```

(Match the exact shape of the existing return — read it first.)

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: still FAIL in `LiquidityStrategy.tsx` (uses old `leverageLoopAPY`) and `tests/simulator.test.ts`. Continue.

---

## Task 6: Rewrite `LiquidityStrategy.tsx` (three-row layout)

**Files:**
- Modify: `app/components/sections/LiquidityStrategy.tsx`

- [ ] **Step 1: Read the existing file in full**

```bash
sed -n '1,200p' /Users/gokhanseckin/claude-projects/Brix-Morpho/app/components/sections/LiquidityStrategy.tsx
```

Understand the current shape (supplier APY card + benchmark bar chart + Merkl text). The supplier row + benchmark + Merkl summary blocks stay; only the loop content changes (the existing file does NOT yet have a separate loop card — it currently exposes `leverageLoopAPY` only as a single inline KPI somewhere in `merklText`). Phase B replaces the loop concept with a dedicated card.

- [ ] **Step 2: Replace the body of `LiquidityStrategy()`**

Replace the destructure + content of the section. Keep imports at top; add `Cell` from Recharts if it isn't already imported. Replace the body (everything inside `export function LiquidityStrategy() { … }`) with:

```tsx
export function LiquidityStrategy() {
  const { strategy, inputs, running } = useSimulator();

  // ── Existing: supplier APY stack + benchmark bar + Merkl text ──────────
  const apyComparison = useMemo(
    () => [
      { name: 'Brix net', apy: strategy.netSupplyAPY },
      { name: 'Brix + incentives', apy: strategy.totalSupplyAPY },
      ...COMPETING_BENCHMARKS,
    ],
    [strategy.netSupplyAPY, strategy.totalSupplyAPY],
  );

  const supplyComponents = [
    { component: 'Net base APY', value: strategy.netSupplyAPY, pct: strategy.netSupplyAPY },
    { component: 'Supply incentives', value: strategy.supplyIncentiveAPY, pct: strategy.supplyIncentiveAPY },
  ];

  // ── NEW: deterministic loop bars (Hold / Loop / Loop+incentives) ───────
  const loopBars = useMemo(
    () => [
      { name: 'Hold wiTRY',        apy: inputs.witryYieldAnnual,             color: '#6b7280' },
      { name: 'Loop wiTRY',        apy: strategy.netLoopAPY,                 color: '#10b981' },
      { name: 'Loop + incentives', apy: strategy.netLoopAPY_withIncentives,  color: '#3b82f6' },
    ],
    [inputs.witryYieldAnnual, strategy.netLoopAPY, strategy.netLoopAPY_withIncentives],
  );
  const impliedLooperDebt_USD = inputs.witryTVL_USD * strategy.loopDebtPerCollateral;
  const viable = strategy.leverageLoopsViable;

  // ── NEW: realized loop P&L histogram (from Monte Carlo loopPath) ───────
  const loopPath = strategy.loopPath;

  // Existing Merkl summary text remains; drop the leverageLoopAPY mention.
  const merklText = useMemo(() => {
    return `Supply-side Merkl: $${(
      inputs.supplyIncentiveBudgetMonthly_USD / 1000
    ).toFixed(0)}k/month → supply incentive APY ${formatPct(strategy.supplyIncentiveAPY, 2)};
      suppliers see ${formatPct(strategy.totalSupplyAPY, 2)} (net ${formatPct(strategy.netSupplyAPY, 2)} + incentives).
      Borrower-side: $${(inputs.borrowerIncentiveBudgetMonthly_USD / 1000).toFixed(0)}k/month →
      borrower incentive APY ${formatPct(strategy.borrowerIncentiveAPY, 2)}; net borrow cost
      ${formatPct(strategy.netBorrowAPY, 2)} (gross ${formatPct(strategy.borrowAPY, 2)}).`;
  }, [strategy, inputs]);

  return (
    <section className="space-y-6">
      {/* ── Row 1: Supplier APY (unchanged) ───────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Supplier APY</h2>
        <div className="grid grid-cols-2 gap-4">
          <Kpi label="Net base APY" value={formatPct(strategy.netSupplyAPY, 2)} helpKey="netSupplyAPY" />
          <Kpi label="Total APY (with incentives)" value={formatPct(strategy.totalSupplyAPY, 2)} helpKey="totalSupplyAPY" />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card mt-2">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={apyComparison}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
              <Bar dataKey="apy" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 2: Loop economics (deterministic, carry-only) ─────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold">Loop economics (carry-only)</h2>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${viable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
            {viable ? 'Loop beats hold' : 'Loop loses to hold'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <Kpi label="Effective leverage" value={`${strategy.effectiveLeverage.toFixed(2)}×`} helpKey="effectiveLeverageStrategy" />
          <Kpi label="Debt / collateral" value={formatPct(strategy.loopDebtPerCollateral, 1)} helpKey="loopDebtPerCollateral" />
          <Kpi label="Implied looper debt" value={formatUSD(impliedLooperDebt_USD)} helpKey="loopDebtPerCollateral" />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={loopBars}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
              <Bar dataKey="apy">
                {loopBars.map((b, i) => (
                  <Cell key={i} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Realized loop P&L (FX-path Monte Carlo) ─────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Loop realized P&L (Monte Carlo)</h2>
        <div className="grid grid-cols-4 gap-4 mb-3">
          <Kpi label="P5 loop APY" value={loopPath ? formatPct(loopPath.apyP5, 1) : running ? '…' : '—'} helpKey="loopAPYP5" />
          <Kpi label="P50 loop APY" value={loopPath ? formatPct(loopPath.apyP50, 1) : running ? '…' : '—'} helpKey="loopAPYP50" />
          <Kpi label="P95 loop APY" value={loopPath ? formatPct(loopPath.apyP95, 1) : running ? '…' : '—'} helpKey="loopAPYP95" />
          <Kpi label="Liquidation rate" value={loopPath ? formatPct(loopPath.liquidationRate, 1) : running ? '…' : '—'} helpKey="loopLiquidationRate" />
        </div>
        {loopPath && (
          <div className="border border-brix-border rounded p-2 bg-brix-card">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={loopPath.apyHistogram}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="bucketLo" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v) => `${(Number(v) * 100).toFixed(0)}% – APY bucket`}
                  formatter={(c: number) => `${c} paths`}
                />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="p-4 rounded border border-brix-accent/40 bg-brix-accent/10">
        <div className="text-xs uppercase tracking-wide text-brix-accent mb-1">Merkl recommendation</div>
        <div className="text-sm">{merklText}</div>
      </div>
    </section>
  );
}
```

Add `Cell` to the Recharts import at the top of the file:

```typescript
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
} from 'recharts';
```

- [ ] **Step 2b: Confirm `Kpi` accepts the `helpKey` prop**

Read `app/components/Kpi.tsx` briefly to confirm `helpKey` is a valid prop. If it isn't (some KPIs may render their HelpPopover separately), adapt — wrap with `<HelpPopover chartKey="…" />` adjacent to each Kpi as the existing supplier-APY KPIs do. Use whichever pattern dominates in the existing file.

- [ ] **Step 3: Run lint — should pass now**

```bash
npm run lint
```

Expected: PASS for the touched files. (Test files still failing — Task 7 handles them.)

---

## Task 7: Rewrite the two `computeStrategy` tests

**Files:**
- Modify: `tests/simulator.test.ts`

- [ ] **Step 1: Locate the two test cases**

```bash
grep -n 'computeStrategy\|expectedTRYDepreciation_annual\|leverageLoopAPY' tests/simulator.test.ts
```

- [ ] **Step 2: Rewrite test 1 ("totals add up …")**

Replace the test body. The new args drop `expectedTRYDepreciation_annual` and add `hfBuffer`, `perLoopSlippageBps`, `lltv`. Assertions about `borrowerIncentiveAPY`, `netBorrowAPY`, supplier figures are preserved; the loop assertion is replaced:

```typescript
it('totals add up; supply incentives lift totalSupplyAPY above netSupplyAPY', () => {
  const out = computeStrategy({
    borrowAPY: 0.10,
    targetUtilization: 0.7,
    performanceFee: 0.1,
    managementFee: 0.01,
    requiredUSDM: 3_300_000,
    supplyIncentiveBudgetMonthly_USD: 10_000,
    borrowerIncentiveBudgetMonthly_USD: 0,
    expectedBorrow_USD: 2_310_000,
    witryYieldAnnual: 0.38,
    hfBuffer: 1.5,
    perLoopSlippageBps: 30,
    lltv: 0.86,
  });
  expect(out.grossSupplyAPY).toBeCloseTo(0.07, 4);
  expect(out.totalSupplyAPY).toBeGreaterThan(out.netSupplyAPY);
  expect(out.borrowerIncentiveAPY).toBe(0);
  expect(out.netBorrowAPY).toBeCloseTo(0.10, 6);
  // Carry-only loop math: effectiveLeverage = 1 / (1 − 0.86/1.5) = 2.34375.
  expect(out.effectiveLeverage).toBeCloseTo(1 / (1 - 0.86 / 1.5), 6);
  expect(out.loopDebtPerCollateral).toBeCloseTo(0.86 / 1.5, 6);
  // Net loop APY > 0 at default params with 38% wiTRY yield, 10% borrow.
  expect(out.netLoopAPY).toBeGreaterThan(0);
  // No borrower incentives → with-incentives equals base.
  expect(out.netLoopAPY_withIncentives).toBeCloseTo(out.netLoopAPY, 10);
});
```

- [ ] **Step 3: Rewrite test 2 ("borrower incentive lowers netBorrowAPY …")**

```typescript
it('borrower incentive lowers netBorrowAPY and lifts loop APY via overlay', () => {
  const out = computeStrategy({
    borrowAPY: 0.10,
    targetUtilization: 0.7,
    performanceFee: 0.1,
    managementFee: 0.01,
    requiredUSDM: 3_300_000,
    supplyIncentiveBudgetMonthly_USD: 0,
    borrowerIncentiveBudgetMonthly_USD: 20_000,
    expectedBorrow_USD: 1_000_000,
    witryYieldAnnual: 0.38,
    hfBuffer: 1.5,
    perLoopSlippageBps: 30,
    lltv: 0.86,
  });
  expect(out.borrowerIncentiveAPY).toBeCloseTo(0.24, 6);
  expect(out.netBorrowAPY).toBeCloseTo(-0.14, 6);
  // With-incentives strictly exceeds carry-only when borrowerIncentiveAPY > 0.
  expect(out.netLoopAPY_withIncentives).toBeGreaterThan(out.netLoopAPY);
});
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run tests/simulator.test.ts
```

Expected: All `describe('strategy', …)` tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: PASS across the board. If `tests/sanity.test.ts` or other tests reference removed/renamed symbols, fix inline (the only candidates are tests that imported `expectedTRYDepreciation_annual` or `leverageLoopAPY`; everything else should be untouched).

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 3 + 4 + 5 + 6 + 7 together (the chained changeset)**

```bash
git add lib/simulation.worker.ts lib/simulator.ts lib/useSimulator.ts \
        types/simulator.ts app/components/sections/LiquidityStrategy.tsx \
        tests/simulator.test.ts
git commit -m "$(cat <<'EOF'
feat(home): carry-only loop math + Monte Carlo realized P&L

Replaces the drift-based leverageLoopAPY (witryYield − netBorrow × (1 +
d_TRY), with d hardcoded at 0.30) with the carry-only netLoopAPY from
lib/utilization.ts. Adds netLoopAPY_withIncentives as an additive
borrower-incentive overlay rather than folding incentives into base
viability. Adds effectiveLeverage and loopDebtPerCollateral to strategy
output.

The Monte Carlo worker now also walks each FX path through
looperPathPnL, producing a per-path realized loop APY distribution
(P5/P50/P95) and a liquidation rate; useSimulator builds a 12-bucket
histogram from this for UI display. LiquidityStrategy.tsx is rewritten
into three rows: Supplier APY (unchanged), deterministic loop bars
(Hold / Loop / Loop+incentives), realized P&L (KPIs + histogram).

StrategyArgs drops expectedTRYDepreciation_annual entirely; tests are
rewritten against the new shape. SidebarInputs gains hfBuffer (added
to URL state in the previous commit) and is now wired through to both
computeStrategy and the worker.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update the help KPI registry

**Files:**
- Modify: `lib/help/kpiKeys.ts`

- [ ] **Step 1: Remove `leverageLoopAPY` from `KPI_KEYS`**

Edit `lib/help/kpiKeys.ts`. In the `KPI_KEYS` array (`LiquidityStrategy (section 3)` block), delete the `'leverageLoopAPY',` line.

- [ ] **Step 2: Add the eight new strategy KPI keys**

In the same `LiquidityStrategy (section 3)` block, append after `'netBorrowAPY',`:

```typescript
  // LiquidityStrategy (section 3) — Phase B carry-only loop
  'netLoopAPY',
  'netLoopAPYWithIncentives',
  'effectiveLeverageStrategy',
  'loopDebtPerCollateral',
  'loopAPYP5',
  'loopAPYP50',
  'loopAPYP95',
  'loopLiquidationRate',
```

- [ ] **Step 3: Update `KPI_SECTION` mapping**

In the same file, find `KPI_SECTION` and delete the `leverageLoopAPY: 'strategy',` line. Add the eight new entries near the existing `'strategy'` block:

```typescript
  netLoopAPY: 'strategy',
  netLoopAPYWithIncentives: 'strategy',
  effectiveLeverageStrategy: 'strategy',
  loopDebtPerCollateral: 'strategy',
  loopAPYP5: 'strategy',
  loopAPYP50: 'strategy',
  loopAPYP95: 'strategy',
  loopLiquidationRate: 'strategy',
```

- [ ] **Step 4: Run the help-registry completeness test**

```bash
npx vitest run tests/help/registry.test.ts
```

Expected: FAIL — `KPI_HELP has an entry for every KPI_KEYS entry` will flag the eight new keys as missing entries. This is the signal that Task 9 follows immediately. **Do not commit yet.**

---

## Task 9: Add help content entries for the new strategy KPIs

**Files:**
- Modify: `lib/help/content/strategy.ts`

- [ ] **Step 1: Remove the old `leverageLoopAPY` entry**

Edit `lib/help/content/strategy.ts`. Delete the `const leverageLoopAPY: KpiHelp = { … };` block (approx the entry that defines the drift-based formula).

- [ ] **Step 2: Add eight new entries**

Add the following blocks somewhere in the file (between existing entries; convention seems alphabetical or by section role — match the existing file). The exact `COMMON_PARAMS` keys and `KpiHelp` shape are already in this file; mimic them. If any field shape differs from what you see, adapt to the existing shape.

```typescript
const netLoopAPY: KpiHelp = {
  title: 'Net loop APY (carry-only)',
  oneLiner:
    'Annualized USD return for a wiTRY → USDM → wiTRY looper, computed as the carry differential (wiTRY yield − borrow rate − slippage − HF-idle cost) at the deterministic effective leverage. FX risk is NOT subtracted as expected cost; it appears separately as a Monte Carlo P&L distribution.',
  formula: {
    plain:
      'netLoopAPY = effectiveLeverage × y_iTRY − (effectiveLeverage − 1) × borrowAPY − slippage − hfIdleCost',
    latex:
      'netLoopAPY = \\ell \\cdot y_{\\text{iTRY}} - (\\ell - 1)(r + s) - y_{\\text{iTRY}}(1 - 1/H)(\\ell - 1)',
  },
  params: [
    COMMON_PARAMS.iTRY!,
    { name: 'effectiveLeverage', source: 'derived', note: '1 / (1 − LLTV / hfBuffer).' },
    { name: 'borrowAPY', source: 'derived', note: 'IRM at target utilization; carry borrow cost.' },
    { name: 'perLoopSlippageBps', source: 'constant', value: '30 bps', note: 'Per-loop round-trip swap cost; matches /utilization.' },
    { name: 'hfBuffer', source: 'derived', note: 'sidebar slider; ≥ 1.0.' },
  ],
  definitions: [
    { term: 'Why no TRY-depreciation surcharge', definition: 'wiTRY is a TRY-denominated MMF; its yield already compensates for the average rate at which TRY depreciates. Charging an extra (1 + d_TRY) factor on the borrow cost double-counts FX risk. Realized FX impact shows up in the path-aware P&L below.' },
    { term: 'leverageLoopsViable flag', definition: 'Green when netLoopAPY > witryYieldAnnual — i.e., looping beats simply holding wiTRY. Borrower incentives are NOT used to flip this gate; they enter only as an additive overlay on the next bar.' },
  ],
  impact: {
    health: 'Primary organic borrow demand driver. Negative netLoopAPY means rational borrowers stay out of loops.',
    sustainability: 'Sensitive to wiTRY yield and borrow rate; insensitive to expected TRY depreciation (by construction).',
    profitability: 'A larger positive netLoopAPY pulls utilization toward target, raising supplier APY.',
  },
};

const netLoopAPYWithIncentives: KpiHelp = {
  title: 'Loop APY with borrower incentives',
  oneLiner:
    'netLoopAPY + the looper share of the borrower-incentive budget. This is the headline number a looper sees when comparing to passive hold during an active Merkl campaign.',
  formula: {
    plain: 'netLoopAPY_withIncentives = netLoopAPY + borrowerIncentiveAPY × (effectiveLeverage − 1)',
    latex: 'netLoopAPY_{\\text{wInc}} = netLoopAPY + b \\cdot (\\ell - 1)',
  },
  params: [
    { name: 'netLoopAPY', source: 'derived' },
    { name: 'borrowerIncentiveAPY', source: 'derived' },
    { name: 'effectiveLeverage', source: 'derived' },
  ],
  definitions: [
    { term: 'Why multiply by (effectiveLeverage − 1)', definition: 'Borrower incentives are paid on the looper\'s debt notional, which equals (effectiveLeverage − 1) × equity for a fully-looped position.' },
    { term: 'Campaign-window only', definition: 'Reverts to netLoopAPY when borrower-side rewards stop. The gap between the two bars is the cliff loopers face at campaign end.' },
  ],
  impact: {
    health: 'A primary acquisition lever during campaign windows; should not be used to gate structural viability.',
    sustainability: 'Mercenary-capital signal — a wide gap between this and netLoopAPY means much of the loop\'s appeal is rented.',
    profitability: 'Direct lever on looper acquisition velocity during a campaign.',
  },
};

const effectiveLeverageStrategy: KpiHelp = {
  title: 'Effective leverage (looper)',
  oneLiner:
    'The geometric-sum cap on how much wiTRY a looper can stack starting from 1 unit of equity, given an LLTV and a self-imposed HF buffer.',
  formula: {
    plain: 'effectiveLeverage = 1 / (1 − LLTV / hfBuffer)',
    latex: '\\ell = 1 / (1 - L / H)',
  },
  params: [
    { name: 'LLTV', source: 'derived', note: 'Sidebar slider; governance-snapped tier.' },
    { name: 'hfBuffer', source: 'derived', note: 'Sidebar slider; ≥ 1.0.' },
  ],
  definitions: [
    { term: 'Why a buffer', definition: 'Looping to the bare LLTV maximizes leverage but liquidates on the first adverse FX tick. hfBuffer ≥ 1.1 leaves headroom; typical defaults are 1.3–1.7.' },
    { term: 'Numerical cap', definition: 'Capped at 50× internally to keep the geometric series numerically stable. Defaults never come near this.' },
  ],
  impact: {
    health: 'Drives both grossLoopAPY (positive) and FX-risk amplification (negative).',
    sustainability: 'Higher leverage → larger realized P&L distribution width.',
    profitability: 'Direct multiplier on yield in the carry term; should always be evaluated against the realized P&L tail.',
  },
};

const loopDebtPerCollateral: KpiHelp = {
  title: 'Debt / collateral (looper)',
  oneLiner:
    'The fraction of collateral USD value a looper has borrowed against. Equals LLTV / hfBuffer.',
  formula: {
    plain: 'loopDebtPerCollateral = LLTV / hfBuffer',
    latex: 'LLTV / H',
  },
  params: [
    { name: 'LLTV', source: 'derived' },
    { name: 'hfBuffer', source: 'derived' },
  ],
  definitions: [
    { term: 'Why useful', definition: 'A cleaner intuition than effectiveLeverage when reasoning about how close a position is to its liquidation threshold.' },
  ],
  impact: {
    health: 'Higher → tighter liquidation tolerance per FX move.',
    sustainability: 'A natural cap on aggressive loops.',
    profitability: 'Affects looper risk appetite; high values deter all but mercenary borrowers.',
  },
};

const loopAPYP5: KpiHelp = {
  title: 'P5 realized loop APY',
  oneLiner:
    '5th-percentile annualized return across all Monte Carlo FX paths. The unlucky-tail outcome a looper should expect once in 20 starts.',
  formula: { plain: 'P5(apyByPath)', latex: 'P_{5}(\\text{apyByPath})' },
  params: [
    { name: 'apyByPath', source: 'derived', note: 'Per-path realized loop APY from looperPathPnL.' },
  ],
  definitions: [
    { term: 'Liquidated paths', definition: 'Paths where HF hit 1.0 before horizon are included at their (heavily negative) terminal APY. They sink the lower tail directly.' },
    { term: 'Difference from carry-only', definition: 'netLoopAPY is the expected value at flat FX; P5 captures the realized downside under simulated TRY moves.' },
  ],
  impact: {
    health: 'Looper risk-budget anchor.',
    sustainability: 'A very deep P5 (e.g. < −50%) means the loop is structurally fragile to TRY shocks.',
    profitability: 'Defines the worst-case a rational looper would accept.',
  },
};

const loopAPYP50: KpiHelp = {
  title: 'P50 realized loop APY',
  oneLiner:
    'Median annualized return across Monte Carlo FX paths. The typical outcome.',
  formula: { plain: 'P50(apyByPath)', latex: 'P_{50}(\\text{apyByPath})' },
  params: [{ name: 'apyByPath', source: 'derived' }],
  definitions: [
    { term: 'P50 vs netLoopAPY', definition: 'For flat FX paths P50 ≈ netLoopAPY. Gaps reveal asymmetric path dynamics (e.g. heavy left tail from liquidations pulls the median below netLoopAPY).' },
  ],
  impact: {
    health: 'Headline expected-value figure for loopers.',
    sustainability: 'The number that goes in marketing copy.',
    profitability: 'Anchor for looper acquisition pitches.',
  },
};

const loopAPYP95: KpiHelp = {
  title: 'P95 realized loop APY',
  oneLiner:
    '95th-percentile annualized return. The lucky-tail outcome — a strong TRY-stable / TRY-strengthening regime.',
  formula: { plain: 'P95(apyByPath)', latex: 'P_{95}(\\text{apyByPath})' },
  params: [{ name: 'apyByPath', source: 'derived' }],
  definitions: [
    { term: 'Upside symmetry', definition: 'In a balanced FX regime P95 sits roughly symmetrically opposite P5 around P50; persistent skew indicates the historical window\'s regime is one-sided.' },
  ],
  impact: {
    health: 'Marketing upside number.',
    sustainability: 'High P95 with low P5 = high-variance strategy; do not mislead users with P95 alone.',
    profitability: 'Sets the realistic best-case expectation.',
  },
};

const loopLiquidationRate: KpiHelp = {
  title: 'Loop liquidation rate',
  oneLiner:
    'Fraction of Monte Carlo paths in which the looper position hit HF = 1.0 before horizon and was forcibly closed.',
  formula: {
    plain: 'liquidationRate = |{ path : HF_t ≤ 1 for some t }| / |paths|',
    latex: 'liquidationRate = |\\{p : HF_t(p) \\le 1 \\text{ for some } t\\}| / |\\text{paths}|',
  },
  params: [
    { name: 'paths', source: 'derived', note: 'Monte Carlo USD/TRY paths from the FX worker.' },
    { name: 'hfBuffer', source: 'derived', note: 'A larger buffer reduces this rate.' },
  ],
  definitions: [
    { term: 'Difference from bad-debt cascade', definition: 'simulateBadDebt (Section 4) models the protocol\'s residual after liquidator action and AMM slippage; this rate models the looper\'s probability of getting wiped. They are disjoint concerns.' },
    { term: 'LIF haircut proxy', definition: 'On liquidation, the looper\'s terminal equity is reduced by (LIF − 1) × debt — a constant proxy for the liquidator-bonus seizure. Slippage at liquidation is omitted by design (covered separately in Section 4).' },
  ],
  impact: {
    health: 'A high liquidation rate (e.g. > 10%) is a structural warning sign even if P50 looks attractive.',
    sustainability: 'Lowering hfBuffer or raising LLTV pushes this up rapidly.',
    profitability: 'A 0-rate at a productive netLoopAPY is the goal; rates > 5% suggest tightening the buffer.',
  },
};
```

- [ ] **Step 3: Update `STRATEGY_KPIS` export**

In the same file, find the `export const STRATEGY_KPIS = { … };` block. Drop `leverageLoopAPY` and add the eight new entries:

```typescript
export const STRATEGY_KPIS = {
  borrowAPY,
  grossSupplyAPY,
  netSupplyAPY,
  supplyIncentiveAPY,
  totalSupplyAPY,
  borrowerIncentiveAPY,
  netBorrowAPY,
  netLoopAPY,
  netLoopAPYWithIncentives,
  effectiveLeverageStrategy,
  loopDebtPerCollateral,
  loopAPYP5,
  loopAPYP50,
  loopAPYP95,
  loopLiquidationRate,
};
```

- [ ] **Step 4: Run the registry test**

```bash
npx vitest run tests/help/registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 8 + 9 together**

```bash
git add lib/help/kpiKeys.ts lib/help/content/strategy.ts
git commit -m "$(cat <<'EOF'
docs(help): KPI registry for carry-only loop + Monte Carlo P&L

Drops leverageLoopAPY help entry. Adds 8 new strategy-section entries:
netLoopAPY (carry-only), netLoopAPYWithIncentives (overlay),
effectiveLeverageStrategy, loopDebtPerCollateral, loopAPYP5/P50/P95
(realized FX-path distribution), loopLiquidationRate. Help text spells
out why TRY depreciation isn't subtracted as expected cost and how the
path-based liquidation rate differs from the bad-debt cascade.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Verify build, e2e perf, and grep-clean state

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: PASS. The static export should produce `out/`.

- [ ] **Step 2: Confirm `leverageLoopAPY` symbol is gone**

```bash
grep -rn 'leverageLoopAPY' lib types app tests 2>/dev/null
```

Expected: zero matches.

If any survive (e.g. a stray comment in `help/content/strategy.ts` referencing the old name), fix in a follow-up amend. The acceptance criterion is grep-clean.

- [ ] **Step 3: Run the e2e perf test**

```bash
npm run test:e2e -- tests-e2e/perf.spec.ts
```

Expected: PASS within ceiling. If the test fails because the new looperPathPnL work in the worker pushes time-to-first-KPI over 6 s, bump the ceiling in `tests-e2e/perf.spec.ts` by ~500 ms with a single-line justification in the same commit. Do NOT raise it more than that without flagging.

- [ ] **Step 4: Run the full e2e suite**

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 5: Smoke-test the UI manually**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
1. Sidebar has an "HF buffer (looper)" slider (default 1.5).
2. LiquidityStrategy section shows three rows: Supplier APY, Loop economics, Loop realized P&L.
3. With default borrower-incentive budget = 0, bar ② and bar ③ in the Loop economics card are equal.
4. Bump `borrowerIncentiveBudgetMonthly_USD` (via URL or sidebar) — bar ③ rises above bar ②.
5. Wait ~3 seconds for the worker; the Loop realized P&L row populates with KPIs and the histogram.
6. Move `hfBuffer` slider from 1.5 → 1.2: effectiveLeverage rises, netLoopAPY changes, histogram refreshes.
7. Navigate to `/utilization`: HF buffer slider on that page shows the same value (URL-shared). Move it; URL updates; navigate back to home; sidebar reflects the new value.

Stop the dev server.

- [ ] **Step 6: Commit any perf/grep follow-up**

If Step 3 required a ceiling bump or Step 2 found stragglers:

```bash
git add tests-e2e/perf.spec.ts <any stragglers>
git commit -m "$(cat <<'EOF'
chore(perf): bump e2e ceiling for looperPathPnL worker pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Otherwise skip.

---

## Task 11: Open the PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/home-loop-carry-fxvol
```

- [ ] **Step 2: Take before/after screenshots**

```bash
npm run dev
```

Open `http://localhost:3000` with default URL params and screenshot the LiquidityStrategy section (three-row layout). Save to `/tmp/home-loop-after.png`. For the "before" half, check out `main`, screenshot the same section at the same URL params, save to `/tmp/home-loop-before.png`, then return to the feature branch.

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "feat(home): carry-only loop math + Monte Carlo realized P&L" --body "$(cat <<'EOF'
## Summary

Phase B of the loop-economics reframe (Phase A = PR #88). Brings the home page's
LiquidityStrategy section in line with /utilization: no more drift-based borrow
surcharge, FX risk treated separately as a realized P&L distribution over Monte
Carlo paths, borrower incentives surfaced as an additive overlay rather than a
viability input.

- Drops `expectedTRYDepreciation_annual` from `StrategyArgs`; renames
  `leverageLoopAPY` → `netLoopAPY` (carry-only).
- Adds `looperPathPnL` to `lib/utilization.ts` — walks each Monte Carlo FX path
  forward, marks the levered wiTRY position to market, liquidates if HF hits 1.0,
  annualizes terminal equity.
- Adds `loopPath` output to the worker (`P5/P50/P95` APY + liquidation rate).
- Promotes `hfBuffer` to URL state so both pages share it.
- Rewrites `LiquidityStrategy.tsx` into three rows: Supplier APY (unchanged),
  Loop economics (Hold / Loop / Loop+incentives bars), Loop realized P&L
  (KPIs + histogram).
- 8 new strategy-section KPIs registered in help system with full content.

## Spec & plan

- Design: `docs/superpowers/specs/2026-05-24-home-loop-carry-fxvol-design.md`
- Plan: `docs/superpowers/plans/2026-05-24-home-loop-carry-fxvol.md`

## Test plan

- [x] `npm run lint` passes
- [x] `npm test` — including 3 new `looperPathPnL` cases and rewritten
      `computeStrategy` cases
- [x] `npm run test:e2e` — perf ceiling unchanged (or bumped by ≤ 500 ms)
- [x] `npm run build` produces `out/`
- [x] Manual smoke: HF buffer slider on both pages, three-row LiquidityStrategy
      renders, borrower-incentive bar lifts when budget > 0, histogram appears
      after worker runs
- [x] `grep leverageLoopAPY` clean across lib/types/app/tests

## Screenshots

Before (main): _attach `/tmp/home-loop-before.png`_
After  (this): _attach `/tmp/home-loop-after.png`_

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Return the PR URL to the user**

---

## Spec-Coverage Self-Review

| Spec section | Implementing task(s) |
|---|---|
| §3 Architecture (single useSimulator orchestration) | Tasks 4, 5 |
| §4.1 Carry-only deterministic math | Task 4 (delegation to `looperNetAPY`) |
| §4.2 Path-aware looperPathPnL | Task 2 (impl + tests), Task 3 (worker integration) |
| §4.3 Borrower-incentive overlay | Task 4 (`netLoopAPY_withIncentives`), Task 6 (3-bar UI) |
| §5.1 `lib/utilization.ts` additions | Task 2 |
| §5.2 `computeStrategy` rewrite | Task 4 |
| §5.3 `LiquidityStrategyOutput` updates | Task 4, Task 5 (loopPath fold-in) |
| §5.4 `hfBuffer` URL state | Task 1 |
| §5.5 `SidebarInputs` add `hfBuffer` | Task 1 |
| §5.6 Worker shape extension | Task 3 |
| §5.7 `useSimulator` wire-up | Task 5 |
| §5.8 `LiquidityStrategy.tsx` rewrite | Task 6 |
| §5.9 KPI registry updates | Task 8 |
| §5.10 Help content rewrite | Task 9 |
| §6.1 `looperPathPnL` tests | Task 2 |
| §6.2 `computeStrategy` test rewrite | Task 7 |
| §6.3 `sanity.test.ts` keep green | Task 7 step 5 (full `npm test`) — sanity has no loop dependency |
| §6.4 e2e perf ceiling | Task 10 step 3 |
| §6.5 Help registry test | Task 8 step 4, Task 9 step 4 |
| §7 Out of scope (looper-equity, ribbon, etc.) | N/A — deliberately omitted |
| §8 Risks 1–5 | Addressed in code/comments (LIF haircut proxy comment in Task 2; hfBuffer migration in Task 1; KPI naming in Task 8 with `effectiveLeverageStrategy` to avoid collision) |
| §10 Acceptance criteria 1–8 | Task 10 (build/lint/test/e2e), Task 10 step 2 (grep), Task 10 step 5 (smoke), Task 11 step 2 (screenshots) |
| §11 Implementation order | Tasks 1–11 follow this order exactly |
