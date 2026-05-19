'use client';
import { useSimulator } from '@/lib/useSimulator';
import { Kpi, formatPct } from '../Kpi';

export function FXRisk() {
  const { fx, running } = useSimulator();
  return (
    <section id="section-fx-risk">
      <h2 className="text-xl font-semibold mb-4">2. FX Risk</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi
          label="Annualized vol"
          value={fx ? formatPct(fx.annualizedVol) : running ? '…' : '—'}
        />
      </div>
    </section>
  );
}
