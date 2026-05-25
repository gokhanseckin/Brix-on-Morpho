'use client';
import { useSimulator } from '@/lib/useSimulator';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useMemo } from 'react';
import { Kpi, formatPct, formatUSD } from '../Kpi';

const COMPETING_BENCHMARKS: Array<{ name: string; apy: number }> = [
  { name: 'Aave USDC', apy: 0.055 },
  { name: 'Morpho USDC vaults', apy: 0.065 },
];

export function LiquidityStrategy() {
  const { strategy, inputs, running } = useSimulator();

  const apyComparison = useMemo(
    () => [
      { name: 'Brix net', apy: strategy.netSupplyAPY },
      { name: 'Brix + incentives', apy: strategy.totalSupplyAPY },
      ...COMPETING_BENCHMARKS,
    ],
    [strategy.netSupplyAPY, strategy.totalSupplyAPY],
  );

  const loopBars = useMemo(
    () => [
      { name: 'Hold wiTRY',        apy: inputs.witryYieldAnnual,             color: '#6b7280' },
      { name: 'Loop wiTRY',        apy: strategy.netLoopAPY,                 color: '#10b981' },
      { name: 'Loop + incentives', apy: strategy.netLoopAPY_withIncentives,  color: '#3b82f6' },
    ],
    [inputs.witryYieldAnnual, strategy.netLoopAPY, strategy.netLoopAPY_withIncentives],
  );
  const viable = strategy.leverageLoopsViable;
  const loopPath = strategy.loopPath;

  const merklText = useMemo(() => {
    return `Supply-side Merkl: $${(
      inputs.supplyIncentiveBudgetMonthly_USD / 1000
    ).toFixed(0)}k/month → supply incentive APY ${formatPct(
      strategy.supplyIncentiveAPY,
      2,
    )}; suppliers see ${formatPct(
      strategy.totalSupplyAPY,
      2,
    )} (net ${formatPct(strategy.netSupplyAPY, 2)} + incentives). Borrower-side: $${(
      inputs.borrowerIncentiveBudgetMonthly_USD / 1000
    ).toFixed(0)}k/month → borrower incentive APY ${formatPct(
      strategy.borrowerIncentiveAPY,
      2,
    )}; net borrow cost ${formatPct(strategy.netBorrowAPY, 2)} (gross ${formatPct(
      strategy.borrowAPY,
      2,
    )}).`;
  }, [
    strategy.supplyIncentiveAPY,
    strategy.totalSupplyAPY,
    strategy.netSupplyAPY,
    strategy.borrowerIncentiveAPY,
    strategy.netBorrowAPY,
    strategy.borrowAPY,
    inputs.supplyIncentiveBudgetMonthly_USD,
    inputs.borrowerIncentiveBudgetMonthly_USD,
  ]);

  return (
    <section id="section-liquidity-strategy" className="space-y-6">
      <div>
        <div className="brix-kicker mb-2">03 · Strategy</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Liquidity Strategy</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Supplier yield, borrower leverage-loop viability, and supply/borrower incentive APYs.
        </p>
      </div>

      {/* Row 1: Supplier APY */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Supplier APY</h3>
        <div className="grid grid-cols-4 gap-4">
          <Kpi label="Gross supply APY" value={formatPct(strategy.grossSupplyAPY, 2)} helpKey="grossSupplyAPY" />
          <Kpi label="Net supply APY" value={formatPct(strategy.netSupplyAPY, 2)} hint="post-fees" helpKey="netSupplyAPY" />
          <Kpi
            label="Supply incentive APY"
            value={formatPct(strategy.supplyIncentiveAPY, 2)}
            hint={`${formatUSD(inputs.supplyIncentiveBudgetMonthly_USD)}/mo`}
            helpKey="supplyIncentiveAPY"
          />
          <Kpi
            label="Total supply APY"
            value={formatPct(strategy.totalSupplyAPY, 2)}
            tone="good"
            helpKey="totalSupplyAPY"
          />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card mt-3">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={apyComparison}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
              <Bar dataKey="apy" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Loop economics (deterministic, carry-only) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold">Loop economics (carry-only)</h3>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              viable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {viable ? 'Loop beats hold' : 'Loop loses to hold'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <Kpi label="Effective leverage" value={`${strategy.effectiveLeverage.toFixed(2)}×`} helpKey="effectiveLeverageStrategy" />
          <Kpi label="Debt / collateral" value={formatPct(strategy.loopDebtPerCollateral, 1)} helpKey="loopDebtPerCollateral" />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={loopBars}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
              <Bar dataKey="apy">
                {loopBars.map((b, i) => (
                  <Cell key={i} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Realized P&L histogram */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Loop realized P&amp;L (Monte Carlo)</h3>
        <div className="grid grid-cols-4 gap-4 mb-3">
          <Kpi label="P5 loop APY" value={loopPath ? formatPct(loopPath.apyP5, 1) : running ? '…' : '—'} helpKey="loopAPYP5" />
          <Kpi label="P50 loop APY" value={loopPath ? formatPct(loopPath.apyP50, 1) : running ? '…' : '—'} helpKey="loopAPYP50" />
          <Kpi label="P95 loop APY" value={loopPath ? formatPct(loopPath.apyP95, 1) : running ? '…' : '—'} helpKey="loopAPYP95" />
          <Kpi label="Liquidation rate" value={loopPath ? formatPct(loopPath.liquidationRate, 1) : running ? '…' : '—'} helpKey="loopLiquidationRate" />
        </div>
        {loopPath && (
          <div className="border border-brix-border rounded p-2 bg-brix-card">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={loopPath.apyHistogram}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="bucketLo"
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v) => `${(Number(v) * 100).toFixed(0)}% – APY bucket`}
                  formatter={(c) => `${Number(c)} paths`}
                />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="p-4 rounded border border-brix-accent/40 bg-brix-accent/10">
        <div className="text-xs uppercase tracking-wide text-brix-accent mb-1">
          Merkl recommendation
        </div>
        <div className="text-sm">{merklText}</div>
      </div>
    </section>
  );
}
