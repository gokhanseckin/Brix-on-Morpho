import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUtilizationAnalysis } from '@/lib/useUtilizationAnalysis';

const urlState = {
  lltv: 0.86,
  witryYieldUSD_7d: 0.0631,
  witryYieldUSD_30d: 0.1931,
  kinkClearance: 0,
  fxStressZ: 1.65,
  loopCount: 2,
};

vi.mock('@/lib/useUrlState', () => ({
  useUrlState: () => [urlState, vi.fn()],
}));

describe('useUtilizationAnalysis', () => {
  it('uses the configured finite loop count for utilization recommendation economics', () => {
    const { result } = renderHook(() => useUtilizationAnalysis({
      tvlUSDM_USD: 5_000_000,
      stressPctOfSupply: 0.20,
      hfBuffer: 1.5,
      rTargetOverride: 0.04,
      fxAnnualVol: 0.43,
    }));

    const borrowFraction = urlState.lltv / 1.5;
    const finiteLeverage = (1 - Math.pow(borrowFraction, urlState.loopCount + 1)) / (1 - borrowFraction);

    expect(result.current.recommended.recommended).toBeCloseTo(0.8, 6);
    expect(result.current.recommendedDetails.economics?.effectiveLeverage).toBeCloseTo(finiteLeverage, 8);
  });
});
