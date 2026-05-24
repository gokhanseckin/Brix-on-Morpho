// lib/utilization.ts
import { adaptiveCurveIRM } from './morphoMath';
export interface LooperEconomicsInput {
  uTarget: number;
  rTarget: number;
  lltv: number;
  hfBuffer: number;            // ≥ 1.0
  witryYieldAnnual: number;    // USD APY used for the loop math (typically 7d figure)
  perLoopSlippageBps: number;  // basis points lost per loop step (round-trip swap cost)
  // FX risk overlay — vol only, no drift. Loopers are TRY-native carry
  // traders; their expected return is the carry (wiTRY yield − borrow
  // rate), and FX vol enters separately as a stress test on leverage.
  fxAnnualVol: number;         // e.g. 0.168 from dailyLogReturns(usdtryData)
  fxStressZ: number;           // stress quantile multiplier; 1.65 ≈ 95th pct
}

export interface LooperEconomicsResult {
  effectiveLeverage: number;
  borrowAPY: number;
  grossLoopAPY: number;
  borrowCost: number;
  slippageCost: number;
  hfIdleCost: number;
  netLoopAPY: number;
  loopMargin: number;             // netLoopAPY − witryYieldAnnual (carry beats hold?)
  // FX stress overlay
  fxStressDrawdown_30d: number;   // = fxAnnualVol × √(30/365) × fxStressZ
  loopSurvivesStress: boolean;    // levered drawdown vs HF headroom
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
  fxSafe: boolean;
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
  fxAnnualVol: number;         // FX vol overlay; 0 disables the stress gate
  fxStressZ: number;           // stress quantile; default 1.65 (≈ 95th pct)
  searchRange: [number, number];
  searchStep: number;
}

export interface RecommendResult {
  recommended: number | null;
  unmetConstraints: Array<'loopMargin' | 'stressSurvival' | 'kinkClearance' | 'fxSafe'>;
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
  // Carry math is TRY-native. wiTRY yield IS the compensation for FX risk;
  // we do NOT subtract expected TRY depreciation here. FX appears below as
  // a separate stress-test on leverage.
  const borrowCost   = borrowedShare * borrowAPY;
  const slippageCost = borrowedShare * (i.perLoopSlippageBps / 10_000);
  // Capital held back to maintain HF buffer earns nothing.
  const hfIdleCost   = i.witryYieldAnnual * (1 - 1 / i.hfBuffer) * borrowedShare;

  const netLoopAPY = grossLoopAPY - borrowCost - slippageCost - hfIdleCost;
  const loopMargin = netLoopAPY - i.witryYieldAnnual;

  // FX stress: 30-day P95 USD/TRY move under a normal-vol assumption.
  // Levered exposure to that move must fit inside the HF headroom
  // (1 − lltv/hfBuffer), otherwise the stress wipes the position.
  const fxStressDrawdown_30d = i.fxAnnualVol * Math.sqrt(30 / 365) * i.fxStressZ;
  const hfHeadroom = Math.max(0, 1 - i.lltv / i.hfBuffer);
  const loopSurvivesStress = effectiveLeverage * fxStressDrawdown_30d < hfHeadroom;

