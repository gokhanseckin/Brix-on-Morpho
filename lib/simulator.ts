import { adaptiveCurveIRM, healthFactor, LIF } from './morphoMath';
import { createRng, gauss, type Rng } from './rng';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';

export interface LiqNeedArgs {
  witryTVL_USD: number;
  lltv: number;
  targetUtilization: number;
  borrowerLTVAlpha: number;
  borrowerLTVBeta: number;
  incentiveAPY: number;
  baseSupplyAPY: number;
  deadDepositCost: number;
}

export interface LiqNeedOut {
  maxBorrowable_USD: number;
  expectedBorrow_USD: number;
  requiredUSDM: number;
  withdrawalBuffer_USD: number;
  liquidityFloor_USD: number;
  bufferPct: number;
}

export function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

// --- Operational-policy dials ---------------------------------------------
// These are NOT derived from first principles. They are governance-tunable
// reserves chosen to absorb plausible operational stress (cascading
// withdrawals, incentive-chase inflows) without exhausting market liquidity.
// Surface them in the help system as "policy assumptions", not "derived".
//
// LIQUIDITY_FLOOR_FRACTION: minimum share of requiredUSDM kept permanently
//   parked. Sized to absorb a ~P95 cascading-withdrawal event without
//   triggering a market shortage.
// DEAD_DEPOSIT_MULTIPLIER:  hard-floor multiplier on a single dead-deposit
//   transaction cost; sets a sensible minimum reserve for very small markets
//   where 20% of required is itself tiny.
// BUFFER_PCT_BASE:          baseline withdrawal buffer in the absence of
//   incentives.
// BUFFER_PCT_INCENTIVE_SLOPE: how much the buffer grows per unit of
//   (incentiveAPY / baseSupplyAPY). Captures the intuition that aggressive
//   incentives attract chase-yield capital that withdraws faster.
export const LIQUIDITY_FLOOR_FRACTION = 0.20;
export const DEAD_DEPOSIT_MULTIPLIER = 100;
export const BUFFER_PCT_BASE = 0.15;
export const BUFFER_PCT_INCENTIVE_SLOPE = 0.10;

// PRE_LIQUIDATION_LLTV_OFFSET: distance below hard LLTV at which the
//   pre-liquidation zone begins. Spec §4D recommends 5pp.
// RISK_TIER_MODERATE_BAND_LLTV: width of the Moderate band above the
//   computed recommended LLTV before a configuration is classed Aggressive.
//   Spec §5 Risk Gauge.
export const PRE_LIQUIDATION_LLTV_OFFSET = 0.05;
export const RISK_TIER_MODERATE_BAND_LLTV = 0.05;
export const PRE_LIQUIDATION_LCF: [number, number] = [0.05, 0.5];
export const PRE_LIQUIDATION_LIF_MIN = 1.01;

export function bufferPctFromIncentive(incentiveAPY: number, baseSupplyAPY: number): number {
  const ratio = baseSupplyAPY > 0 ? incentiveAPY / baseSupplyAPY : 0;
  return BUFFER_PCT_BASE + BUFFER_PCT_INCENTIVE_SLOPE * ratio;
}

export function computeLiquidityNeed(a: LiqNeedArgs): LiqNeedOut {
  const meanLTVFrac = betaMean(a.borrowerLTVAlpha, a.borrowerLTVBeta);
  const maxBorrowable_USD = a.witryTVL_USD * a.lltv;
  const expectedBorrow_USD = maxBorrowable_USD * meanLTVFrac;
  const requiredUSDM = expectedBorrow_USD / a.targetUtilization;
  const bufferPct = bufferPctFromIncentive(a.incentiveAPY, a.baseSupplyAPY);
  const withdrawalBuffer_USD = requiredUSDM * bufferPct;
  const liquidityFloor_USD = Math.max(
    a.deadDepositCost * DEAD_DEPOSIT_MULTIPLIER,
    requiredUSDM * LIQUIDITY_FLOOR_FRACTION,
  );
  return {
    maxBorrowable_USD,
    expectedBorrow_USD,
    requiredUSDM,
    withdrawalBuffer_USD,
    liquidityFloor_USD,
    bufferPct,
  };
}

