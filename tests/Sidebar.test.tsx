import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SidebarInputs } from '@/types/simulator';
import { Sidebar } from '@/app/components/Sidebar';

const urlStateMock = vi.hoisted(() => ({
  state: null as unknown as SidebarInputs,
  setState: vi.fn(),
}));

vi.mock('@/lib/useUrlState', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/useUrlState')>();
  return {
    ...original,
    useUrlState: () => [urlStateMock.state, urlStateMock.setState],
  };
});

const baseInputs: SidebarInputs = {
  witryTVL_USD: 5_000_000,
  lltv: 0.86,
  targetUtilization: 0.8,
  borrowerLTVAlpha: 4.6,
  borrowerLTVBeta: 2,
  witryYieldAnnual: 0.38,
  witryYieldUSD_7d: 0.0631,
  witryYieldUSD_30d: 0.1931,
  hfBuffer: 1.5,
  loopCount: 10,
  usdtryBaseline: 45,
  historicalPeriod: 5,
  simulationMode: 'Bootstrap',
  simulationHorizonDays: 30,
  pathCount: 1000,
  tryShockPct: -0.3,
  supplyIncentiveBudgetMonthly_USD: 0,
  borrowerIncentiveBudgetMonthly_USD: 0,
  performanceFee: 0.1,
  managementFee: 0,
  safetyMargin: 0.01,
  preLiquidationEnabled: false,
  preLLTVOffset: 0.05,
  preLCF1: 0.05,
  preLCF2: 0.5,
  preLIF1: 1.01,
  lltvDrawdownPercentile: 95,
  blockBootstrap: true,
  seed: 42,
  poolFeeTier: 3000,
  poolTVL_USD: 500_000,
  bandSplitCore: 0.3,
  bandSplitAbsorb: 0.5,
  bandCoreLowerPct: -0.05,
  bandCoreUpperPct: 0.05,
  bandAbsorbLowerPct: -0.15,
  bandAbsorbUpperPct: -0.05,
  bandTailLowerPct: -0.9,
  bandTailUpperPct: 0.3,
  swapSellUSD: 1_000_000,
};

describe('Sidebar liquidation status', () => {
  beforeEach(() => {
    urlStateMock.state = { ...baseInputs };
    urlStateMock.setState.mockReset();
  });

  it('shows pre-liquidation as OFF beside the LLTV-page note by default', () => {
    render(<Sidebar />);

    const status = screen.getByLabelText('Pre-liquidation status: OFF');
    expect(status).toHaveTextContent('OFF');
    expect(status.parentElement?.parentElement).toHaveTextContent('LLTV page');
  });

  it('shows pre-liquidation as ON when the scenario is enabled', () => {
    urlStateMock.state = { ...baseInputs, preLiquidationEnabled: true };

    render(<Sidebar />);

    expect(screen.getByLabelText('Pre-liquidation status: ON')).toHaveTextContent('ON');
  });
});
