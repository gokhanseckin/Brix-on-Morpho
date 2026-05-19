import { describe, it, expect } from 'vitest';
import {
  computeLiquidityNeed,
  sampleBetaLtvFractions,
  pctUnderwaterAtT,
} from '@/lib/simulator';

describe('liquidity need', () => {
  it('verification anchor: 5M × 0.77 × 0.6 / 0.7 ≈ 3.3M', () => {
    const out = computeLiquidityNeed({
      witryTVL_USD: 5_000_000,
      lltv: 0.77,
      targetUtilization: 0.7,
      borrowerLTVAlpha: 3,
      borrowerLTVBeta: 2,
      incentiveAPY: 0,
      baseSupplyAPY: 0.05,
      deadDepositCost: 1,
    });
    expect(out.requiredUSDM).toBeCloseTo(3_300_000, -3); // within ±1000
  });

  it('floor uses 20% of required when dead-deposit cost is small', () => {
    const out = computeLiquidityNeed({
      witryTVL_USD: 5_000_000,
      lltv: 0.77,
      targetUtilization: 0.7,
      borrowerLTVAlpha: 3,
      borrowerLTVBeta: 2,
      incentiveAPY: 0,
      baseSupplyAPY: 0.05,
      deadDepositCost: 1,
    });
    expect(out.liquidityFloor_USD).toBeCloseTo(0.2 * out.requiredUSDM, 0);
  });
});

describe('position distribution', () => {
  it('β-sampled fractions are in [0,1]', () => {
    const xs = sampleBetaLtvFractions({ alpha: 2, beta: 1.2, n: 500, seed: 1 });
    expect(xs.every((x) => x >= 0 && x <= 1)).toBe(true);
  });

  it('at S(t)=S(0) and 0 yield, no positions are underwater', () => {
    const pct = pctUnderwaterAtT({
      ltvFractions: [0.2, 0.5, 0.8],
      lltv: 0.86,
      collateralRelChange: 1.0,
    });
    expect(pct).toBe(0);
  });

  it('at large drop, all positions are underwater', () => {
    const pct = pctUnderwaterAtT({
      ltvFractions: [0.2, 0.5, 0.8],
      lltv: 0.86,
      collateralRelChange: 0.1,
    });
    expect(pct).toBe(1);
  });
});
