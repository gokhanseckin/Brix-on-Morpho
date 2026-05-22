# /explore-market Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/explore-market` page where a user pastes a Morpho market URL and sees that market's creator-set parameters, live state, and exposed MetaMorpho vaults.

**Architecture:** Static Next.js page that calls Morpho Blue's public GraphQL API (`https://blue-api.morpho.org/graphql`) directly from the browser. Single fetch per market, in-memory cached. No coupling to the simulator. URL state via `nuqs` for shareable links.

**Tech Stack:** Next.js 14 (App Router, `output: 'export'`), TypeScript (strict), `nuqs` for URL state, native `fetch`, Vitest + jsdom for tests, Tailwind with the existing `brix-*` design tokens.

**Spec:** `docs/superpowers/specs/2026-05-22-explore-market-page-design.md`

---

## File Structure

**New files:**
- `types/morphoMarket.ts` — `MarketView`, `VaultAllocation` type definitions.
- `lib/morphoApi.ts` — `parseMorphoUrl`, `fetchMarket`, in-memory cache. Pure async, no React.
- `lib/useMorphoMarket.ts` — React hook wrapping `fetchMarket` with loading/error state and abort.
- `app/explore-market/page.tsx` — the page; URL input + three cards.
- `app/explore-market/components/MarketParamsCard.tsx`
- `app/explore-market/components/MarketStateCard.tsx`
- `app/explore-market/components/ExposedVaultsCard.tsx`
- `tests/morphoApi.test.ts`

**Modified files:**
- `app/page.tsx` — add nav link to `/explore-market` next to existing nav links.

---

## Task 1: Type definitions

**Files:**
- Create: `types/morphoMarket.ts`

- [ ] **Step 1: Create the types file**

```typescript
// types/morphoMarket.ts

export type MarketParams = {
  collateralAsset: { address: string; symbol: string; decimals: number };
  loanAsset: { address: string; symbol: string; decimals: number };
  lltv: bigint;            // raw 1e18
  irmAddress: string;
  oracleAddress: string;
};

export type MarketState = {
  supplyAssetsUsd: number;
  borrowAssetsUsd: number;
  utilization: number;     // 0..1
  supplyApy: number;       // 0..1
  borrowApy: number;       // 0..1
  liquidityAssetsUsd: number;
  rateAtUTarget: number;   // 0..1
};

export type VaultAllocation = {
  address: string;
  name: string;
  symbol: string;
  totalAssetsUsd: number;
  allocationUsd: number;
  allocationPctOfVault: number;  // 0..1
  supplyCapUsd: number | null;   // null if uncapped
};

export type MarketView = {
  chainId: number;
  marketId: `0x${string}`;
  params: MarketParams;
  state: MarketState;
  vaults: VaultAllocation[];
};

export type ParsedMarketUrl =
  | { ok: true; chainId: number; marketId: `0x${string}` }
  | { ok: false; error: string };
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add types/morphoMarket.ts
git commit -m "feat(explore-market): add MarketView types"
```

---

## Task 2: URL parser (TDD)

**Files:**
- Create: `tests/morphoApi.test.ts`
- Create: `lib/morphoApi.ts`

- [ ] **Step 1: Write failing tests for `parseMorphoUrl`**

