'use client';
import { useEffect, useRef } from 'react';
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

const STORAGE_KEY = 'brix:sidebar-state:v1';
export const DEFAULT_PRE_LIQUIDATION_ENABLED = false;

// Reject any LLTV not in the Morpho governance-allowed set.
const parseAsLLTV = createParser({
  parse: (v: string): LLTV | null => {
    const n = parseFloat(v);
    return (GOV_LLTVS as readonly number[]).includes(n) ? (n as LLTV) : null;
  },
  serialize: (v: LLTV) => String(v),
});

export function useUrlState() {
  const tuple = useQueryStates({
    witryTVL_USD: parseAsFloat.withDefault(5_000_000),
    lltv: parseAsLLTV.withDefault(0.86),
    targetUtilization: parseAsFloat.withDefault(0.8),
    borrowerLTVAlpha: parseAsFloat.withDefault(4.6),
    borrowerLTVBeta: parseAsFloat.withDefault(2),
    witryYieldAnnual: parseAsFloat.withDefault(0.38),
    witryYieldUSD_7d:  parseAsFloat.withDefault(0.0631),
    witryYieldUSD_30d: parseAsFloat.withDefault(0.1931),
    usdtryBaseline: parseAsFloat.withDefault(45),
    historicalPeriod: parseAsInteger.withDefault(5),
    simulationMode: parseAsStringLiteral(MODES).withDefault('Bootstrap'),
    simulationHorizonDays: parseAsInteger.withDefault(30),
    pathCount: parseAsInteger.withDefault(1000),
    tryShockPct: parseAsFloat.withDefault(-0.3),
    incentiveBudgetMonthly_USD: parseAsFloat.withDefault(0),
    attractionRate: parseAsFloat.withDefault(5),
    lockPeriodDays: parseAsInteger.withDefault(90),
    performanceFee: parseAsFloat.withDefault(0.1),
    managementFee: parseAsFloat.withDefault(0),
    safetyMargin: parseAsFloat.withDefault(0.01),
    preLiquidationEnabled: parseAsBoolean.withDefault(DEFAULT_PRE_LIQUIDATION_ENABLED),
    // Morpho pre-liquidation parameters (spec §4D). preLIF2 auto = LIF(LLTV).
    preLLTVOffset: parseAsFloat.withDefault(0.05),
    preLCF1: parseAsFloat.withDefault(0.05),
    preLCF2: parseAsFloat.withDefault(0.5),
    preLIF1: parseAsFloat.withDefault(1.01),
    lltvDrawdownPercentile: parseAsInteger.withDefault(95),
    blockBootstrap: parseAsBoolean.withDefault(true),
    seed: parseAsInteger.withDefault(42),
    // /swapliquidity page state
    poolFeeTier: parseAsInteger.withDefault(3000),
    poolTVL_USD: parseAsFloat.withDefault(500_000),
    bandSplitCore: parseAsFloat.withDefault(0.3),
    bandSplitAbsorb: parseAsFloat.withDefault(0.5),
    // Band price ranges (signed fractions of spot). New defaults close the
    // −10..−5 gap (absorb starts at −5) and extend the tail to −90% so
    // catastrophic crashes still have some recovery liquidity.
    bandCoreLowerPct: parseAsFloat.withDefault(-0.05),
    bandCoreUpperPct: parseAsFloat.withDefault(+0.05),
    bandAbsorbLowerPct: parseAsFloat.withDefault(-0.15),
    bandAbsorbUpperPct: parseAsFloat.withDefault(-0.05),
    bandTailLowerPct: parseAsFloat.withDefault(-0.90),
    bandTailUpperPct: parseAsFloat.withDefault(+0.30),
    swapSellUSD: parseAsFloat.withDefault(1_000_000),
  });

  const [state, setState] = tuple;
  // On first mount, hydrate from localStorage if the URL is bare. On every
  // subsequent state change, mirror to localStorage. URL stays the single
  // source of truth — bookmarked links with explicit params always win.
  const hydrated = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hydrated.current) {
      hydrated.current = true;
      const search = window.location.search;
      const urlIsBare = !search || search === '?';
      if (urlIsBare) {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            // nuqs ignores keys it doesn't know; bad-typed values get
            // rejected by the parsers and fall back to defaults.
            void setState(parsed as Parameters<typeof setState>[0]);
          }
        } catch {
          // Corrupt storage — ignore, fall back to URL/defaults.
        }
      }
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full / unavailable — non-fatal.
    }
  }, [state, setState]);

  return tuple;
}
