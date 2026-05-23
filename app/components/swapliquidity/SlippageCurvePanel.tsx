'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildLadderFromInputs } from '@/lib/poolPreset';
import { quoteLiquidatorSell } from '@/lib/univ3/quoteLiquidatorSell';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { InfoTooltip } from '@/app/components/help/InfoTooltip';

const fmtUSD = (n: number) =>
  n >= 1e6
    ? `$${(n / 1e6).toFixed(2)}M`
    : n >= 1e3
      ? `$${(n / 1e3).toFixed(0)}k`
      : `$${n.toFixed(0)}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

export function SlippageCurvePanel() {
  const [state] = useUrlState();
  const spot = 1 / state.usdtryBaseline;

  const { data, breakeven1pct } = useMemo(() => {
    const preset = buildLadderFromInputs(spot, state);
    const pts: Array<{ sell: number; priceSlip: number; effective: number }> = [];
    // Log sweep from $1k to max($5M, 5× pool TVL) so we see both the flat
    // small-trade regime and the steep tail.
    const lo = Math.log10(1_000);
    const hi = Math.log10(Math.max(5_000_000, state.poolTVL_USD * 5));
    const steps = 70;
    let b1: number | null = null;
    for (let i = 0; i < steps; i++) {
      const sellUSD = Math.pow(10, lo + ((hi - lo) * i) / (steps - 1));
      const wTRYwei = BigInt(Math.floor((sellUSD / spot) * 1e6));
      const q = quoteLiquidatorSell(preset, spot, wTRYwei);
      const usdmOut = Number(q.amountOut) / 1e6;
      // Effective slippage = total proceeds shortfall (includes fee + price impact).
      const effective = Math.max(0, Math.min(1, 1 - usdmOut / sellUSD));
      pts.push({ sell: sellUSD, priceSlip: q.slippagePct, effective });
      if (b1 == null && effective >= 0.01) b1 = sellUSD;
    }
    return { data: pts, breakeven1pct: b1 };
  }, [
    spot,
    state.poolTVL_USD,
    state.bandSplitCore,
    state.bandSplitAbsorb,
    state.poolFeeTier,
    state.bandCoreLowerPct,
    state.bandCoreUpperPct,
    state.bandAbsorbLowerPct,
    state.bandAbsorbUpperPct,
    state.bandTailLowerPct,
    state.bandTailUpperPct,
  ]);

  return (
    <section id="section-slippage-curve" className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-1">
        <span>2. Slippage curve</span>
        <InfoTooltip text="Slippage as a function of single-trade sell size against the current ladder. Two curves: marginal price slip (end-of-trade price impact) and effective proceeds shortfall (1 − amountOut/sellUSD, includes fee). Effective is what hits the trader's wallet. Liquidator-specific thresholds (LIF buffer) are shown in Section 4 where the swap is tied to seized collateral." />
      </h2>
      <p className="text-xs text-neutral-500 max-w-2xl">
        Sweep of slippage vs. trade size on the current ladder. The green line marks the 1% LP
        service target. This chart shows pure AMM behavior — no liquidation context. Whether a
        given slippage causes bad debt depends on the swap being a seized-collateral dump
        (see Section 4). Y-axis capped at 10% to focus on the actionable range.
      </p>
      <div className="border border-brix-border rounded p-2 bg-brix-card">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 40, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="sell"
              type="number"
              scale="log"
              domain={['auto', 'auto']}
              tickFormatter={fmtUSD}
            />
            <YAxis
              domain={[0, 0.1]}
              tickFormatter={(v: number) => fmtPct(v)}
              allowDataOverflow
            />
            <Tooltip
              formatter={(v) => fmtPct(Number(v))}
              labelFormatter={(label) => `sell ${fmtUSD(Number(label))}`}
              cursor={{ stroke: 'rgba(255,255,255,0.25)' }}
              contentStyle={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #262626',
                borderRadius: 4,
                fontSize: 12,
              }}
              labelStyle={{ color: '#a3a3a3' }}
              itemStyle={{ color: '#e5e5e5' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
            <ReferenceLine
              y={0.01}
              stroke="#10b981"
              strokeDasharray="3 3"
              label={{
                value: '1% target',
                position: 'right',
                fill: '#10b981',
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="effective"
              stroke="#a855f7"
              dot={false}
              strokeWidth={2}
              name="effective (fee + price)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="priceSlip"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              name="price slip only"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 gap-3 text-xs">
        <div className="p-3 border border-brix-border rounded bg-brix-card">
          <div className="text-neutral-500 uppercase tracking-wide text-[10px]">
            Max sell at 1% effective slippage
          </div>
          <div className="text-base font-mono mt-1 text-emerald-300">
            {breakeven1pct ? fmtUSD(breakeven1pct) : '> sweep max'}
          </div>
        </div>
      </div>
    </section>
  );
}
