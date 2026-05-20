'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function LoopEconomicsBreakdown({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const econ = analysis.recommendedDetails.economics;
  if (!econ) return <section className="rounded-lg border p-4 text-sm text-gray-500">No loop economics — looper inputs unviable.</section>;

  const data = [
    { name: 'Gross loop APY',  value: econ.grossLoopAPY * 100, color: '#10b981' },
    { name: 'Borrow cost',     value: -econ.borrowCost * 100, color: '#ef4444' },
    { name: 'Slippage',        value: -econ.slippageCost * 100, color: '#f97316' },
    { name: 'HF idle cost',    value: -econ.hfIdleCost * 100, color: '#a855f7' },
    { name: 'Net loop APY',    value: econ.netLoopAPY * 100, color: '#1d4ed8' },
    { name: 'wiTRY (hold)',    value: analysis.inputs.witryYield7d * 100, color: '#6b7280' },
  ];

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Loop Economics Breakdown</h2>
      <p className="text-sm text-gray-600">
        Effective leverage <span className="font-mono">{econ.effectiveLeverage.toFixed(2)}×</span>.
        Loop margin <span className={`font-mono ${econ.loopMargin > 0 ? 'text-green-700' : 'text-red-700'}`}>{pct(econ.loopMargin)}</span>.
      </p>
      <div className="h-64 mt-3">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={v => `${(v as number).toFixed(1)}%`} />
            <Tooltip formatter={(v) => v == null ? '' : `${(v as number).toFixed(2)}%`} />
            <Bar dataKey="value">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
