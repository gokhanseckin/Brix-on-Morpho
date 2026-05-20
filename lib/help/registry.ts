// lib/help/registry.ts
// Stub entries for PRs #4–#7; section-1 entries populated by PR #3.
import type { SidebarInputs } from '@/types/simulator';
import { KPI_KEYS, type KpiKey } from './kpiKeys';
import { CHART_KEYS, type ChartKey } from './chartKeys';
import type { ChartHelp, KpiHelp, ParamHelp } from './types';
import {
  LIQUIDITY_NEED_PARAMS,
  LIQUIDITY_NEED_KPIS,
  LIQUIDITY_NEED_CHARTS,
} from './content/liquidityNeed';

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
const sectionParam = (k: keyof SidebarInputs): ParamHelp =>
  LIQUIDITY_NEED_PARAMS[k] ?? { oneLiner: STUB_ONE_LINER };

export const PARAM_HELP: Record<keyof SidebarInputs, ParamHelp> = {
  witryTVL_USD: sectionParam('witryTVL_USD'),
  lltv: sectionParam('lltv'),
  targetUtilization: sectionParam('targetUtilization'),
  borrowerLTVAlpha: sectionParam('borrowerLTVAlpha'),
  borrowerLTVBeta: sectionParam('borrowerLTVBeta'),
  iTRYYieldAnnual: { oneLiner: STUB_ONE_LINER },
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

const SECTION_KPIS: Partial<Record<KpiKey, KpiHelp>> = {
  ...LIQUIDITY_NEED_KPIS,
};

const SECTION_CHARTS: Partial<Record<ChartKey, ChartHelp>> = {
  ...LIQUIDITY_NEED_CHARTS,
};

export const KPI_HELP: Record<KpiKey, KpiHelp> = Object.fromEntries(
  KPI_KEYS.map((k) => [k, SECTION_KPIS[k] ?? STUB_KPI]),
) as Record<KpiKey, KpiHelp>;

export const CHART_HELP: Record<ChartKey, ChartHelp> = Object.fromEntries(
  CHART_KEYS.map((k) => [k, SECTION_CHARTS[k] ?? STUB_CHART]),
) as Record<ChartKey, ChartHelp>;
