'use client';
import { useMemo, useState } from 'react';
import { TopNav } from '@/app/components/TopNav';
import { CrossPageLink } from '@/app/components/CrossPageLink';
import { useUtilizationAnalysis } from '@/lib/useUtilizationAnalysis';
import { useUrlState } from '@/lib/useUrlState';
import { historicalAnnualizedVol, loadFxRows } from '@/lib/fxData';
import { RecommendationCard } from './components/RecommendationCard';
import { LooperViabilityCurve } from './components/LooperViabilityCurve';
import { LiquidityStressSection } from './components/LiquidityStressSection';
import { LoopEconomicsBreakdown } from './components/LoopEconomicsBreakdown';
import { FXRiskCard } from './components/FXRiskCard';
import { IRMHeatmap } from './components/IRMHeatmap';
import { RecommendationTable } from './components/RecommendationTable';
import { HelpPopover } from '@/app/components/help/HelpPopover';
import type { KpiKey } from '@/lib/help/kpiKeys';

export default function UtilizationPage() {
  const [urlState, setUrlState] = useUrlState();
  // Page-local sliders — calibration knobs that exist only on this page.
  // Market params (TVL, LLTV, wiTRY yields) are pulled from useUrlState
  // and rendered read-only below; edit them on the Market Simulator (home).
  // rTargetIRM lives in URL state (default 0.04) because it feeds home's
  // Strategy borrowAPY + IRM curve too — see useSimulator.ts.
  const [stressPct, setStressPct] = useState(0.20);
  const [hfBuffer, setHfBuffer] = useState(1.5);
  const rTarget = urlState.rTargetIRM;
  const setRTarget = (v: number) => setUrlState({ rTargetIRM: v });
  const kinkClearance = urlState.kinkClearance;
  const setKinkClearance = (v: number) => setUrlState({ kinkClearance: v });
  const fxStressZ = urlState.fxStressZ;
  const setFxStressZ = (v: number) => setUrlState({ fxStressZ: v });
  // Max u_target the recommender can ever return given this clearance,
  // snapped to the 0.01 search grid used by sweepUtilizationTargets.
  // Add a tiny epsilon to absorb floating-point error before flooring.
  const maxUTarget = Math.floor((0.9 - kinkClearance + 1e-9) * 100) / 100;
  // Annualized σ of USD/TRY log-returns, computed once from embedded data.
  // Read-only "measurement, not policy" — surfaced as a chip.
  const fxAnnualVol = useMemo(() => historicalAnnualizedVol(loadFxRows()), []);

  const analysis = useUtilizationAnalysis({
    tvlUSDM_USD: urlState.witryTVL_USD,
    stressPctOfSupply: stressPct,
    hfBuffer,
    rTargetOverride: rTarget,
    fxAnnualVol,
  });

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8 bg-brix-bg min-h-screen text-neutral-200">
      <TopNav />
      <header className="border-b border-brix-border pb-6">
        <div className="brix-kicker mb-3">Brix · Calibration tool</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Target utilization <span className="text-brix-accent">calibration</span>
        </h1>
      </header>

      <section className="space-y-4 rounded-lg border border-brix-border bg-brix-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Market &amp; Simulation context
          </h2>
          <p className="text-[11px] text-neutral-500">
            Read-only. Edit on the{' '}
            <CrossPageLink href="/" className="text-brix-accent underline">
              Market Simulator
            </CrossPageLink>.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ReadOnlyTile label="Vault TVL (USDM)" value={`$${urlState.witryTVL_USD.toLocaleString()}`} />
          <ReadOnlyTile label="LLTV" value={`${(urlState.lltv * 100).toFixed(1)}%`} />
          <ReadOnlyTile label="wiTRY 7d yield" value={`${(urlState.witryYieldUSD_7d * 100).toFixed(2)}%`} />
          <ReadOnlyTile label="wiTRY 30d yield" value={`${(urlState.witryYieldUSD_30d * 100).toFixed(2)}%`} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-brix-border bg-brix-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Calibration knobs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Slider
            label="Stress withdrawal"
            helpKey="stressPctOfSupplyInput"
            value={stressPct}
            min={0.05}
            max={0.5}
            step={0.01}
            format={v => `${(v * 100).toFixed(0)}%`}
            onChange={setStressPct}
          />
          <div>
            <Slider
              label="Looper HF buffer"
              helpKey="hfBufferInput"
              value={hfBuffer}
              min={1.1}
              max={2.5}
              step={0.05}
              format={v => v.toFixed(2) + '×'}
              onChange={setHfBuffer}
            />
            <div className="text-xs text-brix-muted mt-1">
              Borrows {(100 / hfBuffer).toFixed(1)}% of LLTV cap
            </div>
          </div>
          <Slider
            label="Rate at Target override"
            helpKey="rTargetOverrideInput"
            value={rTarget}
            min={0.01}
            max={0.10}
            step={0.0005}
            format={v => `${(v * 100).toFixed(2)}%`}
            onChange={setRTarget}
          />
          <div>
            <Slider
              label="Kink clearance"
              value={kinkClearance}
              min={0}
              max={0.15}
              step={0.0005}
              format={v => `${(v * 100).toFixed(2)}pp`}
              onChange={setKinkClearance}
            />
            <div className="text-xs text-brix-muted mt-1">
              Max u_target ={' '}
              <span className="font-mono text-brix-accent">
                {(maxUTarget * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-brix-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <Slider
              label="FX stress z-score"
              helpKey="fxStressZInput"
              value={fxStressZ}
              min={1.0}
              max={3.0}
              step={0.05}
              format={v => `${v.toFixed(2)}σ`}
              onChange={setFxStressZ}
            />
            <div className="text-xs text-brix-muted mt-1">
              1.65σ ≈ 95th-pct 30-day move; 2.33σ ≈ 99th-pct
            </div>
          </div>
          <div className="rounded-md border border-brix-border bg-brix-surface p-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 flex items-center">
              USD/TRY annual vol (data)
              <HelpPopover kpiKey="fxAnnualVol" />
            </div>
            <div className="mt-1 font-mono text-sm text-neutral-200">
              σ = {(fxAnnualVol * 100).toFixed(2)}%
            </div>
            <div className="text-[11px] text-brix-muted mt-1">
              Measured from embedded TRY=X history. Not editable.
            </div>
          </div>
        </div>
      </section>

      <RecommendationCard analysis={analysis} />
      <LooperViabilityCurve analysis={analysis} />
      <LiquidityStressSection analysis={analysis} />
      <LoopEconomicsBreakdown analysis={analysis} />
      <FXRiskCard analysis={analysis} fxAnnualVol={fxAnnualVol} fxStressZ={fxStressZ} />
      <IRMHeatmap analysis={analysis} />
      <RecommendationTable analysis={analysis} />
    </div>
  );
}

function ReadOnlyTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-brix-border bg-brix-surface p-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-neutral-200">{value}</div>
    </div>
  );
}

function Slider(props: {
  label: string;
  helpKey?: KpiKey;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between items-center">
        <span className="flex items-center">
          {props.label}
          {props.helpKey && <HelpPopover kpiKey={props.helpKey} />}
        </span>
        <span className="font-mono">{props.format(props.value)}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={e => props.onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}
