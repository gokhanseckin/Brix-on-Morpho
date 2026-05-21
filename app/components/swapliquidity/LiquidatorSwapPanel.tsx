'use client';
import { useMemo, useState } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildAsymmetricLadder } from '@/lib/poolPreset';
import { quoteLiquidatorSell } from '@/lib/univ3/quoteLiquidatorSell';

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(3)}%`;

export function LiquidatorSwapPanel() {
  const [state] = useUrlState();
  const [sellUSD, setSellUSD] = useState(1_000_000);
  const spot = 1 / state.usdtryBaseline;
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
  const wTRYwei = BigInt(Math.floor((sellUSD / spot) * 1e6));
  const quote = useMemo(() => quoteLiquidatorSell(preset, spot, wTRYwei), [preset, spot, wTRYwei]);
  const usdmOut = Number(quote.amountOut) / 1e6;
  const feeUSD = Number(quote.feePaid) / 1e6 * spot;

  return (
    <section id="section-liquidator-swap" className="space-y-3">
      <h2 className="text-lg font-semibold">2. Liquidator swap</h2>
      <label className="block text-sm">
        Sell size (USD): {fmtUSD(sellUSD)}
        <input
          type="range"
          min={50_000}
          max={Math.max(5_000_000, state.poolTVL_USD)}
          step={50_000}
          value={sellUSD}
          onChange={(e) => setSellUSD(parseFloat(e.target.value))}
          className="block w-full mt-1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 border rounded">
          <div className="text-xs text-neutral-500">USDM received</div>
          <div className="text-lg font-semibold">{fmtUSD(usdmOut)}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-neutral-500">Slippage</div>
          <div className="text-lg font-semibold">{fmtPct(quote.slippagePct)}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-neutral-500">Effective price</div>
          <div className="text-lg font-semibold">{quote.avgPrice.toFixed(6)}</div>
        </div>
        <div className="p-3 border rounded">
          <div className="text-xs text-neutral-500">Fee paid</div>
          <div className="text-lg font-semibold">{fmtUSD(feeUSD)}</div>
        </div>
        <div className="p-3 border rounded col-span-2">
          <div className="text-xs text-neutral-500">Ticks crossed</div>
          <div className="text-lg font-semibold">{quote.ticksCrossed}</div>
        </div>
      </div>
    </section>
  );
}
