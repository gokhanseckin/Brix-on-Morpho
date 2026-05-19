'use client';
import { useSimulator } from '@/lib/useSimulator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { useMemo } from 'react';
import { liquidatorProfit } from '@/lib/simulator';
import { GOV_LLTVS } from '@/types/simulator';
import { Kpi, formatPct, formatUSD } from '../Kpi';

const POOL_DEPTH_GRID_USD = [100_000, 250_000, 500_000, 1_000_000, 2_500_000];
const HEATMAP_LLTVS = [0.625, 0.77, 0.86, 0.915] as const;

export function LiquidationDesign() {
  const { fx, inputs, lltvDerivation } = useSimulator();

  // Profit cliff data
  const profitCurve = useMemo(() => {
    const pts: Array<{ debt: number; profit: number }> = [];
    const lo = Math.log10(10);
    const hi = Math.log10(1_000_000);
    const steps = 50;
    for (let i = 0; i < steps; i++) {
      const d = Math.pow(10, lo + ((hi - lo) * i) / (steps - 1));
      const { profit_USD } = liquidatorProfit({
        debt_USD: d,
        lltv: inputs.lltv,
        poolDepth_USD: inputs.poolDepth_USD,
        gasCost_USD: 5,
        holdingRisk_USD: 0,
      });
      pts.push({ debt: d, profit: profit_USD });
    }
    return pts;
  }, [inputs.lltv, inputs.poolDepth_USD]);

  // Bad debt histogram
  const badDebtBins = useMemo(() => {
    const data = fx?.badDebt?.badDebtByPath ?? [];
    if (data.length === 0) return [];
    const max = Math.max(...data, 1);
    const bins = 10;
    const width = max / bins;
    const out: Array<{ range: string; count: number; lo: number }> = [];
    for (let i = 0; i < bins; i++) {
      out.push({
        range: `${formatUSD(i * width)}–${formatUSD((i + 1) * width)}`,
        count: 0,
        lo: i * width,
      });
    }
    for (const v of data) {
      const idx = Math.min(bins - 1, Math.floor(v / Math.max(width, 1e-9)));
      const target = out[idx];
      if (target) target.count++;
    }
    return out;
  }, [fx]);

  // Heatmap: render placeholder cells highlighting the user's current LLTV × pool depth cell.
  // We use a heuristic shading derived from (LLTV × 1/(poolDepth+1)) to give a relative sense
  // without re-running the full bad-debt simulator (per perf guard).
  const heatmap = useMemo(() => {
    const cur = fx?.badDebt?.badDebtP95Pct ?? 0;
    const rows = HEATMAP_LLTVS.map((lv) => ({
      lltv: lv,
      cells: POOL_DEPTH_GRID_USD.map((d) => {
        // heuristic: stress scales with LLTV (higher LLTV = thinner buffer) and inverse depth
        const heur = (lv / 0.77) * (500_000 / d) * cur;
        const isCurrent = lv === inputs.lltv && d === inputs.poolDepth_USD;
        return { depth: d, value: heur, isCurrent };
      }),
    }));
    return rows;
  }, [fx, inputs.lltv, inputs.poolDepth_USD]);

  return (
    <section id="section-liquidation-design" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">4. Liquidation Design</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Whether liquidations will actually fire given pool depth and gas, expected bad-debt
          distribution, and the value of pre-liquidation.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="P95 bad debt (USD)"
          value={fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'}
        />
        <Kpi
          label="P95 bad debt (% TVL)"
          value={fx?.badDebt ? formatPct(fx.badDebt.badDebtP95Pct, 2) : '—'}
          tone={
            fx?.badDebt && fx.badDebt.badDebtP95Pct > 0.01
              ? 'warn'
              : fx?.badDebt && fx.badDebt.badDebtP95Pct > 0.05
                ? 'bad'
                : 'good'
          }
        />
        <Kpi
          label="Profitable debt range"
          value={
            isFinite(lltvDerivation.minMax.min_USD) && isFinite(lltvDerivation.minMax.max_USD)
              ? `${formatUSD(lltvDerivation.minMax.min_USD)} – ${formatUSD(lltvDerivation.minMax.max_USD)}`
              : 'unprofitable at any size'
          }
          hint={`pool depth ${formatUSD(inputs.poolDepth_USD)}, gas $5`}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">
          Liquidator profit cliff (debt log-scale, pool depth {formatUSD(inputs.poolDepth_USD)})
        </h3>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={profitCurve} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="debt"
                scale="log"
                domain={['auto', 'auto']}
                type="number"
                tickFormatter={(v: number) => formatUSD(v)}
              />
              <YAxis tickFormatter={(v: number) => formatUSD(v)} />
              <Tooltip
                formatter={(v) => formatUSD(Number(v))}
                labelFormatter={(label) => `debt = ${formatUSD(Number(label))}`}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="profit" stroke="#3b82f6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Bad-debt distribution across simulated paths</h3>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={badDebtBins} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="range" tick={{ fontSize: 9 }} interval={0} angle={-20} height={50} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">
          P95 bad-debt heatmap (LLTV × pool depth, heuristic)
        </h3>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="p-2"></th>
                {POOL_DEPTH_GRID_USD.map((d) => (
                  <th key={d} className="p-2 text-right border-b border-neutral-300 dark:border-neutral-700">
                    {formatUSD(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.lltv}>
                  <td className="p-2 text-left border-r border-neutral-300 dark:border-neutral-700 font-medium">
                    {(row.lltv * 100).toFixed(1)}%
                  </td>
                  {row.cells.map((c) => {
                    const intensity = Math.min(1, c.value * 4);
                    const bg = `rgba(239, 68, 68, ${(0.1 + intensity * 0.7).toFixed(2)})`;
                    return (
                      <td
                        key={c.depth}
                        className={`p-2 text-right tabular-nums ${c.isCurrent ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                        style={{ backgroundColor: bg }}
                      >
                        {formatPct(c.value, 2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          Heatmap is a heuristic scaling of the current P95 % bad-debt by LLTV and pool depth (to
          stay under main-thread 100&nbsp;ms budget). The blue-outlined cell reflects the active
          ({(inputs.lltv * 100).toFixed(1)}%, {formatUSD(inputs.poolDepth_USD)}) configuration.
          Re-run with different sidebar settings to populate other cells precisely.
        </div>
      </div>

      <div
        className={`p-4 rounded border ${
          inputs.preLiquidationEnabled
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
        }`}
      >
        <div className="text-sm font-semibold">
          Pre-liquidation: {inputs.preLiquidationEnabled ? 'enabled' : 'disabled'}
        </div>
        <div className="text-xs mt-1">
          {inputs.preLiquidationEnabled
            ? 'Positions can be partially closed before the hard LLTV, reducing tail bad debt at the cost of borrower friction. Toggle off in the sidebar to see the contrast.'
            : 'Liquidations only trigger at the hard LLTV. Toggle on in the sidebar to reduce tail bad debt.'}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          (Worker recomputes bad-debt for the active toggle setting only; for an exact A/B
          comparison toggle in the sidebar and observe the headline P95 KPI change.)
        </div>
      </div>

      <div className="p-4 rounded border border-blue-500/50 bg-blue-50 dark:bg-blue-950/30">
        <div className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
          Recommendation
        </div>
        <div className="text-sm">
          At LLTV={(inputs.lltv * 100).toFixed(1)}%, P95 bad debt ={' '}
          {fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'} (
          {fx?.badDebt ? formatPct(fx.badDebt.badDebtP95Pct, 2) : '—'} of TVL). Recommended
          wiTRY/USDM pool depth ≥ {formatUSD(Math.max(inputs.poolDepth_USD, 250_000))}. Keep
          pre-liquidation enabled (preLLTV = {(Math.max(0, inputs.lltv - 0.05) * 100).toFixed(1)}%);
          governance-snapped LLTV from FX P95 drawdown is{' '}
          {lltvDerivation.snapped ? `${(lltvDerivation.snapped * 100).toFixed(1)}%` : '—'}.
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          Governance list: {GOV_LLTVS.map((v) => `${(v * 100).toFixed(1)}%`).join(', ')}.
        </div>
      </div>
    </section>
  );
}
