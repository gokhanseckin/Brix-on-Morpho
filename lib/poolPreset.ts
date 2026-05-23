import { priceToTick, nearestUsableTick } from './univ3/tickMath';

export interface PoolPreset {
  feeTier: 500 | 3000 | 10000;
  tickSpacing: number;
  positions: Array<{
    tickLower: number;
    tickUpper: number;
    liquidityUSD: number;   // total USD value parked in the position
    label: 'core' | 'absorb' | 'tail';
  }>;
  rebalancePolicy: { triggerPct: number; intervalDays: number };
}

export interface BandSplit {
  core: number;    // share, 0..1
  absorb: number;
  tail: number;
}

export const DEFAULT_BAND_SPLIT: BandSplit = { core: 0.3, absorb: 0.5, tail: 0.2 };

export interface BandRange {
  lowerPct: number; // e.g. -0.05 = 5% below spot
  upperPct: number; // e.g. +0.05 = 5% above spot
}

export interface BandRanges {
  core: BandRange;
  absorb: BandRange;
  tail: BandRange;
}

// New defaults close the −10%..−5% gap (absorb now starts at −5%) and extend
// the tail down to −90% so catastrophic crashes still see some recovery.
export const DEFAULT_BAND_RANGES: BandRanges = {
  core: { lowerPct: -0.05, upperPct: +0.05 },
  absorb: { lowerPct: -0.15, upperPct: -0.05 },
  tail: { lowerPct: -0.90, upperPct: +0.30 },
};

const SPACING: Record<500 | 3000 | 10000, number> = {
  500: 10,
  3000: 60,
  10000: 200,
};

function bandTicks(spot: number, loPct: number, hiPct: number, spacing: number) {
  const tickLower = nearestUsableTick(priceToTick(spot * (1 + loPct)), spacing);
  const tickUpper = nearestUsableTick(priceToTick(spot * (1 + hiPct)), spacing);
  return { tickLower, tickUpper };
}

export function buildAsymmetricLadder(
  spot: number,
  totalTVL_USD: number,
  split: BandSplit,
  feeTier: 3000 | 10000,
  ranges: BandRanges = DEFAULT_BAND_RANGES,
): PoolPreset {
  const spacing = SPACING[feeTier];
  const core = bandTicks(spot, ranges.core.lowerPct, ranges.core.upperPct, spacing);
  const absorb = bandTicks(spot, ranges.absorb.lowerPct, ranges.absorb.upperPct, spacing);
  const tail = bandTicks(spot, ranges.tail.lowerPct, ranges.tail.upperPct, spacing);
  return {
    feeTier,
    tickSpacing: spacing,
    positions: [
      { ...core, liquidityUSD: totalTVL_USD * split.core, label: 'core' },
      { ...absorb, liquidityUSD: totalTVL_USD * split.absorb, label: 'absorb' },
      { ...tail, liquidityUSD: totalTVL_USD * split.tail, label: 'tail' },
    ],
    rebalancePolicy: { triggerPct: 0.15, intervalDays: 14 },
  };
}

// ---------------------------------------------------------------------------
// Shared helpers: build a ladder from the URL-state shape used by both the
// market simulator (home) and /swapliquidity, and derive a USD scalar
// "effective depth" for UI labels and the heatmap axis.
// ---------------------------------------------------------------------------

export interface LadderInputs {
  poolTVL_USD: number;
  bandSplitCore: number;
  bandSplitAbsorb: number;
  poolFeeTier: number; // 3000 or 10000 (basis points)
  bandCoreLowerPct?: number;
  bandCoreUpperPct?: number;
  bandAbsorbLowerPct?: number;
  bandAbsorbUpperPct?: number;
  bandTailLowerPct?: number;
  bandTailUpperPct?: number;
}

export function ladderRangesFromInputs(s: LadderInputs): BandRanges {
  return {
    core: {
      lowerPct: s.bandCoreLowerPct ?? DEFAULT_BAND_RANGES.core.lowerPct,
      upperPct: s.bandCoreUpperPct ?? DEFAULT_BAND_RANGES.core.upperPct,
    },
    absorb: {
      lowerPct: s.bandAbsorbLowerPct ?? DEFAULT_BAND_RANGES.absorb.lowerPct,
      upperPct: s.bandAbsorbUpperPct ?? DEFAULT_BAND_RANGES.absorb.upperPct,
    },
    tail: {
      lowerPct: s.bandTailLowerPct ?? DEFAULT_BAND_RANGES.tail.lowerPct,
      upperPct: s.bandTailUpperPct ?? DEFAULT_BAND_RANGES.tail.upperPct,
    },
  };
}

export function buildLadderFromInputs(spot: number, s: LadderInputs): PoolPreset {
  const tail = Math.max(0, 1 - s.bandSplitCore - s.bandSplitAbsorb);
  const feeTier: 3000 | 10000 = s.poolFeeTier === 10000 ? 10000 : 3000;
  return buildAsymmetricLadder(
    spot,
    s.poolTVL_USD,
    { core: s.bandSplitCore, absorb: s.bandSplitAbsorb, tail },
    feeTier,
    ladderRangesFromInputs(s),
  );
}

/**
 * USD-equivalent scalar depth of the ladder: sum of `liquidityUSD` across
 * positions whose price range covers `spot`. Intended for KPI labels and
 * heatmap axes; do NOT use for slippage math (use the AMM helpers instead).
 */
export function effectiveDepthFromPreset(preset: PoolPreset, spot: number): number {
  // Tick from spot via the same math as materializePool, but inlined here so
  // poolPreset stays free of the univ3 swap deps. tick = log(spot)/log(1.0001).
  const spotTick = Math.log(spot) / Math.log(1.0001);
  let total = 0;
  for (const pos of preset.positions) {
    if (pos.tickLower <= spotTick && spotTick < pos.tickUpper) {
      total += pos.liquidityUSD;
    }
  }
  return total;
}