```typescript
// tests/morphoApi.test.ts
import { describe, it, expect } from 'vitest';
import { parseMorphoUrl } from '@/lib/morphoApi';

describe('parseMorphoUrl', () => {
  const id = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';

  it('parses canonical URL with slug', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/${id}/savusd-usdc`);
    expect(r).toEqual({ ok: true, chainId: 1, marketId: id });
  });

  it('parses URL with hash anchor', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/${id}/savusd-usdc#risk`);
    expect(r).toEqual({ ok: true, chainId: 1, marketId: id });
  });

  it('parses URL without trailing slug', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/${id}`);
    expect(r).toEqual({ ok: true, chainId: 1, marketId: id });
  });

  it('parses base chain', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/base/market/${id}`);
    expect(r).toEqual({ ok: true, chainId: 8453, marketId: id });
  });

  it('trims surrounding whitespace', () => {
    const r = parseMorphoUrl(`   https://app.morpho.org/ethereum/market/${id}   `);
    expect(r.ok).toBe(true);
  });

  it('rejects unknown chain slug', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/solana/market/${id}`);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/chain/i) });
  });

  it('rejects malformed marketId (too short)', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/0xdeadbeef`);
    expect(r.ok).toBe(false);
  });

  it('rejects malformed marketId (non-hex)', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/0xZZZZ${'0'.repeat(60)}`);
    expect(r.ok).toBe(false);
  });

  it('rejects unrelated URL', () => {
    const r = parseMorphoUrl('https://example.com/foo');
    expect(r.ok).toBe(false);
  });

  it('rejects plain text', () => {
    const r = parseMorphoUrl('not a url');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run tests/morphoApi.test.ts`
Expected: FAIL — module `@/lib/morphoApi` not found.

- [ ] **Step 3: Implement `parseMorphoUrl`**

```typescript
// lib/morphoApi.ts
import type { ParsedMarketUrl } from '@/types/morphoMarket';

const CHAIN_SLUGS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  unichain: 130,
};

const MARKET_ID_RE = /^0x[0-9a-fA-F]{64}$/;

export function parseMorphoUrl(input: string): ParsedMarketUrl {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }
  if (!url.hostname.endsWith('morpho.org')) {
    return { ok: false, error: 'Not a Morpho URL' };
  }
  // Path shape: /<chain>/market/<marketId>[/<slug>]
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts[1] !== 'market') {
    return { ok: false, error: 'Could not find /<chain>/market/<id> in URL path' };
  }
  const chainSlug = parts[0]!.toLowerCase();
  const chainId = CHAIN_SLUGS[chainSlug];
  if (!chainId) {
    return { ok: false, error: `Unknown chain "${chainSlug}"` };
  }
  const rawId = parts[2]!;
  if (!MARKET_ID_RE.test(rawId)) {
    return { ok: false, error: 'Malformed marketId' };
  }
  return { ok: true, chainId, marketId: rawId.toLowerCase() as `0x${string}` };
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run tests/morphoApi.test.ts`
Expected: PASS — 10/10 parseMorphoUrl tests.

- [ ] **Step 5: Commit**

```bash
git add lib/morphoApi.ts tests/morphoApi.test.ts
git commit -m "feat(explore-market): parseMorphoUrl with chain slug + id validation"
```

---

## Task 3: `fetchMarket` against Morpho GraphQL (TDD)

**Files:**
- Modify: `tests/morphoApi.test.ts`
- Modify: `lib/morphoApi.ts`

- [ ] **Step 1: Append failing tests for `fetchMarket`**

Append to `tests/morphoApi.test.ts`:

```typescript
import { fetchMarket, _resetMarketCache } from '@/lib/morphoApi';
import { beforeEach, vi } from 'vitest';

const SAMPLE_RESPONSE = {
  data: {
    marketByUniqueKey: {
      uniqueKey: '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9',
      lltv: '860000000000000000',
      irmAddress: '0x870ac11d48b15db9a138cf899d20f13f79ba00bc',
      oracleAddress: '0x1234567890abcdef1234567890abcdef12345678',
      collateralAsset: { address: '0xc0', symbol: 'sAVUSD', decimals: 18 },
      loanAsset: { address: '0xc1', symbol: 'USDC', decimals: 6 },
      state: {
        supplyAssetsUsd: 1_000_000,
        borrowAssetsUsd: 600_000,
        utilization: 0.6,
        supplyApy: 0.045,
        borrowApy: 0.072,
        liquidityAssetsUsd: 400_000,
        rateAtUTarget: 0.04,
      },
      supplyingVaults: [
        {
          address: '0xVaultA',
          name: 'Steakhouse USDC',
          symbol: 'steakUSDC',
          state: { totalAssetsUsd: 50_000_000 },
          allocation: { supplyAssetsUsd: 800_000, supplyCapUsd: 2_000_000 },
        },
        {
          address: '0xVaultB',
          name: 'Gauntlet USDC',
          symbol: 'gtUSDC',
          state: { totalAssetsUsd: 30_000_000 },
          allocation: { supplyAssetsUsd: 200_000, supplyCapUsd: null },
        },
      ],
    },
  },
};

describe('fetchMarket', () => {
  beforeEach(() => {
    _resetMarketCache();
    vi.restoreAllMocks();
  });

  it('maps GraphQL response to MarketView', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    });
    vi.stubGlobal('fetch', fetchMock);

    const id = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';
    const view = await fetchMarket(1, id);

    expect(view.chainId).toBe(1);
    expect(view.marketId).toBe(id);
    expect(view.params.lltv).toBe(860000000000000000n);
    expect(view.params.collateralAsset.symbol).toBe('sAVUSD');
    expect(view.state.utilization).toBeCloseTo(0.6, 10);
    expect(view.vaults).toHaveLength(2);
    expect(view.vaults[0]!.name).toBe('Steakhouse USDC');
    expect(view.vaults[0]!.allocationPctOfVault).toBeCloseTo(800_000 / 50_000_000, 10);
    expect(view.vaults[1]!.supplyCapUsd).toBeNull();
  });

  it('sorts vaults by allocation desc', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const view = await fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9');
    expect(view.vaults[0]!.allocationUsd).toBeGreaterThanOrEqual(view.vaults[1]!.allocationUsd);
  });

  it('caches by chainId:marketId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    });
    vi.stubGlobal('fetch', fetchMock);

    const id = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';
    await fetchMarket(1, id);
    await fetchMarket(1, id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on null marketByUniqueKey', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketByUniqueKey: null } }),
    }));
    await expect(
      fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9')
    ).rejects.toThrow(/not found/i);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    await expect(
      fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9')
    ).rejects.toThrow(/500/);
  });

  it('throws on GraphQL errors array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'bad query' }] }),
    }));
    await expect(
      fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9')
    ).rejects.toThrow(/bad query/);
  });

  it('handles null supplyingVaults (empty array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          marketByUniqueKey: { ...SAMPLE_RESPONSE.data.marketByUniqueKey, supplyingVaults: null },
        },
      }),
    }));
    const view = await fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9');
    expect(view.vaults).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/morphoApi.test.ts`
Expected: FAIL — `fetchMarket` / `_resetMarketCache` not exported.

- [ ] **Step 3: Implement `fetchMarket`**

Append to `lib/morphoApi.ts`:

```typescript
import type { MarketView, VaultAllocation } from '@/types/morphoMarket';

const ENDPOINT = 'https://blue-api.morpho.org/graphql';

const MARKET_QUERY = `
  query Market($chainId: Int!, $uniqueKey: String!) {
    marketByUniqueKey(chainId: $chainId, uniqueKey: $uniqueKey) {
      uniqueKey
      lltv
      irmAddress
      oracleAddress
      collateralAsset { address symbol decimals }
      loanAsset { address symbol decimals }
      state {
        supplyAssetsUsd
        borrowAssetsUsd
        utilization
        supplyApy
        borrowApy
        liquidityAssetsUsd
        rateAtUTarget
      }
      supplyingVaults {
        address
        name
        symbol
        state { totalAssetsUsd }
        allocation: marketAllocation {
          supplyAssetsUsd
          supplyCapUsd
        }
      }
    }
  }
`;

const cache = new Map<string, MarketView>();

export function _resetMarketCache(): void {
  cache.clear();
}

export async function fetchMarket(
  chainId: number,
  marketId: string,
  options?: { signal?: AbortSignal }
): Promise<MarketView> {
  const key = `${chainId}:${marketId.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: MARKET_QUERY,
      variables: { chainId, uniqueKey: marketId },
    }),
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) {
    throw new Error(`Morpho API HTTP ${res.status}`);
  }

  const json = await res.json() as {
    data?: { marketByUniqueKey: RawMarket | null };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }
  const m = json.data?.marketByUniqueKey;
  if (!m) {
    throw new Error('Market not found on Morpho Blue API');
  }

  const view: MarketView = {
    chainId,
    marketId: marketId.toLowerCase() as `0x${string}`,
    params: {
      collateralAsset: m.collateralAsset,
      loanAsset: m.loanAsset,
      lltv: BigInt(m.lltv),
      irmAddress: m.irmAddress,
      oracleAddress: m.oracleAddress,
    },
    state: {
      supplyAssetsUsd: m.state.supplyAssetsUsd ?? 0,
      borrowAssetsUsd: m.state.borrowAssetsUsd ?? 0,
      utilization: m.state.utilization ?? 0,
      supplyApy: m.state.supplyApy ?? 0,
      borrowApy: m.state.borrowApy ?? 0,
      liquidityAssetsUsd: m.state.liquidityAssetsUsd ?? 0,
      rateAtUTarget: m.state.rateAtUTarget ?? 0,
    },
    vaults: mapVaults(m.supplyingVaults ?? []),
  };

  cache.set(key, view);
  return view;
}