export function irmCurvePoints(rTarget: number, steps = 51): Array<{ u: number; r: number }> {
  const pts: Array<{ u: number; r: number }> = [];
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    pts.push({ u, r: adaptiveCurveIRM(u, rTarget) });
  }
  return pts;
}

/** Sample from Gamma(shape, 1) via Marsaglia-Tsang. */
function gammaSample(rng: Rng, shape: number): number {
  if (shape < 1) {
    return gammaSample(rng, shape + 1) * Math.pow(rng(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const x = gauss(rng);
    let v = 1 + c * x;
    if (v <= 0) continue;
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBetaLtvFractions(a: {
  alpha: number;
  beta: number;
  n: number;
  seed: number | string;
}): number[] {
  const rng = createRng(a.seed);
  const out: number[] = [];
  for (let i = 0; i < a.n; i++) {
    const x = gammaSample(rng, a.alpha);
    const y = gammaSample(rng, a.beta);
    out.push(x / (x + y));
  }
  return out;
}

export interface PctUnderwaterArgs {
  ltvFractions: number[];
  lltv: number;
  collateralRelChange: number;
}

/** position underwater when ltvFrac > collateralRelChange (debt > newColl × LLTV reduces to that). */
export function pctUnderwaterAtT(a: PctUnderwaterArgs): number {
  if (a.ltvFractions.length === 0) return 0;
  let underwater = 0;
  for (const f of a.ltvFractions) {
    if (f > a.collateralRelChange) underwater++;
  }
  return underwater / a.ltvFractions.length;
}

/** AMM slippage for selling L USD-worth into one-side reserve D (USD). */
export function slippage(L_USD: number, D_USD: number): number {
  if (D_USD <= 0) return 1;
  return L_USD / (L_USD + D_USD);
}

export interface LiquidatorArgs {
  debt_USD: number;
  lltv: number;
  poolDepth_USD: number;
  gasCost_USD: number;
  holdingRisk_USD: number;
}

export interface LiquidatorOut {
  collateralSeized_USD: number;
  slippagePct: number;
  revenue_USD: number;
  profit_USD: number;
}

export function liquidatorProfit(a: LiquidatorArgs): LiquidatorOut {
  const lif = LIF(a.lltv);
  const collateralSeized_USD = a.debt_USD * lif;
  const slippagePct = slippage(collateralSeized_USD, a.poolDepth_USD);
  const revenue_USD = collateralSeized_USD * (1 - slippagePct);
  const profit_USD = revenue_USD - a.debt_USD - a.gasCost_USD - a.holdingRisk_USD;
  return { collateralSeized_USD, slippagePct, revenue_USD, profit_USD };
}

export interface MinMaxArgs {
  lltv: number;
  poolDepth_USD: number;
  gasCost_USD: number;
}

export function minMaxProfitableLiquidation(a: MinMaxArgs): { min_USD: number; max_USD: number } {
  const profitAt = (debt: number): number =>
    liquidatorProfit({ ...a, debt_USD: debt, holdingRisk_USD: 0 }).profit_USD;
  // Coarse scan to locate a profitable peak (profit is non-monotonic: gas dominates small,
  // slippage dominates large). Then binary-search the two zero-crossings.
  let peak = 1;
  let peakProfit = profitAt(peak);
  for (let i = 1; i <= 80; i++) {
    const x = Math.pow(10, i / 10);
    const p = profitAt(x);
    if (p > peakProfit) {
      peakProfit = p;
      peak = x;
    }
  }
  if (peakProfit <= 0) return { min_USD: NaN, max_USD: NaN };

  // min: smallest debt with profit ≥ 0 in [0, peak]
  let lo = 0;
  let hi = peak;
  let min_USD = peak;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) > 0) {
      hi = mid;
      min_USD = mid;
    } else {
      lo = mid;
    }
  }
  // max: largest debt with profit ≥ 0 in [peak, peak × 1e6]
  lo = peak;
  hi = peak * 1e6;
  let max_USD = peak;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) > 0) {
      lo = mid;
      max_USD = mid;
    } else {
      hi = mid;
    }
  }
  return { min_USD, max_USD };
}

