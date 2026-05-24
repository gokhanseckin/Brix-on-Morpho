'use client';
import { useEffect, useMemo } from 'react';
import { useUrlState } from './useUrlState';
import { useSimulationWorker } from './useSimulationWorker';
import { loadFxRows, dailyLogReturns, windowRows } from './fxData';
import {
  computeLiquidityNeed,
  irmCurvePoints,
  computeStrategy,
  tierScanRecommendation,
  classifyRiskTier,
  buildVaultConfigJson,
  minMaxProfitableLiquidation,
  slippageFromPreset,
  betaMean,
} from './simulator';
import { buildLadderFromInputs, effectiveDepthFromPreset } from './poolPreset';
import { LIF, adaptiveCurveIRM } from './morphoMath';
import { quantile } from './stats';
import { GOV_LLTVS, type SidebarInputs, type LiquidityStrategyOutput } from '@/types/simulator';

// --- Policy dials surfaced as constants -----------------------------------
// These are NOT user-tunable today; they encode Morpho governance defaults
// and out-of-scope estimates the simulator deliberately doesn't model.
// Surface them in the help system as "fixed assumptions" rather than
// "derived". See docs/superpowers/specs/2026-05-20-formula-validation-report.md
// entries 35–36 for the rationale.
// MORPHO_IRM_RTARGET used to be a hardcoded 0.04 here. It is now sourced from
// the URL/localStorage state as `rTargetIRM` (editable on /utilization,
// default 0.04 = Morpho governance) so the page's slider actually feeds
// home's Strategy borrowAPY and IRM curve.
const DEFAULT_DEAD_DEPOSIT_COST_USD = 1;          // gas-cost proxy for one dead deposit
const DEFAULT_GAS_COST_USD = 5;                   // nominal cushion (MegaETH gas ≈ 0)
export const P95_LIQUIDATION_FRACTION_OF_BORROWS = 0.01; // 1% of expected borrows
const SLIPPAGE_ESTIMATE_CAP = 0.5;                // hard ceiling on derived slippage
const DEFAULT_VAULT_TIMELOCK_SECONDS = 604_800;   // 7 days, spec §5

/**
 * Compute the empirical p{percentile} 1-day drawdown of the wiTRY-per-USD
 * series for use as a fallback before the Monte Carlo worker has run. Cheap;
 * pure on the inputs — `windowRows` slice + max-1d-drawdown is O(n).
 */
function empiricalDrawdownP(
  rows: Array<{ rate: number }>,
  percentile: number,
): number {
  if (rows.length < 2) return 0;
  const wiUSD = rows.map((r) => 1 / r.rate);
  const out: number[] = [];
  for (let i = 1; i < wiUSD.length; i++) {
    const peak = wiUSD[i - 1]!;
    const cur = wiUSD[i]!;
    out.push(-(cur - peak) / peak);
  }
  out.sort((x, y) => x - y);
  const idx = Math.min(out.length - 1, Math.max(0, Math.floor((out.length - 1) * percentile)));
  return out[idx] ?? 0;
}

