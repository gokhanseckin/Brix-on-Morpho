'use client';
import type { KpiHelp } from '@/lib/help/types';
import { KatexBlock } from './KatexBlock';

export function HelpSection({ help }: { help: KpiHelp }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-neutral-700 dark:text-neutral-300">{help.oneLiner}</p>

      <section className="space-y-2">
        <SubHead>How it&apos;s calculated</SubHead>
        {help.formula.latex
          ? <KatexBlock latex={help.formula.latex} fallback={help.formula.plain} />
          : <KatexBlock fallback={help.formula.plain} />}
        {help.params.length > 0 && (
          <ul className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 space-y-0.5">
            {help.params.map((p) => (
              <li key={p.name}>
                <span className="font-mono">{p.name}</span>{' '}
                <span className="text-neutral-500">[{p.source}{p.value ? `: ${p.value}` : ''}]</span>
                {p.note && <span className="ml-1 text-neutral-500">— {p.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1">
        <SubHead>Definitions</SubHead>
        {help.definitions.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">No definitions.</p>
        ) : (
          <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
            {help.definitions.map((d) => (
              <li key={d.term}>
                <span className="font-medium">{d.term}:</span> {d.definition}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1">
        <SubHead>Impact on vault</SubHead>
        <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
          <li><span className="font-medium">Health:</span> {help.impact.health}</li>
          <li><span className="font-medium">Sustainability:</span> {help.impact.sustainability}</li>
          <li><span className="font-medium">Profitability:</span> {help.impact.profitability}</li>
        </ul>
      </section>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </h3>
  );
}
