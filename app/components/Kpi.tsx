'use client';
import { HelpPopover } from './help/HelpPopover';
import type { KpiKey } from '@/lib/help/kpiKeys';

export function Kpi({
  label,
  value,
  hint,
  tone,
  helpKey,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  helpKey?: KpiKey;
}) {
  const toneCls =
    tone === 'good'
      ? 'border-emerald-500/40 bg-emerald-950/20'
      : tone === 'warn'
        ? 'border-amber-500/40 bg-amber-950/20'
        : tone === 'bad'
          ? 'border-red-500/40 bg-red-950/20'
          : 'border-brix-border bg-brix-card';
  const valueCls =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : tone === 'bad'
          ? 'text-red-300'
          : 'text-brix-accent';
  return (
    <div className={`p-4 border rounded-lg ${toneCls}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 flex items-center">
        <span>{label}</span>
        {helpKey && <HelpPopover kpiKey={helpKey} />}
      </div>
      <div className={`text-3xl font-semibold font-mono tracking-tight mt-2 ${valueCls}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-neutral-500 mt-2 leading-relaxed">{hint}</div>}
    </div>
  );
}

export function formatUSD(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function formatPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
