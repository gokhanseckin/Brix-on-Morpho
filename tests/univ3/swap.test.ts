import { describe, it, expect } from 'vitest';
import { priceToSqrtPriceX96, priceToTick, priceToTick as tk } from '@/lib/univ3/tickMath';
import { liquidityForAmounts } from '@/lib/univ3/liquidityMath';
import { type PoolState, swapExactIn, makeSingleRangePool } from '@/lib/univ3/swap';

describe('swapExactIn', () => {
  it('selling token0 into a balanced single-range pool decreases price', () => {
    const pool = makeSingleRangePool({
      spot: 0.03,
      tickLower: priceToTick(0.025),
      tickUpper: priceToTick(0.035),
      amount0: 10_000_000_000n,
      amount1: 300_000_000n,
      feeBps: 30,
      tickSpacing: 60,
    });
    const { quote, newPool } = swapExactIn(pool, 1_000_000_000n, true /* zeroForOne */);
    expect(quote.amountOut).toBeGreaterThan(0n);
    expect(quote.feePaid).toBeGreaterThan(0n);
    expect(newPool.sqrtPriceX96).toBeLessThan(pool.sqrtPriceX96);
    expect(quote.slippagePct).toBeGreaterThan(0);
  });

  it('larger sells suffer monotonically more slippage', () => {
    const make = () =>
      makeSingleRangePool({
        spot: 0.03,
        tickLower: priceToTick(0.025),
        tickUpper: priceToTick(0.035),
        amount0: 10_000_000_000n,
        amount1: 300_000_000n,
        feeBps: 30,
        tickSpacing: 60,
      });
    const a = swapExactIn(make(), 1_000_000_000n, true).quote.slippagePct;
    const b = swapExactIn(make(), 5_000_000_000n, true).quote.slippagePct;
    expect(b).toBeGreaterThan(a);
  });

  it('feePaid scales roughly linearly in amountIn for small swaps', () => {
    const make = () =>
      makeSingleRangePool({
        spot: 0.03,
        tickLower: priceToTick(0.025),
        tickUpper: priceToTick(0.035),
        amount0: 10_000_000_000n,
        amount1: 300_000_000n,
        feeBps: 30,
        tickSpacing: 60,
      });
    const f1 = swapExactIn(make(), 100_000_000n, true).quote.feePaid;
    const f2 = swapExactIn(make(), 200_000_000n, true).quote.feePaid;
    const ratio = Number(f2) / Number(f1);
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.1);
  });

  it('quote does not mutate the input pool', () => {
    const pool = makeSingleRangePool({
      spot: 0.03,
      tickLower: priceToTick(0.025),
      tickUpper: priceToTick(0.035),
      amount0: 10_000_000_000n,
      amount1: 300_000_000n,
      feeBps: 30,
      tickSpacing: 60,
    });
    const before = pool.sqrtPriceX96;
    swapExactIn(pool, 1_000_000_000n, true);
    expect(pool.sqrtPriceX96).toBe(before);
  });
});

describe('swapExactIn — multi-tick', () => {
  it('crosses multiple positions and reports ticksCrossed >= 1', () => {
    // Build a pool with two adjacent ranges below spot.
    const spot = 0.03;
    const sqrtP = priceToSqrtPriceX96(spot);
    const tBand1Lo = Math.floor(tk(0.027) / 60) * 60;
    const tBand1Hi = Math.floor(tk(0.029) / 60) * 60;
    const tBand2Lo = Math.floor(tk(0.024) / 60) * 60;
    const tBand2Hi = Math.floor(tk(0.027) / 60) * 60;
    const sa1 = priceToSqrtPriceX96(Math.pow(1.0001, tBand1Lo));
    const sb1 = priceToSqrtPriceX96(Math.pow(1.0001, tBand1Hi));
    const sa2 = priceToSqrtPriceX96(Math.pow(1.0001, tBand2Lo));
    const sb2 = priceToSqrtPriceX96(Math.pow(1.0001, tBand2Hi));
    const L1 = liquidityForAmounts(sqrtP, sa1, sb1, 5_000_000_000n, 150_000_000n);
    const L2 = liquidityForAmounts(sqrtP, sa2, sb2, 5_000_000_000n, 0n);
    const ticks = new Map<number, { liquidityNet: bigint }>();
    ticks.set(tBand1Lo, { liquidityNet: L1 });
    ticks.set(tBand1Hi, { liquidityNet: -L1 });
    ticks.set(tBand2Lo, { liquidityNet: L2 });
    ticks.set(tBand2Hi, { liquidityNet: -L2 });
    const pool: PoolState = {
      sqrtPriceX96: sqrtP,
      tick: priceToTick(spot),
      liquidity: L1, // only band1 is in range at spot
      feeBps: 30,
      tickSpacing: 60,
      ticks,
    };
    const { quote } = swapExactIn(pool, 20_000_000_000n, true);
    expect(quote.ticksCrossed).toBeGreaterThanOrEqual(1);
    expect(quote.amountOut).toBeGreaterThan(0n);
  });
});
