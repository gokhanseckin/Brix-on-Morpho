// lib/help/chartKeys.ts
import type { HelpSection } from './types';

export const CHART_KEYS = [
  'irmCurve',              // LiquidityNeed
  'betaDistribution',      // LiquidityNeed
  'fxBands',               // FXRisk: P5/P50/P95/P99 USD/TRY
  'netWitryUsdPaths',      // FXRisk
  'drawdownDistribution',  // FXRisk: 1-day max drawdown histogram
  'badDebtHistogram',      // LiquidationDesign
  'competitiveBenchmark',  // LiquidityStrategy
  // Utilization (section 6)
  'looperViabilityCurve',
  'fxRiskCard',
  'irmHeatmap',
  'recommendationTable',
  // SwapLiquidity (section 7)
  'liquidityByTick',
  'bandAllocationTable',
  'slippageCurve',
  'repaymentShortfallHistogram',
  'repaymentShortfallSweep',
] as const;

export type ChartKey = (typeof CHART_KEYS)[number];

export const CHART_SECTION: Record<ChartKey, HelpSection> = {
  irmCurve: 'liquidity-need',
  betaDistribution: 'liquidity-need',
  fxBands: 'fx-risk',
  netWitryUsdPaths: 'fx-risk',
  drawdownDistribution: 'fx-risk',
  badDebtHistogram: 'liquidation',
  competitiveBenchmark: 'strategy',
  looperViabilityCurve: 'utilization',
  fxRiskCard: 'utilization',
  irmHeatmap: 'utilization',
  recommendationTable: 'utilization',
  liquidityByTick: 'swap-liquidity',
  bandAllocationTable: 'swap-liquidity',
  slippageCurve: 'swap-liquidity',
  repaymentShortfallHistogram: 'swap-liquidity',
  repaymentShortfallSweep: 'swap-liquidity',
};
