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
