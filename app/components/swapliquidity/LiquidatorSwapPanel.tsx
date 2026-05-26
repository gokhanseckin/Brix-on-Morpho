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
    swapSellUSD: sellUSD,
  } = state;
  const setSellUSD = (v: number) => setState({ swapSellUSD: v });
  const spot = 1 / usdtryBaseline;
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
  const wTRYwei = BigInt(Math.floor((sellUSD / spot) * 1e6));
  const quote = useMemo(() => quoteLiquidatorSell(preset, spot, wTRYwei), [preset, spot, wTRYwei]);
  const usdmOut = Number(quote.amountOut) / 1e6;
  const feeUSD = Number(quote.feePaid) / 1e6 * spot;
  // Effective slip = total proceeds shortfall (includes fee + integrated price
  // impact). This is the number that determines liquidator P&L vs. the LIF
  // buffer (1 − 1/LIF ≈ 4.20% at LLTV 86%) when the swap is a seized-collateral
  // dump. Marginal price slip from quote.slippagePct is just the end-of-trade
  // price impact — useful for context but not the P&L number.
  const effectiveSlip = sellUSD > 0 ? Math.max(0, 1 - usdmOut / sellUSD) : 0;

  return (
    <section id="section-liquidator-swap" className="space-y-3">
      <h2 className="text-lg font-semibold">3. Liquidator swap probe</h2>
      <label className="block text-sm">
        <span>
          Requested seized-wTRY probe (USD): {fmtUSD(sellUSD)}
          <InfoTooltip text="Scenario input: USD-notional wTRY requested in one modeled sale. If represented pool liquidity is exhausted, the quote assigns no proceeds to the unfilled remainder." />
        </span>
        <input
          type="range"
          min={5_000}
          max={Math.max(5_000_000, poolTVL_USD)}
          step={5_000}
          value={sellUSD}
          onChange={(e) => setSellUSD(parseFloat(e.target.value) || 0)}
          className="block w-full mt-1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="USDM received" value={fmtUSD(usdmOut)} helpKey="usdmReceived" />
        <Kpi
          label="Effective slip (fee + impact)"
          value={fmtPct(effectiveSlip)}
          helpKey="effectiveSlip"
          hint="1 − amountOut / sellUSD. Compare against bufferPct = 1 − 1/LIF (≈4.20% at LLTV 86%) only if this swap is a seized-collateral dump."
        />
        <Kpi label="Marginal price slip" value={fmtPct(quote.slippagePct)} helpKey="slippagePctKpi" />
        <Kpi label="Average fill price" value={quote.avgPrice.toFixed(6)} helpKey="effectivePrice" />
        <Kpi label="Fee on filled input" value={fmtUSD(feeUSD)} helpKey="feePaidUSD" />
        <Kpi label="Ticks crossed" value={String(quote.ticksCrossed)} helpKey="ticksCrossed" />
      </div>
    </section>
  );
}
