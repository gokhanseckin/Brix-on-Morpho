'use client';
import { useSimulator } from '@/lib/useSimulator';
import { Kpi, formatUSD } from '../Kpi';

export function LiquidityNeed() {
  const { liquidity } = useSimulator();
  return (
    <section id="section-liquidity-need">
      <h2 className="text-xl font-semibold mb-4">1. USDM Liquidity Need</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Liquidity Floor" value={formatUSD(liquidity.liquidityFloor_USD)} />
        <Kpi label="Required (steady-state)" value={formatUSD(liquidity.requiredUSDM)} />
        <Kpi
          label="Required + Buffer"
          value={formatUSD(liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD)}
        />
      </div>
    </section>
  );
}