type RawAsset = { address: string; symbol: string; decimals: number };
type RawVault = {
  address: string;
  name: string;
  symbol: string;
  state: { totalAssetsUsd: number | null };
  allocation: { supplyAssetsUsd: number | null; supplyCapUsd: number | null } | null;
};
type RawMarket = {
  uniqueKey: string;
  lltv: string;
  irmAddress: string;
  oracleAddress: string;
  collateralAsset: RawAsset;
  loanAsset: RawAsset;
  state: {
    supplyAssetsUsd: number | null;
    borrowAssetsUsd: number | null;
    utilization: number | null;
    supplyApy: number | null;
    borrowApy: number | null;
    liquidityAssetsUsd: number | null;
    rateAtUTarget: number | null;
  };
  supplyingVaults: RawVault[] | null;
};

function mapVaults(raw: RawVault[]): VaultAllocation[] {
  return raw
    .map(v => {
      const totalAssetsUsd = v.state.totalAssetsUsd ?? 0;
      const allocationUsd = v.allocation?.supplyAssetsUsd ?? 0;
      return {
        address: v.address,
        name: v.name,
        symbol: v.symbol,
        totalAssetsUsd,
        allocationUsd,
        allocationPctOfVault: totalAssetsUsd > 0 ? allocationUsd / totalAssetsUsd : 0,
        supplyCapUsd: v.allocation?.supplyCapUsd ?? null,
      };
    })
    .sort((a, b) => b.allocationUsd - a.allocationUsd);
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npx vitest run tests/morphoApi.test.ts`
Expected: PASS — all `parseMorphoUrl` + `fetchMarket` tests.

- [ ] **Step 5: Note about schema**

The exact GraphQL field name for the vault-to-market allocation (`marketAllocation` aliased as `allocation` here) MAY differ from what the live `blue-api.morpho.org` schema exposes. During execution, if the query errors with "Cannot query field", introspect the schema with a quick curl + adjust the alias. The mapper code is field-name agnostic — only `MARKET_QUERY` needs editing.

- [ ] **Step 6: Commit**

```bash
git add lib/morphoApi.ts tests/morphoApi.test.ts
git commit -m "feat(explore-market): fetchMarket with in-memory cache"
```

---

## Task 4: React hook `useMorphoMarket`

**Files:**
- Create: `lib/useMorphoMarket.ts`

- [ ] **Step 1: Implement the hook**

```typescript
// lib/useMorphoMarket.ts
'use client';
import { useEffect, useState } from 'react';
import { fetchMarket } from '@/lib/morphoApi';
import type { MarketView } from '@/types/morphoMarket';

type State =
  | { loading: false; data: null; error: null }
  | { loading: true; data: null; error: null }
  | { loading: false; data: MarketView; error: null }
  | { loading: false; data: null; error: string };

const IDLE: State = { loading: false, data: null, error: null };

export function useMorphoMarket(
  chainId: number | null,
  marketId: string | null
): State {
  const [state, setState] = useState<State>(IDLE);

  useEffect(() => {
    if (chainId == null || !marketId) {
      setState(IDLE);
      return;
    }

    const ac = new AbortController();
    setState({ loading: true, data: null, error: null });

    fetchMarket(chainId, marketId, { signal: ac.signal })
      .then(data => {
        if (ac.signal.aborted) return;
        setState({ loading: false, data, error: null });
      })
      .catch(err => {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ loading: false, data: null, error: msg });
      });

    return () => ac.abort();
  }, [chainId, marketId]);

  return state;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/useMorphoMarket.ts
