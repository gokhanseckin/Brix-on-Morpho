import { describe, it, expect } from 'vitest';
import { priceToSqrtPriceX96, priceToTick } from '@/lib/univ3/tickMath';
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
