'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUtilizationAnalysis } from '@/lib/useUtilizationAnalysis';
import { RecommendationCard } from './components/RecommendationCard';
import { LooperViabilityCurve } from './components/LooperViabilityCurve';
import { LiquidityStressSection } from './components/LiquidityStressSection';
import { LoopEconomicsBreakdown } from './components/LoopEconomicsBreakdown';
import { IRMHeatmap } from './components/IRMHeatmap';
import { RecommendationTable } from './components/RecommendationTable';
import { HelpPopover } from '@/app/components/help/HelpPopover';
import type { KpiKey } from '@/lib/help/kpiKeys';

export default function UtilizationPage() {
  const [tvlUSDM, setTvlUSDM] = useState(10_000_000);
  const [stressPct, setStressPct] = useState(0.20);
  const [hfBuffer, setHfBuffer] = useState(1.5);
  const [rTarget, setRTarget] = useState(0.04);

  const analysis = useUtilizationAnalysis({
    tvlUSDM_USD: tvlUSDM,
    stressPctOfSupply: stressPct,
    hfBuffer,
    rTargetOverride: rTarget,
  });

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6 [&_section.bg-white]:text-gray-900">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Target Utilization Calibration</h1>
        <Link href="/" className="text-sm text-blue-600 underline">← back to sim</Link>
      </header>

      <section className="space-y-4 rounded-lg border p-4">
        <NumberInput
          label="Vault TVL — total USDM supply"
          helpKey="tvlUSDMInput"
          value={tvlUSDM}
          onChange={setTvlUSDM}
          min={100_000}
          max={500_000_000}
          step={100_000}
          format={v => `$${(v / 1_000_000).toFixed(1)}M`}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Slider
          label="r_target override"
          helpKey="rTargetOverrideInput"
          value={rTarget}
          min={0.01}
          max={0.10}
          step={0.005}
          format={v => `${(v * 100).toFixed(2)}%`}
          onChange={setRTarget}
        />
        </div>
      </section>

      <RecommendationCard analysis={analysis} />
      <LooperViabilityCurve analysis={analysis} />
      <LiquidityStressSection analysis={analysis} />
      <LoopEconomicsBreakdown analysis={analysis} />
      <IRMHeatmap analysis={analysis} />
      <RecommendationTable analysis={analysis} />
    </div>
  );
}

function NumberInput(props: {
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
    <div className="flex flex-col gap-1 text-sm">
      <span className="flex items-center gap-1">
        <span className="font-medium">{props.label}</span>
        {props.helpKey && <HelpPopover kpiKey={props.helpKey} />}
        <span className="ml-auto font-mono text-blue-600">{props.format(props.value)}</span>
      </span>
      <p className="text-xs text-neutral-500">
        How much USDM is deposited in the vault in total. The liquidity buffer and stress-test amounts below are calculated from this number.
      </p>
      <input
        type="number"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={e => {
          const parsed = parseFloat(e.target.value);
          if (Number.isFinite(parsed) && parsed >= props.min) props.onChange(parsed);
        }}
        className="rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm w-full max-w-xs"
      />
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
