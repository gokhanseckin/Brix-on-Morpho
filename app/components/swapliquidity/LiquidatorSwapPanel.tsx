'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildLadderFromInputs } from '@/lib/poolPreset';
import { quoteLiquidatorSell } from '@/lib/univ3/quoteLiquidatorSell';
import { Kpi } from '@/app/components/Kpi';
import { InfoTooltip } from '@/app/components/help/InfoTooltip';

const fmtUSD = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(3)}%`;

export function LiquidatorSwapPanel() {
  const [state, setState] = useUrlState();
  const sellUSD = state.swapSellUSD;
  const setSellUSD = (v: number) => setState({ swapSellUSD: v });
  const spot = 1 / state.usdtryBaseline;
  const preset = useMemo(
    () => buildLadderFromInputs(spot, state),
    [
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
    ],
  );
  const wTRYwei = BigInt(Math.floor((sellUSD / spot) * 1e6));
  const quote = useMemo(() => quoteLiquidatorSell(preset, spot, wTRYwei), [preset, spot, wTRYwei]);
  const usdmOut = Number(quote.amountOut) / 1e6;
  const feeUSD = Number(quote.feePaid) / 1e6 * spot;

  return (
    <section id="section-liquidator-swap" className="space-y-3">
      <h2 className="text-lg font-semibold">2. Liquidator swap</h2>
      <label className="block text-sm">
        <span>
          Sell size (USD): {fmtUSD(sellUSD)}
          <InfoTooltip text="USD-notional amount of wTRY the liquidator dumps into the AMM in a single swap. Slippage rises monotonically with this value — try moving the slider to feel the price-impact curve." />
        </span>
        <input
          type="range"
          min={5_000}
          max={Math.max(5_000_000, state.poolTVL_USD)}
          step={5_000}
          value={sellUSD}
          onChange={(e) => setSellUSD(parseFloat(e.target.value) || 0)}
          className="block w-full mt-1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="USDM received" value={fmtUSD(usdmOut)} helpKey="usdmReceived" />
        <Kpi label="Slippage" value={fmtPct(quote.slippagePct)} helpKey="slippagePctKpi" />
        <Kpi label="Effective price" value={quote.avgPrice.toFixed(6)} helpKey="effectivePrice" />
        <Kpi label="Fee paid" value={fmtUSD(feeUSD)} helpKey="feePaidUSD" />
        <div className="col-span-2">
          <Kpi label="Ticks crossed" value={String(quote.ticksCrossed)} helpKey="ticksCrossed" />
        </div>
      </div>
    </section>
  );
}
