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
      ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30'
      : tone === 'warn'
        ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/30'
        : tone === 'bad'
          ? 'border-red-500/50 bg-red-50 dark:bg-red-950/30'
          : 'border-neutral-300 dark:border-neutral-700';
  return (
    <div className={`p-4 border rounded-lg ${toneCls}`}>
      <div className="text-xs uppercase tracking-wide text-neutral-500 flex items-center">
        <span>{label}</span>
        {helpKey && <HelpPopover kpiKey={helpKey} />}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-neutral-500 mt-1">{hint}</div>}
    </div>
  );
}

export function formatUSD(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function formatPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
