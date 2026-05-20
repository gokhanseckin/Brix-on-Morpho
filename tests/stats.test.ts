import { describe, expect, it } from 'vitest';
import { quantile, quantileSorted } from '@/lib/stats';

describe('quantile (R-7 linear interpolation)', () => {
  it('returns 0 on empty input', () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantileSorted([], 0.95)).toBe(0);
  });

  it('matches numpy.percentile on a canonical small sample', () => {
    // numpy.percentile([1,2,3,4,5,6,7,8,9,10], 95) → 9.55
    // R-7 idx = 0.95 · 9 = 8.55 → sorted[8] + 0.55·(sorted[9]−sorted[8]) = 9 + 0.55 = 9.55
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBeCloseTo(9.55, 6);
  });

  it('median of an even-length sample interpolates between the two middles', () => {
    // numpy.percentile([1,2,3,4], 50) → 2.5
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 12);
  });

  it('p0 and p100 return min and max exactly', () => {
    expect(quantile([5, 1, 3, 9, 2], 0)).toBe(1);
    expect(quantile([5, 1, 3, 9, 2], 1)).toBe(9);
  });

  it('is order-invariant (handles unsorted input)', () => {
    const a = quantile([3, 1, 4, 1, 5, 9, 2, 6, 5, 3], 0.75);
    const b = quantile([1, 1, 2, 3, 3, 4, 5, 5, 6, 9], 0.75);
    expect(a).toBeCloseTo(b, 12);
  });

  it('quantileSorted agrees with quantile when input is pre-sorted', () => {
    const xs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    for (const q of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      expect(quantileSorted(xs, q)).toBeCloseTo(quantile(xs, q), 12);
    }
  });
});
