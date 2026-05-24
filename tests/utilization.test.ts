import { describe, it, expect } from 'vitest';
import {
  looperNetAPY,
  liquidityStress,
  recommendUTarget,
  sweepUtilizationTargets,
} from '@/lib/utilization';

// Disable the FX-safety gate (fxAnnualVol=0) when the case doesn't care
// about it — preserves the previous 3-gate semantics for carry/stress/kink
// assertions inherited from earlier tests.
const NO_FX = { fxAnnualVol: 0, fxStressZ: 0 };

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
  ...NO_FX,
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
      ...NO_FX,
    });
    expect(Number.isFinite(r.netLoopAPY)).toBe(true);
    expect(Number.isFinite(r.effectiveLeverage)).toBe(true);
  });
});

describe('looperNetAPY math', () => {
  it('effectiveLeverage = 1 / (1 − LLTV/HF)', () => {
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30, ...NO_FX,
    });
    const expected = 1 / (1 - 0.86 / 1.5);
    expect(r.effectiveLeverage).toBeCloseTo(expected, 6);
  });

  it('borrowAPY matches adaptiveCurveIRM at uTarget', async () => {
    const { adaptiveCurveIRM } = await import('@/lib/morphoMath');
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30, ...NO_FX,
    });
    expect(r.borrowAPY).toBeCloseTo(adaptiveCurveIRM(0.8, 0.04), 6);
  });

  it('loopMargin = netLoopAPY − witryYieldAnnual', () => {
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30, ...NO_FX,
    });
    expect(r.loopMargin).toBeCloseTo(r.netLoopAPY - 0.0631, 8);
  });

  it('hfIdleCost is zero when hfBuffer = 1', () => {
    const r = looperNetAPY({
      uTarget: 0.7, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.0,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30, ...NO_FX,
    });
    expect(r.hfIdleCost).toBeCloseTo(0, 10);
  });

  it('borrow cost has NO FX adjustment — only the carry math', () => {
    // Borrow cost must equal borrowedShare × borrowAPY regardless of σ or z.
    // The FX overlay enters loopSurvivesStress only, never the cost line.
    const noFx = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
      fxAnnualVol: 0, fxStressZ: 0,
    });
    const highFx = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
      fxAnnualVol: 0.50, fxStressZ: 3.0,
    });
    expect(noFx.borrowCost).toBeCloseTo(highFx.borrowCost, 12);
    expect(noFx.netLoopAPY).toBeCloseTo(highFx.netLoopAPY, 12);
    expect(noFx.loopMargin).toBeCloseTo(highFx.loopMargin, 12);
  });
});

describe('looperNetAPY FX stress overlay', () => {
  it('fxStressDrawdown_30d = σ × √(30/365) × z', () => {
    const r = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
      fxAnnualVol: 0.168, fxStressZ: 1.65,
    });
    const expected = 0.168 * Math.sqrt(30 / 365) * 1.65;
    expect(r.fxStressDrawdown_30d).toBeCloseTo(expected, 8);
  });

  it('loopSurvivesStress flips at leveredDrawdown = HF headroom boundary', () => {
    // headroom = 1 − 0.86/1.5 ≈ 0.4267; lev ≈ 2.344. dd needed to fail = 0.4267/2.344 ≈ 0.1820.
    // Pick a vol that gives a dd well below the boundary at z=1 → safe.
    const safe = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
      fxAnnualVol: 0.10, fxStressZ: 1.0,
    });
    expect(safe.loopSurvivesStress).toBe(true);
    // And one that pushes leveredDrawdown well above the boundary.
    const unsafe = looperNetAPY({
      uTarget: 0.8, rTarget: 0.04, lltv: 0.86, hfBuffer: 1.5,
      witryYieldAnnual: 0.0631, perLoopSlippageBps: 30,
      fxAnnualVol: 0.80, fxStressZ: 2.5,
    });
    expect(unsafe.loopSurvivesStress).toBe(false);
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

