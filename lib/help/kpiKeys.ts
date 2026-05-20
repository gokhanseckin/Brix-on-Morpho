// lib/help/kpiKeys.ts
// Every numeric KPI rendered on the dashboard. Sections add to this list
// as they introduce KPIs; the registry test enforces a corresponding entry.
import type { HelpSection } from './types';

export const KPI_KEYS = [
  // LiquidityNeed (section 1)
  'maxBorrowable',
  'expectedBorrow',
  'requiredUSDM',
  'withdrawalBuffer',
  'requiredPlusBuffer',
  'liquidityFloor',
  'lltvSensitivity',
  // FXRisk (section 2)
  'threeDayMaxDrawdownP50',
  'threeDayMaxDrawdownP95',
  'expectedLiquidationVolumeP95',
  'annualizedVol',
  // LiquidityStrategy (section 3)
  'borrowAPY',
  'grossSupplyAPY',
  'netSupplyAPY',
  'incentiveAPY',
  'totalSupplyAPY',
  'daysToTarget',
  'retentionAfterIncentives',
  'totalIncentiveSpend',
  'leverageLoopAPY',
  // LiquidationDesign (section 4)
  'minProfitableLiquidation',
  'maxProfitableLiquidation',
  'recommendedPoolDepth',
  'badDebtP95USD',
  'badDebtP95Pct',
  'preLiquidationParams',
  // VaultRecommendations (section 5)
  'recommendedLLTV',
  'riskTier',
  'vaultConfigJson',
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

export const KPI_SECTION: Record<KpiKey, HelpSection> = {
  maxBorrowable: 'liquidity-need',
  expectedBorrow: 'liquidity-need',
  requiredUSDM: 'liquidity-need',
  withdrawalBuffer: 'liquidity-need',
  requiredPlusBuffer: 'liquidity-need',
  liquidityFloor: 'liquidity-need',
  lltvSensitivity: 'liquidity-need',
  threeDayMaxDrawdownP50: 'fx-risk',
  threeDayMaxDrawdownP95: 'fx-risk',
  expectedLiquidationVolumeP95: 'fx-risk',
  annualizedVol: 'fx-risk',
  borrowAPY: 'strategy',
  grossSupplyAPY: 'strategy',
  netSupplyAPY: 'strategy',
  incentiveAPY: 'strategy',
  totalSupplyAPY: 'strategy',
  daysToTarget: 'strategy',
  retentionAfterIncentives: 'strategy',
  totalIncentiveSpend: 'strategy',
  leverageLoopAPY: 'strategy',
  minProfitableLiquidation: 'liquidation',
  maxProfitableLiquidation: 'liquidation',
  recommendedPoolDepth: 'liquidation',
  badDebtP95USD: 'liquidation',
  badDebtP95Pct: 'liquidation',
  preLiquidationParams: 'liquidation',
  recommendedLLTV: 'vault',
  riskTier: 'vault',
  vaultConfigJson: 'vault',
};
