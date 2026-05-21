// lib/univ3/liquidityMath.ts
// Uniswap v3 liquidity formulas. See whitepaper §6.2.
const Q96 = 2n ** 96n;

function sort(a: bigint, b: bigint): [bigint, bigint] {
  return a < b ? [a, b] : [b, a];
}

// L = amount0 * sqrtA * sqrtB / (sqrtB - sqrtA)
export function liquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  const [lo, hi] = sort(sqrtA, sqrtB);
  const num = amount0 * lo * hi;
  const den = (hi - lo) * Q96;
  return num / den;
}

// L = amount1 * Q96 / (sqrtB - sqrtA)
export function liquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  const [lo, hi] = sort(sqrtA, sqrtB);
  return (amount1 * Q96) / (hi - lo);
}

export function liquidityForAmounts(
  sqrtP: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint {
  const [lo, hi] = sort(sqrtA, sqrtB);
  if (sqrtP <= lo) return liquidityForAmount0(lo, hi, amount0);
  if (sqrtP >= hi) return liquidityForAmount1(lo, hi, amount1);
  const l0 = liquidityForAmount0(sqrtP, hi, amount0);
  const l1 = liquidityForAmount1(lo, sqrtP, amount1);
  return l0 < l1 ? l0 : l1;
}

// amount0 = L * (sqrtB - sqrtP) / (sqrtP * sqrtB) * Q96
// amount1 = L * (sqrtP - sqrtA) / Q96
export function amountsForLiquidity(
  sqrtP: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  L: bigint,
): { amount0: bigint; amount1: bigint } {
  const [lo, hi] = sort(sqrtA, sqrtB);
  let amount0 = 0n;
  let amount1 = 0n;
  if (sqrtP <= lo) {
    amount0 = (L * Q96 * (hi - lo)) / (lo * hi);
  } else if (sqrtP >= hi) {
    amount1 = (L * (hi - lo)) / Q96;
  } else {
    amount0 = (L * Q96 * (hi - sqrtP)) / (sqrtP * hi);
    amount1 = (L * (sqrtP - lo)) / Q96;
  }
  return { amount0, amount1 };
}
