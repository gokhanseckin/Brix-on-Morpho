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
import { liquidatorProfitWithPool } from '@/lib/simulator';
import { quoteLiquidatorSell, materializePool } from '@/lib/univ3/quoteLiquidatorSell';
import { badDebtFromAMMSale } from '@/lib/badDebtMath';
import { GOV_LLTVS } from '@/types/simulator';
import { Kpi, formatPct, formatUSD } from '../Kpi';
import { HelpPopover } from '../help/HelpPopover';
import Link from 'next/link';

const POOL_DEPTH_GRID_USD = [100_000, 250_000, 500_000, 1_000_000, 2_500_000];
const HEATMAP_LLTVS = [0.625, 0.77, 0.86, 0.915] as const;

export function LiquidationDesign() {
  const { fx, inputs, lltvDerivation, pool } = useSimulator();
  const { preset, spot, effectiveDepth_USD } = pool;

  // Profit cliff data (AMM-accurate sweep using the configured ladder).
  const profitCurve = useMemo(() => {
    const pts: Array<{ debt: number; profit: number }> = [];
    const lo = Math.log10(10);
    const hi = Math.log10(1_000_000);
    const steps = 50;
    const materialized = materializePool(preset, spot);
    for (let i = 0; i < steps; i++) {
      const d = Math.pow(10, lo + ((hi - lo) * i) / (steps - 1));
      const { profit_USD } = liquidatorProfitWithPool(materialized, {
        debt_USD: d,
        lltv: inputs.lltv,
        spot,
        gasCost_USD: 5,
        holdingRisk_USD: 0,
      });
      pts.push({ debt: d, profit: profit_USD });
    }
    return pts;
  }, [inputs.lltv, preset, spot]);

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

  // Heatmap: render placeholder cells highlighting the user's current LLTV ×
  // pool depth cell. Heuristic shading by (LLTV / 1/depth) keeps the sweep
  // under main-thread budget. The "current" cell is matched against the
  // ladder-implied effective depth, so it reflects the real pool config.
  const heatmap = useMemo(() => {
    const cur = fx?.badDebt?.badDebtP95Pct ?? 0;
    // Find the nearest depth bucket to the current effective depth.
    const nearestDepth = POOL_DEPTH_GRID_USD.reduce((best, d) =>
      Math.abs(d - effectiveDepth_USD) < Math.abs(best - effectiveDepth_USD) ? d : best,
    POOL_DEPTH_GRID_USD[0]!);
    const rows = HEATMAP_LLTVS.map((lv) => ({
      lltv: lv,
      cells: POOL_DEPTH_GRID_USD.map((d) => {
        const heur = (lv / 0.77) * (500_000 / d) * cur;
        const isCurrent = lv === inputs.lltv && d === nearestDepth;
        return { depth: d, value: heur, isCurrent };
      }),
    }));
    return rows;
  }, [fx, inputs.lltv, effectiveDepth_USD]);

  // Viability check at P95 coincident liquidation volume.
  //
  // In Morpho, liquidate() is one atomic bundle: repay USDM → seize wTRY →
  // sell on AMM → pocket the difference. If proceeds < debt + gas, the
  // liquidator simply never broadcasts the bundle. So when the AMM is too
  // shallow for the aggregated daily volume, no swap happens; the position
  // sits unliquidated and the shortfall accrues as Morpho market debt as
  // FX drifts further. The "loss bucket" is the lender, not the AMM.
  const coincidentViability = useMemo(() => {
    const collateralUSD = fx?.badDebt?.expectedLiquidationVolumeP95_USD ?? 25_000;
    const wTRYwei = BigInt(Math.floor((collateralUSD / spot) * 1e6));
    const q = quoteLiquidatorSell(preset, spot, wTRYwei);
    const ammSale = Number(q.amountOut) / 1e6;
    const bd = badDebtFromAMMSale({ collateral_USD: collateralUSD, lltv: inputs.lltv, ammSale_USDM: ammSale });
    const gas_USD = 5;
    const liquidatorPnL_USD = ammSale - bd.debt_USD - gas_USD;
    const viable = liquidatorPnL_USD >= 0;
    // If viable: residual Morpho debt = the AMM-shortfall dust.
    // If not viable: liquidator skips; the full debt remains underwriting
    // exposure until FX cures or pre-liq fires. Communicate magnitude only.
    const morphoExposure_USD = viable ? bd.badDebt_USD : bd.debt_USD;
    return {
      viable,
      liquidatorPnL_USD,
      slippagePct: q.slippagePct,
      collateralUSD,
      debtUSD: bd.debt_USD,
      ammSale_USD: ammSale,
      morphoExposure_USD,
    };
  }, [preset, spot, inputs.lltv, fx]);

  return (
    <section id="section-liquidation-design" className="space-y-6">
      <div>
        <div className="brix-kicker mb-2">04 · Liquidation</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Liquidation Design</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Whether liquidations will actually fire given pool depth and gas, expected bad-debt
          distribution, and the value of pre-liquidation.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi
          label="P95 Morpho debt — single (USD)"
          value={fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'}
          hint="Cascade with each liquidation priced as its own swap. Lower bound — assumes liquidators clear positions one at a time."
          helpKey="badDebtP95USD"
        />
        <Kpi
          label="P95 Morpho debt — single (% TVL)"
          value={fx?.badDebt ? formatPct(fx.badDebt.badDebtP95Pct, 2) : '—'}
          tone={
            fx?.badDebt && fx.badDebt.badDebtP95Pct > 0.05
              ? 'bad'
              : fx?.badDebt && fx.badDebt.badDebtP95Pct > 0.01
                ? 'warn'
                : 'good'
          }
          helpKey="badDebtP95Pct"
        />
        <Kpi
          label="Liquidation viability @ P95 coincident vol"
          value={
            coincidentViability.viable
              ? `VIABLE · +${formatUSD(coincidentViability.liquidatorPnL_USD)}`
              : `NOT VIABLE · −${formatUSD(Math.abs(coincidentViability.liquidatorPnL_USD))}`
          }
          hint={
            coincidentViability.viable
              ? `If aggregate ${formatUSD(coincidentViability.debtUSD)} debt clears in one tx: AMM proceeds ${formatUSD(coincidentViability.ammSale_USD)} > debt + gas. Residual Morpho debt ≈ ${formatUSD(coincidentViability.morphoExposure_USD)}.`
              : `Aggregate ${formatUSD(coincidentViability.debtUSD)} debt → AMM proceeds only ${formatUSD(coincidentViability.ammSale_USD)} (slip ${formatPct(coincidentViability.slippagePct, 1)}). Liquidator skips; debt sits as Morpho exposure until FX cures or pre-liq fires.`
          }
          tone={coincidentViability.viable ? 'good' : 'bad'}
        />
        <Kpi
          label="Profitable debt range"
          value={
            isFinite(lltvDerivation.minMax.min_USD) && isFinite(lltvDerivation.minMax.max_USD)
              ? `${formatUSD(lltvDerivation.minMax.min_USD)} – ${formatUSD(lltvDerivation.minMax.max_USD)}`
              : 'unprofitable at any size'
          }
          hint={`pool depth ${formatUSD(effectiveDepth_USD)}, gas $5`}
          helpKey="minProfitableLiquidation"
        />
      </div>

      <PoolSnapshot
        poolTVL_USD={inputs.poolTVL_USD}
        feeTier={inputs.poolFeeTier}
        coreSplit={inputs.bandSplitCore}
        absorbSplit={inputs.bandSplitAbsorb}
        effectiveDepth_USD={effectiveDepth_USD}
        slippagePctAtP95={coincidentViability.slippagePct}
      />

      <div>
        <h3 className="text-sm font-semibold mb-2">
          Liquidator profit cliff (debt log-scale, in-range depth {formatUSD(effectiveDepth_USD)})
        </h3>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
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
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-sm font-semibold">Bad-debt distribution across simulated paths</h3>
          <HelpPopover chartKey="badDebtHistogram" />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
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
                  <th key={d} className="p-2 text-right border-b border-brix-border">
                    {formatUSD(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.lltv}>
                  <td className="p-2 text-left border-r border-brix-border font-medium">
                    {(row.lltv * 100).toFixed(1)}%
                  </td>
                  {row.cells.map((c) => {
                    // <1% good (green), 1-5% warn (amber), >5% bad (red).
                    let bg: string;
                    if (c.value < 0.01) {
                      const intensity = 1 - c.value / 0.01;
                      bg = `rgba(34, 197, 94, ${(0.15 + intensity * 0.45).toFixed(2)})`;
                    } else if (c.value < 0.05) {
                      const intensity = (c.value - 0.01) / 0.04;
                      bg = `rgba(245, 158, 11, ${(0.2 + intensity * 0.5).toFixed(2)})`;
                    } else {
                      const intensity = Math.min(1, (c.value - 0.05) / 0.1);
                      bg = `rgba(239, 68, 68, ${(0.35 + intensity * 0.5).toFixed(2)})`;
                    }
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
          ({(inputs.lltv * 100).toFixed(1)}%, ladder ≈ {formatUSD(effectiveDepth_USD)} in-range)
          configuration. Re-run with different sidebar settings to populate other cells precisely.
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

      <div className="p-4 rounded border border-brix-accent/40 bg-brix-accent/10">
        <div className="text-xs uppercase tracking-wide text-brix-accent mb-1">
          Recommendation
        </div>
        <div className="text-sm">
          At LLTV={(inputs.lltv * 100).toFixed(1)}%, P95 Morpho debt (single) ={' '}
          {fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'} (
          {fx?.badDebt ? formatPct(fx.badDebt.badDebtP95Pct, 2) : '—'} of TVL).
          Coincident-execution viability at P95 vol:{' '}
          <strong>{coincidentViability.viable ? 'VIABLE' : 'NOT VIABLE'}</strong>
          {!coincidentViability.viable && ' — single-tx aggregate dump would lose the liquidator money, so they skip; debt sits as Morpho exposure'}. P95 single-horizon
          liquidation volume ={' '}
          {fx?.badDebt ? formatUSD(fx.badDebt.expectedLiquidationVolumeP95_USD) : '—'}; recommended
          wiTRY/USDM pool depth ≥{' '}
          {fx?.badDebt
            ? formatUSD(Math.max(fx.badDebt.expectedLiquidationVolumeP95_USD / 0.02, 250_000))
            : formatUSD(Math.max(effectiveDepth_USD, 250_000))}{' '}
          (P95 volume ÷ 2% slippage budget; $250k floor). Keep pre-liquidation enabled (preLLTV ={' '}
          {(Math.max(0, inputs.lltv - 0.05) * 100).toFixed(1)}%); governance-snapped LLTV from FX
          P95 drawdown is{' '}
          {lltvDerivation.snapped ? `${(lltvDerivation.snapped * 100).toFixed(1)}%` : '—'}.
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          Governance list: {GOV_LLTVS.map((v) => `${(v * 100).toFixed(1)}%`).join(', ')}.
        </div>
      </div>
    </section>
  );
}

interface PoolSnapshotProps {
  poolTVL_USD: number;
  feeTier: number;
  coreSplit: number;
  absorbSplit: number;
  effectiveDepth_USD: number;
  slippagePctAtP95: number;
}

function PoolSnapshot(p: PoolSnapshotProps) {
  const tailSplit = Math.max(0, 1 - p.coreSplit - p.absorbSplit);
  const feeLabel = p.feeTier === 10000 ? '1.00%' : `${(p.feeTier / 10000).toFixed(2)}%`;
  return (
    <div className="p-3 rounded border border-brix-border bg-brix-card flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
      <div className="font-semibold text-neutral-300">Pool snapshot</div>
      <div>
        TVL <span className="text-neutral-100">{formatUSD(p.poolTVL_USD)}</span>
      </div>
      <div>
        Fee <span className="text-neutral-100">{feeLabel}</span>
      </div>
      <div>
        Splits{' '}
        <span className="text-neutral-100">
          core {(p.coreSplit * 100).toFixed(0)}% · absorb {(p.absorbSplit * 100).toFixed(0)}% ·
          tail {(tailSplit * 100).toFixed(0)}%
        </span>
      </div>
      <div>
        In-range <span className="text-neutral-100">{formatUSD(p.effectiveDepth_USD)}</span>
      </div>
      <div>
        Slip @ P95 <span className="text-neutral-100">{formatPct(p.slippagePctAtP95, 3)}</span>
      </div>
      <Link
        href="/swapliquidity"
        className="ml-auto text-brix-accent hover:text-brix-accentHover"
      >
        Edit on /swapliquidity →
      </Link>
    </div>
  );
}
