// app/explore-market/components/DerivedLiquidationCard.tsx
'use client';
import { LIF } from '@/lib/morphoMath';
import { GOV_LLTVS } from '@/types/simulator';

function lltvDecimal(lltv: bigint): number {
  return Number(lltv) / 1e18;
}

export function DerivedLiquidationCard({ lltv }: { lltv: bigint }) {
  const lltvDec = lltvDecimal(lltv);
  const lif = LIF(lltvDec);
  const bonusPct = (lif - 1) * 100;
  const govTier = GOV_LLTVS.find((g) => Math.abs(g - lltvDec) < 1e-9) ?? null;

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Derived liquidation</h2>
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">LIF (Liquidation Incentive Factor)</dt>
          <dd className="text-neutral-200 tabular-nums">{lif.toFixed(4)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Max liquidator bonus</dt>
          <dd className="text-neutral-200 tabular-nums">{bonusPct.toFixed(2)}%</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Governance tier</dt>
          <dd className="text-neutral-200">
            {govTier != null ? (
              <span className="text-emerald-400">✓ {(govTier * 100).toFixed(2)}%</span>
            ) : (
              <span className="text-yellow-400">⚠ off-grid</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-neutral-500">
        LIF = min(1.15, 1 / (β·LLTV + (1−β))) with β = 0.3. Computed locally via <code className="font-mono">lib/morphoMath.ts</code> — the same function the simulator uses.
      </p>
    </section>
  );
}
