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
import { InfoTooltip } from '@/app/components/help/InfoTooltip';

export default function UtilizationPage() {
  const [stressPct, setStressPct] = useState(0.20);
  const [hfBuffer, setHfBuffer] = useState(1.5);
  const [rTarget, setRTarget] = useState(0.04);

  const analysis = useUtilizationAnalysis({
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

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4">
        <Slider
          label="Stress withdrawal"
          tooltip="Share of vault supply you stress-test as withdrawn in one day. Affects: liquidityBufferUSD requirement, survivesStress flag, recommendedUTarget."
          value={stressPct}
          min={0.05}
          max={0.5}
          step={0.01}
          format={v => `${(v * 100).toFixed(0)}%`}
          onChange={setStressPct}
        />
        <Slider
          label="Looper HF buffer"
          tooltip="How conservative loopers are — debt ≤ max/HF_buffer. Lower = more leverage/loop demand but riskier. Affects: effectiveLeverage, looperNetAPY, loopMargin7d, recommendedUTarget."
          value={hfBuffer}
          min={1.1}
          max={2.5}
          step={0.05}
          format={v => v.toFixed(2) + '×'}
          onChange={setHfBuffer}
        />
        <Slider
          label="r_target override"
          tooltip="Per-page override of the AdaptiveCurveIRM r_target (interest pinned at u=0.9). Affects: borrowAPYAtTarget, looperNetAPY, irmHeatmap, recommendedUTarget."
          value={rTarget}
          min={0.01}
          max={0.10}
          step={0.005}
          format={v => `${(v * 100).toFixed(2)}%`}
          onChange={setRTarget}
        />
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

function Slider(props: {
  label: string;
  tooltip?: string;
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
          {props.tooltip && <InfoTooltip text={props.tooltip} />}
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
