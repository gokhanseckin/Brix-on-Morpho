import { describe, it, expect } from 'vitest';
import {
  computeLiquidityNeed,
  sampleBetaLtvFractions,
  pctUnderwaterAtT,
  slippage,
  liquidatorProfit,
  liquidatorProfitWithPool,
  minMaxProfitableLiquidation,
  quoteSellUSD,
  simulateBadDebt,
  preLiquidationTerms,
  deriveRecommendedLLTV,
  snapToGovernanceLLTV,
  computeStrategy,
  buildVaultConfigJson,
  classifyRiskTier,
  bufferPctFromIncentive,
  irmCurvePoints,
  BUFFER_PCT_BASE,
  BUFFER_PCT_INCENTIVE_SLOPE,
} from '@/lib/simulator';
import { buildAsymmetricLadder, DEFAULT_BAND_SPLIT, type PoolPreset } from '@/lib/poolPreset';
import { materializePool } from '@/lib/univ3/quoteLiquidatorSell';
import { LIF } from '@/lib/morphoMath';

// Convenience: build a ladder preset of the requested USD TVL, centered at
// a provided spot. Default spot matches the standard sim (USD per TRY =
// 1/45). The simulateBadDebt tests use abstract path units (S0=1) and pass
// spot=1 to keep the ladder centered around their paths.
const SPOT = 1 / 45;
const presetWithTVL = (tvl_USD: number, spot: number = SPOT) =>
  buildAsymmetricLadder(spot, tvl_USD, DEFAULT_BAND_SPLIT, 3000);

const crashPresetWithTVL = (tvl_USD: number, spot = 1): PoolPreset =>
  buildAsymmetricLadder(
    spot,
    tvl_USD,
    { core: 1, absorb: 0, tail: 0 },
    3000,
    {
      core: { lowerPct: -0.9, upperPct: 0.3 },
      absorb: { lowerPct: -0.9, upperPct: -0.8 },
      tail: { lowerPct: -0.9, upperPct: 0.3 },
    },
  );

