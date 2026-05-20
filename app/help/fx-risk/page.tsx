import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import { KpiEntry, ChartEntry } from '@/app/components/help/SectionPage';

export default function HelpFXRisk() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'fx-risk');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'fx-risk');
  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-semibold">2. FX Risk</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          Monte-Carlo USD/TRY paths, the net wiTRY USD value (after iTRY yield
          offset), and how many borrower positions go underwater over the horizon.
          Drives the P95 3-day drawdown that anchors the LLTV recommendation in
          Section 5.
        </p>
      </header>

      {kpis.map((k) => <KpiEntry key={k} id={k} help={KPI_HELP[k]} />)}
      {charts.map((c) => <ChartEntry key={c} id={c} help={CHART_HELP[c]} />)}
    </div>
  );
}
