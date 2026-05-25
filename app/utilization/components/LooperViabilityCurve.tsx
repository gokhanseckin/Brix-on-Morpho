'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { HelpPopover } from '@/app/components/help/HelpPopover';

export function LooperViabilityCurve({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  // Vol band around borrow APY at ±σ×√t (30d horizon). Visualises FX noise
  // around the deterministic carry crossing without changing the math.
  const sigma30d = analysis.inputs.fxAnnualVol * Math.sqrt(30 / 365);
  const data = analysis.viabilityCurve.map(p => ({
    u: p.u,
    borrowAPY: p.borrowAPY * 100,
    bandLow:  Math.max(0, p.borrowAPY - sigma30d) * 100,
    bandHigh: (p.borrowAPY + sigma30d) * 100,
  }));
  const wY7  = analysis.inputs.witryYield7d * 100;
  const wY30 = analysis.inputs.witryYield30d * 100;
  const yMax = Math.max(wY7, wY30, ...data.map(d => d.bandHigh)) * 1.1;

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-4">
      <h2 className="font-semibold inline-flex items-center gap-1">Looper Viability Curve<HelpPopover chartKey="looperViabilityCurve" /></h2>
      <p className="text-sm text-neutral-400">
        Where does looping stop paying? Blue = USDM borrow APY at each utilization
        target. Green / orange = wiTRY supply yield (7d and 30d windows). The loop
        is profitable in TRY terms wherever blue stays below the dashed lines;
        the crossing is the carry break-even — the highest u_target a looper can
        tolerate before borrow cost eats the supply yield. Red vertical = IRM kink
        (90%) where borrow APY accelerates. Dashed blue band = ±1σ monthly FX-vol
        envelope on borrow. FX depreciation not included — see FX Risk below.
      </p>
      <div className="h-64 mt-3">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="u"
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              label={{ value: 'Utilization target (u)', position: 'insideBottom', offset: -12, fill: '#a3a3a3' }}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={v => `${v.toFixed(1)}%`}
              label={{ value: 'APY', angle: -90, position: 'insideLeft', fill: '#a3a3a3' }}
            />
            <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(2)}%` : v} labelFormatter={l => `u_target ${(Number(l)*100).toFixed(0)}%`} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 4 }} />
            <ReferenceLine y={wY7}  stroke="#16a34a" strokeDasharray="4 4" label={{ value: 'wiTRY 7d', position: 'right' }} />
            <ReferenceLine y={wY30} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'wiTRY 30d', position: 'right' }} />
            <ReferenceLine x={0.9}  stroke="#ef4444" strokeDasharray="2 2" label={{ value: 'IRM kink', position: 'top' }} />
            <Line type="monotone" dataKey="bandHigh"  stroke="#1d4ed8" strokeWidth={1} strokeDasharray="2 4" strokeOpacity={0.4} dot={false} name="+σ" />
            <Line type="monotone" dataKey="bandLow"   stroke="#1d4ed8" strokeWidth={1} strokeDasharray="2 4" strokeOpacity={0.4} dot={false} name="−σ" />
            <Line type="monotone" dataKey="borrowAPY" stroke="#1d4ed8" strokeWidth={2} dot={false} name="Borrow APY" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
