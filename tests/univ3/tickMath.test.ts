import { describe, it, expect } from 'vitest';
import {
  priceToTick,
  tickToPrice,
  priceToSqrtPriceX96,
  sqrtPriceX96ToPrice,
  MIN_TICK,
  MAX_TICK,
} from '@/lib/univ3/tickMath';

describe('tickMath', () => {
  it('priceToTick(1) === 0', () => {
    expect(priceToTick(1)).toBe(0);
  });

  it('tickToPrice(0) === 1', () => {
    expect(tickToPrice(0)).toBeCloseTo(1, 12);
  });

  it('round-trips a representative wTRY/USDM price (~0.029)', () => {
    const p = 0.029;
    const t = priceToTick(p);
    expect(tickToPrice(t)).toBeCloseTo(p, 4);
  });

  it('priceToTick is monotonic across the wTRY/USDM range', () => {
    expect(priceToTick(0.01)).toBeLessThan(priceToTick(0.05));
  });

  it('sqrtPriceX96 round-trip at price 0.029 within 1e-9', () => {
    const p = 0.029;
    const s = priceToSqrtPriceX96(p);
    expect(sqrtPriceX96ToPrice(s)).toBeCloseTo(p, 9);
  });

  it('exposes MIN_TICK and MAX_TICK matching the Uni v3 spec', () => {
    expect(MIN_TICK).toBe(-887272);
    expect(MAX_TICK).toBe(887272);
  });
});
