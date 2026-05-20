// lib/utilization.ts
import { adaptiveCurveIRM } from './morphoMath';
export interface LooperEconomicsInput {
  uTarget: number;
  rTarget: number;
  lltv: number;
  hfBuffer: number;            // ≥ 1.0
  witryYieldAnnual: number;    // USD APY used for the loop math (typically 7d figure)
  perLoopSlippageBps: number;  // basis points lost per loop step (round-trip swap cost)
}

export interface LooperEconomicsResult {
  effectiveLeverage: number;
  borrowAPY: number;
  grossLoopAPY: number;
  borrowCost: number;
  slippageCost: number;
  hfIdleCost: number;
  netLoopAPY: number;
  loopMargin: number;          // netLoopAPY − witryYieldAnnual (i.e. "beats holding wiTRY"?)
}

export interface LiquidityStressInput {
  uTarget: number;
  tvlUSDM_USD: number;
  stressPctOfSupply: number;   // 0..1
  borrowAPY: number;
}

export interface LiquidityStressResult {
  bufferUSD: number;
  stressWithdrawalUSD: number;
  survives: boolean;
  daysToRefillEstimate: number;
}

export interface SweepRow {
  uTarget: number;
  borrowAPY: number;
  supplierAPY: number;
  loopMargin7d: number;
  loopMargin30d: number;
  bufferUSD: number;
  stressWithdrawalUSD: number;
  survives: boolean;
  distanceToKink: number;
  verdict: 'feasible' | 'tight' | 'infeasible';
}

export interface RecommendInput {
  rTarget: number;
  lltv: number;
  hfBuffer: number;
  witryYield7d: number;
  witryYield30d: number;
  perLoopSlippageBps: number;
  tvlUSDM_USD: number;
  stressPctOfSupply: number;
  kinkClearance: number;       // default 0.07
  searchRange: [number, number];
  searchStep: number;
}

export interface RecommendResult {
  recommended: number | null;
  unmetConstraints: Array<'loopMargin' | 'stressSurvival' | 'kinkClearance'>;
  bestEffort: number;
}

export function looperNetAPY(i: LooperEconomicsInput): LooperEconomicsResult {
  const borrowFraction = i.lltv / i.hfBuffer;
  // Closed-form geometric-sum leverage. Capped at 50× for numerical safety
  // (HF buffer ≥ 1.1 makes that ceiling unreachable in practice).
  const effectiveLeverage = borrowFraction >= 1
    ? 50
    : Math.min(50, 1 / (1 - borrowFraction));

  const borrowAPY = adaptiveCurveIRM(i.uTarget, i.rTarget);
  const borrowedShare = effectiveLeverage - 1;            // levered debt / equity

  const grossLoopAPY = effectiveLeverage * i.witryYieldAnnual;
  const borrowCost   = borrowedShare * borrowAPY;
  const slippageCost = borrowedShare * (i.perLoopSlippageBps / 10_000);
  // Capital held back to maintain HF buffer earns nothing.
  const hfIdleCost   = i.witryYieldAnnual * (1 - 1 / i.hfBuffer) * borrowedShare;

  const netLoopAPY = grossLoopAPY - borrowCost - slippageCost - hfIdleCost;
  const loopMargin = netLoopAPY - i.witryYieldAnnual;

  return { effectiveLeverage, borrowAPY, grossLoopAPY, borrowCost, slippageCost, hfIdleCost, netLoopAPY, loopMargin };
}
export function liquidityStress(_i: LiquidityStressInput): LiquidityStressResult {
  throw new Error('not implemented');
}
export function sweepUtilizationTargets(_i: RecommendInput): SweepRow[] {
  throw new Error('not implemented');
}
export function recommendUTarget(_i: RecommendInput): RecommendResult {
  throw new Error('not implemented');
}
