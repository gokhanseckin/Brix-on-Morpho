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
        <h2 className="text-lg font-semibold text-red-700">Looping is not profitable at any utilization</h2>
        <p className="text-sm">With wiTRY 7d yield {pct(inputs.witryYield7d)} and r_target {pct(inputs.rTarget)},
        no value of u_target produces positive loop margin. Lower r_target or raise wiTRY yield assumptions.</p>
      </section>
    );
  }

  const verdict = recommended.recommended !== null
    ? `Recommended target utilization: ${pct(u)}`
    : `No fully-feasible target; best effort: ${pct(u)} (unmet: ${recommended.unmetConstraints.join(', ')})`;

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold inline-flex items-center gap-1">
        {verdict}
        <HelpPopover kpiKey="recommendedUTarget" />
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Stat label="Borrow APY"        value={econ ? pct(econ.borrowAPY) : '—'}        kpiKey="borrowAPYAtTarget" />
        <Stat label="Supplier APY"      value={econ ? pct(econ.borrowAPY * u) : '—'}    kpiKey="supplierAPYAtTarget" />
        <Stat label="Loop margin (7d)"  value={econ ? pct(econ.loopMargin) : '—'}
               tone={econ && econ.loopMargin > 0 ? 'good' : 'bad'}                       kpiKey="loopMargin7d" />
        <Stat label="Distance to kink"  value={(0.9 - u).toFixed(3)}
               tone={0.9 - u >= 0.07 ? 'good' : 'bad'}                                  kpiKey="distanceToKink" />
        <Stat label="Liquidity buffer"  value={usd(recommendedDetails.bufferUSD)}        kpiKey="liquidityBufferUSD" />
        <Stat label="Stress withdrawal" value={usd(recommendedDetails.stressWithdrawalUSD)} kpiKey="stressWithdrawalUSD" />
        <Stat label="Survives stress?"  value={recommendedDetails.survives ? '✓' : '✗'}
               tone={recommendedDetails.survives ? 'good' : 'bad'}                       kpiKey="survivesStress" />
        <Stat label="Looper net APY"    value={econ ? pct(econ.netLoopAPY) : '—'}        kpiKey="looperNetAPY" />
      </div>
    </section>
  );
}

function Stat({ label, value, tone, kpiKey }: { label: string; value: string; tone?: 'good' | 'bad'; kpiKey?: KpiKey }) {
  const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : 'text-gray-900';
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-gray-500 flex items-center">
        {label}
        {kpiKey && <HelpPopover kpiKey={kpiKey} />}
      </div>
      <div className={`font-mono text-base ${color}`}>{value}</div>
    </div>
  );
}
