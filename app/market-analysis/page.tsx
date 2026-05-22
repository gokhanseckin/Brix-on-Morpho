// app/market-analysis/page.tsx
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TopNav } from '@/app/components/TopNav';
import { SHORTLIST, type Candidate } from './data';

type SortKey = 'tier' | 'tvl' | 'borrow' | 'age' | 'lltv';
type SortDir = 'asc' | 'desc';

const TIER_ORDER: Record<Candidate['tier'], number> = { A: 0, B: 1, C: 2 };

function chainSlug(chainId: number): string | null {
  if (chainId === 1) return 'ethereum';
  if (chainId === 8453) return 'base';
  if (chainId === 137) return 'polygon';
  if (chainId === 42161) return 'arbitrum';
  if (chainId === 10) return 'optimism';
  if (chainId === 130) return 'unichain';
  return null;
}

function exploreHref(c: Candidate): string {
  const slug = chainSlug(c.chainId);
  if (!slug) return '/explore-market';
  const url = `https://app.morpho.org/${slug}/market/${c.uniqueKey}`;
  return `/explore-market?url=${encodeURIComponent(url)}`;
}

function fmtUsd(k: number | null): string {
  if (k == null) return '—';
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}M`;
  return `$${k}k`;
}

export default function MarketAnalysisPage() {
  const [sortKey, setSortKey] = useState<SortKey>('tier');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const rows = [...SHORTLIST];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'tier') cmp = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      else if (sortKey === 'tvl') cmp = (a.tvlK ?? -1) - (b.tvlK ?? -1);
      else if (sortKey === 'borrow') cmp = (a.borrowK ?? -1) - (b.borrowK ?? -1);
      else if (sortKey === 'age') cmp = (a.ageDays ?? -1) - (b.ageDays ?? -1);
      else if (sortKey === 'lltv') cmp = a.lltv - b.lltv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir(k === 'tier' || k === 'lltv' ? 'asc' : 'desc');
    }
  }

  function SortHeader({ k, label, align }: { k: SortKey; label: string; align?: 'right' }) {
    const active = sortKey === k;
    return (
      <th
        scope="col"
        className={
          'py-2 px-2 font-medium select-none cursor-pointer hover:text-brix-accent ' +
          (align === 'right' ? 'text-right' : 'text-left')
        }
        onClick={() => toggleSort(k)}
      >
        {label}
        {active ? <span className="ml-1 opacity-60">{sortDir === 'asc' ? '▲' : '▼'}</span> : null}
      </th>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8 bg-brix-bg min-h-screen text-neutral-200">
      <TopNav />

      <header className="border-b border-brix-border pb-6">
        <div className="brix-kicker mb-3">Brix · Market analysis</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Benchmark <span className="text-brix-accent">markets</span> for wiTRY/USDM
        </h1>
        <p className="mt-3 text-sm text-neutral-400 max-w-3xl leading-relaxed">
          A curated shortlist of Morpho Blue markets that anchor later analyses of borrower-LTV
          distributions and bad-debt history for the pre-launch <span className="text-neutral-200">wiTRY → USDM</span> market
          (yield-bearing TRY collateral, USD-stable loan, target LLTV <span className="text-neutral-200">0.86</span>).
          Selection rules and rationale live in{' '}
          <code className="text-brix-accent">docs/benchmark-markets.md</code>.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-neutral-500">
          <span><span className="text-brix-accent">Tier A</span> — closest structural analog</span>
          <span><span className="text-brix-accent">Tier B</span> — yield-bearing collateral / USD-stable loan</span>
          <span><span className="text-brix-accent">Tier C</span> — diverse controls (LLTV / collateral class)</span>
        </div>
      </header>

      <section className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm border-collapse">
            <thead className="text-neutral-400 border-b border-brix-border">
              <tr>
                <SortHeader k="tier" label="Tier" />
                <th className="py-2 px-2 text-left font-medium">Collateral</th>
                <th className="py-2 px-2 text-left font-medium">Loan</th>
                <th className="py-2 px-2 text-left font-medium">Chain</th>
                <SortHeader k="lltv" label="LLTV" align="right" />
                <SortHeader k="tvl" label="TVL" align="right" />
                <SortHeader k="borrow" label="Borrow" align="right" />
                <SortHeader k="age" label="Age (d)" align="right" />
                <th className="py-2 px-2 text-left font-medium">Bucket</th>
                <th className="py-2 px-2 text-left font-medium">Rationale</th>
                <th className="py-2 px-2 text-left font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.uniqueKey}
                  className="border-b border-brix-border/40 align-top hover:bg-brix-accent/5"
                >
                  <td className="py-2 px-2">
                    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] border border-brix-accent/40 text-brix-accent">
                      {c.tier}
                    </span>
                  </td>
                  <td className="py-2 px-2 font-medium text-neutral-200">{c.collateral}</td>
                  <td className="py-2 px-2 text-neutral-300">{c.loan}</td>
                  <td className="py-2 px-2 text-neutral-400">{c.chainName}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{(c.lltv * 100).toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtUsd(c.tvlK)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtUsd(c.borrowK)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{c.ageDays ?? '—'}</td>
                  <td className="py-2 px-2 text-neutral-400">{c.bucket}</td>
                  <td className="py-2 px-2 text-neutral-400 max-w-md">{c.rationale}</td>
                  <td className="py-2 px-2">
                    <Link
                      href={exploreHref(c) as never}
                      className="text-brix-accent hover:underline whitespace-nowrap"
                    >
                      Explore →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-neutral-500 leading-relaxed space-y-2 pt-2">
          <p>
            <span className="text-neutral-300">Caveats.</span> No FX-vs-USD market exists at the
            ≥$250k TVL floor — sjEUR/USDC (Tier A) is included below the floor as the only true
            structural analog. Borrower counts are not yet pulled; a market with deep TVL but few
            borrowers may still be unusable for Beta fitting. PT and RWA markets are sampled as
            controls only — their price processes are not transferable to wiTRY.
          </p>
        </div>
      </section>
    </div>
  );
}