  return {
    effectiveLeverage, borrowAPY, grossLoopAPY, borrowCost, slippageCost,
    hfIdleCost, netLoopAPY, loopMargin,
    fxStressDrawdown_30d, loopSurvivesStress,
  };
}
export function liquidityStress(i: LiquidityStressInput): LiquidityStressResult {
  const bufferUSD = Math.max(0, (1 - i.uTarget) * i.tvlUSDM_USD);
  const stressWithdrawalUSD = i.stressPctOfSupply * i.tvlUSDM_USD;
  const survives = bufferUSD >= stressWithdrawalUSD - 1e-9;
  const borrowedUSD = i.uTarget * i.tvlUSDM_USD;
  const dailyRepayment = (i.borrowAPY * borrowedUSD) / 365;
  const shortfall = Math.max(0, stressWithdrawalUSD - bufferUSD);
  const daysToRefillEstimate = dailyRepayment > 0 ? shortfall / dailyRepayment : Infinity;
  return { bufferUSD, stressWithdrawalUSD, survives, daysToRefillEstimate };
}
export function sweepUtilizationTargets(i: RecommendInput): SweepRow[] {
  const [lo, hi] = i.searchRange;
  const out: SweepRow[] = [];
  for (let u = lo; u <= hi + 1e-9; u += i.searchStep) {
    const u2 = Math.round(u * 1e6) / 1e6;
    const e7 = looperNetAPY({
      uTarget: u2, rTarget: i.rTarget, lltv: i.lltv, hfBuffer: i.hfBuffer,
      witryYieldAnnual: i.witryYield7d, perLoopSlippageBps: i.perLoopSlippageBps,
      fxAnnualVol: i.fxAnnualVol, fxStressZ: i.fxStressZ,
    });
    const e30 = looperNetAPY({
      uTarget: u2, rTarget: i.rTarget, lltv: i.lltv, hfBuffer: i.hfBuffer,
      witryYieldAnnual: i.witryYield30d, perLoopSlippageBps: i.perLoopSlippageBps,
      fxAnnualVol: i.fxAnnualVol, fxStressZ: i.fxStressZ,
    });
    const stress = liquidityStress({
      uTarget: u2, tvlUSDM_USD: i.tvlUSDM_USD,
      stressPctOfSupply: i.stressPctOfSupply, borrowAPY: e7.borrowAPY,
    });
    const distanceToKink = 0.9 - u2;
    const meetsLoop = e7.loopMargin > 0;
    const meetsKink = distanceToKink >= i.kinkClearance;
    const meetsStress = stress.survives;
    const meetsFx = e7.loopSurvivesStress;
    const verdict: SweepRow['verdict'] =
      meetsLoop && meetsKink && meetsStress && meetsFx ? 'feasible'
      : (meetsLoop && meetsKink) ? 'tight'
      : 'infeasible';
    out.push({
      uTarget: u2,
      borrowAPY: e7.borrowAPY,
      supplierAPY: e7.borrowAPY * u2,
      loopMargin7d: e7.loopMargin,
      loopMargin30d: e30.loopMargin,
      bufferUSD: stress.bufferUSD,
      stressWithdrawalUSD: stress.stressWithdrawalUSD,
      survives: stress.survives,
      distanceToKink,
      fxSafe: meetsFx,
      verdict,
    });
  }
  return out;
}
export function recommendUTarget(i: RecommendInput): RecommendResult {
  const rows = sweepUtilizationTargets(i);
  const feasible = rows.filter(r => r.verdict === 'feasible');
  if (feasible.length > 0) {
    const best = feasible.reduce((a, b) => (b.uTarget > a.uTarget ? b : a));
    return { recommended: best.uTarget, unmetConstraints: [], bestEffort: best.uTarget };
  }
  const loopAndKink = rows.filter(r => r.loopMargin7d > 0 && r.distanceToKink >= i.kinkClearance);
  const bestEffort = loopAndKink.length > 0
    ? loopAndKink.reduce((a, b) => (b.uTarget > a.uTarget ? b : a)).uTarget
    : 0;
  const unmet: RecommendResult['unmetConstraints'] = [];
  const anyLoop = rows.some(r => r.loopMargin7d > 0);
  const anyStress = rows.some(r => r.survives);
  const anyKink = rows.some(r => r.distanceToKink >= i.kinkClearance);
  const anyFx = rows.some(r => r.fxSafe);
  if (!anyLoop) unmet.push('loopMargin');
  if (!anyStress) unmet.push('stressSurvival');
  if (!anyKink) unmet.push('kinkClearance');
  if (!anyFx) unmet.push('fxSafe');
  if (unmet.length === 0) unmet.push('stressSurvival');
  return { recommended: null, unmetConstraints: unmet, bestEffort };
}
