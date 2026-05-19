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
} from './simulator';
import { LIF, adaptiveCurveIRM } from './morphoMath';
import { GOV_LLTVS, type SidebarInputs } from '@/types/simulator';

function quantile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
}

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

  const rTarget = 0.04;
  // borrowAPY derives from the static AdaptiveCurveIRM at the chosen target utilization.
  const borrowAPY = useMemo(
    () => adaptiveCurveIRM(s.targetUtilization, rTarget),
    [s.targetUtilization],
  );

  const liquidity = useMemo(() => {
    const out = computeLiquidityNeed({
      witryTVL_USD: s.witryTVL_USD,
      lltv: s.lltv,
      targetUtilization: s.targetUtilization,
      borrowerLTVAlpha: s.borrowerLTVAlpha,
      borrowerLTVBeta: s.borrowerLTVBeta,
      incentiveAPY: 0,
      baseSupplyAPY: 0.05,
      deadDepositCost: 1,
    });
    const irmCurve = irmCurvePoints(rTarget);
    const sensitivity = GOV_LLTVS.slice(2, 6).map((lv) => ({
      lltv: lv,
      requiredUSDM:
        (s.witryTVL_USD *
          lv *
          (s.borrowerLTVAlpha / (s.borrowerLTVAlpha + s.borrowerLTVBeta))) /
        s.targetUtilization,
    }));
    return { ...out, irmCurve, sensitivity };
  }, [s]);

  const strategy = useMemo(
    () =>
      computeStrategy({
        borrowAPY,
        targetUtilization: s.targetUtilization,
        performanceFee: s.performanceFee,
        managementFee: s.managementFee,
        requiredUSDM: liquidity.requiredUSDM,
        incentiveBudgetMonthly_USD: s.incentiveBudgetMonthly_USD,
        attractionRate: s.attractionRate,
        iTRYYieldAnnual: s.iTRYYieldAnnual,
        expectedTRYDepreciation_annual: 0.3,
        competingAPY: 0.05,
      }),
    [s, liquidity.requiredUSDM, borrowAPY],
  );

  const lltvDerivation = useMemo(() => {
    const p95dd = result?.threeDayDD ? quantile(result.threeDayDD, 0.95) : 0.15;
    const minMax = minMaxProfitableLiquidation({
      lltv: s.lltv,
      poolDepth_USD: s.poolDepth_USD,
      gasCost_USD: 5,
    });
    // Heuristic single-event liquidation size: 1% of total expected borrows
    // (TVL × LLTV × β-mean). Multiplied by LIF for collateral seized.
    const meanLTVFrac = betaMean(s.borrowerLTVAlpha, s.borrowerLTVBeta);
    const p95LiquidationSize_USD =
      s.witryTVL_USD * s.lltv * meanLTVFrac * 0.01 * LIF(s.lltv);
    const rawSlip = slippage(p95LiquidationSize_USD, s.poolDepth_USD);
    const slippageEstimate = Math.max(0, Math.min(0.5, rawSlip));
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
        timelockSeconds: 604800,
        cap_USD: liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD,
        preLLTV: Math.max(0, s.lltv - 0.05),
        preLCF: [0.05, 0.5],
        preLIF: [1.01, LIF(s.lltv)],
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