git commit -m "feat(explore-market): useMorphoMarket React hook with abort"
```

---

## Task 5: Card components

**Files:**
- Create: `app/explore-market/components/MarketParamsCard.tsx`
- Create: `app/explore-market/components/MarketStateCard.tsx`
- Create: `app/explore-market/components/ExposedVaultsCard.tsx`

- [ ] **Step 1: Implement `MarketParamsCard`**

```tsx
// app/explore-market/components/MarketParamsCard.tsx
'use client';
import type { MarketParams } from '@/types/morphoMarket';
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
}: {
  chainId: number;
  marketId: string;
  params: MarketParams;
}) {
  const base = ETHERSCAN_BASE[chainId] ?? '';
  const lltv = lltvPct(params.lltv);
  const gov = isGovernanceLltv(params.lltv);

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Market parameters</h2>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Row label="Collateral" value={`${params.collateralAsset.symbol} (${shorten(params.collateralAsset.address)})`} href={base + params.collateralAsset.address} />
        <Row label="Loan" value={`${params.loanAsset.symbol} (${shorten(params.loanAsset.address)})`} href={base + params.loanAsset.address} />
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
```

- [ ] **Step 2: Implement `MarketStateCard`**

```tsx
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
```

- [ ] **Step 3: Implement `ExposedVaultsCard`**

```tsx
// app/explore-market/components/ExposedVaultsCard.tsx
'use client';
import type { VaultAllocation } from '@/types/morphoMarket';

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, digits = 2): string {
  return `${(n * 100).toFixed(digits)}%`;
}

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
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtUsd(v.totalAssetsUsd)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtUsd(v.allocationUsd)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmtPct(v.allocationPctOfVault)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {v.supplyCapUsd == null ? <span className="text-neutral-500">uncapped</span> : fmtUsd(v.supplyCapUsd)}
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
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/explore-market/components/
git commit -m "feat(explore-market): params, state, and vaults card components"
```

---

## Task 6: Page with URL input and nuqs state

**Files:**
- Create: `app/explore-market/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// app/explore-market/page.tsx
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryState } from 'nuqs';
import { parseMorphoUrl } from '@/lib/morphoApi';
import { useMorphoMarket } from '@/lib/useMorphoMarket';
import { MarketParamsCard } from './components/MarketParamsCard';
import { MarketStateCard } from './components/MarketStateCard';
import { ExposedVaultsCard } from './components/ExposedVaultsCard';

