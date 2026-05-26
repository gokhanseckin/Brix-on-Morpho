import { describe, expect, it } from 'vitest';
import { GOV_LLTVS } from '@/types/simulator';
import {
  scanLLTVSensitivity,
  slippageForGovernanceTier,
} from '@/lib/lltvPageMath';

const tierRows = GOV_LLTVS.map((lltv) => ({
  lltv,
  slippage: lltv >= 0.86 ? 0.05 : 0.001,
  lMaxBadDebt: 1,
  lMaxProfit: 1,
  feasible: true,
}));

describe('LLTV page calculations', () => {
  it('scans sensitivity cells using each candidate tier slippage', () => {
    const result = scanLLTVSensitivity({
      drawdown: 0.05,
      safetyMargin: 0,
      perTier: tierRows,
    });

    expect(result.snapped).toBe(0.77);
  });

  it('uses the chosen tier slippage in the chosen-tier explanation', () => {
    expect(slippageForGovernanceTier(tierRows, 0.86)).toBe(0.05);
    expect(slippageForGovernanceTier(tierRows, 0.77)).toBe(0.001);
  });
});