export function useSimulator() {
  const [s] = useUrlState();
  const { running, result, run } = useSimulationWorker();

  const returnsWindow = useMemo(() => {
    const rows = windowRows(loadFxRows(), s.historicalPeriod as 1 | 3 | 5);
    return dailyLogReturns(rows);
  }, [s.historicalPeriod]);

  // borrowAPY derives from the static AdaptiveCurveIRM at the chosen target utilization.
  const borrowAPY = useMemo(
    () => adaptiveCurveIRM(s.targetUtilization, s.rTargetIRM),
    [s.targetUtilization, s.rTargetIRM],
  );

  // Trigger worker run when relevant inputs change
  useEffect(() => {
    run({ inputs: s as unknown as SidebarInputs, returnsWindow, borrowAPY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, returnsWindow, borrowAPY]);

  // Stage 1: compute requiredUSDM + expected borrow ahead of time so strategy
  // + liquidity can both consume the same values without a useMemo cycle.
  const requiredUSDMPrecursor = useMemo(() => {
    const meanLTVFrac = betaMean(s.borrowerLTVAlpha, s.borrowerLTVBeta);
    return (s.witryTVL_USD * s.lltv * meanLTVFrac) / s.targetUtilization;
  }, [s.witryTVL_USD, s.lltv, s.borrowerLTVAlpha, s.borrowerLTVBeta, s.targetUtilization]);
  const expectedBorrowPrecursor = useMemo(() => {
    const meanLTVFrac = betaMean(s.borrowerLTVAlpha, s.borrowerLTVBeta);
    return s.witryTVL_USD * s.lltv * meanLTVFrac;
  }, [s.witryTVL_USD, s.lltv, s.borrowerLTVAlpha, s.borrowerLTVBeta]);

  // Stage 2: strategy depends on requiredUSDM and produces the real
  // supplyIncentiveAPY + netSupplyAPY that the buffer formula needs.
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

  // Stage 3: liquidity uses the real APYs from strategy, so withdrawal buffer
  // actually responds to the user's incentive budget.
  const liquidity = useMemo(() => {
    const out = computeLiquidityNeed({
      witryTVL_USD: s.witryTVL_USD,
      lltv: s.lltv,
      targetUtilization: s.targetUtilization,
      borrowerLTVAlpha: s.borrowerLTVAlpha,
      borrowerLTVBeta: s.borrowerLTVBeta,
      incentiveAPY: strategy.supplyIncentiveAPY,
      baseSupplyAPY: strategy.netSupplyAPY,
      deadDepositCost: DEFAULT_DEAD_DEPOSIT_COST_USD,
    });
    const irmCurve = irmCurvePoints(s.rTargetIRM);
    const sensitivity = GOV_LLTVS.slice(2, 6).map((lv) => ({
      lltv: lv,
      requiredUSDM:
        (s.witryTVL_USD *
          lv *
          (s.borrowerLTVAlpha / (s.borrowerLTVAlpha + s.borrowerLTVBeta))) /
        s.targetUtilization,
    }));
    return { ...out, irmCurve, sensitivity };
  }, [s, strategy.supplyIncentiveAPY, strategy.netSupplyAPY]);

  // Build the AMM ladder once per parameter change. Reused by minMax, the
  // slippage estimator below, the worker payload, and LiquidationDesign.
  const spot = 1 / s.usdtryBaseline;
  const preset = useMemo(
    () =>
      buildLadderFromInputs(spot, {
        poolTVL_USD: s.poolTVL_USD,
        bandSplitCore: s.bandSplitCore,
        bandSplitAbsorb: s.bandSplitAbsorb,
        poolFeeTier: s.poolFeeTier,
        bandCoreLowerPct: s.bandCoreLowerPct,
        bandCoreUpperPct: s.bandCoreUpperPct,
        bandAbsorbLowerPct: s.bandAbsorbLowerPct,
        bandAbsorbUpperPct: s.bandAbsorbUpperPct,
        bandTailLowerPct: s.bandTailLowerPct,
        bandTailUpperPct: s.bandTailUpperPct,
      }),
    [
      spot,
      s.poolTVL_USD,
      s.bandSplitCore,
      s.bandSplitAbsorb,
      s.poolFeeTier,
      s.bandCoreLowerPct,
      s.bandCoreUpperPct,
      s.bandAbsorbLowerPct,
      s.bandAbsorbUpperPct,
      s.bandTailLowerPct,
      s.bandTailUpperPct,
    ],
  );
  const effectivePoolDepth_USD = useMemo(
    () => effectiveDepthFromPreset(preset, spot),
    [preset, spot],
  );

  // Empirical p{percentile} 1-day drawdown from the loaded 5-year window.
  // Used as fallback before the Monte Carlo worker finishes; previously a
  // hardcoded 5% that was mislabeled as "empirical".
  const empiricalP1dDrawdown = useMemo(() => {
    const rows = windowRows(loadFxRows(), s.historicalPeriod as 1 | 3 | 5);
    const percentileFrac = Math.max(0, Math.min(1, s.lltvDrawdownPercentile / 100));
    return empiricalDrawdownP(rows, percentileFrac);
  }, [s.historicalPeriod, s.lltvDrawdownPercentile]);

  const lltvDerivation = useMemo(() => {
    // Drawdown source: worker's per-path max 1-day move, taken at the
    // operator's chosen percentile (default p95). 1 day is the realistic
    // execution window between liquidation eligibility and a MEV bot's
    // tx confirming on MegaETH. Pre-liquidation is opt-in per borrower
    // (Morpho spec) so it cannot be assumed market-wide; LLTV calibration
    // must reflect the worst case — no pre-liq cap.
    const percentileFrac = Math.max(0, Math.min(1, s.lltvDrawdownPercentile / 100));
    const p95dd = result?.oneDayDD
      ? quantile(result.oneDayDD, percentileFrac)
      : empiricalP1dDrawdown;
    const fallbackInUse = !result?.oneDayDD;

    const minMax = minMaxProfitableLiquidation({
      lltv: s.lltv,
      preset,
      spot,
      gasCost_USD: DEFAULT_GAS_COST_USD,
    });
    // Tier scan: evaluate each governance LLTV with its own liquidation size
    // and slippage. Fixes the prior circular dependency where the recommended
    // LLTV was a function of the user's currently-selected LLTV.
    const meanLTVFrac = betaMean(s.borrowerLTVAlpha, s.borrowerLTVBeta);
    const slippageAt = (lltvCandidate: number): number => {
      const liqSize_USD =
        s.witryTVL_USD *
        lltvCandidate *
        meanLTVFrac *
        P95_LIQUIDATION_FRACTION_OF_BORROWS *
        LIF(lltvCandidate);
      const rawSlip = slippageFromPreset(preset, spot, liqSize_USD);
      return Math.max(0, Math.min(SLIPPAGE_ESTIMATE_CAP, rawSlip));
    };
    const scan = tierScanRecommendation({
      p95Drawdown: p95dd,
      safetyMargin: s.safetyMargin,
      slippageAt,
    });
    // For display: slippage estimate is the slippage AT THE WINNING TIER
    // (or AT THE USER'S CURRENT TIER if scan returned 0, so the
    // "Live calculation inputs" table still shows something useful).
    const evalLLTV = scan.snapped > 0 ? scan.snapped : s.lltv;
    const slippageEstimate = slippageAt(evalLLTV);
    return {
      raw: scan.raw,
      snapped: scan.snapped,
      converged: true,
      iterations: 1,
      bindingConstraint: scan.bindingConstraint,
      perTier: scan.perTier,
      minMax,
      slippageEstimate,
      p95Drawdown: p95dd,
      fallbackInUse,
      drawdownPercentile: s.lltvDrawdownPercentile,
    };
  }, [
    result,
    s.lltv,
    preset,
    spot,
    s.safetyMargin,
    s.witryTVL_USD,
    s.borrowerLTVAlpha,
    s.borrowerLTVBeta,
    s.lltvDrawdownPercentile,
    empiricalP1dDrawdown,
  ]);

  const vaultJson = useMemo(
    () =>
      buildVaultConfigJson({
        lltv: s.lltv,
        oracle: '0xORACLE',
        irm: '0xIRM',
        performanceFee: s.performanceFee,
        managementFee: s.managementFee,
        timelockSeconds: DEFAULT_VAULT_TIMELOCK_SECONDS,
        cap_USD: liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD,
        // Editable on /lltv. preLIF2 stays capped at LIF(LLTV) per Morpho.
        preLLTV: Math.max(0, s.lltv - s.preLLTVOffset),
        preLCF: [s.preLCF1, s.preLCF2],
        preLIF: [s.preLIF1, LIF(s.lltv)],
      }),
    [s, liquidity],
  );

  const loopPathOverlay = useMemo(() => {
    if (!result?.loopPath) return undefined;
    const { apyByPath, apyP5, apyP50, apyP95, liquidationRate } = result.loopPath;
    // 12 fixed buckets from −100% to +200% APY (liquidated paths land in the leftmost bucket).
    const buckets = 12;
    const lo = -1.0;
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

  const strategyWithLoopPath = useMemo<LiquidityStrategyOutput>(
    () => (loopPathOverlay ? { ...strategy, loopPath: loopPathOverlay } : { ...strategy }),
    [strategy, loopPathOverlay],
  );

  return {
    inputs: s,
    running,
    fx: result,
    liquidity,
    strategy: strategyWithLoopPath,
    lltvDerivation,
    riskTier: classifyRiskTier(s.lltv, lltvDerivation.snapped || 0),
    vaultJson,
    pool: { preset, spot, effectiveDepth_USD: effectivePoolDepth_USD },
  };
}
