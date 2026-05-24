import { adaptiveCurveIRM, BETA, healthFactor, LIF, LIF_CAP } from './morphoMath';
import { createRng, gauss, type Rng } from './rng';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';
import type { PoolPreset } from './poolPreset';
import { materializePool } from './univ3/quoteLiquidatorSell';
import { swapExactIn, type PoolState } from './univ3/swap';

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
export const BUFFER_PCT_CEILING = 0.50;

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
  const raw = BUFFER_PCT_BASE + BUFFER_PCT_INCENTIVE_SLOPE * ratio;
  return Math.max(BUFFER_PCT_BASE, Math.min(BUFFER_PCT_CEILING, raw));
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

/**
 * Legacy heuristic AMM slippage for selling L USD-worth into a one-side
 * scalar reserve D (USD). Retained for the heatmap and unit tests; the
 * preset-based path below is the primary slippage source.
 */
export function slippage(L_USD: number, D_USD: number): number {
  if (D_USD <= 0) return 1;
  return L_USD / (L_USD + D_USD);
}

/**
 * AMM-accurate sell quote: returns USDM proceeds and a fully-loaded slippage
 * fraction (includes fee + price impact). `spot` is USD per TRY (= 1 /
 * usdtryBaseline). `sellUSD` is the USD-notional of wTRY collateral the
 * liquidator dumps. If the pool can't absorb the sell, slippagePct→1.
 */
export function quoteSellUSD(
  pool: PoolState,
  spot: number,
  sellUSD: number,
): { revenue_USD: number; slippagePct: number; newPool: PoolState } {
  if (sellUSD <= 0 || spot <= 0) return { revenue_USD: 0, slippagePct: 0, newPool: pool };
  const wTRYwei = BigInt(Math.floor((sellUSD / spot) * 1e6));
  if (wTRYwei <= 0n) return { revenue_USD: 0, slippagePct: 0, newPool: pool };
  const { quote, newPool } = swapExactIn(pool, wTRYwei, true /* sell wTRY */);
  const revenue_USD = Number(quote.amountOut) / 1e6;
  const slippagePct = Math.max(0, Math.min(1, 1 - revenue_USD / sellUSD));
  return { revenue_USD, slippagePct, newPool };
}

/** Convenience: combined slippage fraction for a single sell on a preset. */
export function slippageFromPreset(
  preset: PoolPreset,
  spot: number,
  sellUSD: number,
): number {
  const pool = materializePool(preset, spot);
  return quoteSellUSD(pool, spot, sellUSD).slippagePct;
}

export interface LiquidatorArgs {
  debt_USD: number;
  lltv: number;
  preset: PoolPreset;
  spot: number;            // USD per TRY (= 1 / usdtryBaseline)
  gasCost_USD: number;
  holdingRisk_USD: number;
}

export interface LiquidatorOut {
  collateralSeized_USD: number;
  slippagePct: number;
  revenue_USD: number;
  profit_USD: number;
  newPool: PoolState;
}

export interface LiquidatorPoolArgs extends Omit<LiquidatorArgs, 'preset'> {
  collateralAvailable_USD?: number;
  sellSpot?: number;
}

export function liquidatorProfit(a: LiquidatorArgs): LiquidatorOut {
  return liquidatorProfitWithPool(materializePool(a.preset, a.spot), a);
}

/** Variant that reuses a materialized pool — for tight inner loops. */
export function liquidatorProfitWithPool(
  pool: PoolState,
  a: LiquidatorPoolArgs,
): LiquidatorOut {
  const lif = LIF(a.lltv);
  const uncappedSeized_USD = a.debt_USD * lif;
  const collateralSeized_USD = Math.max(
    0,
    Math.min(uncappedSeized_USD, a.collateralAvailable_USD ?? uncappedSeized_USD),
  );
  const { revenue_USD, slippagePct, newPool } = quoteSellUSD(
    pool,
    a.sellSpot ?? a.spot,
    collateralSeized_USD,
  );
  const profit_USD = revenue_USD - a.debt_USD - a.gasCost_USD - a.holdingRisk_USD;
  return { collateralSeized_USD, slippagePct, revenue_USD, profit_USD, newPool };
}

export interface MinMaxArgs {
  lltv: number;
  preset: PoolPreset;
  spot: number;
  gasCost_USD: number;
}

