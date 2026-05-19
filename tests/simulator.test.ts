import { describe, it, expect } from 'vitest';
import {
  computeLiquidityNeed,
  sampleBetaLtvFractions,
  pctUnderwaterAtT,
  slippage,
  liquidatorProfit,
  minMaxProfitableLiquidation,
  simulateBadDebt,
  deriveRecommendedLLTV,
  snapToGovernanceLLTV,
  computeStrategy,
  buildVaultConfigJson,
  classifyRiskTier,
} from '@/lib/simulator';
import { LIF } from '@/lib/morphoMath';

describe('liquidity need', () => {
  it('verification anchor: 5M × 0.77 × 0.6 / 0.7 ≈ 3.3M', () => {
    const out = computeLiquidityNeed({
      witryTVL_USD: 5_000_000,
      lltv: 0.77,
      targetUtilization: 0.7,
      borrowerLTVAlpha: 3,
      borrowerLTVBeta: 2,
      incentiveAPY: 0,
      baseSupplyAPY: 0.05,
      deadDepositCost: 1,
    });
    expect(out.requiredUSDM).toBeCloseTo(3_300_000, -3); // within ±1000
  });

  it('floor uses 20% of required when dead-deposit cost is small', () => {
    const out = computeLiquidityNeed({
      witryTVL_USD: 5_000_000,
      lltv: 0.77,
      targetUtilization: 0.7,
      borrowerLTVAlpha: 3,
      borrowerLTVBeta: 2,
      incentiveAPY: 0,
      baseSupplyAPY: 0.05,
      deadDepositCost: 1,
    });
    expect(out.liquidityFloor_USD).toBeCloseTo(0.2 * out.requiredUSDM, 0);
  });
});

describe('position distribution', () => {
  it('β-sampled fractions are in [0,1]', () => {
    const xs = sampleBetaLtvFractions({ alpha: 2, beta: 1.2, n: 500, seed: 1 });
    expect(xs.every((x) => x >= 0 && x <= 1)).toBe(true);
  });

  it('at S(t)=S(0) and 0 yield, no positions are underwater', () => {
    const pct = pctUnderwaterAtT({
      ltvFractions: [0.2, 0.5, 0.8],
      lltv: 0.86,
      collateralRelChange: 1.0,
    });
    expect(pct).toBe(0);
  });

  it('at large drop, all positions are underwater', () => {
    const pct = pctUnderwaterAtT({
      ltvFractions: [0.2, 0.5, 0.8],
      lltv: 0.86,
      collateralRelChange: 0.1,
    });
    expect(pct).toBe(1);
  });
});

describe('liquidator economics', () => {
  it('slippage anchor: L=2,D=98 → 0.02', () => {
    expect(slippage(2, 98)).toBeCloseTo(0.02, 4);
  });

  it('profit cliff: profit ≈ 0 at exact break-even slippage', () => {
    const lltv = 0.86;
    const lif = LIF(lltv);
    const debt = 1000;
    const seized = debt * lif;
    // exact cliff: revenue = debt ⇔ (1 − slip)·LIF = 1 ⇔ slip = 1 − 1/LIF.
    const slip = 1 - 1 / lif;
    const D = (seized * (1 - slip)) / slip;
    const p = liquidatorProfit({
      debt_USD: debt,
      lltv,
      poolDepth_USD: D,
      gasCost_USD: 0,
      holdingRisk_USD: 0,
    });
    expect(Math.abs(p.profit_USD)).toBeLessThan(1);
  });

  it('minMaxProfitableLiquidation returns sane bounds', () => {
    const r = minMaxProfitableLiquidation({
      lltv: 0.86,
      poolDepth_USD: 500_000,
      gasCost_USD: 5,
    });
    expect(r.min_USD).toBeGreaterThan(0);
    expect(r.max_USD).toBeGreaterThan(r.min_USD);
  });
});

