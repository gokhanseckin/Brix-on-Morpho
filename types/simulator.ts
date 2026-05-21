// types/simulator.ts
export type SimulationMode = 'Bootstrap' | 'GBM' | 'GBM+Jumps' | 'Scenario';
export type HistoricalPeriod = 1 | 3 | 5;
export type LLTV = 0 | 0.385 | 0.625 | 0.77 | 0.86 | 0.915 | 0.945 | 0.965 | 0.98;
export const GOV_LLTVS: LLTV[] = [0, 0.385, 0.625, 0.77, 0.86, 0.915, 0.945, 0.965, 0.98];

export interface SidebarInputs {
  witryTVL_USD: number;
  lltv: LLTV;
  targetUtilization: number;
  borrowerLTVAlpha: number;
  borrowerLTVBeta: number;
  witryYieldAnnual: number;
  witryYieldUSD_7d: number;
  witryYieldUSD_30d: number;
  usdtryBaseline: number;
  historicalPeriod: HistoricalPeriod;
  simulationMode: SimulationMode;
  simulationHorizonDays: 7 | 30 | 60 | 90;
  pathCount: 100 | 1000 | 5000;
  tryShockPct: number;        // scenario mode, e.g. -0.30
  incentiveBudgetMonthly_USD: number;
  attractionRate: number;
  lockPeriodDays: 30 | 60 | 90 | 180;
  poolDepth_USD: number;
  performanceFee: number;
  managementFee: number;
  safetyMargin: number;
  preLiquidationEnabled: boolean;
  blockBootstrap: boolean;
  seed: number;
  // /swapliquidity page state (mirrored in URL via useUrlState).
  poolFeeTier: number;          // basis points: 3000 = 0.30%, 10000 = 1.00%
  poolTVL_USD: number;
  bandSplitCore: number;        // fraction 0..1
  bandSplitAbsorb: number;      // fraction 0..1
}

export interface LiquidityNeedOutput {
  maxBorrowable_USD: number;
  expectedBorrow_USD: number;
  requiredUSDM: number;
  withdrawalBuffer_USD: number;
  liquidityFloor_USD: number;
  irmCurve: Array<{ u: number; r: number }>;
  sensitivity: Array<{ lltv: LLTV; requiredUSDM: number }>;
}

export interface FxOutput {
  paths: number[][];
  p5: number[]; p50: number[]; p95: number[];
  netWitryUSDPaths: { p5: number[]; p50: number[]; p95: number[] };
  positionUnderwaterByDay: Array<{ day: number; pctUnderwater: number }>;
  threeDayMaxDrawdown: { p50: number; p95: number };
  expectedLiquidationVolumeP95_USD: number;
  annualizedVol: number;
}

export interface LiquidityStrategyOutput {
  borrowAPY: number;
  grossSupplyAPY: number;
  netSupplyAPY: number;
  incentiveAPY: number;
  totalSupplyAPY: number;
  daysToTarget: number;
  retentionAfterIncentivesEnd_USD: number;
  totalIncentiveSpend_USD: number;
  leverageLoopAPY: number;
  leverageLoopsViable: boolean;
}

export interface LiquidationOutput {
  minProfitable_USD: number;
  maxProfitable_USD: number;
  recommendedPoolDepth_USD: number;
  badDebtDistribution: number[];
  badDebtP95_USD: number;
  badDebtP95Pct: number;
  preLiquidationParams: {
    preLLTV: number; preLCF1: number; preLCF2: number; preLIF1: number; preLIF2: number;
  };
}

export interface VaultRecommendation {
  recommendedLLTV: LLTV;
  riskTier: 'Conservative' | 'Moderate' | 'Aggressive';
  configJson: Record<string, unknown>;
}

export interface SimulatorOutputs {
  liquidity: LiquidityNeedOutput;
  fx: FxOutput;
  strategy: LiquidityStrategyOutput;
  liquidation: LiquidationOutput;
  vault: VaultRecommendation;
}

export interface LiquidatorRecovery {
  recoveryRatePct: number;     // 1.0 = full recovery, 0.9 = 10% bad debt
  slippagePct: number;
  feePaid_USD: number;
}
