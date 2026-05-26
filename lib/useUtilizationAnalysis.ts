// lib/useUtilizationAnalysis.ts
'use client';
import { useMemo } from 'react';
import { useUrlState } from './useUrlState';
import {
  looperNetAPY, liquidityStress, sweepUtilizationTargets, recommendUTarget,
  type RecommendInput, type RecommendResult, type SweepRow, type LooperEconomicsResult,
} from './utilization';

export interface PageSliders {
  tvlUSDM_USD: number;
  stressPctOfSupply: number;
  hfBuffer: number;
  rTargetOverride: number;
  fxAnnualVol: number;
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

const HEATMAP_U = Array.from({ length: 10 }, (_, k) => 0.5 + k * 0.05);
const HEATMAP_R = Array.from({ length: 10 }, (_, k) => 0.01 + k * 0.01);
const TABLE_U = [0.6, 0.7, 0.75, 0.8, 0.83, 0.85, 0.88, 0.9];

export function useUtilizationAnalysis(s: PageSliders): UtilizationAnalysisOutput {
  const [url] = useUrlState();
  const inputs: RecommendInput = useMemo(() => ({
    rTarget: s.rTargetOverride,
    lltv: url.lltv,
    hfBuffer: s.hfBuffer,
    loopCount: url.loopCount,
    witryYield7d:  url.witryYieldUSD_7d,
    witryYield30d: url.witryYieldUSD_30d,
    perLoopSlippageBps: 30,
    tvlUSDM_USD: s.tvlUSDM_USD,
    stressPctOfSupply: s.stressPctOfSupply,
    kinkClearance: url.kinkClearance,
    fxAnnualVol: s.fxAnnualVol,
    fxStressZ: url.fxStressZ,
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
      loopCount: inputs.loopCount,
      fxAnnualVol: inputs.fxAnnualVol, fxStressZ: inputs.fxStressZ,
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
      TABLE_U.some(t => Math.abs(r.uTarget - t) < 1e-6)
    );

    const recommendationTable = TABLE_U
      .map(u => sweep.find(r => Math.abs(r.uTarget - u) < 1e-6))
      .filter((r): r is SweepRow => r !== undefined);

    const heatmap: UtilizationAnalysisOutput['heatmap'] = [];
    for (const u of HEATMAP_U) {
      for (const rT of HEATMAP_R) {
        const econ = looperNetAPY({
          uTarget: u, rTarget: rT, lltv: inputs.lltv,
          hfBuffer: inputs.hfBuffer, witryYieldAnnual: inputs.witryYield7d,
          perLoopSlippageBps: inputs.perLoopSlippageBps,
          loopCount: inputs.loopCount,
          fxAnnualVol: inputs.fxAnnualVol, fxStressZ: inputs.fxStressZ,
        });
        const feasible = econ.loopMargin > 0;
        heatmap.push({ u, r: rT, borrowAPY: econ.borrowAPY, feasible });
      }
    }

    const loopImpossible = !sweep.some(r => r.loopMargin7d > 0);

    return {
      inputs,
      recommended: rec,
      recommendedDetails: { economics, ...stress },
      viabilityCurve,
      stressTable,
      recommendationTable,
      heatmap,
      loopImpossible,
    };
  }, [inputs]);
}
