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
import { pctUnderwaterAtT, sampleBetaLtvFractions } from '@/lib/simulator';
import { Kpi, formatPct } from '../Kpi';

export function FXRisk() {
  const { fx, inputs, running } = useSimulator();

  const pathData = useMemo(() => {
    if (!fx) return [] as Array<{ day: number; p5: number; p50: number; p95: number }>;
    return fx.p50.map((v, i) => ({
      day: i,
      p5: fx.p5[i] ?? 0,
      p50: v,
      p95: fx.p95[i] ?? 0,
    }));
  }, [fx]);

  const netWitryData = useMemo(() => {
    if (!fx) return [] as Array<{ day: number; p5: number; p50: number; p95: number }>;
    return fx.p50.map((p50, i) => {
      const w = witryPerITRY(i, inputs.iTRYYieldAnnual);
      const p5v = fx.p5[i] ?? p50;
      const p95v = fx.p95[i] ?? p50;
      return {
        day: i,
        // p5 of NET wiTRY USD: when USD/TRY is high (TRY weak), wiTRY USD is low
        p5: w / p95v,
        p50: w / p50,
        p95: w / p5v,
      };
    });
  }, [fx, inputs.iTRYYieldAnnual]);

  const drawdownBins = useMemo(() => {
    if (!fx?.threeDayDD || fx.threeDayDD.length === 0) return [];
    const bins = [
      { range: '0-2%', lo: 0, hi: 0.02, count: 0 },
      { range: '2-5%', lo: 0.02, hi: 0.05, count: 0 },
      { range: '5-10%', lo: 0.05, hi: 0.1, count: 0 },
      { range: '10-15%', lo: 0.1, hi: 0.15, count: 0 },
      { range: '15-20%', lo: 0.15, hi: 0.2, count: 0 },
      { range: '20-30%', lo: 0.2, hi: 0.3, count: 0 },
      { range: '30%+', lo: 0.3, hi: Infinity, count: 0 },
    ];
    for (const dd of fx.threeDayDD) {
      for (const b of bins) {
        if (dd >= b.lo && dd < b.hi) {
          b.count++;
          break;
        }
      }
    }
    return bins.map((b) => ({ range: b.range, count: b.count }));
  }, [fx]);

  const underwaterByDay = useMemo(() => {
    if (!fx?.p50) return [] as Array<{ day: number; pct: number }>;
    const ltvFractions = sampleBetaLtvFractions({
      alpha: inputs.borrowerLTVAlpha,
      beta: inputs.borrowerLTVBeta,
      n: 500,
      seed: inputs.seed,
    });
    const S0 = fx.p50[0] ?? 1;
    return fx.p50.map((s, t) => {
      // collateralRelChange = wiTRY in USD now / wiTRY in USD at t=0
      // = (witryPerITRY(t) / s) / (1 / S0) = witryPerITRY(t) * S0 / s
      const collRel = (witryPerITRY(t, inputs.iTRYYieldAnnual) * S0) / s;
      return {
        day: t,
        pct: pctUnderwaterAtT({
          ltvFractions,
          lltv: inputs.lltv,
          collateralRelChange: collRel,
        }),
      };
    });
  }, [fx, inputs.borrowerLTVAlpha, inputs.borrowerLTVBeta, inputs.iTRYYieldAnnual, inputs.lltv, inputs.seed]);

  return (
    <section id="section-fx-risk" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">2. FX Risk</h2>
        <p className="text-sm text-neutral-500 mt-1">
          USD/TRY Monte Carlo paths, the net wiTRY USD value (after staking yield offset), and the
          fraction of positions that go underwater across the chosen horizon.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Annualized USD/TRY vol"
          value={fx ? formatPct(fx.annualizedVol, 1) : running ? '…' : '—'}
          hint={`${inputs.historicalPeriod}Y window`}
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

      <div className="grid grid-cols-1 gap-4 p-4 border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 rounded">
        <div className="text-sm">
          <strong>Liquidator wiTRY delivery vs. 3-day cooldown:</strong> Liquidators receive
          seized wiTRY directly at the moment of liquidation. The 3-day cooldown only applies if
          they choose to redeem through Brix. They can also dump on the wiTRY/USDM secondary
          market (see Section 4). The 3-day window therefore measures{' '}
          <em>secondary-market exit risk</em>, not protocol-imposed delay.
        </div>
        <div className="text-sm">
          <strong>Oracle staleness gap:</strong> wiTRY NAV updates are currently manual (not yet
          on Redstone). The on-chain price can lag the true off-chain NAV by hours-to-a-day. The
          simulator&apos;s stress scenarios assume oracle prices update instantly; real
          liquidations will face an additional staleness gap documented in Section 4.
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">USD/TRY paths (P5 / P50 / P95)</h3>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {fx?.p50 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Net wiTRY USD value path (wiTRY accrual / USD-per-TRY)
          </h3>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={netWitryData} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(x: number) => x.toFixed(4)} />
                <Tooltip formatter={(v) => Number(v).toFixed(5)} />
                <Legend />
                <Line type="monotone" dataKey="p5" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="p50" stroke="#3b82f6" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="p95" stroke="#10b981" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">3-day max drawdown distribution</h3>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
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

        <div>
          <h3 className="text-sm font-semibold mb-2">% positions underwater by day (P50 path)</h3>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={underwaterByDay} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(x: number) => `${(x * 100).toFixed(0)}%`} domain={[0, 1]} />
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                <Line type="monotone" dataKey="pct" stroke="#ef4444" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
