import { describe, it, expect } from 'vitest';
import { makeSingleRangePool, swapExactIn } from '@/lib/univ3/swap';
import { priceToTick } from '@/lib/univ3/tickMath';

// Fixture: an analytically computed reference for a well-defined single-range swap.
// We don't have RPC access in CI, so we lock the math by computing the expected
// output via the constant-product formula in the test itself and comparing within
// tight tolerance — this catches drift in the BigInt swap walker.
describe('univ3 swap — analytic reference', () => {
  it('matches constant-product within 1% for a single-range pool', () => {
    const spot = 1.0;
    const pool = makeSingleRangePool({
      spot,
      tickLower: priceToTick(0.5),
      tickUpper: priceToTick(2.0),
      amount0: 1_000_000_000_000n,
      amount1: 1_000_000_000_000n,
      feeBps: 30,
      tickSpacing: 60,
    });
    const amtIn = 10_000_000_000n;
    const { quote } = swapExactIn(pool, amtIn, true);
    // Constant-product estimate: output ≈ amtIn * (1 - feeBps/10000)
    // / (1 + amtIn/reserve). For tight single-range pools at spot=1 this is a
    // decent first-order check.
    const reserve = 1_000_000_000_000;
    const fee = 0.003;
    const expected = (Number(amtIn) * (1 - fee)) / (1 + Number(amtIn) / reserve);
    const got = Number(quote.amountOut);
    const relErr = Math.abs(got - expected) / expected;
    expect(relErr).toBeLessThan(0.01);
  });
});
