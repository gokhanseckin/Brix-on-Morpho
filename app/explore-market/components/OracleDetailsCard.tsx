// app/explore-market/components/OracleDetailsCard.tsx
'use client';
import type { OracleInfo, OracleFeed } from '@/types/morphoMarket';
import { formatUSD } from '@/app/components/Kpi';

const ETHERSCAN_BASE: Record<number, string> = {
  1: 'https://etherscan.io/address/',
  8453: 'https://basescan.org/address/',
  137: 'https://polygonscan.com/address/',
  42161: 'https://arbiscan.io/address/',
  10: 'https://optimistic.etherscan.io/address/',
  130: 'https://uniscan.xyz/address/',
};

function shorten(addr: string): string {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAge(ts: number | null): string {
  if (!ts) return '—';
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function FeedChip({ feed, base }: { feed: OracleFeed | null; base: string }) {
  if (!feed) return null;
  return (
    <a
      href={base + feed.address}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded border border-brix-border bg-brix-bg px-2 py-1 text-xs font-mono text-brix-accent hover:text-brix-accentHover"
    >
      <span>{shorten(feed.address)}</span>
      <span className="text-neutral-500">/{feed.decimals}d</span>
    </a>
  );
}

export function OracleDetailsCard({
  chainId,
  oracle,
  collateralPriceUsd,
  collateralPriceTimestamp,
}: {
  chainId: number;
  oracle: OracleInfo;
  collateralPriceUsd: number | null;
  collateralPriceTimestamp: number | null;
}) {
  const base = ETHERSCAN_BASE[chainId] ?? '';

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Oracle</h2>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-500 uppercase tracking-wide text-xs">Contract:</span>
        <a href={base + oracle.address} target="_blank" rel="noreferrer" className="font-mono text-brix-accent hover:text-brix-accentHover">
          {shorten(oracle.address)}
        </a>
      </div>

      {oracle.details.kind === 'ChainlinkOracleV2' ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-500 uppercase tracking-wide text-xs">Base:</span>
            <FeedChip feed={oracle.details.baseFeedOne} base={base} />
            {oracle.details.baseFeedTwo && (
              <>
                <span className="text-neutral-500">→</span>
                <FeedChip feed={oracle.details.baseFeedTwo} base={base} />
              </>
            )}
            <span className="text-neutral-500 mx-2">/</span>
            <span className="text-neutral-500 uppercase tracking-wide text-xs">Quote:</span>
            {oracle.details.quoteFeedOne ? <FeedChip feed={oracle.details.quoteFeedOne} base={base} /> : <span className="text-neutral-500 text-xs">(none)</span>}
            {oracle.details.quoteFeedTwo && (
              <>
                <span className="text-neutral-500">→</span>
                <FeedChip feed={oracle.details.quoteFeedTwo} base={base} />
              </>
            )}
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Scale factor</dt>
              <dd className="font-mono text-neutral-200">{oracle.details.scaleFactor.toString()}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Collateral price (USD)</dt>
              <dd className="text-neutral-200 tabular-nums">{collateralPriceUsd != null ? formatUSD(collateralPriceUsd) : '—'}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Last update</dt>
              <dd className="text-neutral-200">{formatAge(collateralPriceTimestamp)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="text-sm text-neutral-500">
          Oracle type <span className="font-mono text-neutral-300">{oracle.details.rawType}</span> — feed details not exposed via API.
        </p>
      )}
    </section>
  );
}
