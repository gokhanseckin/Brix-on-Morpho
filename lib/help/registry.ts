// lib/help/registry.ts
// Stub entries for sections still pending; section content overlaid as it ships.
//   ✓ Section 1 (Liquidity Need) — roadmap PR #3
//   ✓ Section 2 (FX Risk)        — roadmap PR #4
//   ✓ Section 3 (Strategy)       — roadmap PR #5
//   ☐ Section 4-5                — roadmap PR #6-#7
import type { SidebarInputs } from '@/types/simulator';
import { KPI_KEYS, type KpiKey } from './kpiKeys';
import { CHART_KEYS, type ChartKey } from './chartKeys';
import type { ChartHelp, KpiHelp, ParamHelp } from './types';
import {
  LIQUIDITY_NEED_PARAMS,
  LIQUIDITY_NEED_KPIS,
  LIQUIDITY_NEED_CHARTS,
} from './content/liquidityNeed';
import {
  FX_RISK_PARAMS,
  FX_RISK_KPIS,
  FX_RISK_CHARTS,
} from './content/fxRisk';
import {
  STRATEGY_PARAMS,
  STRATEGY_KPIS,
  STRATEGY_CHARTS,
} from './content/strategy';

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

// All section overlays merge here. Later spreads win (none currently
// conflict). The registry test asserts every keyof SidebarInputs has a
// PARAM_HELP entry and every KPI/CHART key has its registry entry.
const SECTION_PARAMS: Partial<Record<string, ParamHelp>> = {
  ...LIQUIDITY_NEED_PARAMS,
  ...FX_RISK_PARAMS,
  ...STRATEGY_PARAMS,
};

const SECTION_KPIS: Partial<Record<KpiKey, KpiHelp>> = {
  ...LIQUIDITY_NEED_KPIS,
  ...FX_RISK_KPIS,
  ...STRATEGY_KPIS,
};

const SECTION_CHARTS: Partial<Record<ChartKey, ChartHelp>> = {
  ...LIQUIDITY_NEED_CHARTS,
  ...FX_RISK_CHARTS,
  ...STRATEGY_CHARTS,
};

const sectionParam = (k: keyof SidebarInputs): ParamHelp =>
  SECTION_PARAMS[k] ?? { oneLiner: STUB_ONE_LINER };

// Hand-listing every SidebarInputs key both pins the contract and lets
// TS catch typos against the type.
export const PARAM_HELP: Record<keyof SidebarInputs, ParamHelp> = {
  witryTVL_USD: sectionParam('witryTVL_USD'),
  lltv: sectionParam('lltv'),
  targetUtilization: sectionParam('targetUtilization'),
  borrowerLTVAlpha: sectionParam('borrowerLTVAlpha'),
  borrowerLTVBeta: sectionParam('borrowerLTVBeta'),
  iTRYYieldAnnual: sectionParam('iTRYYieldAnnual'),
  usdtryBaseline: sectionParam('usdtryBaseline'),
  historicalPeriod: sectionParam('historicalPeriod'),
  simulationMode: sectionParam('simulationMode'),
  simulationHorizonDays: sectionParam('simulationHorizonDays'),
  pathCount: sectionParam('pathCount'),
  tryShockPct: sectionParam('tryShockPct'),
  incentiveBudgetMonthly_USD: sectionParam('incentiveBudgetMonthly_USD'),
  attractionRate: sectionParam('attractionRate'),
  lockPeriodDays: sectionParam('lockPeriodDays'),
  poolDepth_USD: sectionParam('poolDepth_USD'),
  performanceFee: sectionParam('performanceFee'),
  managementFee: sectionParam('managementFee'),
  safetyMargin: sectionParam('safetyMargin'),
  preLiquidationEnabled: sectionParam('preLiquidationEnabled'),
  blockBootstrap: sectionParam('blockBootstrap'),
  seed: sectionParam('seed'),
};

export const KPI_HELP: Record<KpiKey, KpiHelp> = Object.fromEntries(
  KPI_KEYS.map((k) => [k, SECTION_KPIS[k] ?? STUB_KPI]),
) as Record<KpiKey, KpiHelp>;

export const CHART_HELP: Record<ChartKey, ChartHelp> = Object.fromEntries(
  CHART_KEYS.map((k) => [k, SECTION_CHARTS[k] ?? STUB_CHART]),
) as Record<ChartKey, ChartHelp>;
