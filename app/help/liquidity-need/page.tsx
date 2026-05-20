import { KPI_HELP } from '@/lib/help/registry';
import { CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';

export default function HelpLiquidityNeed() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'liquidity-need');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'liquidity-need');
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">1. Liquidity Need</h2>
      {kpis.map((k) => (
        <Entry key={k} id={k} title={KPI_HELP[k].title} oneLiner={KPI_HELP[k].oneLiner} />
      ))}
      {charts.map((c) => (
        <Entry key={c} id={c} title={CHART_HELP[c].title} oneLiner={CHART_HELP[c].oneLiner} />
      ))}
    </div>
  );
}

function Entry({ id, title, oneLiner }: { id: string; title: string; oneLiner: string }) {
  return (
    <section id={id}>
      <h3 className="text-base font-semibold">{title === 'Coming soon' ? humanize(id) : title}</h3>
      <p className="text-sm text-neutral-500 mt-1">{oneLiner}</p>
      <p className="text-xs text-neutral-400 italic mt-2">
        Full formula, worked example, chart, and diagram land in a follow-up PR.
      </p>
    </section>
  );
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}