describe('bad debt cascade', () => {
  it('no bad debt under flat collateral', () => {
    const result = simulateBadDebt({
      paths: [[1, 1, 1, 1], [1, 1, 1, 1]],
      ltvFractions: [0.5, 0.7],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      poolDepth_USD: 500_000,
      gasCost_USD: 5,
      iTRYYieldAnnual: 0.38,
      preLiquidationEnabled: false,
    });
    expect(Math.max(...result.badDebtByPath)).toBe(0);
  });

  it('bad debt > 0 under severe crash', () => {
    const result = simulateBadDebt({
      paths: [[1, 1.5, 2.0, 2.5]],
      ltvFractions: [0.9, 0.95],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      poolDepth_USD: 1000,
      gasCost_USD: 5,
      iTRYYieldAnnual: 0,
      preLiquidationEnabled: false,
    });
    expect(result.badDebtByPath[0]!).toBeGreaterThan(0);
  });

  it('pre-liquidation reduces bad debt vs. hard-LLTV only', () => {
    // Deterministic single-path borderline scenario: position starts at
    // ltvFrac=0.85 (effLTV ≈ 0.73 vs LLTV=0.86), drifts upward through
    // the preLLTV zone at S=1.15 (effLTV ≈ 0.84), then crashes to 1.50
    // at the final step. Pool depth (800k) is moderate: hard-liquidation
    // of the full 731k debt suffers meaningful slippage and produces
    // residual bad debt, while pre-liquidating half the position earlier
    // (smaller seize, lower LIF) avoids the deeper drift and reduces it.
    const args = {
      paths: [[1.0, 1.05, 1.10, 1.15, 1.50]],
      ltvFractions: [0.85],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      poolDepth_USD: 800_000,
      gasCost_USD: 5,
      iTRYYieldAnnual: 0,
    };
    const off = simulateBadDebt({ ...args, preLiquidationEnabled: false });
    const on = simulateBadDebt({ ...args, preLiquidationEnabled: true });
    for (let i = 0; i < off.badDebtByPath.length; i++) {
      expect(on.badDebtByPath[i]!).toBeLessThanOrEqual(off.badDebtByPath[i]!);
    }
    // At least one path strictly improves to prove pre-liq is doing work.
    const offTotal = off.badDebtByPath.reduce((s, x) => s + x, 0);
    const onTotal = on.badDebtByPath.reduce((s, x) => s + x, 0);
    expect(onTotal).toBeLessThan(offTotal);
  });
});

describe('LLTV derivation', () => {
  it('converges within 10 iters', () => {
    const r = deriveRecommendedLLTV({
      p95Drawdown: 0.15,
      slippage: 0.02,
      safetyMargin: 0.02,
      maxIter: 10,
    });
    expect(r.converged).toBe(true);
    expect(r.iterations).toBeLessThanOrEqual(10);
  });

  it('snaps down to governance list', () => {
    expect(snapToGovernanceLLTV(0.80)).toBe(0.77);
    expect(snapToGovernanceLLTV(0.95)).toBe(0.945);
    expect(snapToGovernanceLLTV(0.30)).toBe(0);
  });

  it('lower drawdown → higher recommended LLTV', () => {
    const a = deriveRecommendedLLTV({ p95Drawdown: 0.30, slippage: 0.02, safetyMargin: 0.02 });
    const b = deriveRecommendedLLTV({ p95Drawdown: 0.05, slippage: 0.02, safetyMargin: 0.02 });
    expect(b.raw).toBeGreaterThan(a.raw);
  });
});

describe('strategy', () => {
  it('totals add up', () => {
    const out = computeStrategy({
      borrowAPY: 0.10,
      targetUtilization: 0.7,
      performanceFee: 0.1,
      managementFee: 0.01,
      requiredUSDM: 3_300_000,
      incentiveBudgetMonthly_USD: 10_000,
      attractionRate: 5,
      iTRYYieldAnnual: 0.38,
      expectedTRYDepreciation_annual: 0.30,
      competingAPY: 0.05,
    });
    expect(out.grossSupplyAPY).toBeCloseTo(0.07, 4);
    expect(out.totalSupplyAPY).toBeGreaterThan(out.netSupplyAPY);
    expect(out.daysToTarget).toBeGreaterThan(0);
  });
});

describe('vault json', () => {
  it('lltv encoded as 18-decimal fixed string', () => {
    const j = buildVaultConfigJson({
      lltv: 0.77,
      oracle: '0xORACLE',
      irm: '0xIRM',
      performanceFee: 0.1,
      managementFee: 0.01,
      timelockSeconds: 604800,
      cap_USD: 4_000_000,
      preLLTV: 0.72,
      preLCF: [0.05, 0.5],
      preLIF: [1.01, 1.0837],
    });
    expect(j.market.lltv).toBe('770000000000000000');
    expect(j.preLiquidation.preLCF).toEqual([0.05, 0.5]);
  });

  it('classifyRiskTier: chosen=recommended → Conservative', () => {
    expect(classifyRiskTier(0.77, 0.77)).toBe('Conservative');
    expect(classifyRiskTier(0.82, 0.77)).toBe('Moderate');
    expect(classifyRiskTier(0.86, 0.77)).toBe('Aggressive');
  });
});
