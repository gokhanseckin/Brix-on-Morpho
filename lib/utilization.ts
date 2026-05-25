// lib/utilization.ts
import { adaptiveCurveIRM, LIF } from './morphoMath';
export interface LooperEconomicsInput {
  uTarget: number;
  rTarget: number;
  lltv: number;
  hfBuffer: number;            // ≥ 1.0
  witryYieldAnnual: number;    // USD APY used for the loop math (typically 7d figure)
  perLoopSlippageBps: number;  // basis points lost per loop step (round-trip swap cost)
  // Optional caller-supplied borrow APY. When provided, used directly;
  // otherwise derived from adaptiveCurveIRM(uTarget, rTarget). Lets the
  // home page reuse a memoized borrowAPY without drift risk.
  borrowAPY?: number;
  // Optional explicit loop count (finite partial sum). Omit for converged.
  loopCount?: number;
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

export interface CarryLoopInput {
  lltv: number;
  hfBuffer: number;            // ≥ 1.0
  witryYieldAnnual: number;
  borrowAPY: number;
  perLoopSlippageBps: number;
  // Number of explicit loop iterations. Omit (or pass Infinity) for the
  // closed-form converged sum; pass an integer 1..N for a finite partial
  // geometric sum 1 + b + b² + … + bⁿ where b = lltv/hfBuffer.
  loopCount?: number;
}

export interface CarryLoopOut {
  effectiveLeverage: number;
  borrowedShare: number;
  grossLoopAPY: number;
  borrowCost: number;
  slippageCost: number;
  hfIdleCost: number;
  netLoopAPY: number;
}

// Carry-only loop economics. Shared by /utilization (looperNetAPY) and the
// home-page strategy (lib/simulator.ts → computeStrategy). No FX overlay,
// no incentives — pure deterministic carry math.
export function carryLoopAPY(i: CarryLoopInput): CarryLoopOut {
  const borrowFraction = i.lltv / i.hfBuffer;
  const n = i.loopCount;
  // Finite partial geometric sum if n is a positive integer; otherwise the
  // closed-form converged sum. Capped at 50× for numerical safety.
  const finite = typeof n === 'number' && Number.isFinite(n) && n >= 1;
  const effectiveLeverage = finite
    ? (borrowFraction >= 1
        ? Math.min(50, n! + 1)
        : Math.min(50, (1 - Math.pow(borrowFraction, n! + 1)) / (1 - borrowFraction)))
    : (borrowFraction >= 1
        ? 50
        : Math.min(50, 1 / (1 - borrowFraction)));
  const borrowedShare = effectiveLeverage - 1;
  const grossLoopAPY = effectiveLeverage * i.witryYieldAnnual;
  const borrowCost   = borrowedShare * i.borrowAPY;
  const slippageCost = borrowedShare * (i.perLoopSlippageBps / 10_000);
  // Capital held back to maintain HF buffer earns nothing.
  const hfIdleCost   = i.witryYieldAnnual * (1 - 1 / i.hfBuffer) * borrowedShare;
  const netLoopAPY   = grossLoopAPY - borrowCost - slippageCost - hfIdleCost;
  return { effectiveLeverage, borrowedShare, grossLoopAPY, borrowCost, slippageCost, hfIdleCost, netLoopAPY };
}

export function looperNetAPY(i: LooperEconomicsInput): LooperEconomicsResult {
  const borrowAPY = i.borrowAPY ?? adaptiveCurveIRM(i.uTarget, i.rTarget);
  const carry = carryLoopAPY({
    lltv: i.lltv,
    hfBuffer: i.hfBuffer,
    witryYieldAnnual: i.witryYieldAnnual,
    borrowAPY,
    perLoopSlippageBps: i.perLoopSlippageBps,
    ...(i.loopCount !== undefined ? { loopCount: i.loopCount } : {}),
  });
  const { effectiveLeverage, grossLoopAPY, borrowCost, slippageCost, hfIdleCost, netLoopAPY } = carry;
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

export interface LooperPathPnLInput {
  paths: number[][];               // worker output; paths[i][t] = USD/TRY at step t
  lltv: number;
  hfBuffer: number;
  witryYieldAnnual: number;        // the wiTRY annual yield in USD terms (sidebar `witryYieldAnnual` on home; `witryYield7d` or `witryYield30d` on /utilization)
  borrowAPY: number;               // adaptiveCurveIRM(targetUtilization, rTarget)
  perLoopSlippageBps: number;
  loopCount?: number;              // explicit finite loop count; omit for converged
}

export interface LooperPathPnLResult {
  apyByPath: number[];
  liquidatedByPath: boolean[];
  apyP5: number;
  apyP50: number;
  apyP95: number;
  liquidationRate: number;
}

/**
 * Walk each Monte Carlo USD/TRY path forward, marking the levered wiTRY
 * position to market at each step. wiTRY NAV grows in TRY at witryYieldAnnual;
 * the USD value swings with 1/S[t]. Debt accrues at borrowAPY. If health
 * factor hits 1.0 at any step the position is closed; we charge an LIF
 * haircut proxy and freeze equity. At horizon the survivors are annualized.
 *
 * Output is per-path scalar realized APY plus distribution percentiles.
 * Crude vs simulateBadDebt: ignores AMM slippage at liquidation and assumes
 * a single liquidator-bonus haircut. That's intentional — this represents
 * the looper's expected P&L, not the protocol's bad-debt exposure.
 */
export function looperPathPnL(i: LooperPathPnLInput): LooperPathPnLResult {
  const borrowFraction = i.lltv / i.hfBuffer;
  const n = i.loopCount;
  const finite = typeof n === 'number' && Number.isFinite(n) && n >= 1;
  const effectiveLeverage = finite
    ? (borrowFraction >= 1
        ? Math.min(50, n! + 1)
        : Math.min(50, (1 - Math.pow(borrowFraction, n! + 1)) / (1 - borrowFraction)))
    : (borrowFraction >= 1
        ? 50
        : Math.min(50, 1 / (1 - borrowFraction)));
  const borrowedShare = effectiveLeverage - 1;
  const slippageDragAnnual = borrowedShare * (i.perLoopSlippageBps / 10_000);

  // Mirror the deterministic looperNetAPY convention: the looper holds back
  // a fraction (1 − 1/hfBuffer) of their levered debt as USD cash to maintain
  // the HF target rather than deploying it into wiTRY. That idle USD does
  // not swing with FX and earns no wiTRY yield (matching `hfIdleCost` in
  // looperNetAPY). Only the productive collateral is counted toward HF.
  const idleFrac = 1 - 1 / i.hfBuffer;
  const idleUSD = idleFrac * borrowedShare;             // USD cash reserve
  const productiveUSD0 = effectiveLeverage - idleUSD;    // wiTRY-equivalent at t=0

  const lif = LIF(i.lltv);
  const liqHaircutFracOfDebt = Math.max(0, lif - 1);

  const apyByPath: number[] = [];
  const liquidatedByPath: boolean[] = [];

  for (const path of i.paths) {
    if (path.length < 2) {
      apyByPath.push(0);
      liquidatedByPath.push(false);
      continue;
    }
    const S0 = path[0]!;
    if (!Number.isFinite(S0) || S0 <= 0) {
      apyByPath.push(0);
      liquidatedByPath.push(false);
      continue;
    }
    const H = path.length - 1;        // horizon in steps (days)
    const equity0 = 1;
    const debt0_USD = borrowedShare;

    let liquidated = false;
    let liquidationStep = -1;
    let terminalEquity = 0;
    let lastValidEquity: number | null = null;

    for (let t = 1; t <= H; t++) {
      const St = path[t]!;
      if (!Number.isFinite(St) || St <= 0) continue;
      // Simple-interest accrual on a per-day basis — matches the additive
      // annual rates in looperNetAPY (gross − borrow − slip − idle).
      const navMul = 1 + i.witryYieldAnnual * (t / 365);
      const productiveUSD = productiveUSD0 * navMul * (S0 / St);
      const collateralUSD = productiveUSD;             // HF uses posted collateral only
      const debtUSD = debt0_USD * (1 + i.borrowAPY * (t / 365));
      const dragUSD = slippageDragAnnual * (t / 365);
      const equity = productiveUSD + idleUSD - debtUSD - dragUSD;
      // HF = (collateral × lltv) / debt; HF ≤ 1 ⇒ liquidation.
      const hf = debtUSD > 0 ? (collateralUSD * i.lltv) / debtUSD : Infinity;
      if (hf <= 1) {
        liquidated = true;
        liquidationStep = t;
        terminalEquity = Math.max(0, equity - liqHaircutFracOfDebt * debtUSD);
        break;
      }
      lastValidEquity = equity;
    }
    if (!liquidated) {
      terminalEquity = lastValidEquity ?? 0;
    }

    const horizonForAnnualize = liquidated ? liquidationStep : H;
    const ratio = terminalEquity / equity0;
    // Simple-interest annualization keeps parity with looperNetAPY's
    // additive convention; compounding inflates short-horizon returns.
    const rawApy =
      horizonForAnnualize > 0
        ? ratio > 0
          ? (ratio - 1) * (365 / horizonForAnnualize)
          : -1
        : 0;
    // Economic floor: a levered position cannot lose more than 100% of
    // principal. Early-liquidation annualization can extrapolate past −1;
    // downstream consumers (histogram with lo=−1.0) rely on this floor.
    const apy = Math.max(-1, rawApy);
    apyByPath.push(apy);
    liquidatedByPath.push(liquidated);
  }

  const sorted = [...apyByPath].sort((x, y) => x - y);
  const at = (q: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor(q * (sorted.length - 1))),
    );
    return sorted[idx]!;
  };
  const liqRate = liquidatedByPath.filter(Boolean).length / Math.max(1, liquidatedByPath.length);

  return {
    apyByPath,
    liquidatedByPath,
    apyP5: at(0.05),
    apyP50: at(0.50),
    apyP95: at(0.95),
    liquidationRate: liqRate,
  };
}
