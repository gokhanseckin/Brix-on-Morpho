'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { useSimulator } from '@/lib/useSimulator';
import { buildAsymmetricLadder } from '@/lib/poolPreset';
import { quoteLiquidatorSell } from '@/lib/univ3/quoteLiquidatorSell';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const PROBE_SELL_USD = 25_000;
const MAX_PATHS = 200;
const HIST_BINS = 20;

export function RecoveryDistributionPanel() {
  const [state] = useUrlState();
  const { fx } = useSimulator();

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

  const recoveries = useMemo<number[]>(() => {
    if (terminalSpots.length === 0) return [];
    const split = {
      core: state.bandSplitCore,
      absorb: state.bandSplitAbsorb,
      tail: Math.max(0, 1 - state.bandSplitCore - state.bandSplitAbsorb),
    };
    const fee = state.poolFeeTier === 10000 ? 10000 : 3000;
    const out: number[] = [];
    for (const spot of terminalSpots) {
      try {
        const preset = buildAsymmetricLadder(spot, state.poolTVL_USD, split, fee);
        const wTRYwei = BigInt(Math.floor((PROBE_SELL_USD / spot) * 1e6));
        const q = quoteLiquidatorSell(preset, spot, wTRYwei);
        const usdmOut = Number(q.amountOut) / 1e6;
        out.push(usdmOut / PROBE_SELL_USD);
      } catch {
        // skip pathological spots (e.g. tick overflow at extreme FX)
      }
    }
    return out;
  }, [terminalSpots, state.poolTVL_USD, state.bandSplitCore, state.bandSplitAbsorb, state.poolFeeTier]);

  const { histogram, p5, p50 } = useMemo<{
    histogram: Array<{ bin: number; count: number }>;
    p5: number | null;
    p50: number | null;
  }>(() => {
    if (recoveries.length === 0) return { histogram: [], p5: null, p50: null };
    const sorted = [...recoveries].sort((a, b) => a - b);
    const idx5 = Math.max(0, Math.floor(sorted.length * 0.05));
    const idx50 = Math.floor(sorted.length * 0.5);
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    const width = Math.max(1e-6, (max - min) / HIST_BINS);
    const bins = Array.from({ length: HIST_BINS }, (_, i) => ({
      bin: min + (i + 0.5) * width,
      count: 0,
    }));
    for (const r of recoveries) {
      const b = Math.min(HIST_BINS - 1, Math.floor((r - min) / width));
      bins[b]!.count += 1;
    }
    return { histogram: bins, p5: sorted[idx5] ?? null, p50: sorted[idx50] ?? null };
  }, [recoveries]);

  return (
    <section id="section-recovery" className="space-y-3">
      <h2 className="text-lg font-semibold">3. Recovery distribution</h2>
      <div className="text-sm text-neutral-500">
        Probe sell ${PROBE_SELL_USD.toLocaleString()} of wTRY at the terminal spot of each
        Monte-Carlo path (sampled, n={recoveries.length}). Recovery = USDM out / USD notional in.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 border rounded text-sm">
          <div className="text-neutral-500">Median recovery</div>
          <div className="font-semibold text-lg">
            {p50 !== null ? `${(p50 * 100).toFixed(2)}%` : '—'}
          </div>
        </div>
        <div className="p-3 border rounded text-sm">
          <div className="text-neutral-500">5th-percentile recovery</div>
          <div className="font-semibold text-lg">
            {p5 !== null ? `${(p5 * 100).toFixed(2)}%` : '—'}
          </div>
        </div>
      </div>
      <div className="border rounded p-2">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={histogram}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="bin"
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(v) => `Recovery ${(Number(v) * 100).toFixed(2)}%`}
              formatter={(v) => [`${v} paths`, 'count']}
            />
            <Bar dataKey="count" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
