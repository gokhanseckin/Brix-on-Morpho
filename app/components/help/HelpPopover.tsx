'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_SECTION, type KpiKey } from '@/lib/help/kpiKeys';
import { CHART_SECTION, type ChartKey } from '@/lib/help/chartKeys';
import { HelpSection } from './HelpSection';
import type { ChartHelp, KpiHelp } from '@/lib/help/types';

type Props =
  | { kpiKey: KpiKey; chartKey?: never }
  | { kpiKey?: never; chartKey: ChartKey };

export function HelpPopover(props: Props) {
  const isKpi = 'kpiKey' in props && props.kpiKey !== undefined;
  const help = isKpi ? KPI_HELP[props.kpiKey!] : CHART_HELP[props.chartKey!];
  const section = isKpi ? KPI_SECTION[props.kpiKey!] : CHART_SECTION[props.chartKey!];
  const anchor = isKpi ? props.kpiKey! : props.chartKey!;

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const dlg = document.getElementById(id);
      if (dlg && !dlg.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, id]);

  const effectiveTitle = help.title === 'Coming soon' ? humanize(anchor) : help.title;

  return (
    <span className="relative inline-block align-middle ml-2">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Help: ${effectiveTitle}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-400 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-modal="false"
          aria-label={effectiveTitle}
          className="absolute right-0 z-50 mt-2 w-[380px] max-h-[80vh] overflow-auto rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 shadow-xl normal-case tracking-normal sm:right-0 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-lg max-sm:rounded-b-none max-sm:w-auto"
        >
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-sm font-semibold">{effectiveTitle}</h2>
            <button
              type="button"
              aria-label="Close help"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              ×
            </button>
          </div>
          <HelpSection help={isKpi ? KPI_HELP[props.kpiKey!] : asKpiHelp(CHART_HELP[props.chartKey!])} />
          <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-right">
            <Link
              href={{ pathname: `/help/${section}` as Route, hash: anchor }}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              More info →
            </Link>
          </div>
        </div>
      )}
    </span>
  );
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function asKpiHelp(ch: ChartHelp): KpiHelp {
  return {
    title: ch.title,
    oneLiner: ch.oneLiner,
    formula: { plain: `Axes: x=${ch.axes.x}, y=${ch.axes.y}` },
    params: [],
    definitions: ch.definitions,
    impact: ch.impact,
  };
}
