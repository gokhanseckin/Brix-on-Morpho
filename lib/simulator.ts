import { adaptiveCurveIRM, healthFactor, LIF } from './morphoMath';
import { createRng, gauss, type Rng } from './rng';

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

export function bufferPctFromIncentive(incentiveAPY: number, baseSupplyAPY: number): number {
  const ratio = baseSupplyAPY > 0 ? incentiveAPY / baseSupplyAPY : 0;
  return 0.15 + 0.10 * ratio;
}

export function computeLiquidityNeed(a: LiqNeedArgs): LiqNeedOut {
  const meanLTVFrac = betaMean(a.borrowerLTVAlpha, a.borrowerLTVBeta);
  const maxBorrowable_USD = a.witryTVL_USD * a.lltv;
  const expectedBorrow_USD = maxBorrowable_USD * meanLTVFrac;
  const requiredUSDM = expectedBorrow_USD / a.targetUtilization;
  const bufferPct = bufferPctFromIncentive(a.incentiveAPY, a.baseSupplyAPY);
  const withdrawalBuffer_USD = requiredUSDM * bufferPct;
  const liquidityFloor_USD = Math.max(a.deadDepositCost * 100, requiredUSDM * 0.20);
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
  iTRYYieldAnnual: number;
  preLiquidationEnabled: boolean;
}

export interface BadDebtOut {
  badDebtByPath: number[];
  liquidatedCountByPath: number[];
  badDebtP95_USD: number;
  badDebtP95Pct: number;
}

export function simulateBadDebt(a: BadDebtArgs): BadDebtOut {
  const N = a.ltvFractions.length;
  const collateralEachUSD = a.tvl_USD / Math.max(1, N);
  const firstPath = a.paths[0];
  if (!firstPath || firstPath.length === 0) {
    return { badDebtByPath: [], liquidatedCountByPath: [], badDebtP95_USD: 0, badDebtP95Pct: 0 };
  }
  const S0 = firstPath[0]!;

  const badDebtByPath: number[] = [];
  const liquidatedCountByPath: number[] = [];

  for (const path of a.paths) {
    const active = a.ltvFractions.map((f) => ({
      ltvFrac: f,
      debt_USD: f * a.lltv * collateralEachUSD,
      collateralBaseUSD: collateralEachUSD,
      closed: false,
      residual_USD: 0,
    }));

    for (let t = 1; t < path.length; t++) {
      const Snow = path[t]!;
      const rel = (Math.pow(1 + a.iTRYYieldAnnual, t / 365) * S0) / Snow;
      for (const pos of active) {
        if (pos.closed) continue;
        const collNow = pos.collateralBaseUSD * rel;
        const hf = healthFactor({ collateralUSD: collNow, debtUSD: pos.debt_USD, lltv: a.lltv });
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
          } else {
            pos.closed = true;
            pos.residual_USD = Math.max(0, pos.debt_USD - collNow);
          }
        }
      }
    }

    const bd = active.reduce((s, p) => s + p.residual_USD, 0);
    const count = active.filter((p) => p.closed).length;
    badDebtByPath.push(bd);
    liquidatedCountByPath.push(count);
  }

  const sorted = [...badDebtByPath].sort((x, y) => x - y);
  const idx = Math.floor(0.95 * Math.max(0, sorted.length - 1));
  const badDebtP95_USD = sorted[idx] ?? 0;
  return {
    badDebtByPath,
    liquidatedCountByPath,
    badDebtP95_USD,
    badDebtP95Pct: a.tvl_USD > 0 ? badDebtP95_USD / a.tvl_USD : 0,
  };
}
