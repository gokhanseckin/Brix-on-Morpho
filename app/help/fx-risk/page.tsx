import { KPI_HELP, CHART_HELP, PARAM_HELP, PARAM_SECTION } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import type { SidebarInputs } from '@/types/simulator';
import { KpiEntry, ChartEntry, ParamEntry } from '@/app/components/help/SectionPage';

// Friendly labels for params that have rich /help bodies. Only entries with
// `details` get an anchor on the page; we only need labels for those.
const PARAM_LABELS: Partial<Record<keyof SidebarInputs, string>> = {
  simulationMode: 'Simulation mode',
};

export default function HelpFXRisk() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'fx-risk');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'fx-risk');
  const paramKeys = (Object.keys(PARAM_HELP) as Array<keyof SidebarInputs>).filter(
    (k) => PARAM_SECTION[k] === 'fx-risk' && PARAM_HELP[k].details,
  );
  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-semibold">2. FX Risk</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          Monte-Carlo USD/TRY paths, the net wiTRY USD value (after wiTRY yield
          offset), and how many borrower positions go underwater over the horizon.
          Drives the P95 3-day drawdown that anchors the LLTV recommendation in
          Section 5.
        </p>
      </header>

      {kpis.map((k) => <KpiEntry key={k} id={k} help={KPI_HELP[k]} />)}
      {charts.map((c) => <ChartEntry key={c} id={c} help={CHART_HELP[c]} />)}

      {paramKeys.length > 0 && (
        <>
          <h3 className="text-lg font-semibold pt-4 border-t border-neutral-200 dark:border-neutral-800">
            Sidebar parameters
          </h3>
          {paramKeys.map((k) => (
            <ParamEntry
              key={k}
              id={k}
              label={PARAM_LABELS[k] ?? k}
              help={PARAM_HELP[k]}
            />
          ))}
        </>
      )}
    </div>
  );
}
