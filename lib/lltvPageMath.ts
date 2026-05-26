import {
  tierScanRecommendation,
  type TierScanOut,
} from './simulator';

type TierRow = TierScanOut['perTier'][number];

export function slippageForGovernanceTier(
  perTier: readonly TierRow[],
  lltv: number,
): number {
  const row = perTier.find((candidate) => candidate.lltv === lltv);
  if (!row) {
    throw new RangeError(`No LLTV slippage row available for tier ${lltv}.`);
  }
  return row.slippage;
}

export function scanLLTVSensitivity(args: {
  drawdown: number;
  safetyMargin: number;
  perTier: readonly TierRow[];
}): TierScanOut {
  return tierScanRecommendation({
    p95Drawdown: args.drawdown,
    safetyMargin: args.safetyMargin,
    slippageAt: (lltv) => slippageForGovernanceTier(args.perTier, lltv),
  });
}