export interface BadDebtArgs {
  paths: number[][];
  ltvFractions: number[];
  lltv: number;
  tvl_USD: number;
  poolDepth_USD: number;
  gasCost_USD: number;
  witryYieldAnnual: number;
  preLiquidationEnabled: boolean;
}

export interface BadDebtOut {
  badDebtByPath: number[];
  liquidatedCountByPath: number[];
  /** Sum of seized USD per path (pre-liquidation + hard liquidation revenue). */
  liquidatedVolumeByPath: number[];
  badDebtP95_USD: number;
  badDebtP95Pct: number;
}

export function simulateBadDebt(a: BadDebtArgs): BadDebtOut {
  const N = a.ltvFractions.length;
  const collateralEachUSD = a.tvl_USD / Math.max(1, N);
  const firstPath = a.paths[0];
  if (!firstPath || firstPath.length === 0) {
    return {
      badDebtByPath: [],
      liquidatedCountByPath: [],
      liquidatedVolumeByPath: [],
      badDebtP95_USD: 0,
      badDebtP95Pct: 0,
    };
  }
  const S0 = firstPath[0]!;

  // Pre-liquidation parameters per spec §4D.
  const preLLTV = Math.max(0, a.lltv - PRE_LIQUIDATION_LLTV_OFFSET);
  const preLIF1 = PRE_LIQUIDATION_LIF_MIN;
  const preLCF2 = PRE_LIQUIDATION_LCF[1];

  const badDebtByPath: number[] = [];
  const liquidatedCountByPath: number[] = [];
  const liquidatedVolumeByPath: number[] = [];

  for (const path of a.paths) {
    let pathSeizedVolume_USD = 0;
    const active = a.ltvFractions.map((f) => ({
      ltvFrac: f,
      debt_USD: f * a.lltv * collateralEachUSD,
      collateralBaseUSD: collateralEachUSD,
      closed: false,
      preLiquidated: false,
      residual_USD: 0,
    }));

    for (let t = 1; t < path.length; t++) {
      const Snow = path[t]!;
      const rel = (Math.pow(1 + a.witryYieldAnnual, t / 365) * S0) / Snow;
      for (const pos of active) {
        if (pos.closed) continue;
        const collNow = pos.collateralBaseUSD * rel;
        // Effective LTV of this position right now.
        const effLTV = pos.debt_USD / Math.max(1e-9, collNow);

        // Pre-liquidation: position has drifted between preLLTV and LLTV.
        // Simplification: one-shot 50% close at LIF=1.01. The remaining
        // half continues; if it crosses hard LLTV later it gets liquidated.
        if (
          a.preLiquidationEnabled &&
          !pos.preLiquidated &&
          effLTV >= preLLTV &&
          effLTV < a.lltv
        ) {
          const closeDebt = pos.debt_USD * preLCF2;
          const seized = closeDebt * preLIF1;
          pathSeizedVolume_USD += seized;
          const slipPct = slippage(seized, a.poolDepth_USD);
          // Auto-deleverage routes through the same AMM; collateral seized
          // and debt repaid are removed from the position pro-rata.
          const repaid = Math.min(closeDebt, seized * (1 - slipPct));
          pos.debt_USD -= repaid;
          // Report #2 entry #27 fix: the fraction of collateral seized is
          // seized_USD / collNow_USD, NOT preLCF2 · preLIF1 (which only
          // happens to equal the fraction when debt = collateral).
          const fractionSeized = Math.min(1, seized / Math.max(1e-9, collNow));
          pos.collateralBaseUSD *= 1 - fractionSeized;
          if (pos.collateralBaseUSD < 0) pos.collateralBaseUSD = 0;
          pos.preLiquidated = true;
          // Spec §4D defines a full piecewise-linear LCF/LIF schedule
          // interpolated by effLTV in [preLLTV, LLTV]; this is a coarse
          // one-shot approximation. Continue to hard-LLTV check below.
        }

        const collAfter = pos.collateralBaseUSD * rel;
        const hf = healthFactor({ collateralUSD: collAfter, debtUSD: pos.debt_USD, lltv: a.lltv });
        if (hf <= 1) {
          const { revenue_USD } = liquidatorProfit({
            debt_USD: pos.debt_USD,
            lltv: a.lltv,
            poolDepth_USD: a.poolDepth_USD,
            gasCost_USD: a.gasCost_USD,
            holdingRisk_USD: 0,
          });
          const profit = revenue_USD - pos.debt_USD - a.gasCost_USD;
          if (profit > 0) {
            pos.closed = true;
            pos.residual_USD = Math.max(0, pos.debt_USD - revenue_USD);
            // Liquidator actually executed: this revenue is the USD volume
            // that hit the secondary AMM. Unprofitable branch is NOT counted
            // because no liquidator fires there.
            pathSeizedVolume_USD += revenue_USD;
          } else {
            pos.closed = true;
            pos.residual_USD = Math.max(0, pos.debt_USD - collAfter);
          }
        }
      }
    }

    const bd = active.reduce((s, p) => s + p.residual_USD, 0);
    const count = active.filter((p) => p.closed).length;
    badDebtByPath.push(bd);
    liquidatedCountByPath.push(count);
    liquidatedVolumeByPath.push(pathSeizedVolume_USD);
  }

  const sorted = [...badDebtByPath].sort((x, y) => x - y);
  const idx = Math.floor(0.95 * Math.max(0, sorted.length - 1));
  const badDebtP95_USD = sorted[idx] ?? 0;
  return {
    badDebtByPath,
    liquidatedCountByPath,
    liquidatedVolumeByPath,
    badDebtP95_USD,
    badDebtP95Pct: a.tvl_USD > 0 ? badDebtP95_USD / a.tvl_USD : 0,
  };
}

