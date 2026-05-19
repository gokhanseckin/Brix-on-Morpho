export const BETA = 0.3;

/** Morpho Liquidation Incentive Factor. LIF = min(1.15, 1/(β·LLTV + (1−β))). */
export function LIF(lltv: number): number {
  return Math.min(1.15, 1 / (BETA * lltv + (1 - BETA)));
}
