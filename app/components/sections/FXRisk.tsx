'use client';
import { useSimulator } from '@/lib/useSimulator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { useMemo } from 'react';
import { witryPerITRY } from '@/lib/morphoMath';
import { Kpi, formatPct } from '../Kpi';
import { HelpPopover } from '../help/HelpPopover';

export function FXRisk() {
  const { fx, inputs, running } = useSimulator();

  const pathData = useMemo(() => {
    if (!fx) return [] as Array<{ day: number; p5: number; p50: number; p95: number; p99: number }>;
    return fx.p50.map((v, i) => ({
      day: i,
      p5: fx.p5[i] ?? 0,
      p50: v,
      p95: fx.p95[i] ?? 0,
      p99: fx.p99[i] ?? 0,
    }));
  }, [fx]);

  const netWitryData = useMemo(() => {
    if (!fx) return [] as Array<{ day: number; p1: number; p5: number; p50: number; p95: number }>;
    return fx.p50.map((p50, i) => {
      const w = witryPerITRY(i, inputs.witryYieldAnnual);
      const p5v = fx.p5[i] ?? p50;
      const p95v = fx.p95[i] ?? p50;
      const p99v = fx.p99[i] ?? p50;
      // wiTRY USD value ∝ 1/S, so USD/TRY percentiles invert: the worst FX (P99
      // of USD/TRY) maps to the deepest net-value tail (P1 of net wiTRY USD).
      return {
        day: i,
        p1: w / p99v,
        p5: w / p95v,
        p50: w / p50,
        p95: w / p5v,
      };
    });
  }, [fx, inputs.witryYieldAnnual]);

  const drawdownBins = useMemo(() => {
    if (!fx?.oneDayDD || fx.oneDayDD.length === 0) return [];
    const bins = [
      { range: '0-2%', lo: 0, hi: 0.02, count: 0 },
      { range: '2-5%', lo: 0.02, hi: 0.05, count: 0 },
      { range: '5-10%', lo: 0.05, hi: 0.1, count: 0 },
      { range: '10-15%', lo: 0.1, hi: 0.15, count: 0 },
      { range: '15-20%', lo: 0.15, hi: 0.2, count: 0 },
      { range: '20-30%', lo: 0.2, hi: 0.3, count: 0 },
      { range: '30%+', lo: 0.3, hi: Infinity, count: 0 },
    ];
    for (const dd of fx.oneDayDD) {
      for (const b of bins) {
        if (dd >= b.lo && dd < b.hi) {
          b.count++;
          break;
        }
      }
    }
    return bins.map((b) => ({ range: b.range, count: b.count }));
  }, [fx]);

  return (
    <section id="section-fx-risk" className="space-y-6">
      <div>
        <div className="brix-kicker mb-2">02 · FX Risk</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">FX Risk</h2>
        <p className="text-sm text-neutral-500 mt-1">
          USD/TRY Monte Carlo paths and the net wiTRY USD value (after staking yield offset)
          across the chosen horizon.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Annualized USD/TRY vol"
          value={fx ? formatPct(fx.annualizedVol, 1) : running ? '…' : '—'}
          hint={`${inputs.historicalPeriod}Y window`}
          helpKey="annualizedVol"
        />
        <Kpi
          label="Paths simulated"
          value={fx ? String(fx.paths.length) : '—'}
          hint={`mode: ${inputs.simulationMode}`}
        />
        <Kpi
          label="Horizon"
          value={`${inputs.simulationHorizonDays}d`}
        />
      </div>

      <div>
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-sm font-semibold">USD/TRY paths (P5 / P50 / P95 / P99)</h3>
          <HelpPopover chartKey="fxBands" />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={pathData} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" label={{ value: 'day', position: 'insideBottom', offset: -2 }} />
              <YAxis tickFormatter={(x: number) => x.toFixed(1)} />
              <Tooltip formatter={(v) => Number(v).toFixed(3)} />
              <Legend />
              <Line type="monotone" dataKey="p5" stroke="#10b981" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="p50" stroke="#3b82f6" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="p95" stroke="#ef4444" dot={false} strokeWidth={1.5} />
              <Line
                type="monotone"
                dataKey="p99"
                stroke="#7c3aed"
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {fx?.p50 && (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <h3 className="text-sm font-semibold">
              Net wiTRY USD value path (P1 / P5 / P50 / P95 · wiTRY accrual / USD-per-TRY)
            </h3>
            <HelpPopover chartKey="netWitryUsdPaths" />
          </div>
          <div className="border border-brix-border rounded p-2 bg-brix-card">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={netWitryData} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(x: number) => x.toFixed(4)} />
                <Tooltip formatter={(v) => Number(v).toFixed(5)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="p1"
                  stroke="#7c3aed"
                  dot={false}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <Line type="monotone" dataKey="p5" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="p50" stroke="#3b82f6" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="p95" stroke="#10b981" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-sm font-semibold">1-day max drawdown distribution</h3>
          <HelpPopover chartKey="drawdownDistribution" />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={drawdownBins} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="range" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
