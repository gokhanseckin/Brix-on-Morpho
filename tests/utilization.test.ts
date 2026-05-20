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
