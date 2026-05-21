'use client';
import { useUrlState } from '@/lib/useUrlState';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';
import { useState } from 'react';
import { InfoTooltip } from './help/InfoTooltip';
import { PARAM_HELP, PARAM_SECTION } from '@/lib/help/registry';

function paramTooltip(helpKey: keyof typeof PARAM_HELP) {
  const help = PARAM_HELP[helpKey];
  if (help.details) {
    return (
      <InfoTooltip
        text={help.oneLiner}
        moreInfo={{ section: PARAM_SECTION[helpKey], anchor: helpKey }}
      />
    );
  }
  return <InfoTooltip text={help.oneLiner} />;
}

const MODES = ['Bootstrap', 'GBM', 'GBM+Jumps', 'Scenario'] as const;
const HORIZONS = [7, 30, 60, 90] as const;
const PATH_COUNTS = [100, 1000, 5000] as const;
const HISTORICAL_PERIODS = [1, 3, 5] as const;
const LOCK_PERIODS = [30, 60, 90, 180] as const;

export function Sidebar() {
  const [s, setS] = useUrlState();
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="font-bold text-base mb-1">Parameters</h2>
        <p className="text-xs text-neutral-500">All inputs sync to URL</p>
      </div>

      <Group title="Section 1 · Liquidity Need">
        <NumberField
          label="wiTRY TVL (USD)"
          helpKey="witryTVL_USD"
          value={s.witryTVL_USD}
          onChange={(v) => setS({ witryTVL_USD: v })}
          min={100_000}
          max={100_000_000}
          step={100_000}
        />
        <SelectField
          label="LLTV"
          helpKey="lltv"
          value={String(s.lltv)}
          onChange={(v) => setS({ lltv: parseFloat(v) as LLTV })}
          options={GOV_LLTVS.map((lv) => ({
            value: String(lv),
            label: `${(lv * 100).toFixed(1)}%`,
          }))}
        />
        <RangeField
          label="Target utilization"
          helpKey="targetUtilization"
          value={s.targetUtilization}
          onChange={(v) => setS({ targetUtilization: v })}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
        />
        <NumberField
          label="Borrower LTV α"
          helpKey="borrowerLTVAlpha"
          value={s.borrowerLTVAlpha}
          onChange={(v) => setS({ borrowerLTVAlpha: v })}
          min={0.1}
          max={20}
          step={0.1}
        />
        <NumberField
          label="Borrower LTV β"
          helpKey="borrowerLTVBeta"
          value={s.borrowerLTVBeta}
          onChange={(v) => setS({ borrowerLTVBeta: v })}
          min={0.1}
          max={20}
          step={0.1}
        />
      </Group>

      <Group title="Section 2 · FX Risk">
        <RangeField
          label="wiTRY annual yield"
          helpKey="witryYieldAnnual"
          value={s.witryYieldAnnual}
          onChange={(v) => setS({ witryYieldAnnual: v })}
          min={0}
          max={1}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
        />
        <NumberField
          label="USD/TRY baseline"
          helpKey="usdtryBaseline"
          value={s.usdtryBaseline}
          onChange={(v) => setS({ usdtryBaseline: v })}
          min={1}
          max={200}
          step={0.1}
        />
        <SelectField
          label="Historical period"
          helpKey="historicalPeriod"
          value={String(s.historicalPeriod)}
          onChange={(v) => setS({ historicalPeriod: parseInt(v, 10) })}
          options={HISTORICAL_PERIODS.map((p) => ({ value: String(p), label: `${p}Y` }))}
        />
        <SelectField
          label="Simulation mode"
          helpKey="simulationMode"
          value={s.simulationMode}
          onChange={(v) => setS({ simulationMode: v as (typeof MODES)[number] })}
          options={MODES.map((m) => ({ value: m, label: m }))}
        />
        <SelectField
          label="Horizon (days)"
          helpKey="simulationHorizonDays"
          value={String(s.simulationHorizonDays)}
          onChange={(v) => setS({ simulationHorizonDays: parseInt(v, 10) })}
          options={HORIZONS.map((h) => ({ value: String(h), label: `${h}d` }))}
        />
        <SelectField
          label="Path count"
          helpKey="pathCount"
          value={String(s.pathCount)}
          onChange={(v) => setS({ pathCount: parseInt(v, 10) })}
          options={PATH_COUNTS.map((p) => ({ value: String(p), label: String(p) }))}
        />
        <RangeField
          label="TRY shock (scenario)"
          helpKey="tryShockPct"
          value={s.tryShockPct}
          onChange={(v) => setS({ tryShockPct: v })}
          min={-0.8}
          max={-0.1}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
        />
        <CheckboxField
          label="Block bootstrap"
          helpKey="blockBootstrap"
          checked={s.blockBootstrap}
          onChange={(v) => setS({ blockBootstrap: v })}
        />
        <NumberField
          label="RNG seed"
          helpKey="seed"
          value={s.seed}
          onChange={(v) => setS({ seed: Math.round(v) })}
          min={0}
          max={1_000_000}
          step={1}
        />
      </Group>

      <Group title="Section 3 · Strategy">
        <NumberField
          label="Incentive budget/month (USD)"
          helpKey="incentiveBudgetMonthly_USD"
          value={s.incentiveBudgetMonthly_USD}
          onChange={(v) => setS({ incentiveBudgetMonthly_USD: v })}
          min={0}
          max={500_000}
          step={1_000}
        />
        <RangeField
          label="Attraction rate"
          helpKey="attractionRate"
          value={s.attractionRate}
          onChange={(v) => setS({ attractionRate: v })}
          min={1}
          max={10}
          step={0.1}
          format={(v) => v.toFixed(1)}
        />
        <SelectField
          label="Lock period (days)"
          helpKey="lockPeriodDays"
          value={String(s.lockPeriodDays)}
          onChange={(v) => setS({ lockPeriodDays: parseInt(v, 10) })}
          options={LOCK_PERIODS.map((p) => ({ value: String(p), label: `${p}d` }))}
        />
      </Group>

      <Group title="Section 4 · Liquidation">
        <NumberField
          label="wiTRY/USDM pool depth (USD)"
          helpKey="poolDepth_USD"
          value={s.poolDepth_USD}
          onChange={(v) => setS({ poolDepth_USD: v })}
          min={0}
          max={10_000_000}
          step={50_000}
        />
        <CheckboxField
          label="Pre-liquidation enabled"
          helpKey="preLiquidationEnabled"
          checked={s.preLiquidationEnabled}
          onChange={(v) => setS({ preLiquidationEnabled: v })}
        />
      </Group>

      <Group title="Section 5 · Vault Params">
        <RangeField
          label="Performance fee"
          helpKey="performanceFee"
          value={s.performanceFee}
          onChange={(v) => setS({ performanceFee: v })}
          min={0}
          max={0.5}
          step={0.005}
          format={(v) => `${(v * 100).toFixed(1)}%`}
        />
        <RangeField
          label="Management fee"
          helpKey="managementFee"
          value={s.managementFee}
          onChange={(v) => setS({ managementFee: v })}
          min={0}
          max={0.05}
          step={0.001}
          format={(v) => `${(v * 100).toFixed(2)}%`}
        />
        <RangeField
          label="Safety margin (LLTV)"
          helpKey="safetyMargin"
          value={s.safetyMargin}
          onChange={(v) => setS({ safetyMargin: v })}
          min={0}
          max={0.1}
          step={0.005}
          format={(v) => `${(v * 100).toFixed(1)}%`}
        />
      </Group>

      <button
        type="button"
        onClick={onCopy}
        className="w-full rounded border border-neutral-400 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 px-3 py-2 text-sm font-medium"
      >
        {copied ? 'Copied!' : 'Copy share link'}
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  helpKey?: keyof typeof PARAM_HELP;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {props.label}
        {props.helpKey && paramTooltip(props.helpKey)}
      </span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (Number.isFinite(parsed)) props.onChange(parsed);
        }}
        className="rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm"
      />
    </label>
  );
}

function RangeField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  helpKey?: keyof typeof PARAM_HELP;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {props.label}: <span className="font-mono">{props.format(props.value)}</span>
        {props.helpKey && paramTooltip(props.helpKey)}
      </span>
      <input
        type="range"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (Number.isFinite(parsed)) props.onChange(parsed);
        }}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  helpKey?: keyof typeof PARAM_HELP;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {props.label}
        {props.helpKey && paramTooltip(props.helpKey)}
      </span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField(props: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  helpKey?: keyof typeof PARAM_HELP;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {props.label}
        {props.helpKey && paramTooltip(props.helpKey)}
      </span>
    </label>
  );
}
