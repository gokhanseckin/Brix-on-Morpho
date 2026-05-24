import { describe, expect, it, vi } from 'vitest';
import type { WorkerInput, WorkerOutput } from '@/lib/simulation.worker';
import type { SidebarInputs } from '@/types/simulator';

const exposed = vi.hoisted(() => ({
  api: undefined as { run(input: WorkerInput): WorkerOutput } | undefined,
}));

vi.mock('comlink', () => ({
  expose: (api: { run(input: WorkerInput): WorkerOutput }) => {
    exposed.api = api;
  },
}));

const baseInputs: SidebarInputs = {
  witryTVL_USD: 1_000_000,
  lltv: 0.86,
  targetUtilization: 0.8,
  borrowerLTVAlpha: 4.6,
  borrowerLTVBeta: 2,
  witryYieldAnnual: 0,
  witryYieldUSD_7d: 0,
  witryYieldUSD_30d: 0,
  usdtryBaseline: 100,
  historicalPeriod: 5,
  simulationMode: 'GBM+Jumps',
  simulationHorizonDays: 90,
  pathCount: 100,
  tryShockPct: -0.3,
  supplyIncentiveBudgetMonthly_USD: 0,
  borrowerIncentiveBudgetMonthly_USD: 0,
  performanceFee: 0.1,
  managementFee: 0,
  safetyMargin: 0.02,
  preLiquidationEnabled: false,
  preLLTVOffset: 0.05,
  preLCF1: 0.05,
  preLCF2: 0.5,
  preLIF1: 1.01,
  lltvDrawdownPercentile: 95,
  blockBootstrap: true,
  seed: 123,
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

const runWorker = async (input: WorkerInput): Promise<WorkerOutput> => {
  await import('@/lib/simulation.worker');
  if (!exposed.api) throw new Error('simulation worker did not expose its API');
  return exposed.api.run(input);
};

describe('simulation worker jump defaults', () => {
  it('GBM+Jumps stress tail is centered on TRY depreciation under the USD/TRY convention', async () => {
    const output = await runWorker({
      inputs: baseInputs,
      returnsWindow: Array.from({ length: 252 }, () => 0),
    });
    const terminalP5 = output.p5[output.p5.length - 1]!;
    const terminalP50 = output.p50[output.p50.length - 1]!;
    const terminalP95 = output.p95[output.p95.length - 1]!;
    const depreciationTail = terminalP95 - baseInputs.usdtryBaseline;
    const strengtheningTail = baseInputs.usdtryBaseline - terminalP5;

    expect(depreciationTail).toBeGreaterThan(strengtheningTail);
    expect(terminalP50).toBeLessThan(baseInputs.usdtryBaseline);
  });
});
