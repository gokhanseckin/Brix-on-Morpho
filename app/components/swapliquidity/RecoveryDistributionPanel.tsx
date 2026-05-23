'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { useSimulator } from '@/lib/useSimulator';
import { buildAsymmetricLadder, ladderRangesFromInputs } from '@/lib/poolPreset';
import { quoteLiquidatorSell } from '@/lib/univ3/quoteLiquidatorSell';
import { badDebtFromAMMSale } from '@/lib/badDebtMath';
import { LIF } from '@/lib/morphoMath';
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Kpi } from '@/app/components/Kpi';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const MAX_PATHS = 200;
const HIST_BINS = 20;
// Sweep probe sizes as fractions of pool TVL — shows how bad-debt degrades
// as a single-trade liquidation grows. Picks span small → catastrophic.
const SWEEP_FRACTIONS = [0.05, 0.1, 0.25, 0.5, 1.0, 2.0] as const;
const fmtUSD = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${Math.round(n)}`;

interface PathResult {
  badDebtPct: number;
  recoveryPct: number;
}

export function RecoveryDistributionPanel() {
  const [state] = useUrlState();
  const { fx } = useSimulator();
  const lltv = state.lltv;
  const lif = LIF(lltv);
  const probeCollateral_USD = state.swapSellUSD;
  const debtUSD = probeCollateral_USD / lif;
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
    const ranges = ladderRangesFromInputs(state);
    const fee = state.poolFeeTier === 10000 ? 10000 : 3000;
    const out: PathResult[] = [];
    for (const spot of terminalSpots) {
      try {
        const preset = buildAsymmetricLadder(spot, state.poolTVL_USD, split, fee, ranges);
        const wTRYwei = BigInt(Math.floor((probeCollateral_USD / spot) * 1e6));
        const q = quoteLiquidatorSell(preset, spot, wTRYwei);
        const ammSale = Number(q.amountOut) / 1e6;
        const bd = badDebtFromAMMSale({
          collateral_USD: probeCollateral_USD,
          lltv,
          ammSale_USDM: ammSale,
        });
        out.push({ badDebtPct: bd.badDebtPct, recoveryPct: bd.recoveryPct });
      } catch {
        // skip pathological spots (e.g. tick overflow at extreme FX)
      }
    }
    return out;
  }, [
    terminalSpots,
    state.poolTVL_USD,
    state.bandSplitCore,
    state.bandSplitAbsorb,
    state.poolFeeTier,
    state.bandCoreLowerPct,
    state.bandCoreUpperPct,
    state.bandAbsorbLowerPct,
    state.bandAbsorbUpperPct,
    state.bandTailLowerPct,
    state.bandTailUpperPct,
    lltv,
    probeCollateral_USD,
  ]);

  // Sweep across multiple probe sizes (% of pool TVL) to show how bad debt
  // degrades as a single-trade liquidation grows. Reuses the same terminal
  // spots so the comparison is apples-to-apples with the single-size panel.
  const sweep = useMemo<Array<{ probe_USD: number; probePct: number; p95: number; median: number }>>(() => {
    if (terminalSpots.length === 0 || state.poolTVL_USD <= 0) return [];
    const split = {
      core: state.bandSplitCore,
      absorb: state.bandSplitAbsorb,
      tail: Math.max(0, 1 - state.bandSplitCore - state.bandSplitAbsorb),
    };
    const ranges = ladderRangesFromInputs(state);
    const fee = state.poolFeeTier === 10000 ? 10000 : 3000;
    const points: Array<{ probe_USD: number; probePct: number; p95: number; median: number }> = [];
    for (const frac of SWEEP_FRACTIONS) {
      const probeUSD = state.poolTVL_USD * frac;
      const bds: number[] = [];
      for (const spot of terminalSpots) {
        try {
          const preset = buildAsymmetricLadder(spot, state.poolTVL_USD, split, fee, ranges);
          const wTRYwei = BigInt(Math.floor((probeUSD / spot) * 1e6));
          const q = quoteLiquidatorSell(preset, spot, wTRYwei);
          const ammSale = Number(q.amountOut) / 1e6;
          const bd = badDebtFromAMMSale({ collateral_USD: probeUSD, lltv, ammSale_USDM: ammSale });
          bds.push(bd.badDebtPct);
        } catch {
          // ignore
        }
      }
      if (bds.length === 0) continue;
      const sorted = [...bds].sort((a, b) => a - b);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
      const median = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
      points.push({ probe_USD: probeUSD, probePct: frac, p95, median });
    }
    return points;
  }, [
    terminalSpots,
    state.poolTVL_USD,
    state.bandSplitCore,
    state.bandSplitAbsorb,
    state.poolFeeTier,
    state.bandCoreLowerPct,
    state.bandCoreUpperPct,
    state.bandAbsorbLowerPct,
    state.bandAbsorbUpperPct,
    state.bandTailLowerPct,
    state.bandTailUpperPct,
    lltv,
  ]);

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
        Sampled n={results.length} of {state.pathCount} Monte-Carlo paths from main-page sim
        (mode <span className="text-neutral-300">{state.simulationMode}</span>, horizon{' '}
        <span className="text-neutral-300">{state.simulationHorizonDays}d</span>). For each path:
        liquidate <span className="text-neutral-300">{fmtUSD(probeCollateral_USD)}</span> of wTRY at
        the path&apos;s terminal spot (sell size from Section 2 slider). At LLTV {fmtPct(lltv, 1)}{' '}
        the debt is ${debtUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}; LIF buffer
        is {fmtPct(bufferPct, 2)}. Bad debt = max(0, debt − AMM proceeds).
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
            <Bar dataKey="count">
              {histogram.map((h, i) => (
                <Cell key={i} fill={h.bin < 0.001 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="border rounded p-2">
        <div className="flex items-center text-xs text-neutral-500 px-2 pt-1 gap-2">
          <span>Bad-debt vs probe size (sweep across % of pool TVL)</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={sweep} margin={{ top: 12, right: 40, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="probePct"
              type="number"
              scale="log"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            />
            <YAxis tickFormatter={(v: number) => fmtPct(v, 1)} />
            <Tooltip
              labelFormatter={(v) =>
                `Probe ${((Number(v) || 0) * 100).toFixed(0)}% of TVL (${fmtUSD(
                  (Number(v) || 0) * state.poolTVL_USD,
                )})`
              }
              formatter={(v, name) => [fmtPct(Number(v), 2), name]}
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, fontSize: 12 }}
              labelStyle={{ color: '#a3a3a3' }}
              itemStyle={{ color: '#e5e5e5' }}
            />
            <ReferenceLine
              y={1 - 1 / lif}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: `${fmtPct(1 - 1 / lif, 2)} LIF cliff`, position: 'right', fill: '#f59e0b', fontSize: 10 }}
            />
            <Line type="monotone" dataKey="p95" name="P95 bad-debt" stroke="#ef4444" strokeWidth={2} dot />
            <Line type="monotone" dataKey="median" name="Median bad-debt" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="4 3" dot />
          </LineChart>
        </ResponsiveContainer>
        <div className="text-xs text-neutral-500 mt-1 px-2">
          Each point sweeps the probe-collateral size across the SAME terminal spots used above. As
          the probe grows the AMM slip eats into the LIF buffer (orange line); when the curve
          crosses, liquidators skip and lenders take the residual debt.
        </div>
      </div>
    </section>
  );
}