export interface DeriveArgs {
  p95Drawdown: number;
  slippage: number;
  safetyMargin: number;
  maxIter?: number;
  tol?: number;
}

export interface DeriveOut {
  raw: number;
  converged: boolean;
  iterations: number;
}

export function deriveRecommendedLLTV(a: DeriveArgs): DeriveOut {
  const max = a.maxIter ?? 20;
  const tol = a.tol ?? 1e-4;
  let L = 0.80;
  let converged = false;
  let i = 0;
  for (; i < max; i++) {
    const lif = LIF(L);
    const next = (1 - a.p95Drawdown) / (lif * (1 + a.slippage)) - a.safetyMargin;
    if (Math.abs(next - L) < tol) {
      L = next;
      converged = true;
      i++;
      break;
    }
    L = next;
  }
  // On non-convergence (rare; can happen with degenerate inputs that drive
  // L out of [0, 1]), returns the last iterate clamped to a sensible band.
  // Consumers should treat converged=false as a hint to widen safetyMargin.
  return { raw: Math.max(0, Math.min(0.98, L)), converged, iterations: i };
}

export function snapToGovernanceLLTV(raw: number): LLTV | 0 {
  const sorted = [...GOV_LLTVS].sort((x, y) => x - y);
  let chosen: LLTV | 0 = 0;
  for (const lv of sorted) {
    if (lv <= raw) chosen = lv;
  }
  return chosen;
}

export interface StrategyArgs {
  borrowAPY: number;
  targetUtilization: number;
  performanceFee: number;
  managementFee: number;
  requiredUSDM: number;
  incentiveBudgetMonthly_USD: number;
  attractionRate: number;
  witryYieldAnnual: number;
  expectedTRYDepreciation_annual: number;
  competingAPY: number;
}

