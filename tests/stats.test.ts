import { describe, expect, it } from 'vitest';
import { quantile, quantileSorted, betaPdf } from '@/lib/stats';

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

describe('betaPdf', () => {
  it('Beta(1, 1) is the uniform density on (0, 1) — PDF = 1 everywhere', () => {
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(betaPdf(x, 1, 1)).toBeCloseTo(1, 10);
    }
  });

  it('returns 0 at the boundaries x = 0 and x = 1 (singular for α<1 or β<1)', () => {
    expect(betaPdf(0, 2, 2)).toBe(0);
    expect(betaPdf(1, 2, 2)).toBe(0);
  });

  it('Beta(2, 2) peaks at x = 0.5 with density 1.5', () => {
    // pdf(0.5; 2, 2) = 6·0.5·0.5 = 1.5 (analytic)
    expect(betaPdf(0.5, 2, 2)).toBeCloseTo(1.5, 10);
  });

  it('Beta(2, 1.2) — default — pdf integrates to ~1 over a fine grid', () => {
    // Trapezoidal check that the density is properly normalised.
    let area = 0;
    const N = 1000;
    for (let i = 1; i < N; i++) {
      const x0 = i / N;
      const x1 = (i + 1) / N;
      area += 0.5 * (betaPdf(x0, 2, 1.2) + betaPdf(x1, 2, 1.2)) * (x1 - x0);
    }
    expect(area).toBeCloseTo(1, 2); // 2 dp is plenty for plot sanity
  });

  it('Beta(10, 10) is tighter than Beta(5, 5) — higher peak at the centre', () => {
    expect(betaPdf(0.5, 10, 10)).toBeGreaterThan(betaPdf(0.5, 5, 5));
  });

  it('returns 0 for invalid shape parameters', () => {
    expect(betaPdf(0.5, 0, 1)).toBe(0);
    expect(betaPdf(0.5, 1, -1)).toBe(0);
  });
});
