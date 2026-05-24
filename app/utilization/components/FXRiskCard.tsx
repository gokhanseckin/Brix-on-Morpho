'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { HelpPopover } from '@/app/components/help/HelpPopover';
import type { KpiKey } from '@/lib/help/kpiKeys';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function FXRiskCard({
  analysis, fxAnnualVol, fxStressZ,
}: {
  analysis: UtilizationAnalysisOutput;
  fxAnnualVol: number;
  fxStressZ: number;
}) {
  const econ = analysis.recommendedDetails.economics;
  if (!econ) {
    return (
      <section className="rounded-lg border border-brix-border bg-brix-card p-4 text-sm text-neutral-500">
        FX risk overlay unavailable — no viable loop economics.
      </section>
    );
  }
  const dd = econ.fxStressDrawdown_30d;
  const leveredDd = econ.effectiveLeverage * dd;
  const headroom = Math.max(0, 1 - analysis.inputs.lltv / analysis.inputs.hfBuffer);
  const safe = econ.loopSurvivesStress;
  const margin = headroom - leveredDd;

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-4 shadow-sm">
      <h2 className="font-semibold inline-flex items-center gap-1">
        FX risk (vol overlay)
        <HelpPopover chartKey="fxRiskCard" />
      </h2>
      <p className="text-sm text-neutral-400">
        Carry math (above) assumes loopers earn the yield differential. FX vol enters
        here as a separate stress on leverage — does the levered position survive a
        {' '}{fxStressZ.toFixed(2)}σ 30-day USD/TRY move?
      </p>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Stat label="σ annual (data)"        value={pct(fxAnnualVol)}          kpiKey="fxAnnualVol" />
        <Stat label="Stress z"               value={`${fxStressZ.toFixed(2)}σ`} kpiKey="fxStressZInput" />
        <Stat label="30-day stress drawdown" value={pct(dd)}                    kpiKey="fxStressDrawdown30d" />
        <Stat label="HF headroom"            value={pct(headroom)} />
        <Stat label="Levered drawdown"       value={pct(leveredDd)}             tone={safe ? 'good' : 'bad'} />
        <Stat label="Safety margin"          value={pct(margin)}                tone={margin > 0 ? 'good' : 'bad'} />
        <Stat label="Effective leverage"     value={`${econ.effectiveLeverage.toFixed(2)}×`} kpiKey="effectiveLeverage" />
        <Stat label="FX safe?"               value={safe ? '✓' : '✗'}
              tone={safe ? 'good' : 'bad'} kpiKey="loopSurvivesStress" />
      </div>
      {!safe && (
        <p className="mt-3 text-xs text-red-300">
          Levered drawdown ({pct(leveredDd)}) exceeds HF headroom ({pct(headroom)}).
          Raise HF buffer or lower LLTV to make the loop FX-safe at this z.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, tone, kpiKey }: {
  label: string; value: string; tone?: 'good' | 'bad'; kpiKey?: KpiKey;
}) {
  const color = tone === 'good' ? 'text-emerald-300'
              : tone === 'bad'  ? 'text-red-300'
              : 'text-neutral-100';
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