export interface StrategyOut {
  grossSupplyAPY: number;
  netSupplyAPY: number;
  incentiveAPY: number;
  totalSupplyAPY: number;
  daysToTarget: number;
  retentionAfterIncentivesEnd_USD: number;
  totalIncentiveSpend_USD: number;
  leverageLoopAPY: number;
  leverageLoopsViable: boolean;
}

export function computeStrategy(a: StrategyArgs): StrategyOut {
  const grossSupplyAPY = a.borrowAPY * a.targetUtilization;
  const netSupplyAPY = grossSupplyAPY * (1 - a.performanceFee) - a.managementFee;
  const incentiveAPY =
    a.requiredUSDM > 0 ? (a.incentiveBudgetMonthly_USD * 12) / a.requiredUSDM : 0;
  const totalSupplyAPY = netSupplyAPY + incentiveAPY;
  const dailyAttract = (a.incentiveBudgetMonthly_USD * a.attractionRate) / 30;
  const daysToTarget = dailyAttract > 0 ? a.requiredUSDM / dailyAttract : Infinity;
  const retentionAfterIncentivesEnd_USD =
    a.competingAPY > 0
      ? a.requiredUSDM * Math.min(1, netSupplyAPY / a.competingAPY)
      : a.requiredUSDM;
  const totalIncentiveSpend_USD = a.incentiveBudgetMonthly_USD * (daysToTarget / 30);
  // Leverage-loop borrower deposits wiTRY (earns witryYield in TRY) and
  // borrows USDM. Debt cost in TRY-real-terms = borrowAPY × (TRY/USD ratio
  // at repayment / today). If TRY depreciates `d` over the year, that
  // ratio is `(1 + d)`. So real cost = borrowAPY · (1 + d). Report #2
  // open question #1: spec §3B text has a sign typo (`1 − USD_TRY_return`)
  // that conflicts with this; code is the economically correct form.
  const leverageLoopAPY =
    a.witryYieldAnnual - a.borrowAPY * (1 + a.expectedTRYDepreciation_annual);
  return {
    grossSupplyAPY,
    netSupplyAPY,
    incentiveAPY,
    totalSupplyAPY,
    daysToTarget,
    retentionAfterIncentivesEnd_USD,
    totalIncentiveSpend_USD,
    leverageLoopAPY,
    leverageLoopsViable: leverageLoopAPY > 0,
  };
}

export interface VaultJsonArgs {
  lltv: number;
  oracle: string;
  irm: string;
  performanceFee: number;
  managementFee: number;
  timelockSeconds: number;
  cap_USD: number;
  preLLTV: number;
  preLCF: [number, number];
  preLIF: [number, number];
}

function to18Decimal(x: number): string {
  const big = BigInt(Math.round(x * 1e18));
  return big.toString();
}

export interface VaultConfigJson {
  market: { lltv: string; irm: string; oracle: string };
  vault: {
    performanceFee: number;
    managementFee: number;
    timelock: number;
    caps: { absoluteUSD: number; relative: number };
  };
  preLiquidation: { preLLTV: string; preLCF: [number, number]; preLIF: [number, number] };
}

export function buildVaultConfigJson(a: VaultJsonArgs): VaultConfigJson {
  return {
    market: { lltv: to18Decimal(a.lltv), irm: a.irm, oracle: a.oracle },
    vault: {
      performanceFee: a.performanceFee,
      managementFee: a.managementFee,
      timelock: a.timelockSeconds,
      caps: { absoluteUSD: a.cap_USD, relative: 1.0 },
    },
    preLiquidation: { preLLTV: to18Decimal(a.preLLTV), preLCF: a.preLCF, preLIF: a.preLIF },
  };
}

export function classifyRiskTier(
  chosen: number,
  recommended: number
): 'Conservative' | 'Moderate' | 'Aggressive' {
  if (chosen <= recommended) return 'Conservative';
  if (chosen <= recommended + RISK_TIER_MODERATE_BAND_LLTV) return 'Moderate';
  return 'Aggressive';
}
