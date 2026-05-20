'use client';
import { useEffect, useMemo } from 'react';
import { useUrlState } from './useUrlState';
import { useSimulationWorker } from './useSimulationWorker';
import { loadFxRows, dailyLogReturns, windowRows } from './fxData';
import {
  computeLiquidityNeed,
  irmCurvePoints,
  computeStrategy,
  deriveRecommendedLLTV,
  snapToGovernanceLLTV,
  classifyRiskTier,
  buildVaultConfigJson,
  minMaxProfitableLiquidation,
  slippage,
  betaMean,
  PRE_LIQUIDATION_LLTV_OFFSET,
  PRE_LIQUIDATION_LCF,
  PRE_LIQUIDATION_LIF_MIN,
} from './simulator';
import { LIF, adaptiveCurveIRM } from './morphoMath';
import { quantile } from './stats';
import { GOV_LLTVS, type SidebarInputs } from '@/types/simulator';

// --- Policy dials surfaced as constants -----------------------------------
// These are NOT user-tunable today; they encode Morpho governance defaults
// and out-of-scope estimates the simulator deliberately doesn't model.
// Surface them in the help system as "fixed assumptions" rather than
// "derived". See docs/superpowers/specs/2026-05-20-formula-validation-report.md
// entries 35–36 for the rationale.
const MORPHO_IRM_RTARGET = 0.04;                  // 4% APR @ u=90% target
const DEFAULT_TRY_DEPRECIATION_ANNUAL = 0.30;     // rough estimate, out of scope
const COMPETING_STABLECOIN_APY = 0.05;            // typical USDC supply APY
const DEFAULT_DEAD_DEPOSIT_COST_USD = 1;          // gas-cost proxy for one dead deposit
const DEFAULT_P95_3D_DRAWDOWN = 0.15;             // first-render fallback before worker
const DEFAULT_GAS_COST_USD = 5;                   // nominal cushion (MegaETH gas ≈ 0)
const P95_LIQUIDATION_FRACTION_OF_BORROWS = 0.01; // 1% of expected borrows
const SLIPPAGE_ESTIMATE_CAP = 0.5;                // hard ceiling on derived slippage
const DEFAULT_VAULT_TIMELOCK_SECONDS = 604_800;   // 7 days, spec §5

export function useSimulator() {
  const [s] = useUrlState();
  const { running, result, run } = useSimulationWorker();

  const returnsWindow = useMemo(() => {
    const rows = windowRows(loadFxRows(), s.historicalPeriod as 1 | 3 | 5);
    return dailyLogReturns(rows);
  }, [s.historicalPeriod]);

  // Trigger worker run when relevant inputs change
  useEffect(() => {
    run({ inputs: s as unknown as SidebarInputs, returnsWindow });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, returnsWindow]);

  // borrowAPY derives from the static AdaptiveCurveIRM at the chosen target utilization.
  const borrowAPY = useMemo(
    () => adaptiveCurveIRM(s.targetUtilization, MORPHO_IRM_RTARGET),
    [s.targetUtilization],
  );

  // Stage 1: compute requiredUSDM ahead of time so strategy + liquidity can
  // both consume the same value without a useMemo cycle. The formula matches
  // computeLiquidityNeed's internal calculation exactly.
  const requiredUSDMPrecursor = useMemo(() => {
    const meanLTVFrac = betaMean(s.borrowerLTVAlpha, s.borrowerLTVBeta);
    return (s.witryTVL_USD * s.lltv * meanLTVFrac) / s.targetUtilization;
  }, [s.witryTVL_USD, s.lltv, s.borrowerLTVAlpha, s.borrowerLTVBeta, s.targetUtilization]);

  // Stage 2: strategy depends on requiredUSDM and produces the real
  // incentiveAPY + netSupplyAPY that the buffer formula needs.
  const strategy = useMemo(
    () =>
      computeStrategy({
        borrowAPY,
        targetUtilization: s.targetUtilization,
        performanceFee: s.performanceFee,
        managementFee: s.managementFee,
        requiredUSDM: requiredUSDMPrecursor,
        incentiveBudgetMonthly_USD: s.incentiveBudgetMonthly_USD,
        attractionRate: s.attractionRate,
        witryYieldAnnual: s.witryYieldAnnual,
        expectedTRYDepreciation_annual: DEFAULT_TRY_DEPRECIATION_ANNUAL,
        competingAPY: COMPETING_STABLECOIN_APY,
      }),
    [s, requiredUSDMPrecursor, borrowAPY],
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
      incentiveAPY: strategy.incentiveAPY,
      baseSupplyAPY: strategy.netSupplyAPY,
      deadDepositCost: DEFAULT_DEAD_DEPOSIT_COST_USD,
    });
    const irmCurve = irmCurvePoints(MORPHO_IRM_RTARGET);
    const sensitivity = GOV_LLTVS.slice(2, 6).map((lv) => ({
      lltv: lv,
      requiredUSDM:
        (s.witryTVL_USD *
          lv *
          (s.borrowerLTVAlpha / (s.borrowerLTVAlpha + s.borrowerLTVBeta))) /
        s.targetUtilization,
    }));
    return { ...out, irmCurve, sensitivity };
  }, [s, strategy.incentiveAPY, strategy.netSupplyAPY]);

  const lltvDerivation = useMemo(() => {
    const p95dd = result?.threeDayDD ? quantile(result.threeDayDD, 0.95) : DEFAULT_P95_3D_DRAWDOWN;
    const minMax = minMaxProfitableLiquidation({
      lltv: s.lltv,
      poolDepth_USD: s.poolDepth_USD,
      gasCost_USD: DEFAULT_GAS_COST_USD,
    });
    // Heuristic single-event liquidation size: P95_LIQUIDATION_FRACTION_OF_BORROWS
    // of total expected borrows (TVL × LLTV × β-mean), multiplied by LIF for
    // collateral seized. See report #2 entry 36g.
    const meanLTVFrac = betaMean(s.borrowerLTVAlpha, s.borrowerLTVBeta);
    const p95LiquidationSize_USD =
      s.witryTVL_USD * s.lltv * meanLTVFrac * P95_LIQUIDATION_FRACTION_OF_BORROWS * LIF(s.lltv);
    const rawSlip = slippage(p95LiquidationSize_USD, s.poolDepth_USD);
    const slippageEstimate = Math.max(0, Math.min(SLIPPAGE_ESTIMATE_CAP, rawSlip));
    const derived = deriveRecommendedLLTV({
      p95Drawdown: p95dd,
      slippage: slippageEstimate,
      safetyMargin: s.safetyMargin,
    });
    const snapped = snapToGovernanceLLTV(derived.raw);
    return { ...derived, snapped, minMax, slippageEstimate };
  }, [
    result,
    s.lltv,
    s.poolDepth_USD,
    s.safetyMargin,
    s.witryTVL_USD,
    s.borrowerLTVAlpha,
    s.borrowerLTVBeta,
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
        preLLTV: Math.max(0, s.lltv - PRE_LIQUIDATION_LLTV_OFFSET),
        preLCF: PRE_LIQUIDATION_LCF,
        preLIF: [PRE_LIQUIDATION_LIF_MIN, LIF(s.lltv)],
      }),
    [s, liquidity],
  );

  return {
    inputs: s,
    running,
    fx: result,
    liquidity,
    strategy,
    lltvDerivation,
    riskTier: classifyRiskTier(s.lltv, lltvDerivation.snapped || 0),
    vaultJson,
  };
}
