// lib/simulation.worker.ts
import * as Comlink from 'comlink';
import {
  bootstrapPaths,
  blockBootstrapPaths,
  gbmPaths,
  jumpDiffusionPaths,
  fitGbmParams,
  percentilesAtEachStep,
  rolling3DayMaxDrawdown,
} from './fxModel';
import { simulateBadDebt, sampleBetaLtvFractions } from './simulator';
import type { SidebarInputs } from '@/types/simulator';

export interface WorkerInput {
  inputs: SidebarInputs;
  returnsWindow: number[]; // pre-windowed historical returns
}

export interface WorkerOutput {
  paths: number[][];
  p5: number[];
  p50: number[];
  p95: number[];
  threeDayDD: number[];
  badDebt: {
    badDebtByPath: number[];
    badDebtP95_USD: number;
    badDebtP95Pct: number;
    liquidatedCountByPath: number[];
  };
  annualizedVol: number;
}

const api = {
  run(input: WorkerInput): WorkerOutput {
    const { inputs, returnsWindow } = input;
    const common = {
      S0: inputs.usdtryBaseline,
      horizonDays: inputs.simulationHorizonDays,
      paths: inputs.pathCount,
      seed: inputs.seed,
    };
    let paths: number[][];
    switch (inputs.simulationMode) {
      case 'Bootstrap':
        paths = inputs.blockBootstrap
          ? blockBootstrapPaths({ returns: returnsWindow, blockLength: 5, ...common })
          : bootstrapPaths({ returns: returnsWindow, ...common });
        break;
      case 'GBM': {
        const { mu, sigma } = fitGbmParams(returnsWindow);
        paths = gbmPaths({ mu, sigma, ...common });
        break;
      }
      case 'GBM+Jumps': {
        const { mu, sigma } = fitGbmParams(returnsWindow);
        paths = jumpDiffusionPaths({
          mu,
          sigma,
          lambda: 4,
          muJ: -0.05,
          sigmaJ: 0.04,
          ...common,
        });
        break;
      }
      case 'Scenario': {
        // Single deterministic path: linear glide from S0 to S0*(1+|shock|)
        const n = inputs.simulationHorizonDays + 1;
        const end = inputs.usdtryBaseline * (1 + Math.abs(inputs.tryShockPct));
        const path = Array.from({ length: n }, (_, i) =>
          inputs.usdtryBaseline + (end - inputs.usdtryBaseline) * (i / (n - 1)),
        );
        paths = [path];
        break;
      }
    }
    const { p5, p50, p95 } = percentilesAtEachStep(paths);
    const threeDayDD = rolling3DayMaxDrawdown(paths, 3);
    const ltvFractions = sampleBetaLtvFractions({
      alpha: inputs.borrowerLTVAlpha,
      beta: inputs.borrowerLTVBeta,
      n: 1000,
      seed: inputs.seed,
    });
    const badDebtOut = simulateBadDebt({
      paths,
      ltvFractions,
      lltv: inputs.lltv,
      tvl_USD: inputs.witryTVL_USD,
      poolDepth_USD: inputs.poolDepth_USD,
      gasCost_USD: 5,
      iTRYYieldAnnual: inputs.iTRYYieldAnnual,
      preLiquidationEnabled: inputs.preLiquidationEnabled,
    });
    // annualized vol
    const dailyMean =
      returnsWindow.reduce((a, b) => a + b, 0) / returnsWindow.length;
    const dailyVar =
      returnsWindow.reduce((a, b) => a + (b - dailyMean) ** 2, 0) /
      (returnsWindow.length - 1);
    const annualizedVol = Math.sqrt(dailyVar * 252);
    return {
      paths,
      p5,
      p50,
      p95,
      threeDayDD,
      badDebt: {
        badDebtByPath: badDebtOut.badDebtByPath,
        badDebtP95_USD: badDebtOut.badDebtP95_USD,
        badDebtP95Pct: badDebtOut.badDebtP95Pct,
        liquidatedCountByPath: badDebtOut.liquidatedCountByPath,
      },
      annualizedVol,
    };
  },
};

Comlink.expose(api);
export type WorkerApi = typeof api;
