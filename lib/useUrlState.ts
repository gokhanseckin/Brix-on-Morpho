'use client';
import {
  useQueryStates,
  parseAsFloat,
  parseAsInteger,
  parseAsBoolean,
  parseAsStringLiteral,
  createParser,
} from 'nuqs';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';

const MODES = ['Bootstrap', 'GBM', 'GBM+Jumps', 'Scenario'] as const;

// Reject any LLTV not in the Morpho governance-allowed set.
const parseAsLLTV = createParser({
  parse: (v: string): LLTV | null => {
    const n = parseFloat(v);
    return (GOV_LLTVS as readonly number[]).includes(n) ? (n as LLTV) : null;
  },
  serialize: (v: LLTV) => String(v),
});

export function useUrlState() {
  return useQueryStates({
    witryTVL_USD: parseAsFloat.withDefault(5_000_000),
    lltv: parseAsLLTV.withDefault(0.77),
    targetUtilization: parseAsFloat.withDefault(0.7),
    borrowerLTVAlpha: parseAsFloat.withDefault(2),
    borrowerLTVBeta: parseAsFloat.withDefault(1.2),
    witryYieldAnnual: parseAsFloat.withDefault(0.38),
    witryYieldUSD_7d:  parseAsFloat.withDefault(0.0631),
    witryYieldUSD_30d: parseAsFloat.withDefault(0.1931),
    usdtryBaseline: parseAsFloat.withDefault(38.5),
    historicalPeriod: parseAsInteger.withDefault(3),
    simulationMode: parseAsStringLiteral(MODES).withDefault('Bootstrap'),
    simulationHorizonDays: parseAsInteger.withDefault(30),
    pathCount: parseAsInteger.withDefault(1000),
    tryShockPct: parseAsFloat.withDefault(-0.3),
    incentiveBudgetMonthly_USD: parseAsFloat.withDefault(10_000),
    attractionRate: parseAsFloat.withDefault(5),
    lockPeriodDays: parseAsInteger.withDefault(90),
    poolDepth_USD: parseAsFloat.withDefault(500_000),
    performanceFee: parseAsFloat.withDefault(0.1),
    managementFee: parseAsFloat.withDefault(0.01),
    safetyMargin: parseAsFloat.withDefault(0.02),
    preLiquidationEnabled: parseAsBoolean.withDefault(true),
    blockBootstrap: parseAsBoolean.withDefault(false),
    seed: parseAsInteger.withDefault(42),
    // /swapliquidity page state
    poolFeeTier: parseAsInteger.withDefault(3000),
    poolTVL_USD: parseAsFloat.withDefault(500_000),
    bandSplitCore: parseAsFloat.withDefault(0.3),
    bandSplitAbsorb: parseAsFloat.withDefault(0.5),
  });
}
