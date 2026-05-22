// app/explore-market/components/IrmCurveCard.tsx
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import type { IrmCurvePoint } from '@/types/morphoMarket';
import { formatPct } from '@/app/components/Kpi';

export function IrmCurveCard({
  irmAddress,
  curve,
  currentUtilization,
  rateAtTarget,
  apyAtTarget,
}: {
  irmAddress: string;
  curve: IrmCurvePoint[];
  currentUtilization: number;
  rateAtTarget: number;
  apyAtTarget: number;
}) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Interest rate model</h2>
      <div className="h-72 w-full">
        {curve.length === 0 ? (
          <p className="text-sm text-neutral-500">IRM curve unavailable.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
              <XAxis
                dataKey="utilization"
                type="number"
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke="#666"
                fontSize={11}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke="#666"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 12 }}
                formatter={(v) => formatPct(v as number)}
                labelFormatter={(v) => `Utilization ${((v as number) * 100).toFixed(1)}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                x={currentUtilization}
                stroke="#facc15"
                strokeDasharray="4 4"
                label={{ value: 'current', fill: '#facc15', fontSize: 11, position: 'top' }}
              />
              <Line dataKey="borrowApy" name="Borrow APY" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line dataKey="supplyApy" name="Supply APY" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">APY at target</dt>
          <dd className="text-neutral-200 tabular-nums">{formatPct(apyAtTarget)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Rate at target (raw)</dt>
          <dd className="font-mono text-xs text-neutral-200">{rateAtTarget}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">IRM contract</dt>
          <dd className="font-mono text-xs text-neutral-200">{irmAddress.slice(0, 6)}…{irmAddress.slice(-4)}</dd>
        </div>
      </dl>
    </section>
  );
}
