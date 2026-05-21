import { describe, it, expect } from 'vitest';
import { priceToSqrtPriceX96 } from '@/lib/univ3/tickMath';
import {
  liquidityForAmount0,
  liquidityForAmount1,
  liquidityForAmounts,
  amountsForLiquidity,
} from '@/lib/univ3/liquidityMath';

describe('liquidityMath', () => {
  it('liquidityForAmount0 + amountsForLiquidity round-trip within 1 wei', () => {
    const sqrtA = priceToSqrtPriceX96(0.025);
    const sqrtB = priceToSqrtPriceX96(0.035);
    const amt0 = 1_000_000n; // 1e6 wei of token0
    const L = liquidityForAmount0(sqrtA, sqrtB, amt0);
    const { amount0 } = amountsForLiquidity(sqrtA, sqrtA, sqrtB, L); // price at lower edge
    expect(amount0).toBeGreaterThan(0n);
    expect(amount0).toBeLessThanOrEqual(amt0);
    expect(amt0 - amount0).toBeLessThan(2n); // 1 wei tolerance
  });

  it('liquidityForAmount1 produces non-zero L for in-range deposit', () => {
    const sqrtA = priceToSqrtPriceX96(0.025);
    const sqrtB = priceToSqrtPriceX96(0.035);
    const L = liquidityForAmount1(sqrtA, sqrtB, 1_000_000n);
    expect(L).toBeGreaterThan(0n);
  });

  it('liquidityForAmounts picks the binding side', () => {
    const sqrtP = priceToSqrtPriceX96(0.03);
    const sqrtA = priceToSqrtPriceX96(0.025);
    const sqrtB = priceToSqrtPriceX96(0.035);
    const L = liquidityForAmounts(sqrtP, sqrtA, sqrtB, 1_000_000n, 1_000_000n);
    expect(L).toBeGreaterThan(0n);
  });

  it('amountsForLiquidity at lower edge yields all token0', () => {
    const sqrtA = priceToSqrtPriceX96(0.025);
    const sqrtB = priceToSqrtPriceX96(0.035);
    const L = 1_000_000_000n;
    const { amount0, amount1 } = amountsForLiquidity(sqrtA, sqrtA, sqrtB, L);
    expect(amount1).toBe(0n);
    expect(amount0).toBeGreaterThan(0n);
  });

  it('amountsForLiquidity at upper edge yields all token1', () => {
    const sqrtA = priceToSqrtPriceX96(0.025);
    const sqrtB = priceToSqrtPriceX96(0.035);
    const L = 1_000_000_000n;
    const { amount0, amount1 } = amountsForLiquidity(sqrtB, sqrtA, sqrtB, L);
    expect(amount0).toBe(0n);
    expect(amount1).toBeGreaterThan(0n);
  });
});
