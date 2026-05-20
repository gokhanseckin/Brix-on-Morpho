import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import { KatexBlock } from '@/app/components/help/KatexBlock';
import { WorkedExample } from '@/app/components/help/WorkedExample';
import type { ChartHelp, KpiHelp } from '@/lib/help/types';

export default function HelpLiquidityNeed() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'liquidity-need');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'liquidity-need');
  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-semibold">1. Liquidity Need</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          How the simulator sizes USDM for the wiTRY → USDM market: how much is
          needed to fund expected borrows at the configured target utilization,
          and how much extra to hold for stability.
        </p>
      </header>

      {kpis.map((k) => (
        <KpiEntry key={k} id={k} help={KPI_HELP[k]} />
      ))}

      {charts.map((c) => (
        <ChartEntry key={c} id={c} help={CHART_HELP[c]} />
      ))}
    </div>
  );
}

function KpiEntry({ id, help }: { id: string; help: KpiHelp }) {
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

function ChartEntry({ id, help }: { id: string; help: ChartHelp }) {
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
