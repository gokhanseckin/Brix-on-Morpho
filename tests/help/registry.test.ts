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
  'witryYieldAnnual',
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
  'performanceFee',
  'managementFee',
  'safetyMargin',
  'preLiquidationEnabled',
  'preLLTVOffset',
  'preLCF1',
  'preLCF2',
  'preLIF1',
  'blockBootstrap',
  'seed',
  'poolFeeTier',
  'poolTVL_USD',
  'bandSplitCore',
  'bandSplitAbsorb',
  'bandCoreLowerPct',
  'bandCoreUpperPct',
  'bandAbsorbLowerPct',
  'bandAbsorbUpperPct',
  'bandTailLowerPct',
  'bandTailUpperPct',
  'swapSellUSD',
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

  // PR #3: Section 1 (Liquidity Need) ships real copy. Guard against
  // accidental regression to stubs.
  describe('PR #3 — liquidity-need content is no longer stubbed', () => {
    const SECTION_1_KPIS = [
      'maxBorrowable',
      'expectedBorrow',
      'requiredUSDM',
      'withdrawalBuffer',
      'requiredPlusBuffer',
      'liquidityFloor',
      'lltvSensitivity',
    ] as const;
    const SECTION_1_CHARTS = ['irmCurve'] as const;
    const SECTION_1_PARAMS = [
      'witryTVL_USD',
      'lltv',
      'targetUtilization',
      'borrowerLTVAlpha',
      'borrowerLTVBeta',
    ] as const;

    it('section-1 KPI entries have real titles + formulas', () => {
      for (const k of SECTION_1_KPIS) {
        expect(KPI_HELP[k].title, `KPI ${k} title still stubbed`).not.toBe('Coming soon');
        expect(KPI_HELP[k].formula.plain).not.toBe('(documentation pending)');
        expect(KPI_HELP[k].definitions.length, `KPI ${k} has no definitions`).toBeGreaterThan(0);
      }
    });

    it('section-1 chart entries have real axes + definitions', () => {
      for (const c of SECTION_1_CHARTS) {
        expect(CHART_HELP[c].title).not.toBe('Coming soon');
        expect(CHART_HELP[c].axes.x).not.toBe('pending');
        expect(CHART_HELP[c].definitions.length).toBeGreaterThan(0);
      }
    });

    it('section-1 param tooltips are no longer the stub one-liner', () => {
      const stub = 'Coming soon. See /help for details.';
      for (const p of SECTION_1_PARAMS) {
        expect(PARAM_HELP[p].oneLiner, `PARAM_HELP.${p} still stubbed`).not.toBe(stub);
      }
    });
  });

  // PR #4: Section 2 (FX Risk) ships real copy.
  describe('PR #4 — fx-risk content is no longer stubbed', () => {
    const SECTION_2_KPIS = [
      'threeDayMaxDrawdownP50',
      'threeDayMaxDrawdownP95',
      'expectedLiquidationVolumeP95',
      'annualizedVol',
    ] as const;
    const SECTION_2_CHARTS = ['fxBands', 'netWitryUsdPaths', 'positionsUnderwater'] as const;
    const SECTION_2_PARAMS = [
      'witryYieldAnnual',
      'usdtryBaseline',
      'historicalPeriod',
      'simulationMode',
      'simulationHorizonDays',
      'pathCount',
      'tryShockPct',
      'blockBootstrap',
      'seed',
    ] as const;

    it('section-2 KPI entries have real titles + formulas', () => {
      for (const k of SECTION_2_KPIS) {
        expect(KPI_HELP[k].title, `KPI ${k} title still stubbed`).not.toBe('Coming soon');
        expect(KPI_HELP[k].formula.plain).not.toBe('(documentation pending)');
        expect(KPI_HELP[k].definitions.length, `KPI ${k} has no definitions`).toBeGreaterThan(0);
      }
    });

    it('section-2 chart entries have real axes + definitions', () => {
      for (const c of SECTION_2_CHARTS) {
        expect(CHART_HELP[c].title).not.toBe('Coming soon');
        expect(CHART_HELP[c].axes.x).not.toBe('pending');
        expect(CHART_HELP[c].definitions.length).toBeGreaterThan(0);
      }
    });

    it('section-2 param tooltips are no longer the stub one-liner', () => {
      const stub = 'Coming soon. See /help for details.';
      for (const p of SECTION_2_PARAMS) {
        expect(PARAM_HELP[p].oneLiner, `PARAM_HELP.${p} still stubbed`).not.toBe(stub);
      }
    });
  });

  // PR #5: Section 3 (Liquidity Strategy) ships real copy.
  describe('PR #5 — strategy content is no longer stubbed', () => {
    const SECTION_3_KPIS = [
      'borrowAPY',
      'grossSupplyAPY',
      'netSupplyAPY',
      'incentiveAPY',
      'totalSupplyAPY',
      'daysToTarget',
      'retentionAfterIncentives',
      'totalIncentiveSpend',
      'leverageLoopAPY',
    ] as const;
    const SECTION_3_PARAMS = [
      'incentiveBudgetMonthly_USD',
      'attractionRate',
      'lockPeriodDays',
      'performanceFee',
      'managementFee',
    ] as const;

    it('section-3 KPI entries have real titles + formulas', () => {
      for (const k of SECTION_3_KPIS) {
        expect(KPI_HELP[k].title, `KPI ${k} title still stubbed`).not.toBe('Coming soon');
        expect(KPI_HELP[k].formula.plain).not.toBe('(documentation pending)');
        expect(KPI_HELP[k].definitions.length, `KPI ${k} has no definitions`).toBeGreaterThan(0);
      }
    });

    it('section-3 param tooltips are no longer the stub one-liner', () => {
      const stub = 'Coming soon. See /help for details.';
      for (const p of SECTION_3_PARAMS) {
        expect(PARAM_HELP[p].oneLiner, `PARAM_HELP.${p} still stubbed`).not.toBe(stub);
      }
    });
  });

  // PR #6: Section 4 (Liquidation Design) ships real copy.
  describe('PR #6 — liquidation content is no longer stubbed', () => {
    const SECTION_4_KPIS = [
      'minProfitableLiquidation',
      'maxProfitableLiquidation',
      'recommendedPoolDepth',
      'badDebtP95USD',
      'badDebtP95Pct',
      'preLiquidationParams',
    ] as const;
    const SECTION_4_CHARTS = ['badDebtHistogram'] as const;
    const SECTION_4_PARAMS = [
      'safetyMargin',
      'preLiquidationEnabled',
    ] as const;

    it('section-4 KPI entries have real titles + formulas', () => {
      for (const k of SECTION_4_KPIS) {
        expect(KPI_HELP[k].title, `KPI ${k} title still stubbed`).not.toBe('Coming soon');
        expect(KPI_HELP[k].formula.plain).not.toBe('(documentation pending)');
        expect(KPI_HELP[k].definitions.length, `KPI ${k} has no definitions`).toBeGreaterThan(0);
      }
    });

    it('section-4 chart entries have real axes + definitions', () => {
      for (const c of SECTION_4_CHARTS) {
        expect(CHART_HELP[c].title).not.toBe('Coming soon');
        expect(CHART_HELP[c].axes.x).not.toBe('pending');
        expect(CHART_HELP[c].definitions.length).toBeGreaterThan(0);
      }
    });

    it('section-4 param tooltips are no longer the stub one-liner', () => {
      const stub = 'Coming soon. See /help for details.';
      for (const p of SECTION_4_PARAMS) {
        expect(PARAM_HELP[p].oneLiner, `PARAM_HELP.${p} still stubbed`).not.toBe(stub);
      }
    });
  });

  // PR #7: Section 5 (Vault Recommendations) ships real copy.
  // Section 5 owns no sidebar inputs — all params are derived — so no
  // param-stub guard. Only KPIs are checked.
  describe('PR #7 — vault content is no longer stubbed', () => {
    const SECTION_5_KPIS = [
      'recommendedLLTV',
      'riskTier',
      'vaultConfigJson',
    ] as const;

    it('section-5 KPI entries have real titles + formulas', () => {
      for (const k of SECTION_5_KPIS) {
        expect(KPI_HELP[k].title, `KPI ${k} title still stubbed`).not.toBe('Coming soon');
        expect(KPI_HELP[k].formula.plain).not.toBe('(documentation pending)');
        expect(KPI_HELP[k].definitions.length, `KPI ${k} has no definitions`).toBeGreaterThan(0);
      }
    });

    // Help system is now fully populated — no sidebar param should remain
    // stubbed. This guards against future SidebarInputs additions slipping in
    // without help copy.
    it('no sidebar param is left on the stub one-liner', () => {
      const stub = 'Coming soon. See /help for details.';
      for (const [k, v] of Object.entries(PARAM_HELP)) {
        expect(v.oneLiner, `PARAM_HELP.${k} still stubbed`).not.toBe(stub);
      }
    });

    // Same for KPIs and charts now that all 5 sections shipped.
    it('no KPI is left on the stub title', () => {
      for (const [k, v] of Object.entries(KPI_HELP)) {
        expect(v.title, `KPI_HELP.${k} still stubbed`).not.toBe('Coming soon');
      }
    });

    it('no chart is left on the stub title', () => {
      for (const [k, v] of Object.entries(CHART_HELP)) {
        expect(v.title, `CHART_HELP.${k} still stubbed`).not.toBe('Coming soon');
      }
    });
  });
});
