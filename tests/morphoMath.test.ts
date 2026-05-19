import { describe, it, expect } from 'vitest';
import { LIF, BETA, healthFactor, adaptiveCurveIRM, witryPerITRY, witryUSD } from '@/lib/morphoMath';

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

describe('adaptiveCurveIRM', () => {
  const rt = 0.04; // 4% target
  it('hits anchors', () => {
    expect(adaptiveCurveIRM(0,   rt)).toBeCloseTo(rt / 4, 8);
    expect(adaptiveCurveIRM(0.9, rt)).toBeCloseTo(rt,     8);
    expect(adaptiveCurveIRM(1.0, rt)).toBeCloseTo(4 * rt, 8);
  });
  it('is monotonic increasing on [0,1]', () => {
    let prev = -Infinity;
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const r = adaptiveCurveIRM(u, rt);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });
  it('clamps below 0 and above 1', () => {
    expect(adaptiveCurveIRM(-0.1, rt)).toBeCloseTo(rt / 4, 8);
    expect(adaptiveCurveIRM(1.5,  rt)).toBeCloseTo(4 * rt, 8);
  });
});

describe('witryUSD', () => {
  it('witry/iTRY = 1 at t=0', () => {
    expect(witryPerITRY(0, 0.38)).toBeCloseTo(1, 8);
  });
  it('witry/iTRY grows at iTRY APY', () => {
    // 1 year, 38% APY
    expect(witryPerITRY(365, 0.38)).toBeCloseTo(1.38, 4);
  });
  it('wiTRY USD = (wiTRY/iTRY) / (USD/TRY)', () => {
    // S=40, yield=0.38, t=365 → 1.38/40 = 0.0345
    expect(witryUSD({ tDays: 365, iTRYYieldAnnual: 0.38, usdTryRate: 40 })).toBeCloseTo(0.0345, 4);
  });
});
