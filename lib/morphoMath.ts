export const BETA = 0.3;

/** Morpho Liquidation Incentive Factor. LIF = min(1.15, 1/(β·LLTV + (1−β))). */
export function LIF(lltv: number): number {
  return Math.min(1.15, 1 / (BETA * lltv + (1 - BETA)));
}

export interface PositionView { collateralUSD: number; debtUSD: number; lltv: number; }
export function healthFactor(p: PositionView): number {
  if (p.debtUSD === 0) return Infinity;
  return (p.collateralUSD * p.lltv) / p.debtUSD;
}