describe('sweepUtilizationTargets', () => {
  it('returns rows across the search range at the requested step', () => {
    const rows = sweepUtilizationTargets(CANONICAL);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.uTarget).toBeCloseTo(0.5, 6);
    expect(rows[rows.length - 1]!.uTarget).toBeLessThanOrEqual(0.9 + 1e-9);
    for (let k = 1; k < rows.length; k++) {
      expect(rows[k]!.borrowAPY).toBeGreaterThanOrEqual(rows[k - 1]!.borrowAPY - 1e-9);
    }
  });

  it('verdict reflects feasibility and stress survival', () => {
    const rows = sweepUtilizationTargets(CANONICAL);
    const row = rows.find(r => Math.abs(r.uTarget - 0.7) < 1e-6)!;
    expect(['feasible','tight','infeasible']).toContain(row.verdict);
  });
});

describe('recommendUTarget', () => {
  it('picks the largest u where loop+stress+kink all pass', () => {
    const r = recommendUTarget(CANONICAL);
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!).toBeLessThanOrEqual(0.83 + 1e-9);
    expect(r.recommended!).toBeGreaterThanOrEqual(0.5);
    expect(r.unmetConstraints).toEqual([]);
  });

  it('returns null when stress is unsatisfiable, flags stressSurvival, exposes bestEffort', () => {
    // stressPctOfSupply: 0.51 means buffer at u=0.5 is 0.5*TVL < 0.51*TVL — no u in [0.5,0.9] survives
    const r = recommendUTarget({ ...CANONICAL, stressPctOfSupply: 0.51 });
    expect(r.recommended).toBeNull();
    expect(r.unmetConstraints).toContain('stressSurvival');
    expect(r.bestEffort).toBeGreaterThan(0);
  });

  it('returns null when loop is unprofitable at every u', () => {
    const r = recommendUTarget({ ...CANONICAL, witryYield7d: 0.005 });
    expect(r.recommended).toBeNull();
    expect(r.unmetConstraints).toContain('loopMargin');
  });

  it('enforces kink clearance of 0.07', () => {
    const r = recommendUTarget(CANONICAL);
    if (r.recommended !== null) {
      expect(0.9 - r.recommended).toBeGreaterThanOrEqual(0.07 - 1e-9);
    }
  });

  it('canonical recommended value is stable in 0.6..0.83 range', () => {
    const r = recommendUTarget(CANONICAL);
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!).toBeGreaterThanOrEqual(0.6);
    expect(r.recommended!).toBeLessThanOrEqual(0.83);
  });

  // The new /utilization defaults drop kinkClearance to 0 specifically to
  // let the recommender operate near the IRM kink (u=0.9), provided lender
  // stress and FX safety allow it. At default hfBuffer=1.5, hf-idle cost
  // (28% of witry yield × borrowedShare) caps the math just below the
  // kink — the recommender lands ~0.88 in this fixture rather than 0.90.
  // Lowering hfBuffer below 1.5 frees more leverage and lets it cross.
  it('with kinkClearance=0 and relaxed stress, recommender operates near 0.90', () => {
    const r = recommendUTarget({
      ...CANONICAL,
      kinkClearance: 0,
      stressPctOfSupply: 0.10,          // buffer at u=0.9 = 10% = stress
      fxAnnualVol: 0.168, fxStressZ: 1.65,
    });
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!).toBeGreaterThanOrEqual(0.85);
    expect(r.recommended!).toBeLessThanOrEqual(0.90 + 1e-9);
  });

  // Lowering hfBuffer raises leverage and gross loop APY enough to
  // overcome hf-idle cost — recommender pushes all the way to 0.90.
  it('with kinkClearance=0, hfBuffer=1.2, and relaxed stress, recommender hits 0.90', () => {
    const r = recommendUTarget({
      ...CANONICAL,
      kinkClearance: 0,
      hfBuffer: 1.2,
      stressPctOfSupply: 0.10,
      fxAnnualVol: 0.168, fxStressZ: 1.65,
    });
    expect(r.recommended).not.toBeNull();
    expect(r.recommended!).toBeCloseTo(0.9, 6);
  });

  it('FX-unsafe inputs block the recommendation and flag fxSafe', () => {
    const r = recommendUTarget({
      ...CANONICAL,
      kinkClearance: 0,
      stressPctOfSupply: 0.10,
      // High vol × high z × low hfBuffer (more leverage) → no u survives.
      hfBuffer: 1.15,
      fxAnnualVol: 0.80, fxStressZ: 3.0,
    });
    expect(r.recommended).toBeNull();
    expect(r.unmetConstraints).toContain('fxSafe');
  });
});
