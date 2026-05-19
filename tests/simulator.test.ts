import { describe, it, expect } from 'vitest';
import { computeLiquidityNeed } from '@/lib/simulator';

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
