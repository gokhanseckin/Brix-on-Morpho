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

export const STORAGE_KEY = 'brix:sidebar-state:v1';

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
    hfBuffer:          parseAsFloat.withDefault(1.5),
    loopCount:         parseAsInteger.withDefault(10),
    usdtryBaseline: parseAsFloat.withDefault(45),
    historicalPeriod: parseAsInteger.withDefault(5),
    simulationMode: parseAsStringLiteral(MODES).withDefault('Bootstrap'),
    simulationHorizonDays: parseAsInteger.withDefault(30),
    pathCount: parseAsInteger.withDefault(1000),
    tryShockPct: parseAsFloat.withDefault(-0.3),
    supplyIncentiveBudgetMonthly_USD: parseAsFloat.withDefault(0),
    borrowerIncentiveBudgetMonthly_USD: parseAsFloat.withDefault(0),
    performanceFee: parseAsFloat.withDefault(0.1),
    managementFee: parseAsFloat.withDefault(0),
    safetyMargin: parseAsFloat.withDefault(0.01),
    preLiquidationEnabled: parseAsBoolean.withDefault(true),
    // Morpho pre-liquidation parameters (spec §4D). preLIF2 auto = LIF(LLTV).
    preLLTVOffset: parseAsFloat.withDefault(0.05),
    preLCF1: parseAsFloat.withDefault(0.05),
    preLCF2: parseAsFloat.withDefault(0.5),
    preLIF1: parseAsFloat.withDefault(1.01),
    lltvDrawdownPercentile: parseAsInteger.withDefault(95),
    // Morpho IRM "rate at target" — APR at the target utilization (u=90% in
    // the adaptive-curve formula). Default 0.04 = Morpho governance default.
    // Edited on /utilization; read on home (Strategy section + IRM curve).
    rTargetIRM: parseAsFloat.withDefault(0.04),
    // Minimum gap between u_target and the Morpho IRM kink (u = 0.9).
    // Default 0 = no enforced buffer; the goal on /utilization is to
    // operate close to the kink for max supplier APY. Slider remains so
    // operators can dial in a buffer if they want one.
    kinkClearance: parseAsFloat.withDefault(0.0),
    // FX stress-quantile multiplier on annualized USD/TRY vol. Default
    // 1.65 ≈ 95th-percentile single-tail z-score. Gates whether a levered
    // loop position survives a 1-month P95 FX move within HF headroom.
    fxStressZ: parseAsFloat.withDefault(1.65),
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
  // Two effects keep URL as the single source of truth while letting
  // localStorage carry params across page navigations:
  //   (A) MOUNT-ONLY hydration — on first mount, if the URL has no query
  //       string, load every saved key from localStorage and push them to
  //       the URL. Bookmarked URLs with explicit params always win.
  //   (B) WRITE-ON-CHANGE mirror — every time state changes, mirror the
  //       whole shape to localStorage. The flag below skips the very
  //       first render so we don't overwrite stored values with the
  //       defaults that render gives us before hydration runs.
  const skipFirstWrite = useRef(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = window.location.search;
    const urlIsBare = !search || search === '?';
    if (!urlIsBare) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // nuqs ignores unknown keys and falls back to defaults for bad
      // values, so we can safely throw the whole blob at setState.
      void setState(parsed as Parameters<typeof setState>[0]);
    } catch {
      // Corrupt storage — fall back to URL/defaults.
    }
    // Intentionally [] — hydrate exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full / unavailable — non-fatal.
    }
  }, [state]);

  return tuple;
}
