export const BETA = 0.3;
export const LIF_CAP = 1.15;

/** Morpho Liquidation Incentive Factor. LIF = min(LIF_CAP, 1/(β·LLTV + (1−β))). */
export function LIF(lltv: number): number {
  return Math.min(LIF_CAP, 1 / (BETA * lltv + (1 - BETA)));
}

export interface PositionView { collateralUSD: number; debtUSD: number; lltv: number; }
export function healthFactor(p: PositionView): number {
  if (p.debtUSD === 0) return Infinity;
  return (p.collateralUSD * p.lltv) / p.debtUSD;
}

// AdaptiveCurveIRM segment slopes — hoisted; IRM is called in the Monte Carlo hot loop.
const IRM_K1 = Math.log(4) / 0.9;
const IRM_K2 = Math.log(4) / 0.1;

/** Static AdaptiveCurveIRM (no time evolution). u clamped to [0,1]; continuous at u=0.9. */
export function adaptiveCurveIRM(u: number, rTarget: number): number {
  const x = Math.max(0, Math.min(1, u));
  if (x <= 0.9) {
    return (rTarget / 4) * Math.exp(IRM_K1 * x);
  }
  return rTarget * Math.exp(IRM_K2 * (x - 0.9));
}

export function witryPerITRY(tDays: number, iTRYYieldAnnual: number): number {
  return Math.pow(1 + iTRYYieldAnnual, tDays / 365);
}

export interface WitryUsdArgs { tDays: number; iTRYYieldAnnual: number; usdTryRate: number; }
export function witryUSD(a: WitryUsdArgs): number {
  return witryPerITRY(a.tDays, a.iTRYYieldAnnual) / a.usdTryRate;
}
