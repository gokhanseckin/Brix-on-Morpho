// app/explore-market/components/ExposedVaultsCard.tsx
'use client';
import type { VaultAllocation } from '@/types/morphoMarket';
import { formatUSD, formatPct } from '@/app/components/Kpi';

export function ExposedVaultsCard({ vaults }: { vaults: VaultAllocation[] }) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">
        Exposed vaults <span className="text-neutral-500 text-sm font-normal">({vaults.length})</span>
      </h2>
      {vaults.length === 0 ? (
        <p className="text-sm text-neutral-500">No MetaMorpho vaults currently allocate to this market.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-brix-border">
                <th className="text-left py-2 pr-4">Vault</th>
                <th className="text-right py-2 pr-4">Total assets</th>
                <th className="text-right py-2 pr-4">Allocation</th>
                <th className="text-right py-2 pr-4">% of vault</th>
                <th className="text-right py-2">Supply cap</th>
              </tr>
            </thead>
            <tbody>
              {vaults.map(v => (
                <tr key={v.address} className="border-b border-brix-border/40 last:border-0">
                  <td className="py-2 pr-4">
                    <div className="text-neutral-200">{v.name}</div>
                    <div className="text-xs text-neutral-500 font-mono">{v.symbol}</div>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatUSD(v.totalAssetsUsd)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatUSD(v.allocationUsd)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatPct(v.allocationPctOfVault)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {v.supplyCapUsd == null ? <span className="text-neutral-500">uncapped</span> : formatUSD(v.supplyCapUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
