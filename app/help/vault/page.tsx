import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import { KpiEntry, ChartEntry } from '@/app/components/help/SectionPage';

export default function HelpVault() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'vault');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'vault');
  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-semibold">5. Vault Recommendations</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          The fixed-point LLTV derivation, the risk-tier classification of the
          user-chosen LLTV vs the recommendation, and the deploy-ready vault
          config JSON. Aggregates every upstream section into a single artifact
          ready for the MetaMorpho deployment scripts.
        </p>
      </header>

      {kpis.map((k) => <KpiEntry key={k} id={k} help={KPI_HELP[k]} />)}
      {charts.map((c) => <ChartEntry key={c} id={c} help={CHART_HELP[c]} />)}
    </div>
  );
}