export default function ExploreMarketPage() {
  const [url, setUrl] = useQueryState('url', { defaultValue: '' });
  const [draft, setDraft] = useState(url);

  const parsed = useMemo(() => (url ? parseMorphoUrl(url) : null), [url]);
  const ok = parsed?.ok === true;
  const result = useMorphoMarket(ok ? parsed.chainId : null, ok ? parsed.marketId : null);

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
          <MarketParamsCard chainId={parsed.chainId} marketId={parsed.marketId} params={result.data.params} />
          <MarketStateCard state={result.data.state} />
          <ExposedVaultsCard vaults={result.data.vaults} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS (no errors specific to new files).

- [ ] **Step 4: Commit**

```bash
git add app/explore-market/page.tsx
git commit -m "feat(explore-market): page with URL input and 3 result cards"
```

---

## Task 7: Add nav link from home page

**Files:**
- Modify: `app/page.tsx` (around lines 25-38)

- [ ] **Step 1: Add the link**

In `app/page.tsx`, locate the nav block:

```tsx
<div className="mt-6 flex gap-6 text-sm">
  <a href="/utilization" className="text-brix-accent hover:text-brix-accentHover">
    Target utilization →
  </a>
  <a href="/lltv" className="text-brix-accent hover:text-brix-accentHover">
    LLTV calibration →
  </a>
  <a href="/swapliquidity" className="text-brix-accent hover:text-brix-accentHover">
    Swap liquidity →
  </a>
  <a href="/assignment" className="text-brix-accent hover:text-brix-accentHover">
    Pitch deck →
  </a>
</div>
```

Add a new anchor after the `swapliquidity` link, before `assignment`:

```tsx
<a href="/explore-market" className="text-brix-accent hover:text-brix-accentHover">
  Explore market →
</a>
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat(explore-market): add nav link from home page"
```

---

## Task 8: Build + full test run

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS — all existing tests + the new `tests/morphoApi.test.ts` (16 tests added across Tasks 2 and 3).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Run static build**

Run: `npm run build`
Expected: PASS — the new `/explore-market` route appears in the build output as a static page.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`

In a browser, open `http://localhost:3000/explore-market` and:
1. Paste `https://app.morpho.org/ethereum/market/0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9/savusd-usdc` → click Load.
2. Verify all 3 cards render with real data: collateral = sAVUSD, loan = USDC, LLTV %, live USD totals, and at least one vault row.
3. Verify the URL bar updates to include `?url=https%3A%2F%2Fapp.morpho.org%2F…`.
4. Refresh the page → cards re-render from the URL.
5. Paste a malformed URL → inline error displays without a network call (verify in DevTools Network panel).

If the GraphQL query errors with "Cannot query field", introspect the live schema:

```bash
curl -s https://blue-api.morpho.org/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __type(name: \"Vault\") { fields { name } } }"}' | jq
```

Adjust the field name in `MARKET_QUERY` and re-test. Commit the fix:

```bash
git add lib/morphoApi.ts
git commit -m "fix(explore-market): align GraphQL field name with live schema"
```

- [ ] **Step 5: Final commit if nothing changed**

If the smoke test passed without schema edits, no commit needed. Done.

---

## Spec Coverage Check

| Spec section | Task |
|---|---|
| `/explore-market` route, static export | Task 6 |
| URL input, parse via `parseMorphoUrl`, error inline | Tasks 2, 6 |
| `nuqs` `?url=` shareable state | Task 6 |
| `fetchMarket` + in-memory cache, GraphQL endpoint | Task 3 |
| `useMorphoMarket` hook with abort | Task 4 |
| MarketParamsCard with LLTV gov flag + Etherscan links | Task 5 |
| MarketStateCard with formatted numbers | Task 5 |
| ExposedVaultsCard sorted by allocation desc, empty state | Tasks 3, 5 |
| Types in `types/morphoMarket.ts` (separate from simulator types) | Task 1 |
| Unit tests: `parseMorphoUrl` + `fetchMarket` with mocked fetch | Tasks 2, 3 |
| No e2e | (not added) |
| Nav link from home | Task 7 |
