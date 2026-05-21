import { priceToSqrtPriceX96, priceToTick } from './tickMath';
import { liquidityForAmounts } from './liquidityMath';
import { swapExactIn, type PoolState, type SwapQuote, type TickInfo } from './swap';
import type { PoolPreset } from '../poolPreset';

// Convert one position's USD value into (amount0, amount1) at spot, then derive L.
function positionLiquidity(
  spot: number,
  tickLower: number,
  tickUpper: number,
  liquidityUSD: number,
): bigint {
  const sqrtP = priceToSqrtPriceX96(spot);
  const sqrtA = priceToSqrtPriceX96(Math.pow(1.0001, tickLower));
  const sqrtB = priceToSqrtPriceX96(Math.pow(1.0001, tickUpper));
  // Naive split: half in each token at spot. (Position will rebalance via amountsForLiquidity.)
  // Token0 is wTRY (priced low in USDM), token1 is USDM.
  // amount0 (wTRY wei) ≈ (liquidityUSD/2) / spot in wei units (use 1e6 wei = $1 for sim units).
  const halfUSD = liquidityUSD / 2;
  const amount0 = BigInt(Math.floor((halfUSD / spot) * 1e6));
  const amount1 = BigInt(Math.floor(halfUSD * 1e6));
  return liquidityForAmounts(sqrtP, sqrtA, sqrtB, amount0, amount1);
}

export function materializePool(preset: PoolPreset, spot: number): PoolState {
  const ticks = new Map<number, TickInfo>();
  for (const pos of preset.positions) {
    const L = positionLiquidity(spot, pos.tickLower, pos.tickUpper, pos.liquidityUSD);
    const lo = ticks.get(pos.tickLower) ?? { liquidityNet: 0n };
    const hi = ticks.get(pos.tickUpper) ?? { liquidityNet: 0n };
    ticks.set(pos.tickLower, { liquidityNet: lo.liquidityNet + L });
    ticks.set(pos.tickUpper, { liquidityNet: hi.liquidityNet - L });
  }
  // Active liquidity at spot: sum L of positions whose range covers `spot`.
  const tickAtSpot = priceToTick(spot);
  let active = 0n;
  for (const pos of preset.positions) {
    if (pos.tickLower <= tickAtSpot && tickAtSpot < pos.tickUpper) {
      active += positionLiquidity(spot, pos.tickLower, pos.tickUpper, pos.liquidityUSD);
    }
  }
  return {
    sqrtPriceX96: priceToSqrtPriceX96(spot),
    tick: tickAtSpot,
    liquidity: active,
    feeBps: preset.feeTier / 100,
    tickSpacing: preset.tickSpacing,
    ticks,
  };
}

export function quoteLiquidatorSell(
  preset: PoolPreset,
  spot: number,
  wTRYAmount: bigint,
): SwapQuote {
  const pool = materializePool(preset, spot);
  return swapExactIn(pool, wTRYAmount, true /* zeroForOne: sell wTRY */).quote;
}
