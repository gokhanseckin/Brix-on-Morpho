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
  deriveRecommendedLLTV,
  maxLForBadDebt,
  maxLForProfit,
  tierScanRecommendation,
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
      preset: presetWithTVL(1_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidationEnabled: false,
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
      preLiquidationEnabled: false,
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
      preLiquidationEnabled: false,
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
      preLiquidationEnabled: false,
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
      preLiquidationEnabled: false,
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
      preLiquidationEnabled: false,
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
      preLiquidationEnabled: false,
    });
    expect(result.liquidatedVolumeByPath).toHaveLength(1);
    const vol = result.liquidatedVolumeByPath[0]!;
    expect(vol).toBeGreaterThan(0);
    // Upper bound: collateralUSD × LIF (collateral covers debt × LIF when LTV < 1).
    expect(vol).toBeLessThanOrEqual(1_000_000 * 1.1);
  });

  it('honors caller-supplied preLLTVOffset (deeper offset → earlier trigger, more seized volume)', () => {
    // Drifting path that only crosses preLLTV when the offset is wide enough.
    // With a narrow 1pp offset, preLLTV = 0.85; the position never reaches it
    // in this gentle drift. With a wide 10pp offset, preLLTV = 0.76; the
    // position enters the band early and triggers pre-liq.
    const args = {
      paths: [[1.0, 1.02, 1.04, 1.06, 1.08]],
      ltvFractions: [0.85],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(5_000_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidationEnabled: true,
      preLCF1: 0.05,
      preLCF2: 0.5,
      preLIF1: 1.01,
    };
    const narrow = simulateBadDebt({ ...args, preLLTVOffset: 0.01 });
    const wide = simulateBadDebt({ ...args, preLLTVOffset: 0.10 });
    expect(narrow.liquidatedVolumeByPath[0]!).toBe(0);
    expect(wide.liquidatedVolumeByPath[0]!).toBeGreaterThan(0);
  });

  it('honors caller-supplied preLCF2 (more aggressive close → more seized volume)', () => {
    // Same drift, same preLLTV — only the close factor differs. With LCF2
    // dialed up, the partial close at trigger seizes more of the position.
    const args = {
      paths: [[1.0, 1.05, 1.10, 1.15]],
      ltvFractions: [0.85],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(5_000_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidationEnabled: true,
      preLLTVOffset: 0.05,
      preLCF1: 0.05,
      preLIF1: 1.01,
    };
    const gentle = simulateBadDebt({ ...args, preLCF2: 0.10 });
    const aggressive = simulateBadDebt({ ...args, preLCF2: 0.90 });
    expect(aggressive.liquidatedVolumeByPath[0]!).toBeGreaterThan(
      gentle.liquidatedVolumeByPath[0]!,
    );
  });

  it('honors caller-supplied preLIF1 (higher bonus → more seized USD at constant close factor)', () => {
    // ltvFrac=0.99 places effLTV (= 0.99·0.86 = 0.8514) inside the pre-liq
    // band [0.81, 0.86] from the first step, no FX move required. preLCF1 =
    // preLCF2 zeroes out the close-factor interpolation so only lifNow
    // (= preLIF1 + tFrac·(LIF(LLTV) − preLIF1)) varies with preLIF1.
    const args = {
      paths: [[1.0, 1.0]],
      ltvFractions: [0.99],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(50_000_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidationEnabled: true,
      preLLTVOffset: 0.05,
      preLCF1: 0.20,
      preLCF2: 0.20,
    };
    const low = simulateBadDebt({ ...args, preLIF1: 1.01 });
    const high = simulateBadDebt({ ...args, preLIF1: 1.05 });
    expect(low.liquidatedVolumeByPath[0]!).toBeGreaterThan(0);
    expect(high.liquidatedVolumeByPath[0]!).toBeGreaterThan(
      low.liquidatedVolumeByPath[0]!,
    );
  });

  it('linear interpolation: deeper trigger inside the band uses larger close factor', () => {
    // Position A triggers near preLLTV (gentle); position B triggers near
    // LLTV (aggressive). Same close-factor endpoints; pick widely separated
    // anchors so the interpolation gap is large.
    const lltv = 0.86;
    const preLLTVOffset = 0.05;
    const baseArgs = {
      lltv,
      tvl_USD: 1_000_000,
      preset: presetWithTVL(50_000_000, 1),
      spot: 1,
      gasCost_USD: 5,
      witryYieldAnnual: 0,
      preLiquidationEnabled: true,
      preLLTVOffset,
      preLCF1: 0.05,
      preLCF2: 0.95,
      preLIF1: 1.01,
    };
    // Position A: ltvFrac=0.95, no FX move → effLTV = 0.95·0.86 = 0.817
    //   (just above preLLTV=0.81; tFrac ≈ 0.14)
    const gentleTrigger = simulateBadDebt({
      ...baseArgs,
      paths: [[1.0, 1.0]],
      ltvFractions: [0.95],
    });
    // Position B: ltvFrac=0.99, no FX move → effLTV = 0.99·0.86 = 0.851
    //   (deep in band; tFrac ≈ 0.82)
    const deepTrigger = simulateBadDebt({
      ...baseArgs,
      paths: [[1.0, 1.0]],
      ltvFractions: [0.99],
    });
    // Both fire pre-liq once; deeper trigger uses larger close factor →
    // larger seized USD per unit of debt-at-trigger.
    const gentleVol = gentleTrigger.liquidatedVolumeByPath[0]!;
    const deepVol = deepTrigger.liquidatedVolumeByPath[0]!;
    expect(gentleVol).toBeGreaterThan(0);
    expect(deepVol).toBeGreaterThan(0);
    // Normalise by debt at trigger so the comparison is on close-factor share,
    // not on the absolute debt difference between the two positions.
    const debtA = 0.95 * lltv * 1_000_000;
    const debtB = 0.99 * lltv * 1_000_000;
    expect(deepVol / debtB).toBeGreaterThan(gentleVol / debtA);
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
    const off = simulateBadDebt({ ...args, preLiquidationEnabled: false });
    const on = simulateBadDebt({ ...args, preLiquidationEnabled: true });
    expect(on.liquidatedVolumeByPath[0]!).toBeGreaterThan(off.liquidatedVolumeByPath[0]!);
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

  // Regression: the old fixed-point formula declared "break-even" at L≈0.9333
  // for dd=0, slip=5%, safety=0 — but at that L, LIF=1.0204 and the
  // liquidator loses ~3% per liquidation. The new solver must enforce the
  // liquidator-profit constraint and cap L well below 0.9333.
  it('liquidator-profit constraint binds at high slippage / zero drawdown', () => {
    const r = deriveRecommendedLLTV({ p95Drawdown: 0, slippage: 0.05, safetyMargin: 0 });
    expect(r.bindingConstraint).toBe('liquidator-profit');
    expect(r.raw).toBeLessThan(0.90); // old formula gave 0.9333; must be tighter
    // True ceiling: LIF·(1-slip) ≥ 1 → L ≤ 1 - slip/β = 1 - 0.05/0.3 = 0.8333
    expect(r.raw).toBeCloseTo(0.8333, 3);
    expect(LIF(r.raw) * (1 - 0.05)).toBeGreaterThanOrEqual(1 - 1e-6);
  });

  it('bad-debt constraint binds at high drawdown / zero slippage', () => {
    const r = deriveRecommendedLLTV({ p95Drawdown: 0.20, slippage: 0, safetyMargin: 0 });
    expect(r.bindingConstraint).toBe('bad-debt');
    // L · LIF(L) ≤ 1 - 0.20 = 0.80
    expect(r.raw * LIF(r.raw)).toBeLessThanOrEqual(0.80 + 1e-6);
  });

  it('maxLForBadDebt returns 0 when target is non-positive', () => {
    expect(maxLForBadDebt(1.0, 0.0)).toBe(0);
    expect(maxLForBadDebt(0.5, 0.6)).toBe(0);
  });

  it('maxLForProfit returns 0 when even LIF_CAP cannot cover slippage', () => {
    // LIF_CAP = 1.15; need LIF ≥ (1+0)/(1-0.2) = 1.25 > 1.15 → infeasible
    expect(maxLForProfit(0.20, 0)).toBe(0);
  });

  it('tier scan picks largest feasible governance tier', () => {
    // dd=5%, very low slippage (constant 0.5% across tiers), safety=0.5%
    const scan = tierScanRecommendation({
      p95Drawdown: 0.05,
      safetyMargin: 0.005,
      slippageAt: () => 0.005,
    });
    expect(scan.snapped).toBeGreaterThan(0);
    expect(scan.perTier.length).toBeGreaterThan(0);
    // Every tier above the winner must be infeasible
    const winnerIdx = scan.perTier.findIndex((t) => t.lltv === scan.snapped);
    for (let i = winnerIdx + 1; i < scan.perTier.length; i++) {
      expect(scan.perTier[i]!.feasible).toBe(false);
    }
  });

  it('tier scan returns 0 when no tier is feasible', () => {
    const scan = tierScanRecommendation({
      p95Drawdown: 0.99,
      safetyMargin: 0,
      slippageAt: () => 0,
    });
    expect(scan.snapped).toBe(0);
  });
});

describe('strategy', () => {
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
      loopCount: 10,
    });
    expect(out.grossSupplyAPY).toBeCloseTo(0.07, 4);
    expect(out.totalSupplyAPY).toBeGreaterThan(out.netSupplyAPY);
    expect(out.borrowerIncentiveAPY).toBe(0);
    expect(out.netBorrowAPY).toBeCloseTo(0.10, 6);
    // n=10 finite partial sum: (1 − b^11) / (1 − b) where b = 0.86/1.5
    const b = 0.86 / 1.5;
    expect(out.effectiveLeverage).toBeCloseTo((1 - Math.pow(b, 11)) / (1 - b), 6);
    expect(out.loopDebtPerCollateral).toBeCloseTo(0.86 / 1.5, 6);
    expect(out.netLoopAPY).toBeGreaterThan(0);
    expect(out.netLoopAPY_withIncentives).toBeCloseTo(out.netLoopAPY, 10);
  });

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
      loopCount: 10,
    });
    expect(out.borrowerIncentiveAPY).toBeCloseTo(0.24, 6);
    expect(out.netBorrowAPY).toBeCloseTo(-0.14, 6);
    expect(out.netLoopAPY_withIncentives).toBeGreaterThan(out.netLoopAPY);
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
