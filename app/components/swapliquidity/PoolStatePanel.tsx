'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildAsymmetricLadder } from '@/lib/poolPreset';
import { materializePool } from '@/lib/univ3/quoteLiquidatorSell';
import { sqrtPriceX96ToPrice, tickToPrice } from '@/lib/univ3/tickMath';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Kpi } from '@/app/components/Kpi';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmt6 = (n: number) => n.toFixed(6);

export function PoolStatePanel() {
  const [state] = useUrlState();
  const spot = useMemo(
    () => state.usdtryBaseline > 0 ? 1 / state.usdtryBaseline : 0,
    [state.usdtryBaseline],
  );
  const preset = useMemo(
    () =>
      buildAsymmetricLadder(
        spot,
        state.poolTVL_USD,
        {
          core: state.bandSplitCore,
          absorb: state.bandSplitAbsorb,
          tail: Math.max(0, 1 - state.bandSplitCore - state.bandSplitAbsorb),
        },
        state.poolFeeTier === 10000 ? 10000 : 3000,
      ),
    [spot, state.poolTVL_USD, state.bandSplitCore, state.bandSplitAbsorb, state.poolFeeTier],
  );
  const pool = useMemo(() => materializePool(preset, spot), [preset, spot]);
  const ticksChart = useMemo(() => {
    const arr = [...pool.ticks.entries()].map(([t, info]) => ({
      price: tickToPrice(t),
      liquidityNet: Number(info.liquidityNet) / 1e12,
    }));
    arr.sort((a, b) => a.price - b.price);
    return arr;
  }, [pool]);

  return (
    <section id="section-pool-state" className="space-y-3">
      <h2 className="text-lg font-semibold">1. Pool state</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Spot wTRY/USDM"
          value={fmt6(sqrtPriceX96ToPrice(pool.sqrtPriceX96))}
          helpKey="spotWtryUsdm"
        />
        <Kpi
          label="Active liquidity (scaled)"
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
            <Tooltip formatter={(v) => Number(v).toFixed(2)} />
            <Bar dataKey="liquidityNet" fill="#3b82f6" />
            <ReferenceLine x={sqrtPriceX96ToPrice(pool.sqrtPriceX96)} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'spot', position: 'top', fill: '#ef4444', fontSize: 11 }} />
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
