import { adaptiveCurveIRM } from './morphoMath';

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
