// lib/univ3/swap.ts
// Uniswap v3 exact-in swap walker. Reference: whitepaper §6.3 + Uniswap v3-core SwapMath.sol.
import { priceToSqrtPriceX96, priceToTick, sqrtPriceX96ToPrice } from './tickMath';
import { liquidityForAmounts, amountsForLiquidity } from './liquidityMath';

const Q96 = 2n ** 96n;

export interface TickInfo {
  liquidityNet: bigint;
}

export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  feeBps: number;         // e.g. 30 for 0.30%
  tickSpacing: number;    // 60 or 200
  ticks: Map<number, TickInfo>;
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  feePaid: bigint;
  avgPrice: number;
  slippagePct: number;
  finalSqrtPriceX96: bigint;
  ticksCrossed: number;
}

// Helper to build a single-range pool from token amounts. Useful for tests and the page UI.
export function makeSingleRangePool(args: {
  spot: number;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
  feeBps: number;
  tickSpacing: number;
}): PoolState {
  const sqrtP = priceToSqrtPriceX96(args.spot);
  const sqrtA = priceToSqrtPriceX96(Math.pow(1.0001, args.tickLower));
  const sqrtB = priceToSqrtPriceX96(Math.pow(1.0001, args.tickUpper));
  const L = liquidityForAmounts(sqrtP, sqrtA, sqrtB, args.amount0, args.amount1);
  const ticks = new Map<number, TickInfo>();
  ticks.set(args.tickLower, { liquidityNet: L });
  ticks.set(args.tickUpper, { liquidityNet: -L });
  return {
    sqrtPriceX96: sqrtP,
    tick: priceToTick(args.spot),
    liquidity: L,
    feeBps: args.feeBps,
    tickSpacing: args.tickSpacing,
    ticks,
  };
}

// Compute the next initialized tick on either side of `tick`.
function nextInitializedTick(
  ticks: Map<number, TickInfo>,
  tick: number,
  zeroForOne: boolean,
): number | null {
  const keys = [...ticks.keys()].sort((a, b) => a - b);
  if (zeroForOne) {
    // moving price DOWN; find largest initialized tick < current
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i]!;
      if (k < tick) return k;
    }
    return null;
  } else {
    // moving price UP; find smallest initialized tick >= current
    for (const k of keys) {
      if (k >= tick) return k;
    }
    return null;
  }
}

// Compute swap-within-step using constant-product on active liquidity.
// Returns the post-step sqrtPrice, input consumed, output produced (gross of fee).
function computeSwapStep(
  sqrtP: bigint,
  sqrtTarget: bigint,
  L: bigint,
  amountInRemaining: bigint,
  zeroForOne: boolean,
): { sqrtPNext: bigint; amountIn: bigint; amountOut: bigint } {
  // Max input to reach target (covers entire step):
  // zeroForOne (sell token0):  ΔX = L * (sqrtP - sqrtTarget) / (sqrtP * sqrtTarget) * Q96
  // !zeroForOne (sell token1): ΔY = L * (sqrtTarget - sqrtP) / Q96
  let maxIn: bigint;
  if (zeroForOne) {
    maxIn = (L * Q96 * (sqrtP - sqrtTarget)) / (sqrtP * sqrtTarget);
  } else {
    maxIn = (L * (sqrtTarget - sqrtP)) / Q96;
  }
  let sqrtPNext: bigint;
  let amountIn: bigint;
  if (amountInRemaining >= maxIn) {
    sqrtPNext = sqrtTarget;
    amountIn = maxIn;
  } else {
    // partial step: derive sqrtPNext from remaining input
    amountIn = amountInRemaining;
    if (zeroForOne) {
      // sqrtPNext = (L * sqrtP * Q96) / (L * Q96 + amountIn * sqrtP)
      sqrtPNext = (L * sqrtP * Q96) / (L * Q96 + amountIn * sqrtP);
    } else {
      // sqrtPNext = sqrtP + amountIn * Q96 / L
      sqrtPNext = sqrtP + (amountIn * Q96) / L;
    }
  }
  // output (gross of fee, denominated in opposite token)
  let amountOut: bigint;
  if (zeroForOne) {
    // ΔY = L * (sqrtP - sqrtPNext) / Q96
    amountOut = (L * (sqrtP - sqrtPNext)) / Q96;
  } else {
    // ΔX = L * (sqrtPNext - sqrtP) / (sqrtP * sqrtPNext) * Q96
    amountOut = (L * Q96 * (sqrtPNext - sqrtP)) / (sqrtP * sqrtPNext);
  }
  return { sqrtPNext, amountIn, amountOut };
}

export function swapExactIn(
  pool: PoolState,
  amountIn: bigint,
  zeroForOne: boolean,
): { quote: SwapQuote; newPool: PoolState } {
  if (amountIn <= 0n) throw new RangeError('amountIn must be > 0');
  // clone pool (immutable input)
  const ticks = new Map(pool.ticks);
  let sqrtP = pool.sqrtPriceX96;
  let L = pool.liquidity;
  let tick = pool.tick;
  let remaining = amountIn;
  let totalOut = 0n;
  let totalFee = 0n;
  let crossed = 0;
  const feeBps = BigInt(pool.feeBps);

  while (remaining > 0n) {
    const nextTick = nextInitializedTick(ticks, tick, zeroForOne);
    if (nextTick == null) break; // liquidity exhausted
    const sqrtTarget = priceToSqrtPriceX96(Math.pow(1.0001, nextTick));

    // take fee off the top of remaining input
    const feeStep = (remaining * feeBps) / 10000n;
    const netIn = remaining - feeStep;

    const step = computeSwapStep(sqrtP, sqrtTarget, L, netIn, zeroForOne);
    // fee paid proportional to the portion of netIn actually used
    const feePaidStep = (step.amountIn * feeBps) / (10000n - feeBps);
    totalFee += feePaidStep;
    remaining -= step.amountIn + feePaidStep;
    totalOut += step.amountOut;

    if (step.sqrtPNext === sqrtTarget) {
      // crossed the tick: flip active liquidity
      const ti = ticks.get(nextTick);
      if (ti) {
        if (zeroForOne) L -= ti.liquidityNet;
        else L += ti.liquidityNet;
      }
      tick = zeroForOne ? nextTick - 1 : nextTick;
      sqrtP = sqrtTarget;
      crossed++;
      if (L <= 0n) break;
    } else {
      sqrtP = step.sqrtPNext;
      break;
    }
  }

  const entryPrice = sqrtPriceX96ToPrice(pool.sqrtPriceX96);
  const exitPrice = sqrtPriceX96ToPrice(sqrtP);
  const avgPrice = totalOut > 0n ? Number(totalOut) / Number(amountIn - remaining) : entryPrice;
  // For zeroForOne, price drops; slippage = (entry - exit) / entry.
  const slippagePct = zeroForOne
    ? Math.max(0, (entryPrice - exitPrice) / entryPrice)
    : Math.max(0, (exitPrice - entryPrice) / entryPrice);

  const newPool: PoolState = {
    sqrtPriceX96: sqrtP,
    tick,
    liquidity: L,
    feeBps: pool.feeBps,
    tickSpacing: pool.tickSpacing,
    ticks,
  };
  const quote: SwapQuote = {
    amountIn: amountIn - remaining,
    amountOut: totalOut,
    feePaid: totalFee,
    avgPrice,
    slippagePct,
    finalSqrtPriceX96: sqrtP,
    ticksCrossed: crossed,
  };
  return { quote, newPool };
}
