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
import { buildLadderFromInputs } from './poolPreset';
import { quantile } from './stats';
import type { SidebarInputs } from '@/types/simulator';

// --- Simulation constants (see report #2 entry 36) ------------------------
// BOOTSTRAP_BLOCK_LENGTH_DAYS: block length for the block-bootstrap option;
//   ~1 trading week preserves short-run autocorrelation per spec §2.
// BORROWER_POPULATION_SAMPLES: number of synthetic borrowers drawn from the
//   Beta(α,β) LTV distribution for the bad-debt cascade.
// JUMP_*: Merton jump-diffusion calibration constants per spec §2. Positive
//   log jumps raise USD/TRY, i.e. TRY depreciation and wiTRY collateral loss.
// DEFAULT_GAS_COST_USD: nominal cushion (MegaETH gas is near-zero).
const BOOTSTRAP_BLOCK_LENGTH_DAYS = 5;
const BORROWER_POPULATION_SAMPLES = 1000;
const JUMP_LAMBDA_PER_YEAR = 4;
const JUMP_LOG_MEAN = 0.05;
const JUMP_LOG_STD = 0.04;
const DEFAULT_GAS_COST_USD = 5;

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
    liquidatedVolumeByPath: number[];
    expectedLiquidationVolumeP95_USD: number;
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
          ? blockBootstrapPaths({ returns: returnsWindow, blockLength: BOOTSTRAP_BLOCK_LENGTH_DAYS, ...common })
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
          lambda: JUMP_LAMBDA_PER_YEAR,
          muJ: JUMP_LOG_MEAN,
          sigmaJ: JUMP_LOG_STD,
          ...common,
        });
        break;
      }
      case 'Scenario': {
        // Single deterministic path: linear glide from S0 to S0·(1+|shock|).
        // `tryShockPct` is signed in the UI (negative = TRY drop), but the
        // simulator always glides upward (USD/TRY rising = TRY weakening =
        // collateral USD value falling) — hence the abs(). See report #2
        // entry #21.
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
      n: BORROWER_POPULATION_SAMPLES,
      seed: inputs.seed,
    });
    const spot = 1 / inputs.usdtryBaseline;
    const preset = buildLadderFromInputs(spot, inputs);
    const badDebtOut = simulateBadDebt({
      paths,
      ltvFractions,
      lltv: inputs.lltv,
      tvl_USD: inputs.witryTVL_USD,
      preset,
      spot,
      gasCost_USD: DEFAULT_GAS_COST_USD,
      witryYieldAnnual: inputs.witryYieldAnnual,
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
        liquidatedVolumeByPath: badDebtOut.liquidatedVolumeByPath,
        expectedLiquidationVolumeP95_USD: quantile(
          badDebtOut.liquidatedVolumeByPath,
          0.95,
        ),
      },
      annualizedVol,
    };
  },
};

Comlink.expose(api);
export type WorkerApi = typeof api;
