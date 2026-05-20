import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import { KpiEntry, ChartEntry } from '@/app/components/help/SectionPage';

export default function HelpLiquidation() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'liquidation');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'liquidation');
  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-semibold">4. Liquidation Design</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          The profitable-liquidation window driven by LIF, AMM slippage and gas;
          the resulting tail bad-debt distribution; and the Morpho pre-liquidation
          parameters that drain that tail before it triggers. Feeds the LLTV
          derivation and vault config in Section 5.
        </p>
      </header>

      {kpis.map((k) => <KpiEntry key={k} id={k} help={KPI_HELP[k]} />)}
      {charts.map((c) => <ChartEntry key={c} id={c} help={CHART_HELP[c]} />)}
    </div>
  );
}
