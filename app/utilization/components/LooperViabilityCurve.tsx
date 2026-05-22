'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { HelpPopover } from '@/app/components/help/HelpPopover';

export function LooperViabilityCurve({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const data = analysis.viabilityCurve.map(p => ({
    u: p.u, borrowAPY: p.borrowAPY * 100, viable7d: p.viable7d ? 1 : 0,
  }));
  const wY7  = analysis.inputs.witryYield7d * 100;
  const wY30 = analysis.inputs.witryYield30d * 100;
  const yMax = Math.max(wY7, wY30, ...data.map(d => d.borrowAPY)) * 1.1;

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-4">
      <h2 className="font-semibold inline-flex items-center gap-1">Looper Viability Curve<HelpPopover chartKey="looperViabilityCurve" /></h2>
      <p className="text-sm text-neutral-400">Borrow APY across u_target with wiTRY 7d / 30d reference yields.</p>
      <div className="h-64 mt-3">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="u" tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
            <YAxis domain={[0, yMax]} tickFormatter={v => `${v.toFixed(1)}%`} />
            <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(2)}%` : v} labelFormatter={l => `u_target ${(Number(l)*100).toFixed(0)}%`} />
            <Legend />
            <ReferenceLine y={wY7}  stroke="#16a34a" strokeDasharray="4 4" label={{ value: 'wiTRY 7d', position: 'right' }} />
            <ReferenceLine y={wY30} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'wiTRY 30d', position: 'right' }} />
            <ReferenceLine x={0.9}  stroke="#ef4444" strokeDasharray="2 2" label={{ value: 'IRM kink', position: 'top' }} />
            <Line type="monotone" dataKey="borrowAPY" stroke="#1d4ed8" strokeWidth={2} dot={false} name="Borrow APY" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
