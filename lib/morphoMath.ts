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

/** Static AdaptiveCurveIRM (no time evolution). u in [0,1], r_target as APR. */
export function adaptiveCurveIRM(u: number, rTarget: number): number {
  const x = Math.max(0, Math.min(1, u));
  const k1 = Math.log(4) / 0.9;
  const k2 = Math.log(4) / 0.1;
  if (x <= 0.9) {
    return (rTarget / 4) * Math.exp(k1 * x);
  }
  const a2 = rTarget * Math.exp(-0.9 * k2);
  return a2 * Math.exp(k2 * x);
}
