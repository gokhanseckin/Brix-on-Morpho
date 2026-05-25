import { describe, it, expect } from 'vitest';
import {
  buildAsymmetricLadder,
  buildLadderFromInputs,
  DEFAULT_BAND_SPLIT,
  normalizeLadderInputs,
} from '@/lib/poolPreset';
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

  it('rejects programmatic presets that allocate more capital than stated TVL', () => {
    expect(() =>
      buildAsymmetricLadder(
        0.03,
        500_000,
        { core: 0.8, absorb: 0.8, tail: 0 },
        3000,
      ),
    ).toThrow(/sum to 1/);
  });

  it('normalizes overallocated URL shares without creating extra capital', () => {
    const spot = 0.03;
    const input = {
      poolTVL_USD: 500_000,
      bandSplitCore: 0.8,
      bandSplitAbsorb: 0.8,
      poolFeeTier: 3000,
    };
    const normalized = normalizeLadderInputs(spot, input);
    const preset = buildLadderFromInputs(spot, input);

    expect(normalized.adjustments).toContain('Band shares normalized to 100% of pool TVL.');
    expect(normalized.split).toEqual({ core: 0.5, absorb: 0.5, tail: 0 });
    expect(preset.positions.reduce((sum, p) => sum + p.liquidityUSD, 0)).toBeCloseTo(500_000, 6);
  });

  it('falls back from malformed URL ranges to safe default tick ranges', () => {
    const spot = 0.03;
    const normalized = normalizeLadderInputs(spot, {
      poolTVL_USD: 500_000,
      bandSplitCore: 0.3,
      bandSplitAbsorb: 0.5,
      poolFeeTier: 10000,
      bandAbsorbLowerPct: -1.1,
      bandAbsorbUpperPct: -1.05,
    });
    const preset = buildLadderFromInputs(spot, {
      poolTVL_USD: 500_000,
      bandSplitCore: 0.3,
      bandSplitAbsorb: 0.5,
      poolFeeTier: 10000,
      bandAbsorbLowerPct: -1.1,
      bandAbsorbUpperPct: -1.05,
    });

    expect(normalized.adjustments).toContain('Absorb range reset to its default.');
    expect(preset.positions[1]!.tickLower).toBeLessThan(preset.positions[1]!.tickUpper);
  });

  it('rejects invalid or tick-collapsed programmatic ranges', () => {
    expect(() =>
      buildAsymmetricLadder(0.03, 500_000, DEFAULT_BAND_SPLIT, 3000, {
        core: { lowerPct: 0.001, upperPct: 0.0011 },
        absorb: { lowerPct: -0.15, upperPct: -0.05 },
        tail: { lowerPct: -0.9, upperPct: 0.3 },
      }),
    ).toThrow(/usable tick range/);
  });
});
