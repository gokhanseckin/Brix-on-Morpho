// app/explore-market/components/HistoryChartCard.tsx
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { HistoryPoint } from '@/types/morphoMarket';
import { formatPct } from '@/app/components/Kpi';

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(5, 10); // MM-DD
}

export function HistoryChartCard({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data: HistoryPoint[] | null;
}) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">30-day history</h2>
      <div className="h-72 w-full">
        {loading && <p className="text-sm text-neutral-400">Loading history…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && data && data.length === 0 && (
          <p className="text-sm text-neutral-500">Not enough history yet.</p>
        )}
        {!loading && !error && data && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={fmtDate} stroke="#666" fontSize={11} />
              <YAxis
                yAxisId="apy"
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                stroke="#666"
                fontSize={11}
              />
              <YAxis
                yAxisId="util"
                orientation="right"
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke="#666"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 12 }}
                formatter={(v) => formatPct(v as number)}
                labelFormatter={(v) => new Date((v as number) * 1000).toISOString().slice(0, 10)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="apy" dataKey="supplyApy" name="Supply APY" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line yAxisId="apy" dataKey="borrowApy" name="Borrow APY" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line yAxisId="util" dataKey="utilization" name="Utilization" stroke="#facc15" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
