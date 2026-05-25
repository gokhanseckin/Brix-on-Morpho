import { describe, it, expect } from 'vitest';
import { liquidatorExecutionShortfall } from '@/lib/liquidatorShortfallMath';
import { LIF } from '@/lib/morphoMath';

describe('liquidatorExecutionShortfall', () => {
  it('has no repayment shortfall when AMM sale equals debt', () => {
    const collateral = 10_000;
    const lltv = 0.86;
    const debt = collateral / LIF(lltv);
    const out = liquidatorExecutionShortfall({
      collateral_USD: collateral,
      lltv,
      ammSale_USDM: debt,
    });
    expect(out.repaymentShortfall_USD).toBe(0);
    expect(out.proceedsCoveragePct).toBeCloseTo(1, 6);
  });

  it('has no repayment shortfall when trading loss stays within the LIF bonus', () => {
    const out = liquidatorExecutionShortfall({
      collateral_USD: 10_000,
      lltv: 0.86,
      ammSale_USDM: 10_000 * 0.97,
    });
    expect(out.repaymentShortfall_USD).toBe(0);
  });

  it('reports liquidator repayment shortfall when proceeds cannot cover repayment', () => {
    const out = liquidatorExecutionShortfall({
      collateral_USD: 10_000,
      lltv: 0.86,
      ammSale_USDM: 10_000 * 0.95,
    });
    expect(out.repaymentShortfall_USD).toBeGreaterThan(0);
    expect(out.repaymentShortfallPct).toBeGreaterThan(0);
    expect(out.proceedsCoveragePct).toBeLessThan(1);
    expect(out.executableBeforeGas).toBe(false);
  });

  it('uses lower LLTV bonus to reduce the same trade repayment shortfall', () => {
    const collateral = 10_000;
    const ammSale = 9_300;
    const high = liquidatorExecutionShortfall({ collateral_USD: collateral, lltv: 0.86, ammSale_USDM: ammSale });
    const low = liquidatorExecutionShortfall({ collateral_USD: collateral, lltv: 0.625, ammSale_USDM: ammSale });
    expect(low.repaymentShortfall_USD).toBeLessThan(high.repaymentShortfall_USD);
  });

  it('computes debt to repay from collateral and LIF', () => {
    const out = liquidatorExecutionShortfall({ collateral_USD: 10_000, lltv: 0.86, ammSale_USDM: 0 });
    expect(out.debtToRepay_USD).toBeCloseTo(10_000 / LIF(0.86), 6);
    expect(out.incentiveBonus_USD).toBeCloseTo(10_000 - 10_000 / LIF(0.86), 6);
  });

  it('handles zero collateral', () => {
    const out = liquidatorExecutionShortfall({ collateral_USD: 0, lltv: 0.86, ammSale_USDM: 0 });
    expect(out.repaymentShortfall_USD).toBe(0);
    expect(out.repaymentShortfallPct).toBe(0);
    expect(out.proceedsCoveragePct).toBe(0);
  });
});
