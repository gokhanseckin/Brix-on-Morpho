import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';

export default function HelpUtilization() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'utilization');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'utilization');
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">6. Utilization Calibration</h2>
      {kpis.map((k) => (
        <Entry
          key={k}
          id={k}
          title={KPI_HELP[k].title}
          oneLiner={KPI_HELP[k].oneLiner}
          formula={KPI_HELP[k].formula.plain}
          params={KPI_HELP[k].params}
          definitions={KPI_HELP[k].definitions}
          impact={KPI_HELP[k].impact}
        />
      ))}
      {charts.map((c) => (
        <ChartEntry
          key={c}
          id={c}
          title={CHART_HELP[c].title}
          oneLiner={CHART_HELP[c].oneLiner}
          axes={CHART_HELP[c].axes}
          definitions={CHART_HELP[c].definitions}
          impact={CHART_HELP[c].impact}
        />
      ))}
    </div>
  );
}

function Entry({
  id,
  title,
  oneLiner,
  formula,
  params,
  definitions,
  impact,
}: {
  id: string;
  title: string;
  oneLiner: string;
  formula: string;
  params: Array<{ name: string; source: string; ref?: string; value?: string; note?: string }>;
  definitions: Array<{ term: string; definition: string }>;
  impact: { health: string; sustainability: string; profitability: string };
}) {
  return (
    <section id={id} className="space-y-3">
      <h3 className="text-base font-semibold">{title === 'Coming soon' ? humanize(id) : title}</h3>
      <p className="text-sm text-neutral-500">{oneLiner}</p>
      {formula && formula !== '(documentation pending)' && (
        <pre className="rounded bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-xs font-mono whitespace-pre-wrap">{formula}</pre>
      )}
      {params.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Inputs</h4>
          <ul className="text-xs space-y-1">
            {params.map((p) => (
              <li key={p.name} className="flex gap-2">
                <span className="font-mono text-neutral-700 dark:text-neutral-300">{p.name}</span>
                <span className="text-neutral-400">({p.source}{p.ref ? ` → ${p.ref}` : ''}{p.value ? ` = ${p.value}` : ''})</span>
                {p.note && <span className="text-neutral-400 italic">{p.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {definitions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Definitions</h4>
          <dl className="text-xs space-y-1">
            {definitions.map((d) => (
              <div key={d.term} className="flex gap-2">
                <dt className="font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">{d.term}:</dt>
                <dd className="text-neutral-500">{d.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div>
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Consequences</h4>
        <ul className="text-xs space-y-1">
          <li><span className="font-semibold text-neutral-600 dark:text-neutral-400">Health:</span> {impact.health}</li>
          <li><span className="font-semibold text-neutral-600 dark:text-neutral-400">Sustainability:</span> {impact.sustainability}</li>
          <li><span className="font-semibold text-neutral-600 dark:text-neutral-400">Profitability:</span> {impact.profitability}</li>
        </ul>
      </div>
    </section>
  );
}

function ChartEntry({
  id,
  title,
  oneLiner,
  axes,
  definitions,
  impact,
}: {
  id: string;
  title: string;
  oneLiner: string;
  axes: { x: string; y: string };
  definitions: Array<{ term: string; definition: string }>;
  impact: { health: string; sustainability: string; profitability: string };
}) {
  return (
    <section id={id} className="space-y-3">
      <h3 className="text-base font-semibold">{title === 'Coming soon' ? humanize(id) : title}</h3>
      <p className="text-sm text-neutral-500">{oneLiner}</p>
      <p className="text-xs text-neutral-400">
        <span className="font-semibold">x-axis:</span> {axes.x} &nbsp;·&nbsp;
        <span className="font-semibold">y-axis:</span> {axes.y}
      </p>
      {definitions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Definitions</h4>
          <dl className="text-xs space-y-1">
            {definitions.map((d) => (
              <div key={d.term} className="flex gap-2">
                <dt className="font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">{d.term}:</dt>
                <dd className="text-neutral-500">{d.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div>
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Consequences</h4>
        <ul className="text-xs space-y-1">
          <li><span className="font-semibold text-neutral-600 dark:text-neutral-400">Health:</span> {impact.health}</li>
          <li><span className="font-semibold text-neutral-600 dark:text-neutral-400">Sustainability:</span> {impact.sustainability}</li>
          <li><span className="font-semibold text-neutral-600 dark:text-neutral-400">Profitability:</span> {impact.profitability}</li>
        </ul>
      </div>
    </section>
  );
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}
