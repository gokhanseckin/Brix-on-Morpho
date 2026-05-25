import { describe, it, expect } from 'vitest';
import { buildAsymmetricLadder, DEFAULT_BAND_SPLIT } from '@/lib/poolPreset';
import { materializedPositionValueUSD } from '@/lib/univ3/quoteLiquidatorSell';

describe('buildAsymmetricLadder', () => {
  it('produces three positions with descending tick lowers', () => {
    const preset = buildAsymmetricLadder(0.03, 10_000_000, DEFAULT_BAND_SPLIT, 3000);
    expect(preset.positions).toHaveLength(3);
    const lows = preset.positions.map((p) => p.tickLower);
    expect(lows[0]!).toBeGreaterThan(lows[2]!); // first (core) is highest range
  });

  it('respects fee tier and corresponding tick spacing', () => {
    const p3000 = buildAsymmetricLadder(0.03, 10_000_000, DEFAULT_BAND_SPLIT, 3000);
    expect(p3000.feeTier).toBe(3000);
    expect(p3000.tickSpacing).toBe(60);
    const p10000 = buildAsymmetricLadder(0.03, 10_000_000, DEFAULT_BAND_SPLIT, 10000);
    expect(p10000.tickSpacing).toBe(200);
  });

  it('sums positional USD to the total TVL within rounding', () => {
    const preset = buildAsymmetricLadder(0.03, 10_000_000, DEFAULT_BAND_SPLIT, 3000);
    const sum = preset.positions.reduce((s, p) => s + p.liquidityUSD, 0);
    expect(Math.abs(sum - 10_000_000)).toBeLessThan(1); // rounding only
  });

  it('Absorb band is fully below spot', () => {
    const spot = 0.03;
    const preset = buildAsymmetricLadder(spot, 10_000_000, DEFAULT_BAND_SPLIT, 3000);
    const absorb = preset.positions[1]!;
    expect(Math.pow(1.0001, absorb.tickUpper)).toBeLessThanOrEqual(spot);
  });

  it('materializes each band at its configured marked USD allocation', () => {
    const spot = 1 / 45;
    const preset = buildAsymmetricLadder(spot, 500_000, DEFAULT_BAND_SPLIT, 3000);

    for (const position of preset.positions) {
      expect(materializedPositionValueUSD(position, spot)).toBeCloseTo(position.liquidityUSD, 0);
    }
  });

  it('materializes total default pool capital at the stated TVL', () => {
    const spot = 1 / 45;
    const preset = buildAsymmetricLadder(spot, 500_000, DEFAULT_BAND_SPLIT, 3000);
    const actualTVL = preset.positions.reduce(
      (sum, position) => sum + materializedPositionValueUSD(position, spot),
      0,
    );

    expect(actualTVL).toBeCloseTo(500_000, 0);
  });
});
