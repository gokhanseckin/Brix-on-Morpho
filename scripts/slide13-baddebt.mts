/**
 * One-off calibration script for slide 13 of /assignment.
 *
 * Runs simulateBadDebt with the canonical sidebar defaults to capture
 * fresh 1-day-drawdown bad-debt P95 numbers (with and without pre-liq).
 *
 * Inputs mirror lib/useUrlState.ts defaults verbatim — change them here
 * only if the sidebar defaults change.
 *
 * Run: npx tsx scripts/slide13-baddebt.mts
 */
import { blockBootstrapPaths } from '../lib/fxModel';
import { loadFxRows, windowRows, dailyLogReturns } from '../lib/fxData';
import {
  simulateBadDebt,
  buildPreLiquidationScenario,
  sampleBetaLtvFractions,
} from '../lib/simulator';
import { buildLadderFromInputs } from '../lib/poolPreset';

// Sidebar defaults (lib/useUrlState.ts, 2026-05-26)
const DEFAULTS = {
  witryTVL_USD: 5_000_000,
  lltv: 0.86,
  borrowerLTVAlpha: 4.6,
  borrowerLTVBeta: 2,
  witryYieldAnnual: 0.38,
  usdtryBaseline: 45,
  historicalPeriod: 5,
  simulationHorizonDays: 30,
  pathCount: 1000,
  seed: 42,
  preLLTVOffset: 0.05,
  preLCF1: 0.05,
  preLCF2: 0.5,
  preLIF1: 1.01,
  poolFeeTier: 3000,
  poolTVL_USD: 500_000,
  bandSplitCore: 0.3,
  bandSplitAbsorb: 0.5,
  bandCoreLowerPct: -0.05,
  bandCoreUpperPct: +0.05,
  bandAbsorbLowerPct: -0.15,
  bandAbsorbUpperPct: -0.05,
  bandTailLowerPct: -0.9,
  bandTailUpperPct: +0.3,
} as const;

const BORROWER_POPULATION_SAMPLES = 1000;
const BOOTSTRAP_BLOCK_LENGTH_DAYS = 5;
const DEFAULT_GAS_COST_USD = 5;

function run(preLiqEnabled: boolean) {
  const rows = windowRows(loadFxRows(), DEFAULTS.historicalPeriod);
  const returns = dailyLogReturns(rows);
  const paths = blockBootstrapPaths({
    returns,
    blockLength: BOOTSTRAP_BLOCK_LENGTH_DAYS,
    S0: DEFAULTS.usdtryBaseline,
    horizonDays: DEFAULTS.simulationHorizonDays,
    paths: DEFAULTS.pathCount,
    seed: DEFAULTS.seed,
  });
  const ltvFractions = sampleBetaLtvFractions({
    alpha: DEFAULTS.borrowerLTVAlpha,
    beta: DEFAULTS.borrowerLTVBeta,
    n: BORROWER_POPULATION_SAMPLES,
    seed: DEFAULTS.seed,
  });
  const spot = 1 / DEFAULTS.usdtryBaseline;
  const preset = buildLadderFromInputs(spot, DEFAULTS as never);
  const out = simulateBadDebt({
    paths,
    ltvFractions,
    lltv: DEFAULTS.lltv,
    tvl_USD: DEFAULTS.witryTVL_USD,
    preset,
    spot,
    gasCost_USD: DEFAULT_GAS_COST_USD,
    witryYieldAnnual: DEFAULTS.witryYieldAnnual,
    preLiquidation: buildPreLiquidationScenario({
      enabled: preLiqEnabled,
      lltv: DEFAULTS.lltv,
      preLLTVOffset: DEFAULTS.preLLTVOffset,
      preLCF1: DEFAULTS.preLCF1,
      preLCF2: DEFAULTS.preLCF2,
      preLIF1: DEFAULTS.preLIF1,
    }),
  });
  const pctOfPathsWithAnyBadDebt =
    out.badDebtByPath.filter((v) => v > 0).length / out.badDebtByPath.length;
  return {
    p95_USD: out.badDebtP95_USD,
    p95_pct: out.badDebtP95Pct,
    anyBadDebtRate: pctOfPathsWithAnyBadDebt,
  };
}

const off = run(false);
const on = run(true);

const fmt = (v: number, digits = 2) => v.toFixed(digits);
console.log('=== slide-13 calibration ===');
console.log(`canonical inputs: LLTV ${DEFAULTS.lltv}, TVL $${DEFAULTS.witryTVL_USD.toLocaleString()},`);
console.log(`historical window ${DEFAULTS.historicalPeriod}y, horizon ${DEFAULTS.simulationHorizonDays}d,`);
console.log(`paths ${DEFAULTS.pathCount}, seed ${DEFAULTS.seed}`);
console.log('');
console.log('PRE-LIQ OFF:');
console.log(`  P95 bad debt: $${off.p95_USD.toLocaleString()} (${fmt(off.p95_pct * 100)}% of TVL)`);
console.log(`  paths with any bad debt: ${fmt(off.anyBadDebtRate * 100, 1)}%`);
console.log('');
console.log('PRE-LIQ ON:');
console.log(`  P95 bad debt: $${on.p95_USD.toLocaleString()} (${fmt(on.p95_pct * 100)}% of TVL)`);
console.log(`  paths with any bad debt: ${fmt(on.anyBadDebtRate * 100, 1)}%`);
