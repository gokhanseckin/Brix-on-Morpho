// LLTV-aware bad-debt math. At the liquidation trigger price:
//   collateral_USD = debt_USD × LIF(lltv)
// so the liquidator seizes collateral worth `debt × LIF` and must repay `debt`.
// They sell the seized wTRY into the AMM; bad debt is born when the AMM proceeds
// fall short of the debt owed (i.e. when slippage+fee chews through the LIF buffer).
import { LIF } from './morphoMath';

export interface BadDebtFromSaleArgs {
  /** Notional USD value of the seized collateral at the trigger spot. */
  collateral_USD: number;
  /** LLTV tier (e.g. 0.86). */
  lltv: number;
  /** USDM proceeds the liquidator actually received from the AMM sale. */
  ammSale_USDM: number;
}

export interface BadDebtFromSaleOut {
  /** Debt owed at trigger: collateral / LIF(lltv). */
  debt_USD: number;
  /** LIF(lltv). */
  lif: number;
  /** Excess collateral seized vs debt owed (liquidator's gross bonus before AMM costs). */
  bonus_USD: number;
  /** max(0, debt − ammSale_USDM). */
  badDebt_USD: number;
  /** badDebt_USD ÷ debt_USD. 0 = whole, 1 = total loss. */
  badDebtPct: number;
  /** ammSale_USDM ÷ debt_USD. 1.0 = fully repaid; >1 means liquidator kept profit. */
  recoveryPct: number;
}

export function badDebtFromAMMSale(a: BadDebtFromSaleArgs): BadDebtFromSaleOut {
  const lif = LIF(a.lltv);
  const debt_USD = a.collateral_USD / lif;
  const bonus_USD = a.collateral_USD - debt_USD;
  const badDebt_USD = Math.max(0, debt_USD - a.ammSale_USDM);
  const badDebtPct = debt_USD > 0 ? badDebt_USD / debt_USD : 0;
  const recoveryPct = debt_USD > 0 ? a.ammSale_USDM / debt_USD : 0;
  return { debt_USD, lif, bonus_USD, badDebt_USD, badDebtPct, recoveryPct };
}
