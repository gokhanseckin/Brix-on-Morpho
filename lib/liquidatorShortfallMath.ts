import { LIF } from './morphoMath';

export interface LiquidatorExecutionShortfallArgs {
  /** Notional USD value of collateral that would be seized at execution. */
  collateral_USD: number;
  /** LLTV tier (for the liquidation incentive factor). */
  lltv: number;
  /** USDM proceeds from selling the seized collateral into the configured AMM. */
  ammSale_USDM: number;
}

export interface LiquidatorExecutionShortfallOut {
  debtToRepay_USD: number;
  lif: number;
  incentiveBonus_USD: number;
  repaymentShortfall_USD: number;
  repaymentShortfallPct: number;
  proceedsCoveragePct: number;
  pnlBeforeGas_USD: number;
  executableBeforeGas: boolean;
}

/**
 * Economics of a hypothetical liquidator sale. A shortfall makes execution
 * unattractive; it does not itself mean the protocol has incurred bad debt.
 */
export function liquidatorExecutionShortfall(
  a: LiquidatorExecutionShortfallArgs,
): LiquidatorExecutionShortfallOut {
  const lif = LIF(a.lltv);
  const debtToRepay_USD = a.collateral_USD / lif;
  const incentiveBonus_USD = a.collateral_USD - debtToRepay_USD;
  const repaymentShortfall_USD = Math.max(0, debtToRepay_USD - a.ammSale_USDM);
  const repaymentShortfallPct =
    debtToRepay_USD > 0 ? repaymentShortfall_USD / debtToRepay_USD : 0;
  const proceedsCoveragePct =
    debtToRepay_USD > 0 ? a.ammSale_USDM / debtToRepay_USD : 0;
  const pnlBeforeGas_USD = a.ammSale_USDM - debtToRepay_USD;
  return {
    debtToRepay_USD,
    lif,
    incentiveBonus_USD,
    repaymentShortfall_USD,
    repaymentShortfallPct,
    proceedsCoveragePct,
    pnlBeforeGas_USD,
    executableBeforeGas: pnlBeforeGas_USD >= 0,
  };
}
