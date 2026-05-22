// app/explore-market/components/TokensActivityCard.tsx
'use client';
import type { AssetMeta, MarketActivity, PreLiquidationContract } from '@/types/morphoMarket';
import { formatUSD, formatPct } from '@/app/components/Kpi';
import { ColumnHint } from './ColumnHint';

const ETHERSCAN_BASE: Record<number, string> = {
  1: 'https://etherscan.io',
  8453: 'https://basescan.org',
  137: 'https://polygonscan.com',
  42161: 'https://arbiscan.io',
  10: 'https://optimistic.etherscan.io',
  130: 'https://uniscan.xyz',
};

function shorten(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';
}

function formatAge(ts: number | null): string {
  if (!ts) return '—';
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toISOString().split('T')[0] ?? '—';
}

function lltvPct(lltv: bigint): string {
  return `${(Number(lltv) / 1e18 * 100).toFixed(2)}%`;
}

export function TokensActivityCard({
  chainId,
  collateral,
  loan,
  activity,
  preLiquidations,
}: {
  chainId: number;
  collateral: AssetMeta;
  loan: AssetMeta;
  activity: MarketActivity;
  preLiquidations: PreLiquidationContract[];
}) {
  const baseAddr = ETHERSCAN_BASE[chainId] ? `${ETHERSCAN_BASE[chainId]}/address/` : '';
  const baseBlock = ETHERSCAN_BASE[chainId] ? `${ETHERSCAN_BASE[chainId]}/block/` : '';

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-200">Tokens & activity</h2>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Tokens</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-500">
              <tr className="border-b border-brix-border">
                <th className="text-left py-2 pr-4">Role</th>
                <th className="text-left py-2 pr-4">Token</th>
                <th className="text-left py-2 pr-4">Decimals</th>
                <th className="text-right py-2 pr-4">USD price</th>
                <th className="text-right py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {[
                { role: 'Collateral', asset: collateral },
                { role: 'Loan', asset: loan },
              ].map(({ role, asset }) => (
                <tr key={role} className="border-b border-brix-border/40 last:border-0">
                  <td className="py-2 pr-4 text-neutral-300">{role}</td>
                  <td className="py-2 pr-4">
                    <div className="text-neutral-200">{asset.name} <span className="text-neutral-500">({asset.symbol})</span></div>
                    <a href={baseAddr + asset.address} target="_blank" rel="noreferrer" className="text-xs font-mono text-brix-accent hover:text-brix-accentHover">{shorten(asset.address)}</a>
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-neutral-300">{asset.decimals}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-neutral-200">
                    {asset.priceUsd != null ? `$${asset.priceUsd.toFixed(asset.priceUsd < 1 ? 4 : 2)}` : '—'}
                  </td>
                  <td className="py-2 text-right text-neutral-400 text-xs">{formatAge(asset.priceTimestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Activity</h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <Stat label="Protocol fee" value={formatPct(activity.feePct)} />
          <Stat
            label="Creation block"
            value={
              <a href={baseBlock + activity.creationBlockNumber} target="_blank" rel="noreferrer" className="font-mono text-brix-accent hover:text-brix-accentHover">
                {activity.creationBlockNumber.toLocaleString()}
              </a>
            }
          />
          <Stat label="Creation date" value={formatDate(activity.creationTimestamp)} />
          <Stat label="Collateral locked" value={formatUSD(activity.collateralAssetsUsd)} />
          <Stat label="Current bad debt" value={formatUSD(activity.badDebtUsd)} />
          <Stat label="Realized bad debt" value={formatUSD(activity.realizedBadDebtUsd)} />
        </dl>
        {activity.warnings.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {activity.warnings.map((w, i) => (
              <span key={i} className="rounded border border-yellow-700/50 bg-yellow-900/20 px-2 py-1 text-xs text-yellow-300">
                {w.level}: {w.type}
              </span>
            ))}
          </div>
        )}
      </div>

      {preLiquidations.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Pre-liquidation contracts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500">
                <tr className="border-b border-brix-border">
                  <th className="text-left py-2 pr-4">
                    <ColumnHint label="Address">
                      On-chain address of the pre-liquidation contract. Click to view it on the
                      block explorer. Each pre-liquidation contract is a small standalone contract
                      attached to a Morpho market that auto-closes risky positions before they hit
                      the hard liquidation limit (LLTV).
                    </ColumnHint>
                  </th>
                  <th className="text-right py-2 pr-4">
                    <ColumnHint label="preLLTV">
                      Pre-Liquidation LTV. The early trigger — once a borrower&apos;s
                      loan-to-value rises above this, the auto-deleverage rule kicks in. Set below
                      LLTV (the hard limit) so positions are nudged down before they would actually
                      get liquidated. Shown as a % of the borrower&apos;s collateral value.
                    </ColumnHint>
                  </th>
                  <th className="text-right py-2 pr-4">
                    <ColumnHint label="CF₁">
                      Close Factor at the start of the trigger zone (when LTV just crossed preLLTV).
                      Think of it as &quot;what fraction of the position to close on the first
                      trigger.&quot; Example: CF₁ = 20% → close 20% of the debt the first time.
                      Lower CF₁ = gentler intervention.
                    </ColumnHint>
                  </th>
                  <th className="text-right py-2 pr-4">
                    <ColumnHint label="CF₂">
                      Close Factor at the end of the trigger zone (when LTV approaches LLTV).
                      The fraction closed scales linearly from CF₁ up to CF₂ as LTV rises through
                      the zone. Higher CF₂ = more aggressive cleanup when the position is close to
                      getting hard-liquidated.
                    </ColumnHint>
                  </th>
                  <th className="text-right py-2 pr-4">
                    <ColumnHint label="IF₁">
                      Incentive Factor at the start of the zone — the bonus paid to whoever runs
                      the pre-liquidation. IF₁ = 101% means the closer receives 1% extra collateral
                      as their fee. Has to be high enough to cover gas, low enough that borrowers
                      don&apos;t get rekt.
                    </ColumnHint>
                  </th>
                  <th className="text-right py-2">
                    <ColumnHint label="IF₂">
                      Incentive Factor at the end of the zone. Like IF₁ but at the upper edge.
                      Usually higher than IF₁ so liquidators are paid more for closing the riskier
                      positions. Scales linearly between IF₁ and IF₂ across the zone.
                    </ColumnHint>
                  </th>
                </tr>
              </thead>
              <tbody>
                {preLiquidations.map((p) => (
                  <tr key={p.address} className="border-b border-brix-border/40 last:border-0">
                    <td className="py-2 pr-4">
                      <a href={baseAddr + p.address} target="_blank" rel="noreferrer" className="font-mono text-brix-accent hover:text-brix-accentHover">{shorten(p.address)}</a>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{lltvPct(p.preLltv)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{lltvPct(p.preLCF1)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{lltvPct(p.preLCF2)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{lltvPct(p.preLIF1)}</td>
                    <td className="py-2 text-right tabular-nums">{lltvPct(p.preLIF2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="text-neutral-200 tabular-nums">{value}</dd>
    </div>
  );
}
