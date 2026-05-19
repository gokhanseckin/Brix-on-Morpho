import { adaptiveCurveIRM } from './morphoMath';
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
