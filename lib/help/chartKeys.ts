// lib/help/chartKeys.ts
import type { HelpSection } from './types';

export const CHART_KEYS = [
  'irmCurve',              // LiquidityNeed
  'fxBands',               // FXRisk: P5/P50/P95 USD/TRY
  'netWitryUsdPaths',      // FXRisk
  'positionsUnderwater',   // FXRisk
  'badDebtHistogram',      // LiquidationDesign
] as const;

export type ChartKey = (typeof CHART_KEYS)[number];

export const CHART_SECTION: Record<ChartKey, HelpSection> = {
  irmCurve: 'liquidity-need',
  fxBands: 'fx-risk',
  netWitryUsdPaths: 'fx-risk',
  positionsUnderwater: 'fx-risk',
  badDebtHistogram: 'liquidation',
};
