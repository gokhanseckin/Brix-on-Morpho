// lib/help/registry.ts
// Stub entries for PR #1. Real copy lands in PRs #2-#6.
import type { SidebarInputs } from '@/types/simulator';
import { KPI_KEYS, type KpiKey } from './kpiKeys';
import { CHART_KEYS, type ChartKey } from './chartKeys';
import type { ChartHelp, KpiHelp, ParamHelp } from './types';

const STUB_ONE_LINER = 'Coming soon. See /help for details.';

const STUB_KPI: KpiHelp = {
  title: 'Coming soon',
  oneLiner: STUB_ONE_LINER,
  formula: { plain: '(documentation pending)' },
  params: [],
  definitions: [],
  impact: {
    health: 'Pending.',
    sustainability: 'Pending.',
    profitability: 'Pending.',
  },
};

const STUB_CHART: ChartHelp = {
  title: 'Coming soon',
  oneLiner: STUB_ONE_LINER,
  axes: { x: 'pending', y: 'pending' },
  definitions: [],
  impact: {
    health: 'Pending.',
    sustainability: 'Pending.',
    profitability: 'Pending.',
  },
};

// PARAM_HELP must have an entry for every key of SidebarInputs.
// The registry test asserts this — adding a sidebar input without help breaks CI.
export const PARAM_HELP: Record<keyof SidebarInputs, ParamHelp> = {
  witryTVL_USD: { oneLiner: STUB_ONE_LINER },
  lltv: { oneLiner: STUB_ONE_LINER },
  targetUtilization: { oneLiner: STUB_ONE_LINER },
  borrowerLTVAlpha: { oneLiner: STUB_ONE_LINER },
  borrowerLTVBeta: { oneLiner: STUB_ONE_LINER },
  iTRYYieldAnnual: { oneLiner: STUB_ONE_LINER },
  witryYieldUSD_7d:  { oneLiner: 'Trailing-7-day USD APY of holding wiTRY. Used by /utilization as the conservative loop-viability threshold.' },
  witryYieldUSD_30d: { oneLiner: 'Trailing-30-day USD APY of holding wiTRY. Shown as the optimistic reference on /utilization.' },
  usdtryBaseline: { oneLiner: STUB_ONE_LINER },
  historicalPeriod: { oneLiner: STUB_ONE_LINER },
  simulationMode: { oneLiner: STUB_ONE_LINER },
  simulationHorizonDays: { oneLiner: STUB_ONE_LINER },
  pathCount: { oneLiner: STUB_ONE_LINER },
  tryShockPct: { oneLiner: STUB_ONE_LINER },
  incentiveBudgetMonthly_USD: { oneLiner: STUB_ONE_LINER },
  attractionRate: { oneLiner: STUB_ONE_LINER },
  lockPeriodDays: { oneLiner: STUB_ONE_LINER },
  poolDepth_USD: { oneLiner: STUB_ONE_LINER },
  performanceFee: { oneLiner: STUB_ONE_LINER },
  managementFee: { oneLiner: STUB_ONE_LINER },
  safetyMargin: { oneLiner: STUB_ONE_LINER },
  preLiquidationEnabled: { oneLiner: STUB_ONE_LINER },
  blockBootstrap: { oneLiner: STUB_ONE_LINER },
  seed: { oneLiner: STUB_ONE_LINER },
};

export const KPI_HELP: Record<KpiKey, KpiHelp> = Object.fromEntries(
  KPI_KEYS.map((k) => [k, STUB_KPI]),
) as Record<KpiKey, KpiHelp>;

export const CHART_HELP: Record<ChartKey, ChartHelp> = Object.fromEntries(
  CHART_KEYS.map((k) => [k, STUB_CHART]),
) as Record<ChartKey, ChartHelp>;
