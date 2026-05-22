// app/explore-market/page.tsx
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryState } from 'nuqs';
import { parseMorphoUrl } from '@/lib/morphoApi';
import { useMorphoMarket } from '@/lib/useMorphoMarket';
import { useMarketHistory } from '@/lib/useMarketHistory';
import { MarketParamsCard } from './components/MarketParamsCard';
import { MarketStateCard } from './components/MarketStateCard';
import { OracleDetailsCard } from './components/OracleDetailsCard';
import { IrmCurveCard } from './components/IrmCurveCard';
import { TokensActivityCard } from './components/TokensActivityCard';
import { DerivedLiquidationCard } from './components/DerivedLiquidationCard';
import { HistoryChartCard } from './components/HistoryChartCard';
import { ExposedVaultsCard } from './components/ExposedVaultsCard';

export default function ExploreMarketPage() {
  const [url, setUrl] = useQueryState('url', { defaultValue: '' });
  const [draft, setDraft] = useState(url);

  const parsed = useMemo(() => (url ? parseMorphoUrl(url) : null), [url]);
  const ok = parsed?.ok === true;
  const result = useMorphoMarket(ok ? parsed.chainId : null, ok ? parsed.marketId : null);
  const history = useMarketHistory(ok ? parsed.chainId : null, ok ? parsed.marketId : null, 30);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void setUrl(draft.trim() || null);
  }

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-8 bg-brix-bg min-h-screen text-neutral-200">
      <header className="border-b border-brix-border pb-6">
        <div className="brix-kicker mb-3">Brix · Market explorer</div>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Explore a <span className="text-brix-accent">Morpho market</span>
          </h1>
          <Link href="/" className="text-sm text-brix-accent hover:text-brix-accentHover">← back to sim</Link>
        </div>
        <p className="mt-4 text-sm text-neutral-400 max-w-2xl">
          Paste a Morpho Blue market URL to see its creator-set parameters, live state, and the MetaMorpho vaults
          currently supplying it. Read-only reference — does not affect the Brix simulator.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="market-url" className="block text-xs uppercase tracking-wide text-neutral-500">
          Market URL
        </label>
        <div className="flex gap-2">
          <input
            id="market-url"
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="https://app.morpho.org/ethereum/market/0x…/savusd-usdc"
            className="flex-1 rounded-md border border-brix-border bg-brix-card px-3 py-2 text-sm font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-brix-accent"
          />
          <button
            type="submit"
            className="rounded-md border border-brix-accent bg-brix-accent/10 px-4 py-2 text-sm text-brix-accent hover:bg-brix-accent/20"
          >
            Load
          </button>
        </div>
        {url && parsed && !parsed.ok && (
          <p className="text-sm text-red-400">{parsed.error}</p>
        )}
      </form>

      {result.loading && (
        <p className="text-sm text-neutral-400">Loading market…</p>
      )}
      {result.error && (
        <div className="rounded-md border border-red-700/50 bg-red-900/20 p-4 text-sm text-red-300">
          {result.error}
        </div>
      )}
      {result.data && ok && (
        <>
          <MarketParamsCard
            chainId={parsed.chainId}
            marketId={parsed.marketId}
            params={result.data.params}
            collateral={result.data.collateral}
            loan={result.data.loan}
          />
          <MarketStateCard state={result.data.state} />
          <OracleDetailsCard
            chainId={parsed.chainId}
            oracle={result.data.oracle}
            collateralPriceUsd={result.data.collateral.priceUsd}
            collateralPriceTimestamp={result.data.collateral.priceTimestamp}
          />
          <IrmCurveCard
            irmAddress={result.data.params.irmAddress}
            curve={result.data.irmCurve}
            currentUtilization={result.data.state.utilization}
            rateAtTarget={result.data.state.rateAtUTarget}
            apyAtTarget={result.data.state.apyAtTarget}
          />
          <TokensActivityCard
            chainId={parsed.chainId}
            collateral={result.data.collateral}
            loan={result.data.loan}
            activity={result.data.activity}
            preLiquidations={result.data.preLiquidations}
          />
          <DerivedLiquidationCard lltv={result.data.params.lltv} />
          <HistoryChartCard
            loading={history.loading}
            error={history.error}
            data={history.data}
          />
          <ExposedVaultsCard vaults={result.data.vaults} />
        </>
      )}
    </div>
  );
}
