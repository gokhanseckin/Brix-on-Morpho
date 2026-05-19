'use client';
import { useSimulator } from '@/lib/useSimulator';
import { Kpi, formatUSD } from '../Kpi';

export function LiquidationDesign() {
  const { fx } = useSimulator();
  return (
    <section id="section-liquidation-design">
      <h2 className="text-xl font-semibold mb-4">4. Liquidation Design</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="P95 Bad Debt"
          value={fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'}
        />
      </div>
    </section>
  );
}
