// app/explore-market/components/MarketStateCard.tsx
'use client';
import type { MarketState } from '@/types/morphoMarket';

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, digits = 2): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function MarketStateCard({ state }: { state: MarketState }) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Live state</h2>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
        <Stat label="Total supply" value={fmtUsd(state.supplyAssetsUsd)} />
        <Stat label="Total borrow" value={fmtUsd(state.borrowAssetsUsd)} />
        <Stat label="Available liquidity" value={fmtUsd(state.liquidityAssetsUsd)} />
        <Stat label="Utilization" value={fmtPct(state.utilization)} />
        <Stat label="Supply APY" value={fmtPct(state.supplyApy)} />
        <Stat label="Borrow APY" value={fmtPct(state.borrowApy)} />
        <Stat label="Rate at target" value={fmtPct(state.rateAtUTarget)} />
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
