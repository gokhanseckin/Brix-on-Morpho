import { describe, it, expect } from 'vitest';
import { LIF, BETA } from '@/lib/morphoMath';

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
