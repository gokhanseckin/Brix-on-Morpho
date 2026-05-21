// lib/poolPreset.ts (stub — full impl in Task 5)
export interface PoolPreset {
  feeTier: 500 | 3000 | 10000;
  tickSpacing: number;
  positions: Array<{
    tickLower: number;
    tickUpper: number;
    liquidityUSD: number;
    label: 'core' | 'absorb' | 'tail';
  }>;
  rebalancePolicy: { triggerPct: number; intervalDays: number };
}
