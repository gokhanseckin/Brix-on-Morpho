// app/explore-market/components/MarketStateCard.tsx
'use client';
import type { MarketState } from '@/types/morphoMarket';
import { formatUSD, formatPct } from '@/app/components/Kpi';

export function MarketStateCard({ state }: { state: MarketState }) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Live state</h2>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
        <Stat label="Total supply" value={formatUSD(state.supplyAssetsUsd)} />
        <Stat label="Total borrow" value={formatUSD(state.borrowAssetsUsd)} />
        <Stat label="Available liquidity" value={formatUSD(state.liquidityAssetsUsd)} />
        <Stat label="Utilization" value={formatPct(state.utilization)} />
        <Stat label="Supply APY" value={formatPct(state.supplyApy)} />
        <Stat label="Borrow APY" value={formatPct(state.borrowApy)} />
        <Stat label="Rate at target" value={formatPct(state.rateAtUTarget)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="text-neutral-200 text-lg tabular-nums">{value}</dd>
    </div>
  );
}