const preLiquidation = (
  enabled: boolean,
  overrides: Partial<{
    preLLTV: number;
    preLCF1: number;
    preLCF2: number;
    preLIF1: number;
    preLIF2: number;
  }> = {},
) => ({
  enabled,
  preLLTV: 0.81,
  preLCF1: 0.05,
  preLCF2: 0.5,
  preLIF1: 1.01,
  preLIF2: LIF(0.86),
  ...overrides,
});

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

  it('profit cliff: deep pool → profit ≈ LIF·(1-fee)·debt - debt for sub-tail debts', () => {
    // With a $50M ladder and a small debt the AMM behaves nearly linearly:
    // revenue ≈ collateralSeized × (1 - feeRate). Profit ≈ debt × (LIF·(1-fee) - 1) - gas.
    const lltv = 0.86;
    const lif = LIF(lltv);
    const debt = 1000;
    const p = liquidatorProfit({
      debt_USD: debt,
      lltv,
      preset: presetWithTVL(50_000_000),
      spot: SPOT,
      gasCost_USD: 0,
      holdingRisk_USD: 0,
    });
    const feeRate = 30 / 10000; // 0.30% fee tier
    const expected = debt * lif * (1 - feeRate) - debt;
    expect(p.profit_USD).toBeCloseTo(expected, -1); // within ~$1
  });

  it('profit cliff: thin pool → profit negative for whale debts', () => {
    const p = liquidatorProfit({
      debt_USD: 5_000_000,
      lltv: 0.86,
      preset: presetWithTVL(100_000),
      spot: SPOT,
      gasCost_USD: 5,
      holdingRisk_USD: 0,
    });
    expect(p.profit_USD).toBeLessThan(0);
  });

  it('minMaxProfitableLiquidation returns sane bounds with a real ladder', () => {
    const r = minMaxProfitableLiquidation({
      lltv: 0.86,
      preset: presetWithTVL(500_000),
      spot: SPOT,
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
      preset: presetWithTVL(500_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0.38,
      preLiquidation: preLiquidation(false),
    });
    expect(Math.max(...result.badDebtByPath)).toBe(0);
  });

  it('bad debt > 0 under severe crash', () => {
    const result = simulateBadDebt({
      paths: [[1, 1.5, 2.0, 2.5]],
      ltvFractions: [0.9, 0.95],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(1_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(false),
    });
    expect(result.badDebtByPath[0]!).toBeGreaterThan(0);
  });

  it('keeps unprofitable underwater positions open so later collateral losses increase bad debt', () => {
    const lltv = 0.86;
    const tvl_USD = 1_000_000;
    const ltvFrac = 0.95;
    const debt = ltvFrac * lltv * tvl_USD;
    const result = simulateBadDebt({
      paths: [[1, 2, 4]],
      ltvFractions: [ltvFrac],
      lltv,
      tvl_USD,
      preset: presetWithTVL(1, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(false),
    });

    expect(result.badDebtByPath[0]!).toBeCloseTo(debt - tvl_USD / 4, 0);
    expect(result.liquidatedCountByPath[0]!).toBe(0);
    expect(result.liquidatedVolumeByPath[0]!).toBe(0);
  });

  it('caps hard-liquidation sale size at the remaining collateral', () => {
    const lltv = 0.86;
    const pool = materializePool(crashPresetWithTVL(5_000_000, 1), 1);
    const out = liquidatorProfitWithPool(pool, {
      debt_USD: 1_000_000,
      lltv,
      spot: 1,
      gasCost_USD: 5,
      holdingRisk_USD: 0,
      collateralAvailable_USD: 100_000,
    });

    expect(out.collateralSeized_USD).toBe(100_000);
  });

  it('sizes hard-liquidation wTRY dumps at the stressed path spot', () => {
    const lltv = 0.86;
    const tvl_USD = 1_000_000;
    const path = [1, 2];
    const preset = crashPresetWithTVL(10_000_000, 1);
    const debt = 0.95 * lltv * tvl_USD;
    const collAfter = tvl_USD / 2;
    const seized = Math.min(debt * LIF(lltv), collAfter);
    const expected = quoteSellUSD(materializePool(preset, 1), 0.5, seized).revenue_USD;
    expect(expected).toBeGreaterThan(debt + 5);

    const result = simulateBadDebt({
      paths: [path],
      ltvFractions: [0.95],
      lltv,
      tvl_USD,
      preset,
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(false),
    });

    expect(result.liquidatedVolumeByPath[0]!).toBeCloseTo(expected, 0);
  });

  it('consumes AMM liquidity across hard liquidations in the same path', () => {
    const single = simulateBadDebt({
      paths: [[1, 2]],
      ltvFractions: [0.95],
      lltv: 0.86,
      tvl_USD: 500_000,
      preset: crashPresetWithTVL(5_000_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(false),
    });
    const cascade = simulateBadDebt({
      paths: [[1, 2]],
      ltvFractions: [0.95, 0.95],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: crashPresetWithTVL(5_000_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(false),
    });

    expect(cascade.badDebtByPath[0]!).toBeGreaterThan(single.badDebtByPath[0]! * 2);
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
      preset: presetWithTVL(800_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
    };
    const off = simulateBadDebt({ ...args, preLiquidation: preLiquidation(false) });
    const on = simulateBadDebt({ ...args, preLiquidation: preLiquidation(true) });
    for (let i = 0; i < off.badDebtByPath.length; i++) {
      expect(on.badDebtByPath[i]!).toBeLessThanOrEqual(off.badDebtByPath[i]!);
    }
    // At least one path strictly improves to prove pre-liq is doing work.
    const offTotal = off.badDebtByPath.reduce((s, x) => s + x, 0);
    const onTotal = on.badDebtByPath.reduce((s, x) => s + x, 0);
    expect(onTotal).toBeLessThan(offTotal);
  });

  it('liquidatedVolumeByPath is zero under flat collateral (nothing liquidates)', () => {
    const result = simulateBadDebt({
      paths: [[1, 1, 1, 1], [1, 1, 1, 1]],
      ltvFractions: [0.5, 0.7],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(500_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0.38,
      preLiquidation: preLiquidation(false),
    });
    expect(result.liquidatedVolumeByPath).toHaveLength(2);
    expect(Math.max(...result.liquidatedVolumeByPath)).toBe(0);
  });

  it('liquidatedVolumeByPath accumulates seized USD when liquidations fire', () => {
    // Deterministic crash forces hard liquidations with enough pool depth
    // that the profit branch fires (not the unprofitable branch). Aggregate
    // volume should be positive and bounded above by total debt × LIF.
    const result = simulateBadDebt({
      paths: [[1.0, 1.2, 1.5, 2.0]],
      ltvFractions: [0.95],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(50_000_000, 1), // deep pool ⇒ near-zero slippage ⇒ profitable
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(false),
    });
    expect(result.liquidatedVolumeByPath).toHaveLength(1);
    const vol = result.liquidatedVolumeByPath[0]!;
    expect(vol).toBeGreaterThan(0);
    // Upper bound: collateralUSD × LIF (collateral covers debt × LIF when LTV < 1).
    expect(vol).toBeLessThanOrEqual(1_000_000 * 1.1);
  });

  it('pre-liquidation contributes to liquidatedVolumeByPath even when no hard liquidation fires', () => {
    // Position drifts into the preLLTV band but never crosses the hard LLTV.
    // With pre-liq on, the partial close should register seized volume.
    const args = {
      paths: [[1.0, 1.05, 1.10, 1.15]],
      ltvFractions: [0.85],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(5_000_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
    };
    const off = simulateBadDebt({ ...args, preLiquidation: preLiquidation(false) });
    const on = simulateBadDebt({ ...args, preLiquidation: preLiquidation(true) });
    expect(on.liquidatedVolumeByPath[0]!).toBeGreaterThan(off.liquidatedVolumeByPath[0]!);
  });

  it('interpolates configured pre-liquidation terms across the eligible LTV range', () => {
    const config = preLiquidation(true, {
      preLLTV: 0.8,
      preLCF1: 0.1,
      preLCF2: 0.5,
      preLIF1: 1.01,
      preLIF2: 1.05,
    });

    expect(preLiquidationTerms(0.8, 0.86, config)).toEqual({
      closeFactor: 0.1,
      incentiveFactor: 1.01,
    });
    const midpoint = preLiquidationTerms(0.83, 0.86, config);
    expect(midpoint.closeFactor).toBeCloseTo(0.3, 10);
    expect(midpoint.incentiveFactor).toBeCloseTo(1.03, 10);
    expect(preLiquidationTerms(0.86, 0.86, config)).toEqual({
      closeFactor: 0.5,
      incentiveFactor: 1.05,
    });
  });

  it('allows repeated profitable pre-liquidations while a position remains eligible', () => {
    const args = {
      paths: [[1, 1.001]],
      ltvFractions: [0.99],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: crashPresetWithTVL(100_000_000, 1),
      spot: 1,
      gasCost_USD: 0,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(true, {
        preLLTV: 0.5,
        preLCF1: 0.1,
        preLCF2: 0.1,
        preLIF1: 1.01,
        preLIF2: 1.01,
      }),
    };
    const firstSeizeOnly = 0.99 * 0.86 * 1_000_000 * 0.1 * 1.01;
    const result = simulateBadDebt(args);

    expect(result.liquidatedVolumeByPath[0]!).toBeGreaterThan(firstSeizeOnly * 1.5);
  });

  it('does not execute a pre-liquidation trade whose AMM proceeds cannot repay debt and gas', () => {
    const result = simulateBadDebt({
      paths: [[1, 1.15]],
      ltvFractions: [0.85],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(1, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidation: preLiquidation(true),
    });

    expect(result.liquidatedVolumeByPath[0]!).toBe(0);
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
      witryYieldAnnual: 0.38,
      expectedTRYDepreciation_annual: 0.30,
      competingAPY: 0.05,
    });
    expect(out.grossSupplyAPY).toBeCloseTo(0.07, 4);
    expect(out.totalSupplyAPY).toBeGreaterThan(out.netSupplyAPY);
    expect(out.daysToTarget).toBeGreaterThan(0);
  });
});

describe('bufferPctFromIncentive (report #2 entry 7)', () => {
  it('equals BUFFER_PCT_BASE when there are no incentives', () => {
    expect(bufferPctFromIncentive(0, 0.05)).toBeCloseTo(BUFFER_PCT_BASE, 10);
  });
  it('grows linearly with incentive/base ratio', () => {
    // incentive=base ⇒ ratio=1 ⇒ buffer = BASE + SLOPE
    expect(bufferPctFromIncentive(0.05, 0.05)).toBeCloseTo(
      BUFFER_PCT_BASE + BUFFER_PCT_INCENTIVE_SLOPE,
      10,
    );
  });
  it('returns BUFFER_PCT_BASE when baseSupplyAPY ≤ 0 (degenerate)', () => {
    expect(bufferPctFromIncentive(0.1, 0)).toBeCloseTo(BUFFER_PCT_BASE, 10);
  });
  it('floors at BUFFER_PCT_BASE when net supply APY is negative', () => {
    // Negative baseSupplyAPY would make the ratio negative; clamp to BASE.
    expect(bufferPctFromIncentive(0.10, -0.02)).toBeCloseTo(BUFFER_PCT_BASE, 10);
  });
  it('caps at 0.50 when incentive dwarfs base APY', () => {
    // Huge incentive vs tiny positive base would otherwise push buffer past 100%.
    expect(bufferPctFromIncentive(10, 0.001)).toBeCloseTo(0.50, 10);
  });
});

describe('irmCurvePoints (report #2 entry 9)', () => {
  it('produces `steps` evenly-spaced points covering [0,1]', () => {
    const pts = irmCurvePoints(0.04, 51);
    expect(pts.length).toBe(51);
    expect(pts[0]!.u).toBe(0);
    expect(pts[50]!.u).toBeCloseTo(1, 10);
    // r at u=0.9 should equal rTarget per AdaptiveCurveIRM anchor.
    const target = pts.find((p) => Math.abs(p.u - 0.9) < 1e-9);
    expect(target?.r).toBeCloseTo(0.04, 8);
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

  it('cap is emitted as absoluteUSD_human (plain dollars, not contract-ready wei)', () => {
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
    expect(j.vault.caps.absoluteUSD_human).toBe(4_000_000);
  });

  it('classifyRiskTier: chosen=recommended → Conservative', () => {
    expect(classifyRiskTier(0.77, 0.77)).toBe('Conservative');
    expect(classifyRiskTier(0.82, 0.77)).toBe('Moderate');
    expect(classifyRiskTier(0.86, 0.77)).toBe('Aggressive');
  });

  it('classifyRiskTier: recommended=0 → Indeterminate (no governance tier qualifies)', () => {
    expect(classifyRiskTier(0.77, 0)).toBe('Indeterminate');
    expect(classifyRiskTier(0.86, 0)).toBe('Indeterminate');
  });
});
