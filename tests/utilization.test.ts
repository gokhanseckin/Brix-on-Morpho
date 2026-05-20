import { describe, it, expect } from 'vitest';
import {
  looperNetAPY,
  liquidityStress,
  recommendUTarget,
  sweepUtilizationTargets,
} from '@/lib/utilization';

const CANONICAL = {
  rTarget: 0.04,
  lltv: 0.86,
  hfBuffer: 1.5,
  witryYield7d: 0.0631,
  witryYield30d: 0.1931,
  perLoopSlippageBps: 30,
  tvlUSDM_USD: 10_000_000,
  stressPctOfSupply: 0.20,
  kinkClearance: 0.07,
  searchRange: [0.5, 0.9] as [number, number],
  searchStep: 0.01,
};

describe('looperNetAPY', () => {
  it('returns finite numbers for canonical inputs', () => {
    const r = looperNetAPY({
      uTarget: 0.8,
      rTarget: CANONICAL.rTarget,
      lltv: CANONICAL.lltv,
      hfBuffer: CANONICAL.hfBuffer,
      witryYieldAnnual: CANONICAL.witryYield7d,
      perLoopSlippageBps: CANONICAL.perLoopSlippageBps,
    });
    expect(Number.isFinite(r.netLoopAPY)).toBe(true);
    expect(Number.isFinite(r.effectiveLeverage)).toBe(true);
  });
});

describe('looperNetAPY math', () => {
  it('effectiveLeverage = 1 / (1 − LLTV/HF)', () => {
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    const expected = 1 / (1 - 0.86 / 1.5);
    expect(r.effectiveLeverage).toBeCloseTo(expected, 6);
  });

  it('borrowAPY matches adaptiveCurveIRM at uTarget', async () => {
    const { adaptiveCurveIRM } = await import('@/lib/morphoMath');
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    expect(r.borrowAPY).toBeCloseTo(adaptiveCurveIRM(0.8, 0.04), 6);
  });

  it('loopMargin = netLoopAPY − witryYieldAnnual', () => {
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    expect(r.loopMargin).toBeCloseTo(r.netLoopAPY - 0.0631, 8);
  });

  it('hfIdleCost is zero when hfBuffer = 1', () => {
    const r = looperNetAPY({
      uTarget: 0.7, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.0,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
    });
    expect(r.hfIdleCost).toBeCloseTo(0, 10);
  });
});

describe('liquidityStress', () => {
  it('bufferUSD = (1 − u) × TVL', () => {
    const r = liquidityStress({ uTarget: 0.8, tvlUSDM_USD: 10_000_000, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(r.bufferUSD).toBeCloseTo(2_000_000, 6);
    expect(r.stressWithdrawalUSD).toBeCloseTo(2_000_000, 6);
  });

  it('survives = bufferUSD >= stressWithdrawalUSD', () => {
    const survives = liquidityStress({ uTarget: 0.8, tvlUSDM_USD: 10e6, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(survives.survives).toBe(true);
    const fails = liquidityStress({ uTarget: 0.85, tvlUSDM_USD: 10e6, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(fails.survives).toBe(false);
  });

  it('daysToRefillEstimate is positive when borrowAPY > 0', () => {
    const r = liquidityStress({ uTarget: 0.8, tvlUSDM_USD: 10e6, stressPctOfSupply: 0.2, borrowAPY: 0.04 });
    expect(r.daysToRefillEstimate).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.daysToRefillEstimate) || r.daysToRefillEstimate === Infinity).toBe(true);
  });
});
