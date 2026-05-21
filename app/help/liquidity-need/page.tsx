import { KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import { KpiEntry, ChartEntry } from '@/app/components/help/SectionPage';

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

      {kpis.map((k) => <KpiEntry key={k} id={k} help={KPI_HELP[k]} />)}
      {charts.map((c) => <ChartEntry key={c} id={c} help={CHART_HELP[c]} />)}
    </div>
  );
}
