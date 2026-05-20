import { describe, expect, it } from 'vitest';
import { PARAM_HELP, KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS } from '@/lib/help/kpiKeys';
import { CHART_KEYS } from '@/lib/help/chartKeys';

// We can't enumerate keyof SidebarInputs at runtime, so we hard-code the
// expected list here. If a sidebar input is added without a PARAM_HELP entry,
// TS will fail in registry.ts; if one is removed without updating this list,
// this test fails. Either way, the drift is caught.
const EXPECTED_PARAM_KEYS = [
  'witryTVL_USD',
  'lltv',
  'targetUtilization',
  'borrowerLTVAlpha',
  'borrowerLTVBeta',
  'iTRYYieldAnnual',
  'witryYieldUSD_7d',
  'witryYieldUSD_30d',
  'usdtryBaseline',
  'historicalPeriod',
  'simulationMode',
  'simulationHorizonDays',
  'pathCount',
  'tryShockPct',
  'incentiveBudgetMonthly_USD',
  'attractionRate',
  'lockPeriodDays',
  'poolDepth_USD',
  'performanceFee',
  'managementFee',
  'safetyMargin',
  'preLiquidationEnabled',
  'blockBootstrap',
  'seed',
] as const;

describe('help registry', () => {
  it('PARAM_HELP has an entry for every expected sidebar input', () => {
    const got = Object.keys(PARAM_HELP).sort();
    const want = [...EXPECTED_PARAM_KEYS].sort();
    expect(got).toEqual(want);
  });

  it('every PARAM_HELP entry has a non-empty oneLiner', () => {
    for (const [k, v] of Object.entries(PARAM_HELP)) {
      expect(v.oneLiner, `PARAM_HELP.${k}.oneLiner empty`).toBeTruthy();
    }
  });

  it('KPI_HELP has an entry for every KPI_KEYS entry', () => {
    for (const k of KPI_KEYS) {
      expect(KPI_HELP[k], `KPI_HELP missing ${k}`).toBeDefined();
    }
  });

  it('every KPI_HELP entry has all required fields', () => {
    for (const [k, v] of Object.entries(KPI_HELP)) {
      expect(v.title, `KPI_HELP.${k}.title`).toBeTruthy();
      expect(v.formula.plain, `KPI_HELP.${k}.formula.plain`).toBeTruthy();
      expect(v.impact.health, `KPI_HELP.${k}.impact.health`).toBeTruthy();
      expect(v.impact.sustainability, `KPI_HELP.${k}.impact.sustainability`).toBeTruthy();
      expect(v.impact.profitability, `KPI_HELP.${k}.impact.profitability`).toBeTruthy();
    }
  });

  it('CHART_HELP has an entry for every CHART_KEYS entry', () => {
    for (const k of CHART_KEYS) {
      expect(CHART_HELP[k], `CHART_HELP missing ${k}`).toBeDefined();
    }
  });
});
