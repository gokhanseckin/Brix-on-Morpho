// lib/help/chartKeys.ts
import type { HelpSection } from './types';

export const CHART_KEYS = [
  'irmCurve',              // LiquidityNeed
  'betaDistribution',      // LiquidityNeed
  'fxBands',               // FXRisk: P5/P50/P95 USD/TRY
  'netWitryUsdPaths',      // FXRisk
  'positionsUnderwater',   // FXRisk
  'badDebtHistogram',      // LiquidationDesign
  // Utilization (section 6)
  'looperViabilityCurve',
  'liquidityStressTable',
  'loopEconomicsWaterfall',
  'irmHeatmap',
  'recommendationTable',
  // SwapLiquidity (section 7)
  'liquidityByTick',
  'bandAllocationTable',
  'swapBadDebtHistogram',
  'presetExportSchema',
] as const;

export type ChartKey = (typeof CHART_KEYS)[number];

export const CHART_SECTION: Record<ChartKey, HelpSection> = {
  irmCurve: 'liquidity-need',
  betaDistribution: 'liquidity-need',
  fxBands: 'fx-risk',
  netWitryUsdPaths: 'fx-risk',
  positionsUnderwater: 'fx-risk',
  badDebtHistogram: 'liquidation',
  looperViabilityCurve: 'utilization',
  liquidityStressTable: 'utilization',
  loopEconomicsWaterfall: 'utilization',
  irmHeatmap: 'utilization',
  recommendationTable: 'utilization',
  liquidityByTick: 'swap-liquidity',
  bandAllocationTable: 'swap-liquidity',
  swapBadDebtHistogram: 'swap-liquidity',
  presetExportSchema: 'swap-liquidity',
};
