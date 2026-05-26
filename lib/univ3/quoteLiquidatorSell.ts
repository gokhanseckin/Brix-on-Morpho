import { priceToSqrtPriceX96, priceToTick } from './tickMath';
import { amountsForLiquidity } from './liquidityMath';
import { swapExactIn, type PoolState, type SwapQuote, type TickInfo } from './swap';
import type { PoolPreset } from '../poolPreset';

const TOKEN_SCALE = 1e6;
const REFERENCE_LIQUIDITY = 10n ** 24n;

// Size a position so its launch-spot marked token amounts equal its stated
// USD allocation. Out-of-range bands naturally resolve to one-sided funding.
function positionLiquidity(
  spot: number,
  tickLower: number,
  tickUpper: number,
  liquidityUSD: number,
): bigint {
  const sqrtP = priceToSqrtPriceX96(spot);
  const sqrtA = priceToSqrtPriceX96(Math.pow(1.0001, tickLower));
  const sqrtB = priceToSqrtPriceX96(Math.pow(1.0001, tickUpper));
  const referenceAmounts = amountsForLiquidity(sqrtP, sqrtA, sqrtB, REFERENCE_LIQUIDITY);
  const referenceUSD =
    (Number(referenceAmounts.amount0) * spot + Number(referenceAmounts.amount1)) /
    TOKEN_SCALE;
  if (!Number.isFinite(referenceUSD) || referenceUSD <= 0 || liquidityUSD <= 0) return 0n;
  return BigInt(Math.floor(Number(REFERENCE_LIQUIDITY) * (liquidityUSD / referenceUSD)));
}

export function materializedPositionValueUSD(
  position: PoolPreset['positions'][number],
  spot: number,
): number {
  const sqrtP = priceToSqrtPriceX96(spot);
  const sqrtA = priceToSqrtPriceX96(Math.pow(1.0001, position.tickLower));
  const sqrtB = priceToSqrtPriceX96(Math.pow(1.0001, position.tickUpper));
  const amounts = amountsForLiquidity(
    sqrtP,
    sqrtA,
    sqrtB,
    positionLiquidity(spot, position.tickLower, position.tickUpper, position.liquidityUSD),
  );
  return (Number(amounts.amount0) * spot + Number(amounts.amount1)) / TOKEN_SCALE;
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
