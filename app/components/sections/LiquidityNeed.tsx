'use client';
import { useSimulator } from '@/lib/useSimulator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Kpi, formatUSD, formatPct } from '../Kpi';
import { HelpPopover } from '../help/HelpPopover';

export function LiquidityNeed() {
  const { liquidity, inputs } = useSimulator();
  return (
    <section id="section-liquidity-need" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">1. USDM Liquidity Need</h2>
        <p className="text-sm text-neutral-500 mt-1">
          How much USDM the vault must hold to satisfy expected borrow demand at the configured
          target utilization, given a Beta-distributed borrower LTV profile.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Liquidity Floor"
          value={formatUSD(liquidity.liquidityFloor_USD)}
          hint="20% of required, or dead-deposit cost"
          helpKey="liquidityFloor"
        />
        <Kpi
          label="Required (steady-state)"
          value={formatUSD(liquidity.requiredUSDM)}
          hint={`TVL × LLTV × E[LTV] / u_target`}
          helpKey="requiredUSDM"
        />
        <Kpi
          label="Required + Buffer"
          value={formatUSD(liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD)}
          hint={`Buffer ${formatPct(liquidity.bufferPct, 1)}`}
          helpKey="requiredPlusBuffer"
        />
      </div>

      <div>
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-sm font-semibold">
            Borrow APY curve (AdaptiveCurveIRM, target u = {formatPct(inputs.targetUtilization, 0)})
          </h3>
          <HelpPopover chartKey="irmCurve" />
        </div>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded p-2 bg-white dark:bg-neutral-950">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={liquidity.irmCurve} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="u"
                tickFormatter={(x: number) => `${Math.round(x * 100)}%`}
                label={{ value: 'utilization', position: 'insideBottom', offset: -2 }}
              />
              <YAxis tickFormatter={(x: number) => `${(x * 100).toFixed(1)}%`} />
              <Tooltip
                formatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
                labelFormatter={(u) => `u = ${(Number(u) * 100).toFixed(0)}%`}
              />
              <ReferenceLine
                x={inputs.targetUtilization}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: 'target', fill: '#ef4444', fontSize: 11, position: 'top' }}
              />
              <Line type="monotone" dataKey="r" stroke="#3b82f6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-sm font-semibold">Sensitivity: required USDM by LLTV</h3>
          <HelpPopover kpiKey="lltvSensitivity" />
        </div>
        <table className="text-sm border-collapse w-full max-w-md">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <th className="text-left py-1">LLTV</th>
              <th className="text-right py-1">Required USDM</th>
            </tr>
          </thead>
          <tbody>
            {liquidity.sensitivity.map((r) => (
              <tr
                key={r.lltv}
                className={
                  r.lltv === inputs.lltv
                    ? 'bg-blue-50 dark:bg-blue-950/40 font-medium'
                    : 'border-b border-neutral-100 dark:border-neutral-900'
                }
              >
                <td className="py-1">{(r.lltv * 100).toFixed(1)}%</td>
                <td className="py-1 text-right tabular-nums">
                  {formatUSD(r.requiredUSDM)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
