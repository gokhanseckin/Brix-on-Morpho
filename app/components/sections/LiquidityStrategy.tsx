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
  Legend,
} from 'recharts';
import { useMemo } from 'react';
import { Kpi, formatPct, formatUSD } from '../Kpi';

const COMPETING_BENCHMARKS: Array<{ name: string; apy: number }> = [
  { name: 'Aave USDC', apy: 0.055 },
  { name: 'Morpho USDC vaults', apy: 0.065 },
];

export function LiquidityStrategy() {
  const { strategy, inputs, liquidity } = useSimulator();

  const rampData = useMemo(() => {
    const days = Math.min(90, isFinite(strategy.daysToTarget) ? strategy.daysToTarget : 90);
    const n = Math.max(2, Math.ceil(days));
    const arr: Array<{ day: number; tvl: number }> = [];
    for (let t = 0; t <= n; t++) {
      const tvl = inputs.attractionRate * inputs.incentiveBudgetMonthly_USD * (t / 30);
      arr.push({ day: t, tvl });
    }
    return arr;
  }, [strategy.daysToTarget, inputs.attractionRate, inputs.incentiveBudgetMonthly_USD]);

  const apyComparison = useMemo(
    () => [
      { name: 'Brix net', apy: strategy.netSupplyAPY },
      { name: 'Brix + incentives', apy: strategy.totalSupplyAPY },
      ...COMPETING_BENCHMARKS,
    ],
    [strategy.netSupplyAPY, strategy.totalSupplyAPY],
  );

  // Stacked horizontal bar: base + incentive
  const supplyComponents: Array<{ component: string; value: number; pct: number }> = [
    { component: 'Net base APY', value: strategy.netSupplyAPY, pct: strategy.netSupplyAPY },
    { component: 'Incentives', value: strategy.incentiveAPY, pct: strategy.incentiveAPY },
  ];

  // Lock & Earn: lockPremium = base × (1 + 0.005 × lockPeriodDays)
  const lockPremiums = [30, 60, 90, 180].map((d) => ({
    days: d,
    premiumAPY: strategy.totalSupplyAPY * (1 + 0.005 * d),
  }));

  const merklText = useMemo(() => {
    const days =
      strategy.daysToTarget && isFinite(strategy.daysToTarget)
        ? `${strategy.daysToTarget.toFixed(0)} days`
        : 'unbounded';
    return `Deploy a Merkl campaign at $${(
      inputs.incentiveBudgetMonthly_USD / 1000
    ).toFixed(0)}k/month with attraction rate ${inputs.attractionRate.toFixed(
      1,
    )}×. At this rate, expected time to reach target USDM (${formatUSD(
      liquidity.requiredUSDM,
    )}) is ${days}, with total incentive spend of ${formatUSD(
      strategy.totalIncentiveSpend_USD,
    )}. Net supply APY (post-fee, pre-incentive) is ${formatPct(
      strategy.netSupplyAPY,
      2,
    )}; with incentives layered on, suppliers see ${formatPct(
      strategy.totalSupplyAPY,
      2,
    )}. When incentives end, retention estimate is ${formatUSD(
      strategy.retentionAfterIncentivesEnd_USD,
    )}.`;
  }, [strategy, inputs.incentiveBudgetMonthly_USD, inputs.attractionRate, liquidity.requiredUSDM]);

  return (
    <section id="section-liquidity-strategy" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">3. Liquidity Strategy</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Supplier yield, borrower leverage-loop viability, and a Merkl incentive plan to reach
          target USDM.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Gross supply APY" value={formatPct(strategy.grossSupplyAPY, 2)} />
        <Kpi label="Net supply APY" value={formatPct(strategy.netSupplyAPY, 2)} hint="post-fees" />
        <Kpi
          label="Incentive APY"
          value={formatPct(strategy.incentiveAPY, 2)}
          hint={`${formatUSD(inputs.incentiveBudgetMonthly_USD)}/mo`}
        />
        <Kpi
          label="Total supply APY"
          value={formatPct(strategy.totalSupplyAPY, 2)}
          tone="good"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Supply APY composition</h3>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
          <ResponsiveContainer width="100%" height={120}>
            <BarChart layout="vertical" data={supplyComponents} margin={{ left: 100 }}>
              <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
              <YAxis type="category" dataKey="component" />
              <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`} />
              <Bar dataKey="pct" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
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
              Loop APY = iTRY yield − borrow × (1 + TRY depreciation) ={' '}
              {formatPct(strategy.leverageLoopAPY, 2)}
            </div>
            <div className="text-xs text-neutral-500 mt-2">
              Assumes 30% annual TRY depreciation; iTRY yield {formatPct(inputs.iTRYYieldAnnual, 0)}.
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Competitive benchmark</h3>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
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

      <div>
        <h3 className="text-sm font-semibold mb-2">
          TVL ramp at {inputs.attractionRate.toFixed(1)}× attraction (linear projection)
        </h3>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rampData} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" label={{ value: 'day', position: 'insideBottom', offset: -2 }} />
              <YAxis tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatUSD(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="tvl" stroke="#3b82f6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          Days to target: {isFinite(strategy.daysToTarget) ? strategy.daysToTarget.toFixed(0) : '∞'}.
          Total spend at target: {formatUSD(strategy.totalIncentiveSpend_USD)}.
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Lock &amp; Earn — required premium by lock</h3>
        <table className="text-sm border-collapse w-full max-w-md">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <th className="text-left py-1">Lock days</th>
              <th className="text-right py-1">Premium APY</th>
            </tr>
          </thead>
          <tbody>
            {lockPremiums.map((r) => (
              <tr
                key={r.days}
                className={
                  r.days === inputs.lockPeriodDays
                    ? 'bg-blue-50 dark:bg-blue-950/40 font-medium'
                    : 'border-b border-neutral-100 dark:border-neutral-900'
                }
              >
                <td className="py-1">{r.days}d</td>
                <td className="py-1 text-right tabular-nums">{formatPct(r.premiumAPY, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-xs text-neutral-500 mt-1">
          Heuristic: premium = total supply APY × (1 + 0.005 × lockDays). Replace with calibrated
          curve once illiquidity-preference data is available.
        </div>
      </div>

      <div className="p-4 rounded border border-blue-500/50 bg-blue-50 dark:bg-blue-950/30">
        <div className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
          Merkl recommendation
        </div>
        <div className="text-sm">{merklText}</div>
      </div>
    </section>
  );
}
