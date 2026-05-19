'use client';
import { useSimulator } from '@/lib/useSimulator';
import { Kpi, formatPct } from '../Kpi';

export function LiquidityStrategy() {
  const { strategy } = useSimulator();
  return (
    <section id="section-liquidity-strategy">
      <h2 className="text-xl font-semibold mb-4">3. Liquidity Strategy</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total Supply APY" value={formatPct(strategy.totalSupplyAPY)} />
      </div>
    </section>
  );
}
