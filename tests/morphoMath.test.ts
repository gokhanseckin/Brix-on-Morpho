import { describe, it, expect } from 'vitest';
import { LIF, BETA, healthFactor } from '@/lib/morphoMath';

describe('LIF', () => {
  it('matches spec anchors', () => {
    expect(LIF(0.77)).toBeCloseTo(1.0741, 3);
    expect(LIF(0.86)).toBeCloseTo(1.0438, 3);
    expect(LIF(0.915)).toBeCloseTo(1.0262, 3);
  });

  it('caps at 1.15', () => {
    expect(LIF(0.10)).toBeCloseTo(1.15, 3);
  });

  it('uses β = 0.3', () => {
    expect(BETA).toBe(0.3);
  });
});

describe('healthFactor', () => {
  it('coll=100 debt=80 lltv=0.86 → ~1.075', () => {
    expect(healthFactor({ collateralUSD: 100, debtUSD: 80, lltv: 0.86 })).toBeCloseTo(1.075, 3);
  });
  it('HF=1 at debt = coll × LLTV', () => {
    expect(healthFactor({ collateralUSD: 100, debtUSD: 86, lltv: 0.86 })).toBeCloseTo(1, 6);
  });
  it('returns Infinity for zero debt', () => {
    expect(healthFactor({ collateralUSD: 100, debtUSD: 0, lltv: 0.86 })).toBe(Infinity);
  });
});
