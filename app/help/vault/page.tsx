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
        <h2 className="text-xl font-semibold">5. Deployment Recommendations</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          Three distinct artifacts: the Morpho Blue <strong>market</strong> (immutable
          LLTV/IRM/oracle), the per-market <strong>pre-liquidation contract</strong>{' '}
          (borrower opt-in, spec §4D), and the MetaMorpho <strong>vault</strong>
          {' '}(caps, fees, timelock, roles). The two-constraint governance-tier scan
          and risk-tier classification summarize upstream risk inputs. The JSON is a
          configuration template: replace placeholder addresses and convert the
          human-readable cap before any submission.
        </p>
      </header>

      {kpis.map((k) => <KpiEntry key={k} id={k} help={KPI_HELP[k]} />)}
      {charts.map((c) => <ChartEntry key={c} id={c} help={CHART_HELP[c]} />)}
    </div>
  );
}
