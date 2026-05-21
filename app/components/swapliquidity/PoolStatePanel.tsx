'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildAsymmetricLadder } from '@/lib/poolPreset';
import { materializePool } from '@/lib/univ3/quoteLiquidatorSell';
import { sqrtPriceX96ToPrice, tickToPrice } from '@/lib/univ3/tickMath';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmt6 = (n: number) => n.toFixed(6);

export function PoolStatePanel() {
  const [state] = useUrlState();
  const spot = useMemo(
    () => state.witryYieldAnnual && state.usdtryBaseline
      ? (1 + state.witryYieldAnnual * 0) / state.usdtryBaseline
      : 1 / state.usdtryBaseline,
    [state.witryYieldAnnual, state.usdtryBaseline],
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
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="p-3 border rounded">
          <div className="text-xs text-neutral-500">Spot wTRY/USDM</div>
          <div className="text-lg font-semibold">{fmt6(sqrtPriceX96ToPrice(pool.sqrtPriceX96))}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-neutral-500">Active liquidity (scaled)</div>
          <div className="text-lg font-semibold">{(Number(pool.liquidity) / 1e12).toFixed(2)}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-neutral-500">Fee tier</div>
          <div className="text-lg font-semibold">{(pool.feeBps / 100).toFixed(2)}%</div>
        </div>
      </div>
      <div className="border rounded p-2">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={ticksChart}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="price" tickFormatter={fmt6} />
            <YAxis />
            <Tooltip formatter={(v) => Number(v).toFixed(2)} />
            <Bar dataKey="liquidityNet" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="text-xs w-full">
        <thead><tr><th className="text-left">Band</th><th>Range</th><th>USD</th></tr></thead>
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
    </section>
  );
}
