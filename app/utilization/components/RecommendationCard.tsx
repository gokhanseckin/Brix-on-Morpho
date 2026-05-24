'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { HelpPopover } from '@/app/components/help/HelpPopover';
import type { KpiKey } from '@/lib/help/kpiKeys';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

export function RecommendationCard({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const { recommended, recommendedDetails, inputs, loopImpossible } = analysis;
  const u = recommended.recommended ?? recommended.bestEffort;
  const econ = recommendedDetails.economics;

  if (loopImpossible) {
    return (
      <section className="rounded-lg border border-red-500 bg-red-50 p-4">
        <h2 className="text-lg font-semibold text-red-300">Looping is not profitable at any utilization</h2>
        <p className="text-sm">With wiTRY 7d yield {pct(inputs.witryYield7d)} and Rate at Target {pct(inputs.rTarget)},
        no value of u_target produces positive loop margin. Lower Rate at Target or raise wiTRY yield assumptions.</p>
      </section>
    );
  }

  const verdict = recommended.recommended !== null
    ? `Recommended target utilization: ${pct(u)}`
    : `No fully-feasible target; best effort: ${pct(u)} (unmet: ${recommended.unmetConstraints.join(', ')})`;

  const carryGood = !!(econ && econ.loopMargin > 0);
  const fxGood = !!(econ && econ.loopSurvivesStress);
  const kinkClearance = inputs.kinkClearance;

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold inline-flex items-center gap-1">
        {verdict}
        <HelpPopover kpiKey="recommendedUTarget" />
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge ok={carryGood} label="Carry" detail={econ ? `+${pct(econ.loopMargin)}` : '—'} />
        <Badge ok={fxGood}    label="FX"    detail={econ ? `lev ${econ.effectiveLeverage.toFixed(2)}×` : '—'} />
        <Badge ok={recommendedDetails.survives} label="Stress" detail={recommendedDetails.survives ? 'covered' : 'breach'} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Stat label="Borrow APY"        value={econ ? pct(econ.borrowAPY) : '—'}        kpiKey="borrowAPYAtTarget" />
        <Stat label="Supplier APY"      value={econ ? pct(econ.borrowAPY * u) : '—'}    kpiKey="supplierAPYAtTarget" />
        <Stat label="Loop margin (7d)"  value={econ ? pct(econ.loopMargin) : '—'}
               tone={carryGood ? 'good' : 'bad'}                                         kpiKey="loopMargin7d" />
        <Stat label="Distance to kink"  value={(0.9 - u).toFixed(3)}
               tone={0.9 - u >= kinkClearance ? 'good' : 'bad'}                          kpiKey="distanceToKink" />
        <Stat label="Liquidity buffer"  value={usd(recommendedDetails.bufferUSD)}        kpiKey="liquidityBufferUSD" />
        <Stat label="Stress withdrawal" value={usd(recommendedDetails.stressWithdrawalUSD)} kpiKey="stressWithdrawalUSD" />
        <Stat label="Survives stress?"  value={recommendedDetails.survives ? '✓' : '✗'}
               tone={recommendedDetails.survives ? 'good' : 'bad'}                       kpiKey="survivesStress" />
        <Stat label="Looper net APY"    value={econ ? pct(econ.netLoopAPY) : '—'}        kpiKey="looperNetAPY" />
      </div>
    </section>
  );
}

function Badge({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const cls = ok
    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
    : 'border-red-500 bg-red-950/40 text-red-300';
  return (
    <span className={`text-xs font-medium border rounded px-2 py-1 ${cls}`}>
      {label}: {ok ? '✓' : '✗'} <span className="font-mono ml-1">{detail}</span>
    </span>
  );
}

function Stat({ label, value, tone, kpiKey }: { label: string; value: string; tone?: 'good' | 'bad'; kpiKey?: KpiKey }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-neutral-100';
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-neutral-500 flex items-center">
        {label}
        {kpiKey && <HelpPopover kpiKey={kpiKey} />}
      </div>
      <div className={`font-mono text-base ${color}`}>{value}</div>
    </div>
  );
}
