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
): PoolPreset {
  const spacing = SPACING[feeTier];
  const core = bandTicks(spot, -0.05, +0.05, spacing);
  const absorb = bandTicks(spot, -0.25, -0.10, spacing);
  const tail = bandTicks(spot, -0.50, +0.15, spacing);
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
}

export function buildLadderFromInputs(spot: number, s: LadderInputs): PoolPreset {
  const tail = Math.max(0, 1 - s.bandSplitCore - s.bandSplitAbsorb);
  const feeTier: 3000 | 10000 = s.poolFeeTier === 10000 ? 10000 : 3000;
  return buildAsymmetricLadder(
    spot,
    s.poolTVL_USD,
    { core: s.bandSplitCore, absorb: s.bandSplitAbsorb, tail },
    feeTier,
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
