// app/explore-market/components/MarketParamsCard.tsx
'use client';
import type { MarketParams, AssetMeta } from '@/types/morphoMarket';
import { GOV_LLTVS } from '@/types/simulator';

const ETHERSCAN_BASE: Record<number, string> = {
  1: 'https://etherscan.io/address/',
  8453: 'https://basescan.org/address/',
  137: 'https://polygonscan.com/address/',
  42161: 'https://arbiscan.io/address/',
  10: 'https://optimistic.etherscan.io/address/',
  130: 'https://uniscan.xyz/address/',
};

function lltvPct(lltv: bigint): number {
  return Number(lltv) / 1e18;
}

function isGovernanceLltv(lltv: bigint): boolean {
  const pct = lltvPct(lltv);
  return GOV_LLTVS.some(g => Math.abs(g - pct) < 1e-9);
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function MarketParamsCard({
  chainId,
  marketId,
  params,
  collateral,
  loan,
}: {
  chainId: number;
  marketId: string;
  params: MarketParams;
  collateral: AssetMeta;
  loan: AssetMeta;
}) {
  const base = ETHERSCAN_BASE[chainId] ?? '';
  const lltv = lltvPct(params.lltv);
  const gov = isGovernanceLltv(params.lltv);

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Market parameters</h2>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Row label="Collateral" value={`${collateral.symbol} (${shorten(collateral.address)})`} href={base + collateral.address} />
        <Row label="Loan" value={`${loan.symbol} (${shorten(loan.address)})`} href={base + loan.address} />
        <Row
          label="LLTV"
          value={
            <>
              {(lltv * 100).toFixed(2)}%{' '}
              <span className="text-neutral-500">({params.lltv.toString()})</span>{' '}
              {gov ? (
                <span className="ml-1 text-emerald-400">✓ governance</span>
              ) : (
                <span className="ml-1 text-yellow-400">⚠ non-governance</span>
              )}
            </>
          }
        />
        <Row label="IRM" value={shorten(params.irmAddress)} href={base + params.irmAddress} />
        <Row label="Oracle" value={shorten(params.oracleAddress)} href={base + params.oracleAddress} />
        <Row label="Market ID" value={shorten(marketId)} />
      </dl>
    </section>
  );
}

function Row({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="font-mono text-neutral-200">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-brix-accent hover:text-brix-accentHover">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
