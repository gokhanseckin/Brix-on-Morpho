'use client';
import { useSimulator } from '@/lib/useSimulator';
import { Kpi, formatPct } from '../Kpi';

export function VaultRecommendations() {
  const { riskTier, lltvDerivation } = useSimulator();
  return (
    <section id="section-vault-recommendations">
      <h2 className="text-xl font-semibold mb-4">5. Vault Recommendations</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Risk Tier" value={riskTier} />
        <Kpi
          label="Snapped LLTV"
          value={lltvDerivation.snapped ? formatPct(lltvDerivation.snapped, 1) : '—'}
        />
      </div>
    </section>
  );
}
