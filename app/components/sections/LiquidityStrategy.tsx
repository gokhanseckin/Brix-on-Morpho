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
} from 'recharts';
import { useMemo } from 'react';
import { Kpi, formatPct, formatUSD } from '../Kpi';
import { HelpPopover } from '../help/HelpPopover';

const COMPETING_BENCHMARKS: Array<{ name: string; apy: number }> = [
  { name: 'Aave USDC', apy: 0.055 },
  { name: 'Morpho USDC vaults', apy: 0.065 },
];

export function LiquidityStrategy() {
  const { strategy, inputs } = useSimulator();

  const apyComparison = useMemo(
    () => [
      { name: 'Brix net', apy: strategy.netSupplyAPY },
      { name: 'Brix + incentives', apy: strategy.totalSupplyAPY },
      ...COMPETING_BENCHMARKS,
    ],
    [strategy.netSupplyAPY, strategy.totalSupplyAPY],
  );

  // Stacked horizontal bar: base + supply incentive
  const supplyComponents: Array<{ component: string; value: number; pct: number }> = [
    { component: 'Net base APY', value: strategy.netSupplyAPY, pct: strategy.netSupplyAPY },
    { component: 'Supply incentives', value: strategy.supplyIncentiveAPY, pct: strategy.supplyIncentiveAPY },
  ];

  // Borrower-side stack: gross borrow − borrower incentives = net borrow
  const borrowComponents: Array<{ component: string; value: number; pct: number }> = [
    { component: 'Borrow APY', value: strategy.borrowAPY, pct: strategy.borrowAPY },
    { component: 'Borrower incentives', value: -strategy.borrowerIncentiveAPY, pct: -strategy.borrowerIncentiveAPY },
  ];

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
  }, [strategy, inputs.supplyIncentiveBudgetMonthly_USD, inputs.borrowerIncentiveBudgetMonthly_USD]);

  return (
    <section id="section-liquidity-strategy" className="space-y-6">
      <div>
        <div className="brix-kicker mb-2">03 · Strategy</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Liquidity Strategy</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Supplier yield, borrower leverage-loop viability, and supply/borrower incentive APYs.
        </p>
      </div>

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

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Gross borrow APY" value={formatPct(strategy.borrowAPY, 2)} helpKey="borrowAPY" />
        <Kpi
          label="Borrower incentive APY"
          value={formatPct(strategy.borrowerIncentiveAPY, 2)}
          hint={`${formatUSD(inputs.borrowerIncentiveBudgetMonthly_USD)}/mo`}
          helpKey="borrowerIncentiveAPY"
        />
        <Kpi
          label="Net borrow APY"
          value={formatPct(strategy.netBorrowAPY, 2)}
          hint={strategy.netBorrowAPY < 0 ? 'paid to borrow' : 'post-incentive'}
          {...(strategy.netBorrowAPY < 0 ? { tone: 'good' as const } : {})}
          helpKey="netBorrowAPY"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Supply APY composition</h3>
          <div className="border border-brix-border rounded p-2 bg-brix-card">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart layout="vertical" data={supplyComponents} margin={{ left: 110 }}>
                <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <YAxis type="category" dataKey="component" />
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
                <Bar dataKey="pct" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Borrow APY composition</h3>
          <div className="border border-brix-border rounded p-2 bg-brix-card">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart layout="vertical" data={borrowComponents} margin={{ left: 110 }}>
                <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <YAxis type="category" dataKey="component" />
                <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
                <Bar dataKey="pct" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Net borrow = gross − borrower incentives. Negative net = borrowers paid (incentive APY {'>'} borrow APY).
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Borrow / leverage-loop viability
          </h3>
          <div
            className={`p-4 rounded border ${
              strategy.leverageLoopsViable
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-red-500 bg-red-50 dark:bg-red-950/30'
            }`}
          >
            <div className="text-2xl font-semibold">
              {strategy.leverageLoopsViable ? 'Viable' : 'Not viable'}
            </div>
            <div className="text-sm mt-1">
              Loop APY = wiTRY yield − borrow × (1 + TRY depreciation) ={' '}
              {formatPct(strategy.leverageLoopAPY, 2)}
            </div>
            <div className="text-xs text-neutral-500 mt-2">
              Assumes 30% annual TRY depreciation; wiTRY yield {formatPct(inputs.witryYieldAnnual, 0)}.
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 mb-2">
            <h3 className="text-sm font-semibold">Competitive benchmark</h3>
            <HelpPopover chartKey="competitiveBenchmark" />
          </div>
          <div className="border border-brix-border rounded p-2 bg-brix-card">
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
