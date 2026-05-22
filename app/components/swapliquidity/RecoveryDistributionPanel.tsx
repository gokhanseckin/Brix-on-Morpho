'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { useSimulator } from '@/lib/useSimulator';
import { buildAsymmetricLadder } from '@/lib/poolPreset';
import { quoteLiquidatorSell } from '@/lib/univ3/quoteLiquidatorSell';
import { badDebtFromAMMSale } from '@/lib/badDebtMath';
import { LIF } from '@/lib/morphoMath';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Kpi } from '@/app/components/Kpi';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const PROBE_COLLATERAL_USD = 25_000;
const MAX_PATHS = 200;
const HIST_BINS = 20;

interface PathResult {
  badDebtPct: number;
  recoveryPct: number;
}

export function RecoveryDistributionPanel() {
  const [state] = useUrlState();
  const { fx } = useSimulator();
  const lltv = state.lltv;
  const lif = LIF(lltv);
  const debtUSD = PROBE_COLLATERAL_USD / lif;
  const bufferPct = 1 - 1 / lif;

  // Sample terminal USD/TRY across MC paths and convert to USD-per-wTRY spot.
  const terminalSpots = useMemo<number[]>(() => {
    const paths = fx?.paths;
    if (!paths || paths.length === 0) return [];
    const step = Math.max(1, Math.floor(paths.length / MAX_PATHS));
    const out: number[] = [];
    for (let i = 0; i < paths.length; i += step) {
      const p = paths[i];
      if (!p || p.length === 0) continue;
      const last = p[p.length - 1];
      if (typeof last === 'number' && last > 0) out.push(1 / last);
    }
    return out;
  }, [fx]);

  const results = useMemo<PathResult[]>(() => {
    if (terminalSpots.length === 0) return [];
    const split = {
      core: state.bandSplitCore,
      absorb: state.bandSplitAbsorb,
      tail: Math.max(0, 1 - state.bandSplitCore - state.bandSplitAbsorb),
    };
    const fee = state.poolFeeTier === 10000 ? 10000 : 3000;
    const out: PathResult[] = [];
    for (const spot of terminalSpots) {
      try {
        const preset = buildAsymmetricLadder(spot, state.poolTVL_USD, split, fee);
        const wTRYwei = BigInt(Math.floor((PROBE_COLLATERAL_USD / spot) * 1e6));
        const q = quoteLiquidatorSell(preset, spot, wTRYwei);
        const ammSale = Number(q.amountOut) / 1e6;
        const bd = badDebtFromAMMSale({
          collateral_USD: PROBE_COLLATERAL_USD,
          lltv,
          ammSale_USDM: ammSale,
        });
        out.push({ badDebtPct: bd.badDebtPct, recoveryPct: bd.recoveryPct });
      } catch {
        // skip pathological spots (e.g. tick overflow at extreme FX)
      }
    }
    return out;
  }, [terminalSpots, state.poolTVL_USD, state.bandSplitCore, state.bandSplitAbsorb, state.poolFeeTier, lltv]);

  const { histogram, p95BadDebt, medianBadDebt, zeroBadDebtPct } = useMemo<{
    histogram: Array<{ bin: number; count: number }>;
    p95BadDebt: number | null;
    medianBadDebt: number | null;
    zeroBadDebtPct: number;
  }>(() => {
    if (results.length === 0) {
      return { histogram: [], p95BadDebt: null, medianBadDebt: null, zeroBadDebtPct: 0 };
    }
    const badDebts = results.map((r) => r.badDebtPct);
    const sorted = [...badDebts].sort((a, b) => a - b);
    const idx95 = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const idx50 = Math.floor(sorted.length * 0.5);
    const zeroCount = badDebts.filter((b) => b === 0).length;
    const max = sorted[sorted.length - 1]!;
    // Histogram from 0 to max (or small range if all zero)
    const upper = Math.max(0.001, max);
    const width = upper / HIST_BINS;
    const bins = Array.from({ length: HIST_BINS }, (_, i) => ({
      bin: (i + 0.5) * width,
      count: 0,
    }));
    for (const b of badDebts) {
      const idx = Math.min(HIST_BINS - 1, Math.floor(b / width));
      bins[idx]!.count += 1;
    }
    return {
      histogram: bins,
      p95BadDebt: sorted[idx95] ?? null,
      medianBadDebt: sorted[idx50] ?? null,
      zeroBadDebtPct: zeroCount / badDebts.length,
    };
  }, [results]);

  const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;

  return (
    <section id="section-recovery" className="space-y-3">
      <h2 className="text-lg font-semibold">4. Bad-debt distribution</h2>
      <div className="text-sm text-neutral-500">
        For each Monte-Carlo path (sampled, n={results.length}), liquidate ${PROBE_COLLATERAL_USD.toLocaleString()} of
        wTRY collateral at the path&apos;s terminal spot. At LLTV {fmtPct(lltv, 1)} the debt is{' '}
        ${debtUSD.toFixed(0)}; LIF buffer is {fmtPct(bufferPct, 2)}. Bad debt = max(0, debt − AMM proceeds).
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Paths with zero bad debt" value={fmtPct(zeroBadDebtPct)} helpKey="zeroBadDebtPct" />
        <Kpi
          label="Median bad-debt rate"
          value={medianBadDebt !== null ? fmtPct(medianBadDebt) : '—'}
          helpKey="medianBadDebtRate"
        />
        <Kpi
          label="95th-percentile bad-debt rate"
          value={p95BadDebt !== null ? fmtPct(p95BadDebt) : '—'}
          helpKey="p95BadDebtRate"
        />
      </div>
      <div className="border rounded p-2">
        <div className="flex items-center text-xs text-neutral-500 px-2 pt-1">
          <span>Bad-debt rate distribution</span>
          <HelpPopover chartKey="swapBadDebtHistogram" />
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={histogram}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="bin"
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(v) => `Bad debt ${(Number(v) * 100).toFixed(2)}%`}
              formatter={(v) => [`${v} paths`, 'count']}
            />
            <Bar dataKey="count" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
