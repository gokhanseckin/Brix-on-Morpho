import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import { KpiEntry, ChartEntry } from '@/app/components/help/SectionPage';

export default function HelpStrategy() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'strategy');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'strategy');
  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-semibold">3. Liquidity Strategy</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          Supplier yield economics (gross → net → with-incentive), the Merkl
          campaign ramp (days-to-target, total spend, retention after rewards
          end), and the borrower-side leverage-loop viability check that drives
          organic borrow demand.
        </p>
      </header>

      {kpis.map((k) => <KpiEntry key={k} id={k} help={KPI_HELP[k]} />)}
      {charts.map((c) => <ChartEntry key={c} id={c} help={CHART_HELP[c]} />)}
    </div>
  );
}