export function minMaxProfitableLiquidation(a: MinMaxArgs): { min_USD: number; max_USD: number } {
  // Materialize the pool once and reuse for every probe. swapExactIn clones
  // the ticks map internally so the pool isn't mutated across calls.
  const pool = materializePool(a.preset, a.spot);
  const profitAt = (debt: number): number =>
    liquidatorProfitWithPool(pool, {
      debt_USD: debt,
      lltv: a.lltv,
      spot: a.spot,
      gasCost_USD: a.gasCost_USD,
      holdingRisk_USD: 0,
    }).profit_USD;
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
  preset: PoolPreset;
  spot: number; // USD per TRY (= 1 / usdtryBaseline)
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
    let pool = materializePool(a.preset, a.spot);
    const active = a.ltvFractions.map((f) => ({
      ltvFrac: f,
      debt_USD: f * a.lltv * collateralEachUSD,
      collateralBaseUSD: collateralEachUSD,
      closed: false,
      unresolved: false,
      preLiquidated: false,
      residual_USD: 0,
    }));

    for (let t = 1; t < path.length; t++) {
      const Snow = path[t]!;
      const rel = (Math.pow(1 + a.witryYieldAnnual, t / 365) * S0) / Snow;
      const spotNow = Snow > 0 ? a.spot * (S0 / Snow) : 0;
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
          const { revenue_USD, newPool } = quoteSellUSD(pool, spotNow, seized);
          pool = newPool;
          // Auto-deleverage routes through the same AMM; collateral seized
          // and debt repaid are removed from the position pro-rata.
          const repaid = Math.min(closeDebt, revenue_USD);
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
        if (pos.unresolved) {
          pos.residual_USD = Math.max(0, pos.debt_USD - collAfter);
        }
        if (hf <= 1) {
          const { revenue_USD, newPool } = liquidatorProfitWithPool(pool, {
            debt_USD: pos.debt_USD,
            lltv: a.lltv,
            spot: a.spot,
            sellSpot: spotNow,
            gasCost_USD: a.gasCost_USD,
            holdingRisk_USD: 0,
            collateralAvailable_USD: collAfter,
          });
          const profit = revenue_USD - pos.debt_USD - a.gasCost_USD;
          if (profit > 0) {
            pool = newPool;
            pos.closed = true;
            pos.unresolved = false;
            pos.residual_USD = Math.max(0, pos.debt_USD - revenue_USD);
            // Liquidator actually executed: this revenue is the USD volume
            // that hit the secondary AMM. Unprofitable branch is NOT counted
            // because no liquidator fires there.
            pathSeizedVolume_USD += revenue_USD;
          } else {
            pos.unresolved = true;
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
  /** @deprecated unused since two-constraint closed-form solver — kept for ABI compat */
  maxIter?: number;
  /** @deprecated unused since two-constraint closed-form solver — kept for ABI compat */
  tol?: number;
}

export type LLTVBindingConstraint = 'bad-debt' | 'liquidator-profit' | 'none';

export interface DeriveOut {
  raw: number;
  converged: boolean;
  iterations: number;
  /** Which constraint binds at `raw`. 'none' means feasibility was trivially satisfied. */
  bindingConstraint: LLTVBindingConstraint;
  /** Upper bound from the no-bad-debt constraint: L × LIF(L) ≤ 1 − dd − safety. */
  lMaxBadDebt: number;
  /** Upper bound from the liquidator-profit constraint: LIF(L) × (1 − slip) ≥ 1 + safety. */
  lMaxProfit: number;
}

/**
 * Maximum LLTV that satisfies the no-bad-debt constraint:
 *   L · LIF(L) ≤ 1 − dd − safety
 * After a `dd` collateral drawdown, the remaining collateral (1 − dd) must
 * still cover the LIF-bonused seizure that a liquidator is owed. If this
 * inequality is violated the contract can't pay the full bonus → bad debt.
 *
 * Solved analytically. LIF is monotone-decreasing in L (above the cap
 * threshold), so L · LIF(L) is monotone-increasing in L, giving a unique
 * upper bound. Handles the LIF_CAP plateau explicitly.
 */
export function maxLForBadDebt(dd: number, safety: number): number {
  const T = 1 - dd - safety;
  if (T <= 0) return 0;
  // L where LIF transitions from cap (LIF_CAP) to formula (1/(βL+(1-β))):
  //   1/(βL+(1-β)) = LIF_CAP  ⇒  L = (1/LIF_CAP − (1-β)) / β
  const lCapBoundary = (1 / LIF_CAP - (1 - BETA)) / BETA;
  // In the capped region (L ≤ lCapBoundary): L · LIF_CAP ≤ T  ⇒  L ≤ T / LIF_CAP
  const lFromCapped = T / LIF_CAP;
  // In the uncapped region (L > lCapBoundary):
  //   L / (βL + (1-β)) = T  ⇒  L = T·(1-β) / (1 − β·T)
  const denom = 1 - BETA * T;
  const lFromUncapped = denom > 0 ? (T * (1 - BETA)) / denom : 1;
  // Pick whichever falls in its region of validity.
  if (lFromUncapped > lCapBoundary) return Math.min(1, lFromUncapped);
  return Math.min(lCapBoundary, lFromCapped);
}

/**
 * Maximum LLTV that satisfies the liquidator-profit constraint:
 *   LIF(L) · (1 − slip) ≥ 1 + safety
 * A liquidator repays D in loan token and seizes D · LIF in collateral, then
 * dumps it on the AMM losing `slip`. Profit per unit debt is LIF·(1−slip)−1.
 * Since LIF is monotone-decreasing in L, higher L → lower bonus → tighter
 * profit headroom. Returns 0 if even the LIF_CAP plateau is insufficient.
 */
export function maxLForProfit(slip: number, safety: number): number {
  if (slip >= 1) return 0;
  const lifMin = (1 + safety) / (1 - slip);
  if (lifMin <= 1) return 1; // LIF ≥ 1 always; trivially satisfied
  if (lifMin > LIF_CAP) return 0; // even the cap can't reach required LIF
  // Solve 1/(βL + (1-β)) = lifMin  ⇒  L = (1/lifMin − (1-β)) / β
  const L = (1 / lifMin - (1 - BETA)) / BETA;
  return Math.max(0, Math.min(1, L));
}

/**
 * Recommended LLTV under the two binding constraints (bad-debt + liquidator
 * profitability). Both constraints are upper bounds; the tighter wins.
 *
 * NOTE: the previous fixed-point formula
 *   L = (1 − dd) / (LIF(L) · (1 + slip)) − safety
 * mixed the two constraints into a single inequality with no clean economic
 * meaning, and could declare "break-even" at L where LIF·(1−slip) < 1 (a
 * loss for the liquidator). See report on formula validation (2026-05-24).
 *
 * `converged`/`iterations` are kept in the return type for backward compat;
 * the closed-form solver always converges in one step.
 */
export function deriveRecommendedLLTV(a: DeriveArgs): DeriveOut {
  const lMaxBadDebt = maxLForBadDebt(a.p95Drawdown, a.safetyMargin);
  const lMaxProfit = maxLForProfit(a.slippage, a.safetyMargin);
  const raw = Math.max(0, Math.min(0.98, Math.min(lMaxBadDebt, lMaxProfit)));
  let bindingConstraint: LLTVBindingConstraint;
  if (raw <= 0) {
    bindingConstraint = lMaxProfit < lMaxBadDebt ? 'liquidator-profit' : 'bad-debt';
  } else if (Math.abs(lMaxProfit - lMaxBadDebt) < 1e-9) {
    bindingConstraint = 'bad-debt';
  } else {
    bindingConstraint = lMaxProfit < lMaxBadDebt ? 'liquidator-profit' : 'bad-debt';
  }
  return {
    raw,
    converged: true,
    iterations: 1,
    bindingConstraint,
    lMaxBadDebt,
    lMaxProfit,
  };
}

export interface TierScanArgs {
  p95Drawdown: number;
  safetyMargin: number;
  /** Liquidation slippage as a function of the candidate LLTV being evaluated. */
  slippageAt: (lltv: number) => number;
}

export interface TierScanOut {
  /** Largest governance LLTV that satisfies both constraints, or 0 if none. */
  snapped: LLTV | 0;
  /** Continuous upper bound at the chosen tier's slippage (for display). */
  raw: number;
  bindingConstraint: LLTVBindingConstraint;
  perTier: Array<{
    lltv: LLTV;
    slippage: number;
    lMaxBadDebt: number;
    lMaxProfit: number;
    feasible: boolean;
  }>;
}

/**
 * Tier-scan recommendation: evaluate each governance LLTV with its OWN
 * liquidation size / slippage (not the operator's current selection), pick
 * the largest tier where both constraints hold. This fixes the circular
 * dependency where the recommended LLTV was a function of the currently
 * selected LLTV (see report on formula validation, 2026-05-24).
 */
export function tierScanRecommendation(a: TierScanArgs): TierScanOut {
  const tiers = [...GOV_LLTVS].sort((x, y) => x - y);
  const perTier = tiers.map((lltv) => {
    const slippage = a.slippageAt(lltv);
    const lMaxBadDebt = maxLForBadDebt(a.p95Drawdown, a.safetyMargin);
    const lMaxProfit = maxLForProfit(slippage, a.safetyMargin);
    const feasible = lltv <= Math.min(lMaxBadDebt, lMaxProfit);
    return { lltv, slippage, lMaxBadDebt, lMaxProfit, feasible };
  });
  // Largest feasible tier wins.
  const winners = perTier.filter((t) => t.feasible);
  const winner = winners.length > 0 ? winners[winners.length - 1]! : null;
  if (!winner) {
    return {
      snapped: 0,
      raw: 0,
      bindingConstraint:
        perTier[0]!.lMaxProfit < perTier[0]!.lMaxBadDebt ? 'liquidator-profit' : 'bad-debt',
      perTier,
    };
  }
  const binding: LLTVBindingConstraint =
    winner.lMaxProfit < winner.lMaxBadDebt ? 'liquidator-profit' : 'bad-debt';
  return {
    snapped: winner.lltv,
    raw: Math.min(winner.lMaxBadDebt, winner.lMaxProfit),
    bindingConstraint: binding,
    perTier,
  };
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
  supplyIncentiveBudgetMonthly_USD: number;
  borrowerIncentiveBudgetMonthly_USD: number;
  /** Expected USDM borrowed at steady state. Denominator for borrower-incentive APY. */
  expectedBorrow_USD: number;
  witryYieldAnnual: number;
  expectedTRYDepreciation_annual: number;
}

export interface StrategyOut {
  /** Gross borrow APY (pre-incentive); mirror of the IRM input for downstream displays. */
  borrowAPY: number;
  grossSupplyAPY: number;
  netSupplyAPY: number;
  supplyIncentiveAPY: number;
  totalSupplyAPY: number;
  borrowerIncentiveAPY: number;
  /** Borrow rate net of borrower-side incentives. Can go negative (paid to borrow). */
  netBorrowAPY: number;
  leverageLoopAPY: number;
  leverageLoopsViable: boolean;
}

export function computeStrategy(a: StrategyArgs): StrategyOut {
  const grossSupplyAPY = a.borrowAPY * a.targetUtilization;
  const netSupplyAPY = grossSupplyAPY * (1 - a.performanceFee) - a.managementFee;
  const supplyIncentiveAPY =
    a.requiredUSDM > 0 ? (a.supplyIncentiveBudgetMonthly_USD * 12) / a.requiredUSDM : 0;
  const totalSupplyAPY = netSupplyAPY + supplyIncentiveAPY;
  const borrowerIncentiveAPY =
    a.expectedBorrow_USD > 0
      ? (a.borrowerIncentiveBudgetMonthly_USD * 12) / a.expectedBorrow_USD
      : 0;
  const netBorrowAPY = a.borrowAPY - borrowerIncentiveAPY;
  // Leverage-loop borrower deposits wiTRY (earns witryYield in TRY) and
  // borrows USDM. Real debt cost = netBorrowAPY (post-incentive) × (1 + d),
  // where d is annual TRY depreciation. Report #2 open question #1: spec
  // §3B text has a sign typo (`1 − USD_TRY_return`); code is canonical.
  const leverageLoopAPY =
    a.witryYieldAnnual - netBorrowAPY * (1 + a.expectedTRYDepreciation_annual);
  return {
    borrowAPY: a.borrowAPY,
    grossSupplyAPY,
    netSupplyAPY,
    supplyIncentiveAPY,
    totalSupplyAPY,
    borrowerIncentiveAPY,
    netBorrowAPY,
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
    caps: { absoluteUSD_human: number; relative: number };
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
      caps: { absoluteUSD_human: a.cap_USD, relative: 1.0 },
    },
    preLiquidation: { preLLTV: to18Decimal(a.preLLTV), preLCF: a.preLCF, preLIF: a.preLIF },
  };
}

export type RiskTier = 'Conservative' | 'Moderate' | 'Aggressive' | 'Indeterminate';

export function classifyRiskTier(chosen: number, recommended: number): RiskTier {
  if (recommended <= 0) return 'Indeterminate';
  if (chosen <= recommended) return 'Conservative';
  if (chosen <= recommended + RISK_TIER_MODERATE_BAND_LLTV) return 'Moderate';
  return 'Aggressive';
}
