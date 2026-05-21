// Uniswap v3 tick math. Reference: https://uniswap.org/whitepaper-v3.pdf §6.1.
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

const Q96 = 2n ** 96n;
const LOG_1_0001 = Math.log(1.0001);

export function priceToTick(price: number): number {
  if (!isFinite(price) || price <= 0) throw new RangeError('price must be > 0');
  const t = Math.floor(Math.log(price) / LOG_1_0001);
  if (t < MIN_TICK || t > MAX_TICK) throw new RangeError('tick out of range');
  return t;
}

export function tickToPrice(tick: number): number {
  if (tick < MIN_TICK || tick > MAX_TICK) throw new RangeError('tick out of range');
  return Math.pow(1.0001, tick);
}

export function priceToSqrtPriceX96(price: number): bigint {
  if (!isFinite(price) || price <= 0) throw new RangeError('price must be > 0');
  const s = Math.sqrt(price);
  // Scale by 2^96. Use string→BigInt for sub-bit precision.
  const scaled = BigInt(Math.floor(s * 2 ** 96));
  return scaled;
}

export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const s = Number(sqrtPriceX96) / Number(Q96);
  return s * s;
}

export function nearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  if (rounded < MIN_TICK) return rounded + tickSpacing;
  if (rounded > MAX_TICK) return rounded - tickSpacing;
  return rounded;
}
