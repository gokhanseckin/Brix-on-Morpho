// Shared rendering primitives for /help/<section> pages. Each section
// page (liquidity-need, fx-risk, …) just imports KpiEntry + ChartEntry
// and feeds them registry entries — content lives in lib/help/content/.
import { KatexBlock } from './KatexBlock';
import { WorkedExample } from './WorkedExample';
import type { ChartHelp, KpiHelp } from '@/lib/help/types';

export function KpiEntry({ id, help }: { id: string; help: KpiHelp }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-16">
      <h3 className="text-base font-semibold">{help.title}</h3>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 max-w-prose">{help.oneLiner}</p>

      <SubHead>How it&apos;s calculated</SubHead>
      {help.formula.latex
        ? <KatexBlock latex={help.formula.latex} fallback={help.formula.plain} />
        : <KatexBlock fallback={help.formula.plain} />}
      {help.params.length > 0 && (
        <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-0.5">
          {help.params.map((p) => (
            <li key={p.name}>
              <span className="font-mono">{p.name}</span>{' '}
              <span className="text-neutral-500">
                [{p.source}
                {p.value ? `: ${p.value}` : ''}]
              </span>
              {p.note && <span className="ml-1 text-neutral-500">— {p.note}</span>}
            </li>
          ))}
        </ul>
      )}

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

      <SubHead>Impact on vault</SubHead>
      <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
        <li><span className="font-medium">Health:</span> {help.impact.health}</li>
        <li><span className="font-medium">Sustainability:</span> {help.impact.sustainability}</li>
        <li><span className="font-medium">Profitability:</span> {help.impact.profitability}</li>
      </ul>

      {help.workedExample && (
        <>
          <SubHead>Worked example</SubHead>
          <WorkedExample example={help.workedExample} />
        </>
      )}
    </section>
  );
}

export function ChartEntry({ id, help }: { id: string; help: ChartHelp }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-16">
      <h3 className="text-base font-semibold">{help.title}</h3>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 max-w-prose">{help.oneLiner}</p>

      <SubHead>Axes</SubHead>
      <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-0.5">
        <li><span className="font-medium">x:</span> {help.axes.x}</li>
        <li><span className="font-medium">y:</span> {help.axes.y}</li>
      </ul>

      {help.bands && help.bands.length > 0 && (
        <>
          <SubHead>Bands / regions</SubHead>
          <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
            {help.bands.map((b) => (
              <li key={b.name}>
                <span className="font-medium">{b.name}:</span> {b.meaning}
              </li>
            ))}
          </ul>
        </>
      )}

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

      <SubHead>Impact on vault</SubHead>
      <ul className="text-xs text-neutral-700 dark:text-neutral-300 space-y-1">
        <li><span className="font-medium">Health:</span> {help.impact.health}</li>
        <li><span className="font-medium">Sustainability:</span> {help.impact.sustainability}</li>
        <li><span className="font-medium">Profitability:</span> {help.impact.profitability}</li>
      </ul>
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 pt-1">
      {children}
    </h4>
  );
}
