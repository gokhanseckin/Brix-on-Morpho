'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildLadderFromInputs } from '@/lib/poolPreset';
import { materializePool } from '@/lib/univ3/quoteLiquidatorSell';
import { sqrtPriceX96ToPrice, tickToPrice } from '@/lib/univ3/tickMath';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Kpi } from '@/app/components/Kpi';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmt6 = (n: number) => n.toFixed(6);

export function PoolStatePanel() {
  const [state] = useUrlState();
  const {
    usdtryBaseline,
    poolTVL_USD,
    bandSplitCore,
    bandSplitAbsorb,
    poolFeeTier,
    bandCoreLowerPct,
    bandCoreUpperPct,
    bandAbsorbLowerPct,
    bandAbsorbUpperPct,
    bandTailLowerPct,
    bandTailUpperPct,
  } = state;
  const spot = useMemo(
    () => usdtryBaseline > 0 ? 1 / usdtryBaseline : 0,
    [usdtryBaseline],
  );
  const preset = useMemo(
    () => buildLadderFromInputs(spot, {
      poolTVL_USD,
      bandSplitCore,
      bandSplitAbsorb,
      poolFeeTier,
      bandCoreLowerPct,
      bandCoreUpperPct,
      bandAbsorbLowerPct,
      bandAbsorbUpperPct,
      bandTailLowerPct,
      bandTailUpperPct,
    }),
    [
      spot,
      poolTVL_USD,
      bandSplitCore,
      bandSplitAbsorb,
      poolFeeTier,
      bandCoreLowerPct,
      bandCoreUpperPct,
      bandAbsorbLowerPct,
      bandAbsorbUpperPct,
      bandTailLowerPct,
      bandTailUpperPct,
    ],
  );
  const pool = useMemo(() => materializePool(preset, spot), [preset, spot]);
  const spotPrice = useMemo(() => sqrtPriceX96ToPrice(pool.sqrtPriceX96), [pool.sqrtPriceX96]);
  const ticksChart = useMemo(() => {
    const arr = [...pool.ticks.entries()].map(([t, info]) => ({
      price: tickToPrice(t),
      liquidityNet: Number(info.liquidityNet) / 1e12,
    }));
    // Insert a zero-height synthetic point at spot so the category axis has a
    // bucket the spot ReferenceLine can lock onto (Recharts category axis
    // silently drops ReferenceLines that don't match a known tick).
    if (!arr.some((p) => Math.abs(p.price - spotPrice) < 1e-12)) {
      arr.push({ price: spotPrice, liquidityNet: 0 });
    }
    arr.sort((a, b) => a.price - b.price);
    return arr;
  }, [pool, spotPrice]);

  return (
    <section id="section-pool-state" className="space-y-3">
      <h2 className="text-lg font-semibold">1. Pool state</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Spot wTRY/USDM"
          value={fmt6(spotPrice)}
          helpKey="spotWtryUsdm"
        />
        <Kpi
          label="Active liquidity L (Uniswap units / 1e12)"
          value={(Number(pool.liquidity) / 1e12).toFixed(2)}
          helpKey="activeLiquidityScaled"
        />
        <Kpi
          label="Fee tier"
          value={`${(pool.feeBps / 100).toFixed(2)}%`}
          helpKey="poolFeeTierKpi"
        />
      </div>
      <div className="border rounded p-2">
        <div className="flex items-center text-xs text-neutral-500 px-2 pt-1">
          <span>Liquidity by tick</span>
          <HelpPopover chartKey="liquidityByTick" />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ticksChart}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="price" tickFormatter={fmt6} />
            <YAxis />
            <Tooltip
              formatter={(v) => Number(v).toFixed(2)}
              cursor={{ fill: 'rgba(255,255,255,0.06)' }}
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, fontSize: 12 }}
              labelStyle={{ color: '#a3a3a3' }}
              itemStyle={{ color: '#e5e5e5' }}
            />
            <Bar dataKey="liquidityNet" fill="#3b82f6" />
            <ReferenceLine
              x={spotPrice}
              stroke="#facc15"
              strokeWidth={2}
              ifOverflow="extendDomain"
              label={{
                value: `spot ${fmt6(spotPrice)}`,
                position: 'top',
                fill: '#facc15',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="flex items-center text-xs text-neutral-500">
          <span>Band allocation</span>
          <HelpPopover chartKey="bandAllocationTable" />
        </div>
        <table className="text-xs w-full mt-1">
          <thead><tr><th className="text-left">Band</th><th className="text-left">Range</th><th className="text-left">USD</th></tr></thead>
          <tbody>
            {preset.positions.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td>{fmt6(tickToPrice(p.tickLower))} → {fmt6(tickToPrice(p.tickUpper))}</td>
                <td>{fmtUSD(p.liquidityUSD)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
