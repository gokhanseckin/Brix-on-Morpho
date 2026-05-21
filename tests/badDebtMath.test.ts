import { describe, it, expect } from 'vitest';
import { badDebtFromAMMSale } from '@/lib/badDebtMath';
import { LIF } from '@/lib/morphoMath';

describe('badDebtFromAMMSale', () => {
  it('zero bad debt when AMM sale equals debt', () => {
    const collateral = 10_000;
    const lltv = 0.86;
    const debt = collateral / LIF(lltv);
    const out = badDebtFromAMMSale({ collateral_USD: collateral, lltv, ammSale_USDM: debt });
    expect(out.badDebt_USD).toBe(0);
    expect(out.recoveryPct).toBeCloseTo(1, 6);
  });

  it('zero bad debt when slippage stays within LIF buffer', () => {
    // 86% LLTV → LIF ≈ 1/(0.3*0.86 + 0.7) = 1/0.958 ≈ 1.0439
    // collateral $10k → debt ≈ $9579. Liquidator can lose up to ~$421 (4.4%) before bad debt.
    const collateral = 10_000;
    const lltv = 0.86;
    const lossPct = 0.03; // 3% slippage+fee, under the buffer
    const out = badDebtFromAMMSale({
      collateral_USD: collateral,
      lltv,
      ammSale_USDM: collateral * (1 - lossPct),
    });
    expect(out.badDebt_USD).toBe(0);
  });

  it('positive bad debt when AMM loss exceeds LIF buffer', () => {
    // 5% slippage > ~4.4% LIF buffer for 86% LLTV → bad debt fires.
    const collateral = 10_000;
    const lltv = 0.86;
    const out = badDebtFromAMMSale({
      collateral_USD: collateral,
      lltv,
      ammSale_USDM: collateral * 0.95,
    });
    expect(out.badDebt_USD).toBeGreaterThan(0);
    expect(out.badDebtPct).toBeGreaterThan(0);
    expect(out.recoveryPct).toBeLessThan(1);
  });

  it('lower LLTV → more buffer → less bad debt for same slippage', () => {
    const collateral = 10_000;
    const ammSale = 9_300; // 7% loss
    const high = badDebtFromAMMSale({ collateral_USD: collateral, lltv: 0.86, ammSale_USDM: ammSale });
    const low = badDebtFromAMMSale({ collateral_USD: collateral, lltv: 0.625, ammSale_USDM: ammSale });
    expect(low.badDebt_USD).toBeLessThan(high.badDebt_USD);
  });

  it('debt_USD ≈ collateral / LIF', () => {
    const out = badDebtFromAMMSale({ collateral_USD: 10_000, lltv: 0.86, ammSale_USDM: 0 });
    expect(out.debt_USD).toBeCloseTo(10_000 / LIF(0.86), 6);
    expect(out.bonus_USD).toBeCloseTo(10_000 - 10_000 / LIF(0.86), 6);
  });

  it('handles zero collateral', () => {
    const out = badDebtFromAMMSale({ collateral_USD: 0, lltv: 0.86, ammSale_USDM: 0 });
    expect(out.badDebt_USD).toBe(0);
    expect(out.badDebtPct).toBe(0);
    expect(out.recoveryPct).toBe(0);
  });
});
