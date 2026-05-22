# /explore-market Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 cards (oracle details, IRM curve chart, tokens+activity+pre-liq, derived liquidation, 30-day history chart) to `/explore-market`, exposing every creator-set and derived parameter Morpho's API surfaces.

**Architecture:** Extend the existing single GraphQL query with the new field selections (one round-trip), plus add a separate `fetchMarketHistory` for the historical timeseries (fires in parallel). All new cards consume the expanded `MarketView` (or the history hook for the chart). The redundant asset fields on `MarketParams` are dropped — `view.collateral` and `view.loan` become the single source of truth per asset.

**Tech Stack:** Next.js 14 (App Router, static export), TypeScript strict, `nuqs`, Recharts (already installed), native `fetch`, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-explore-market-enrichment-design.md`

**Builds on:** previous /explore-market work (commits `91000c3..5739698`).

---

## File Structure

**New files:**
- `app/explore-market/components/OracleDetailsCard.tsx`
- `app/explore-market/components/IrmCurveCard.tsx`
- `app/explore-market/components/TokensActivityCard.tsx`
- `app/explore-market/components/DerivedLiquidationCard.tsx`
- `app/explore-market/components/HistoryChartCard.tsx`
- `lib/useMarketHistory.ts`

**Modified files:**
- `types/morphoMarket.ts` — add new type unions and extend `MarketView`; remove asset fields from `MarketParams`.
- `lib/morphoApi.ts` — expand `MARKET_QUERY`, expand `RawMarket`/mapping, add `fetchMarketHistory` + history cache, refactor `mapVaults` if needed.
- `tests/morphoApi.test.ts` — update existing `SAMPLE_RESPONSE` fixture, add tests for new mappings and `fetchMarketHistory`.
- `app/explore-market/components/MarketParamsCard.tsx` — read from `view.collateral` / `view.loan` instead of `params.collateralAsset` / `params.loanAsset`.
- `app/explore-market/page.tsx` — render all 8 cards in order, fire history hook in parallel.

---

## Task 1: Extend types

**Files:**
- Modify: `types/morphoMarket.ts`

- [ ] **Step 1: Read the current types file** to see exact lines to change.

Run from worktree dir:
```bash
cat types/morphoMarket.ts
```

- [ ] **Step 2: Edit `types/morphoMarket.ts`**

Replace the existing `MarketParams` type to drop the redundant asset fields:

```typescript
// types/morphoMarket.ts

export type MarketParams = {
  lltv: bigint;            // raw 1e18
  irmAddress: string;
  oracleAddress: string;
};
```

Add these new exports below the existing types (keep `MarketState`, `VaultAllocation`, `ParsedMarketUrl` as-is):

```typescript
export type AssetMeta = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
  priceTimestamp: number | null;
};

export type OracleFeed = { address: string; decimals: number };

export type ChainlinkOracleV2Details = {
  kind: 'ChainlinkOracleV2';
  baseFeedOne: OracleFeed | null;
  baseFeedTwo: OracleFeed | null;
  quoteFeedOne: OracleFeed | null;
  quoteFeedTwo: OracleFeed | null;
  scaleFactor: bigint;
};

export type UnknownOracleDetails = {
  kind: 'Unknown';
  rawType: string;
};

export type OracleInfo = {
  address: string;
  details: ChainlinkOracleV2Details | UnknownOracleDetails;
};

export type IrmCurvePoint = {
  utilization: number;
  supplyApy: number;
  borrowApy: number;
};

export type PreLiquidationContract = {
  address: string;
  preLltv: bigint;
  preLCF1: bigint;
  preLCF2: bigint;
  preLIF1: bigint;
  preLIF2: bigint;
};

export type MarketWarning = { type: string; level: string };

export type MarketActivity = {
  feePct: number;
  creationBlockNumber: number;
  creationTimestamp: number;
  collateralAssetsUsd: number;
  badDebtUsd: number;
  realizedBadDebtUsd: number;
  warnings: MarketWarning[];
  oraclePrice: bigint;     // state.price raw
};

export type HistoryPoint = {
  timestamp: number;
  supplyApy: number;
  borrowApy: number;
  utilization: number;
};
```

Replace the existing `MarketView` with the expanded version:

```typescript
export type MarketView = {
  chainId: number;
  marketId: `0x${string}`;
  params: MarketParams;
  state: MarketState;
  vaults: VaultAllocation[];
  collateral: AssetMeta;
  loan: AssetMeta;
  oracle: OracleInfo;
  irmCurve: IrmCurvePoint[];
  activity: MarketActivity;
  preLiquidations: PreLiquidationContract[];
};
```

- [ ] **Step 3: Type-check from the worktree dir**

Run: `npx tsc --noEmit`

Expected: FAIL — `lib/morphoApi.ts` still constructs the old `MarketView` shape, and `MarketParamsCard.tsx` reads the removed `params.collateralAsset`/`params.loanAsset`. **These will be fixed in Tasks 2 and 3 — leave them failing for now and do NOT commit yet.** Capture the error count to confirm it's only the expected sites.

- [ ] **Step 4: Stage and stash (no commit yet)**

```bash
git add types/morphoMarket.ts
```

Do NOT commit standalone — this task's change makes the build red. It will be committed together with Tasks 2 + 3 once the consumers are migrated.

---

## Task 2: Expand `MARKET_QUERY` and mapping

**Files:**
- Modify: `lib/morphoApi.ts`
- Modify: `tests/morphoApi.test.ts`

- [ ] **Step 1: Update `MARKET_QUERY` in `lib/morphoApi.ts`**

Replace the existing `MARKET_QUERY` constant with:

```typescript
const MARKET_QUERY = `
  query Market($chainId: Int!, $uniqueKey: String!) {
    marketByUniqueKey(chainId: $chainId, uniqueKey: $uniqueKey) {
      uniqueKey
      lltv
      irmAddress
      oracleAddress
      creationBlockNumber
      creationTimestamp
      warnings { type level }
      collateralAsset {
        address symbol name decimals
        price { usd timestamp }
      }
      loanAsset {
        address symbol name decimals
        price { usd timestamp }
      }
      state {
        supplyAssetsUsd
        borrowAssetsUsd
        utilization
        supplyApy
        borrowApy
        liquidityAssetsUsd
        rateAtUTarget
        apyAtTarget
        fee
        price
        collateralAssetsUsd
        timestamp
      }
      badDebt { usd }
      realizedBadDebt { usd }
      oracle {
        address
        type
        data {
          ... on MorphoChainlinkOracleV2Data {
            baseFeedOne { address decimals }
            baseFeedTwo { address decimals }
            quoteFeedOne { address decimals }
            quoteFeedTwo { address decimals }
            scaleFactor
          }
        }
      }
      currentIrmCurve { utilization supplyApy borrowApy }
      preLiquidations {
        items { address preLltv preLCF1 preLCF2 preLIF1 preLIF2 }
      }
      supplyingVaults {
        address name symbol
        state {
          totalAssetsUsd
          allocation {
            supplyAssetsUsd
            supplyCapUsd
            market { uniqueKey }
          }
        }
      }
    }
  }
`;
```

- [ ] **Step 2: Update `RawMarket` and the mapping in `fetchMarket`**

Replace the existing `RawMarket` and related raw types with:

```typescript
type RawPrice = { usd: number | null; timestamp: number | null } | null;
type RawAsset = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: RawPrice;
};
type RawFeed = { address: string; decimals: number } | null;
type RawOracleData = {
  baseFeedOne?: RawFeed;
  baseFeedTwo?: RawFeed;
  quoteFeedOne?: RawFeed;
  quoteFeedTwo?: RawFeed;
  scaleFactor?: string;
} | null;
type RawOracle = {
  address: string;
  type: string;
  data: RawOracleData;
};
type RawIrmPoint = { utilization: number; supplyApy: number; borrowApy: number };
type RawPreLiq = {
  address: string;
  preLltv: string;
  preLCF1: string;
  preLCF2: string;
  preLIF1: string;
  preLIF2: string;
};
type RawVault = {
  address: string;
  name: string;
  symbol: string;
  state: {
    totalAssetsUsd: number | null;
    allocation: Array<{
      supplyAssetsUsd: number | null;
      supplyCapUsd: number | null;
      market: { uniqueKey: string };
    }> | null;
  };
};
type RawMarket = {
  uniqueKey: string;
  lltv: string;
  irmAddress: string;
  oracleAddress: string;
  creationBlockNumber: number;
  creationTimestamp: string;
  warnings: Array<{ type: string; level: string }> | null;
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
    apyAtTarget: number | null;
    fee: number | null;
    price: string | null;
    collateralAssetsUsd: number | null;
    timestamp: string | null;
  };
  badDebt: { usd: number | null } | null;
  realizedBadDebt: { usd: number | null } | null;
  oracle: RawOracle | null;
  currentIrmCurve: RawIrmPoint[] | null;
  preLiquidations: { items: RawPreLiq[] | null } | null;
  supplyingVaults: RawVault[] | null;
};
```

Replace the assembly of `view` inside `fetchMarket` with:

```typescript
  const view: MarketView = {
    chainId,
    marketId: marketId.toLowerCase() as `0x${string}`,
    params: {
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
    collateral: mapAsset(m.collateralAsset),
    loan: mapAsset(m.loanAsset),
    oracle: mapOracle(m.oracle),
    irmCurve: m.currentIrmCurve ?? [],
    activity: {
      feePct: m.state.fee ?? 0,
      creationBlockNumber: m.creationBlockNumber ?? 0,
      creationTimestamp: m.creationTimestamp ? Number(m.creationTimestamp) : 0,
      collateralAssetsUsd: m.state.collateralAssetsUsd ?? 0,
      badDebtUsd: m.badDebt?.usd ?? 0,
      realizedBadDebtUsd: m.realizedBadDebt?.usd ?? 0,
      warnings: m.warnings ?? [],
      oraclePrice: m.state.price ? BigInt(m.state.price) : 0n,
    },
    preLiquidations: (m.preLiquidations?.items ?? []).map(mapPreLiq),
    vaults: mapVaults(m.supplyingVaults ?? [], marketId),
  };
```

Add these helpers near the bottom of the file (above the existing `mapVaults`):

```typescript
function mapAsset(a: RawAsset): AssetMeta {
  return {
    address: a.address,
    symbol: a.symbol,
    name: a.name,
    decimals: a.decimals,
    priceUsd: a.price?.usd ?? null,
    priceTimestamp: a.price?.timestamp ?? null,
  };
}

function mapOracle(o: RawOracle | null): OracleInfo {
  if (!o) {
    return { address: '', details: { kind: 'Unknown', rawType: 'null' } };
  }
  if (o.type === 'ChainlinkOracleV2' && o.data) {
    return {
      address: o.address,
      details: {
        kind: 'ChainlinkOracleV2',
        baseFeedOne: o.data.baseFeedOne ?? null,
        baseFeedTwo: o.data.baseFeedTwo ?? null,
        quoteFeedOne: o.data.quoteFeedOne ?? null,
        quoteFeedTwo: o.data.quoteFeedTwo ?? null,
        scaleFactor: o.data.scaleFactor ? BigInt(o.data.scaleFactor) : 0n,
      },
    };
  }
  return { address: o.address, details: { kind: 'Unknown', rawType: o.type } };
}

function mapPreLiq(p: RawPreLiq): PreLiquidationContract {
  return {
    address: p.address,
    preLltv: BigInt(p.preLltv),
    preLCF1: BigInt(p.preLCF1),
    preLCF2: BigInt(p.preLCF2),
    preLIF1: BigInt(p.preLIF1),
    preLIF2: BigInt(p.preLIF2),
  };
}
```

Update the import at the top:

```typescript
import type {
  MarketView,
  VaultAllocation,
  AssetMeta,
  OracleInfo,
  PreLiquidationContract,
} from '@/types/morphoMarket';
```

- [ ] **Step 3: Update `SAMPLE_RESPONSE` fixture in `tests/morphoApi.test.ts`**

The existing fixture currently includes only the v1 fields. Replace it (locate the `const SAMPLE_RESPONSE = {...}` near the top of the `describe('fetchMarket', ...)` block) with the full v2 shape:

```typescript
const ID = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';

const SAMPLE_RESPONSE = {
  data: {
    marketByUniqueKey: {
      uniqueKey: ID,
      lltv: '860000000000000000',
      irmAddress: '0x870ac11d48b15db9a138cf899d20f13f79ba00bc',
      oracleAddress: '0x1234567890abcdef1234567890abcdef12345678',
      creationBlockNumber: 24249174,
      creationTimestamp: '1768589183',
      warnings: [],
      collateralAsset: {
        address: '0xc0',
        symbol: 'sAVUSD',
        name: 'Staked avUSD',
        decimals: 18,
        price: { usd: 1.17, timestamp: 1779426806 },
      },
      loanAsset: {
        address: '0xc1',
        symbol: 'USDC',
        name: 'USDCoin',
        decimals: 6,
        price: { usd: 1.00, timestamp: 1779439141 },
      },
      state: {
        supplyAssetsUsd: 1_000_000,
        borrowAssetsUsd: 600_000,
        utilization: 0.6,
        supplyApy: 0.045,
        borrowApy: 0.072,
        liquidityAssetsUsd: 400_000,
        rateAtUTarget: 0.04,
        apyAtTarget: 0.0855,
        fee: 0,
        price: '1170553706056013390000000',
        collateralAssetsUsd: 11_708_677,
        timestamp: '1779438983',
      },
      badDebt: { usd: 0 },
      realizedBadDebt: { usd: 0 },
      oracle: {
        address: '0x839940de5043e7c6eDaf063714AFe7F20De5ff12',
        type: 'ChainlinkOracleV2',
        data: {
          baseFeedOne: { address: '0x9fBb7D07ae32B3F75c2a5805C2153243A2532589', decimals: 18 },
          baseFeedTwo: null,
          quoteFeedOne: null,
          quoteFeedTwo: null,
          scaleFactor: '1000000',
        },
      },
      currentIrmCurve: [
        { utilization: 0, supplyApy: 0, borrowApy: 0.02 },
        { utilization: 0.5, supplyApy: 0.025, borrowApy: 0.05 },
        { utilization: 1, supplyApy: 0.1, borrowApy: 0.2 },
      ],
      preLiquidations: { items: [] },
      supplyingVaults: [
        {
          address: '0xVaultA',
          name: 'Steakhouse USDC',
          symbol: 'steakUSDC',
          state: {
            totalAssetsUsd: 50_000_000,
            allocation: [
              {
                supplyAssetsUsd: 800_000,
                supplyCapUsd: 2_000_000,
                market: { uniqueKey: ID },
              },
              {
                supplyAssetsUsd: 999_999,
                supplyCapUsd: 1_000_000_000,
                market: { uniqueKey: '0xdead0000000000000000000000000000000000000000000000000000000000ad' },
              },
            ],
          },
        },
        {
          address: '0xVaultB',
          name: 'Gauntlet USDC',
          symbol: 'gtUSDC',
          state: {
            totalAssetsUsd: 30_000_000,
            allocation: [
              {
                supplyAssetsUsd: 200_000,
                supplyCapUsd: null,
                market: { uniqueKey: ID },
              },
            ],
          },
        },
      ],
    },
  },
};
```

If the existing fixture uses a hardcoded id string at the top of the file (e.g. `const id = '0xe07d...';`) for other tests, replace those occurrences with `ID` so there's a single canonical constant.

- [ ] **Step 4: Update existing fetchMarket tests for the new MarketView shape**

The previously-written tests reference `view.params.collateralAsset.symbol` etc. Update each affected assertion to use `view.collateral.symbol` (and analogously for `view.loan`). Walk through the existing `describe('fetchMarket', ...)` block and fix every spot that references `view.params.collateralAsset` or `view.params.loanAsset` to read from the new top-level `collateral`/`loan`.

- [ ] **Step 5: Add new test cases**

Append these tests inside the `describe('fetchMarket', ...)` block:

```typescript
  it('maps Chainlink V2 oracle data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.oracle.address).toBe('0x839940de5043e7c6eDaf063714AFe7F20De5ff12');
    expect(view.oracle.details.kind).toBe('ChainlinkOracleV2');
    if (view.oracle.details.kind === 'ChainlinkOracleV2') {
      expect(view.oracle.details.baseFeedOne?.address).toBe('0x9fBb7D07ae32B3F75c2a5805C2153243A2532589');
      expect(view.oracle.details.scaleFactor).toBe(1000000n);
    }
  });

  it('falls back to Unknown for non-V2 oracle types', async () => {
    const resp = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
    resp.data.marketByUniqueKey.oracle = {
      address: '0xLegacy',
      type: 'ChainlinkOracle',
      data: null,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => resp,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.oracle.details.kind).toBe('Unknown');
    if (view.oracle.details.kind === 'Unknown') {
      expect(view.oracle.details.rawType).toBe('ChainlinkOracle');
    }
  });

  it('maps activity, creation, and bigints', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.activity.creationBlockNumber).toBe(24249174);
    expect(view.activity.creationTimestamp).toBe(1768589183);
    expect(view.activity.feePct).toBe(0);
    expect(view.activity.collateralAssetsUsd).toBe(11_708_677);
    expect(view.activity.oraclePrice).toBe(1170553706056013390000000n);
    expect(view.irmCurve).toHaveLength(3);
    expect(view.irmCurve[1]!.utilization).toBe(0.5);
  });

  it('maps preLiquidations to bigints', async () => {
    const resp = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
    resp.data.marketByUniqueKey.preLiquidations = {
      items: [
        {
          address: '0xPreLiq',
          preLltv: '900000000000000000',
          preLCF1: '100000000000000000',
          preLCF2: '500000000000000000',
          preLIF1: '1010000000000000000',
          preLIF2: '1080000000000000000',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => resp,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.preLiquidations).toHaveLength(1);
    expect(view.preLiquidations[0]!.preLltv).toBe(900000000000000000n);
    expect(view.preLiquidations[0]!.preLIF2).toBe(1080000000000000000n);
  });

  it('handles null oracle / irmCurve / warnings / pre-liq', async () => {
    const resp = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
    resp.data.marketByUniqueKey.oracle = null;
    resp.data.marketByUniqueKey.currentIrmCurve = null;
    resp.data.marketByUniqueKey.warnings = null;
    resp.data.marketByUniqueKey.preLiquidations = null;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => resp,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.oracle.details.kind).toBe('Unknown');
    expect(view.irmCurve).toEqual([]);
    expect(view.activity.warnings).toEqual([]);
    expect(view.preLiquidations).toEqual([]);
  });
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/morphoApi.test.ts`

Expected: PASS — all parseMorphoUrl tests still pass (10), all updated/new fetchMarket tests pass (existing + 5 new = at least 14 in fetchMarket describe block).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`

Expected: still FAIL because `MarketParamsCard.tsx` reads removed asset fields. Confirm the only remaining errors are in that file (move to Task 3).

- [ ] **Step 8: Stage but do NOT commit yet**

```bash
git add lib/morphoApi.ts tests/morphoApi.test.ts
```

---

## Task 3: Migrate `MarketParamsCard` off `params.collateralAsset`/`loanAsset`

**Files:**
- Modify: `app/explore-market/components/MarketParamsCard.tsx`

- [ ] **Step 1: Edit `MarketParamsCard.tsx`**

Change the props signature and reads:

Old props (current):
```tsx
export function MarketParamsCard({
  chainId,
  marketId,
  params,
}: {
  chainId: number;
  marketId: string;
  params: MarketParams;
})
```

New props:
```tsx
import type { MarketParams, AssetMeta } from '@/types/morphoMarket';
import { GOV_LLTVS } from '@/types/simulator';

// ... (keep ETHERSCAN_BASE, lltvPct, isGovernanceLltv, shorten helpers unchanged)

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
```

Keep the `Row` helper at the bottom unchanged.

- [ ] **Step 2: Update page call site (preview only — actual page edit happens in Task 9)**

Inspect `app/explore-market/page.tsx` to confirm where `MarketParamsCard` is rendered. The call site will need to add `collateral={result.data.collateral} loan={result.data.loan}` props. **Do not edit the page yet** — that's Task 9's job. We just need to verify the existing call doesn't break compilation in an unrecoverable way.

Run: `npx tsc --noEmit`

Expected: FAIL with errors specifically about missing `collateral`/`loan` props on `MarketParamsCard` in `page.tsx`. **This is expected and will be fixed in Task 9.** Confirm no other unrelated errors.

- [ ] **Step 3: Commit Tasks 1 + 2 + 3 together**

```bash
git add app/explore-market/components/MarketParamsCard.tsx
git commit -m "feat(explore-market): expand MarketView with oracle/IRM/activity/pre-liq fields"
```

(The page.tsx error will remain until Task 9.)

---

## Task 4: OracleDetailsCard

**Files:**
- Create: `app/explore-market/components/OracleDetailsCard.tsx`

- [ ] **Step 1: Implement the card**

```tsx
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
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: still has the Task 3 leftover error on page.tsx; no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/explore-market/components/OracleDetailsCard.tsx
git commit -m "feat(explore-market): OracleDetailsCard with Chainlink V2 feed chain"
```

---

## Task 5: IrmCurveCard

**Files:**
- Create: `app/explore-market/components/IrmCurveCard.tsx`

- [ ] **Step 1: Implement the card**

```tsx
// app/explore-market/components/IrmCurveCard.tsx
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import type { IrmCurvePoint } from '@/types/morphoMarket';
import { formatPct } from '@/app/components/Kpi';

export function IrmCurveCard({
  irmAddress,
  curve,
  currentUtilization,
  rateAtTarget,
  apyAtTarget,
}: {
  irmAddress: string;
  curve: IrmCurvePoint[];
  currentUtilization: number;
  rateAtTarget: number;
  apyAtTarget: number;
}) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">Interest rate model</h2>
      <div className="h-72 w-full">
        {curve.length === 0 ? (
          <p className="text-sm text-neutral-500">IRM curve unavailable.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
              <XAxis
                dataKey="utilization"
                type="number"
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke="#666"
                fontSize={11}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke="#666"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 12 }}
                formatter={(v: number) => formatPct(v)}
                labelFormatter={(v: number) => `Utilization ${(v * 100).toFixed(1)}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                x={currentUtilization}
                stroke="#facc15"
                strokeDasharray="4 4"
                label={{ value: 'current', fill: '#facc15', fontSize: 11, position: 'top' }}
              />
              <Line dataKey="borrowApy" name="Borrow APY" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line dataKey="supplyApy" name="Supply APY" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">APY at target</dt>
          <dd className="text-neutral-200 tabular-nums">{formatPct(apyAtTarget)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">Rate at target (raw)</dt>
          <dd className="font-mono text-xs text-neutral-200">{rateAtTarget}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">IRM contract</dt>
          <dd className="font-mono text-xs text-neutral-200">{irmAddress.slice(0, 6)}…{irmAddress.slice(-4)}</dd>
        </div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: same as before — only the page.tsx error remains.

- [ ] **Step 3: Commit**

```bash
git add app/explore-market/components/IrmCurveCard.tsx
git commit -m "feat(explore-market): IrmCurveCard with utilization-vs-APY chart"
```

---

## Task 6: TokensActivityCard

**Files:**
- Create: `app/explore-market/components/TokensActivityCard.tsx`

- [ ] **Step 1: Implement the card**

```tsx
// app/explore-market/components/TokensActivityCard.tsx
'use client';
import type { AssetMeta, MarketActivity, PreLiquidationContract } from '@/types/morphoMarket';
import { formatUSD, formatPct } from '@/app/components/Kpi';

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
                  <th className="text-left py-2 pr-4">Address</th>
                  <th className="text-right py-2 pr-4">preLLTV</th>
                  <th className="text-right py-2 pr-4">CF₁</th>
                  <th className="text-right py-2 pr-4">CF₂</th>
                  <th className="text-right py-2 pr-4">IF₁</th>
                  <th className="text-right py-2">IF₂</th>
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/explore-market/components/TokensActivityCard.tsx
git commit -m "feat(explore-market): TokensActivityCard with tokens, activity, pre-liq"
```

---

## Task 7: DerivedLiquidationCard

**Files:**
- Create: `app/explore-market/components/DerivedLiquidationCard.tsx`

- [ ] **Step 1: Implement the card**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/explore-market/components/DerivedLiquidationCard.tsx
git commit -m "feat(explore-market): DerivedLiquidationCard using shared LIF()"
```

---

## Task 8: `fetchMarketHistory` + hook + chart card

**Files:**
- Modify: `lib/morphoApi.ts`
- Modify: `tests/morphoApi.test.ts`
- Create: `lib/useMarketHistory.ts`
- Create: `app/explore-market/components/HistoryChartCard.tsx`

- [ ] **Step 1: Add `fetchMarketHistory` to `lib/morphoApi.ts`**

Append (don't replace existing code):

```typescript
import type { HistoryPoint } from '@/types/morphoMarket';

const HISTORY_QUERY = `
  query History($chainId: Int!, $uniqueKey: String!, $start: Int!, $end: Int!) {
    marketByUniqueKey(chainId: $chainId, uniqueKey: $uniqueKey) {
      historicalState {
        supplyApy(options: { startTimestamp: $start, endTimestamp: $end, interval: DAY }) { x y }
        borrowApy(options: { startTimestamp: $start, endTimestamp: $end, interval: DAY }) { x y }
        utilization(options: { startTimestamp: $start, endTimestamp: $end, interval: DAY }) { x y }
      }
    }
  }
`;

const historyCache = new Map<string, HistoryPoint[]>();

export function _resetHistoryCache(): void {
  historyCache.clear();
}

export async function fetchMarketHistory(
  chainId: number,
  marketId: string,
  days = 30,
  options?: { signal?: AbortSignal }
): Promise<HistoryPoint[]> {
  const key = `${chainId}:${marketId.toLowerCase()}:${days}`;
  const cached = historyCache.get(key);
  if (cached) return cached;

  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: HISTORY_QUERY,
      variables: { chainId, uniqueKey: marketId, start, end },
    }),
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) throw new Error(`Morpho API HTTP ${res.status}`);
  const json = await res.json() as {
    data?: { marketByUniqueKey: { historicalState: { supplyApy: Pt[]; borrowApy: Pt[]; utilization: Pt[] } } | null };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  const h = json.data?.marketByUniqueKey?.historicalState;
  if (!h) {
    historyCache.set(key, []);
    return [];
  }

  const byTs = new Map<number, HistoryPoint>();
  for (const pt of h.supplyApy ?? []) byTs.set(pt.x, { timestamp: pt.x, supplyApy: pt.y, borrowApy: 0, utilization: 0 });
  for (const pt of h.borrowApy ?? []) {
    const e = byTs.get(pt.x) ?? { timestamp: pt.x, supplyApy: 0, borrowApy: 0, utilization: 0 };
    e.borrowApy = pt.y;
    byTs.set(pt.x, e);
  }
  for (const pt of h.utilization ?? []) {
    const e = byTs.get(pt.x) ?? { timestamp: pt.x, supplyApy: 0, borrowApy: 0, utilization: 0 };
    e.utilization = pt.y;
    byTs.set(pt.x, e);
  }
  const out = Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
  historyCache.set(key, out);
  return out;
}

type Pt = { x: number; y: number };
```

(The `HistoryPoint` import in `lib/morphoApi.ts` can be added to the existing top-of-file type import.)

- [ ] **Step 2: Add tests for `fetchMarketHistory`**

Append to `tests/morphoApi.test.ts`:

```typescript
import { fetchMarketHistory, _resetHistoryCache } from '@/lib/morphoApi';

describe('fetchMarketHistory', () => {
  beforeEach(() => {
    _resetHistoryCache();
    vi.restoreAllMocks();
  });

  const HISTORY_RESP = {
    data: {
      marketByUniqueKey: {
        historicalState: {
          supplyApy: [
            { x: 1700000000, y: 0.04 },
            { x: 1700086400, y: 0.045 },
          ],
          borrowApy: [
            { x: 1700000000, y: 0.06 },
            { x: 1700086400, y: 0.065 },
          ],
          utilization: [
            { x: 1700000000, y: 0.7 },
            { x: 1700086400, y: 0.72 },
          ],
        },
      },
    },
  };

  it('joins three series by timestamp, sorted ascending', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => HISTORY_RESP,
    }));
    const out = await fetchMarketHistory(1, '0xabc', 30);
    expect(out).toEqual([
      { timestamp: 1700000000, supplyApy: 0.04, borrowApy: 0.06, utilization: 0.7 },
      { timestamp: 1700086400, supplyApy: 0.045, borrowApy: 0.065, utilization: 0.72 },
    ]);
  });

  it('returns empty array when historicalState is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketByUniqueKey: null } }),
    }));
    const out = await fetchMarketHistory(1, '0xabc', 30);
    expect(out).toEqual([]);
  });

  it('caches by (chainId, marketId, days)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => HISTORY_RESP,
    });
    vi.stubGlobal('fetch', fetchMock);
    await fetchMarketHistory(1, '0xabc', 30);
    await fetchMarketHistory(1, '0xabc', 30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/morphoApi.test.ts`
Expected: all pass (parseMorphoUrl + fetchMarket from Task 2 + new fetchMarketHistory).

- [ ] **Step 4: Create `lib/useMarketHistory.ts`**

```typescript
// lib/useMarketHistory.ts
'use client';
import { useEffect, useState } from 'react';
import { fetchMarketHistory } from '@/lib/morphoApi';
import type { HistoryPoint } from '@/types/morphoMarket';

type State =
  | { loading: false; data: null; error: null }
  | { loading: true; data: null; error: null }
  | { loading: false; data: HistoryPoint[]; error: null }
  | { loading: false; data: null; error: string };

const IDLE: State = { loading: false, data: null, error: null };

export function useMarketHistory(
  chainId: number | null,
  marketId: string | null,
  days = 30
): State {
  const [state, setState] = useState<State>(IDLE);

  useEffect(() => {
    if (chainId == null || !marketId) {
      setState(IDLE);
      return;
    }
    const ac = new AbortController();
    setState({ loading: true, data: null, error: null });

    fetchMarketHistory(chainId, marketId, days, { signal: ac.signal })
      .then((data) => {
        if (ac.signal.aborted) return;
        setState({ loading: false, data, error: null });
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ loading: false, data: null, error: msg });
      });

    return () => ac.abort();
  }, [chainId, marketId, days]);

  return state;
}
```

- [ ] **Step 5: Create `HistoryChartCard.tsx`**

```tsx
// app/explore-market/components/HistoryChartCard.tsx
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { HistoryPoint } from '@/types/morphoMarket';
import { formatPct } from '@/app/components/Kpi';

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(5, 10); // MM-DD
}

export function HistoryChartCard({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data: HistoryPoint[] | null;
}) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-neutral-200">30-day history</h2>
      <div className="h-72 w-full">
        {loading && <p className="text-sm text-neutral-400">Loading history…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!loading && !error && data && data.length === 0 && (
          <p className="text-sm text-neutral-500">Not enough history yet.</p>
        )}
        {!loading && !error && data && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={fmtDate} stroke="#666" fontSize={11} />
              <YAxis
                yAxisId="apy"
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                stroke="#666"
                fontSize={11}
              />
              <YAxis
                yAxisId="util"
                orientation="right"
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                stroke="#666"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 12 }}
                formatter={(v: number) => formatPct(v)}
                labelFormatter={(v: number) => new Date(v * 1000).toISOString().slice(0, 10)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="apy" dataKey="supplyApy" name="Supply APY" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line yAxisId="apy" dataKey="borrowApy" name="Borrow APY" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line yAxisId="util" dataKey="utilization" name="Utilization" stroke="#facc15" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: page.tsx errors still present (Task 9 fixes); no other new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/morphoApi.ts lib/useMarketHistory.ts app/explore-market/components/HistoryChartCard.tsx tests/morphoApi.test.ts
git commit -m "feat(explore-market): fetchMarketHistory + 30-day history chart"
```

---

## Task 9: Wire all cards into the page

**Files:**
- Modify: `app/explore-market/page.tsx`

- [ ] **Step 1: Read the current page**

Open `app/explore-market/page.tsx` and locate the success render block (where the 3 existing cards are rendered conditionally on `result.data && ok`).

- [ ] **Step 2: Update the imports and call sites**

Replace the current imports section with:

```tsx
import { MarketParamsCard } from './components/MarketParamsCard';
import { MarketStateCard } from './components/MarketStateCard';
import { OracleDetailsCard } from './components/OracleDetailsCard';
import { IrmCurveCard } from './components/IrmCurveCard';
import { TokensActivityCard } from './components/TokensActivityCard';
import { DerivedLiquidationCard } from './components/DerivedLiquidationCard';
import { HistoryChartCard } from './components/HistoryChartCard';
import { ExposedVaultsCard } from './components/ExposedVaultsCard';
import { useMarketHistory } from '@/lib/useMarketHistory';
```

After the existing `const result = useMorphoMarket(...)` line, add:

```tsx
const history = useMarketHistory(ok ? parsed.chainId : null, ok ? parsed.marketId : null, 30);
```

Replace the success render block (where the 3 cards are conditionally rendered) with:

```tsx
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
      apyAtTarget={result.data.state.rateAtUTarget}
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
```

NOTE: The `IrmCurveCard` receives `rateAtUTarget` for both `rateAtTarget` and `apyAtTarget` props at this point because `MarketState` (the Task 1 v1 type) does not include a separate `apyAtTarget`. The fix: extend `MarketState` to include `apyAtTarget: number` and surface it in the mapping. See follow-up step.

- [ ] **Step 3: Extend `MarketState` to include `apyAtTarget`**

In `types/morphoMarket.ts`, change `MarketState`:

```typescript
export type MarketState = {
  supplyAssetsUsd: number;
  borrowAssetsUsd: number;
  utilization: number;
  supplyApy: number;
  borrowApy: number;
  liquidityAssetsUsd: number;
  rateAtUTarget: number;
  apyAtTarget: number;          // NEW
};
```

In `lib/morphoApi.ts`, update the `state:` block of the `view` assembly to include:

```typescript
state: {
  // ... existing fields ...
  apyAtTarget: m.state.apyAtTarget ?? 0,
},
```

Update the `SAMPLE_RESPONSE` already includes `apyAtTarget: 0.0855` (added in Task 2) — no test change needed beyond confirming.

Update `app/explore-market/page.tsx` to pass `result.data.state.apyAtTarget` instead of `rateAtUTarget` for the apy prop:

```tsx
<IrmCurveCard
  irmAddress={result.data.params.irmAddress}
  curve={result.data.irmCurve}
  currentUtilization={result.data.state.utilization}
  rateAtTarget={result.data.state.rateAtUTarget}
  apyAtTarget={result.data.state.apyAtTarget}
/>
```

- [ ] **Step 4: Full type-check + lint + tests + build**

Run from worktree dir:
```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

All should PASS. The build output should still list `/explore-market` as a static route.

- [ ] **Step 5: Live API smoke test**

Use ctx_execute to fetch the live query and confirm the new fields populate:

```javascript
const body = {
  query: `query M { marketByUniqueKey(chainId: 1, uniqueKey: "0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9") { creationBlockNumber creationTimestamp state { fee apyAtTarget } oracle { type data { ... on MorphoChainlinkOracleV2Data { scaleFactor baseFeedOne { address decimals } } } } currentIrmCurve { utilization } preLiquidations { items { address } } } }`,
};
const r = await fetch('https://blue-api.morpho.org/graphql', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
const j = await r.json();
console.log(JSON.stringify(j, null, 2).slice(0, 1500));
```

Confirm: `creationBlockNumber` is a number, `state.apyAtTarget` is present, oracle data contains feed addresses, `currentIrmCurve` has many points (~101).

If any field name is wrong, capture the GraphQL error and fix the query inline before committing.

- [ ] **Step 6: Commit**

```bash
git add app/explore-market/page.tsx types/morphoMarket.ts lib/morphoApi.ts tests/morphoApi.test.ts
git commit -m "feat(explore-market): wire all enrichment cards into page"
```

- [ ] **Step 7: Manual browser smoke**

Dev server is already running on port 3000. Open `http://localhost:3000/explore-market?url=https%3A%2F%2Fapp.morpho.org%2Fethereum%2Fmarket%2F0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9%2Fsavusd-usdc` and verify:

1. All 8 cards render in order.
2. Oracle card shows the Chainlink V2 feed chip linking to Etherscan.
3. IRM curve chart shows a smooth curve with the dashed current-utilization line.
4. Tokens table shows both assets with prices.
5. Activity grid shows creation block, fee, no bad debt.
6. Derived liquidation shows LIF ≈ 1.117 for 86% LLTV (with governance ✓ chip).
7. History chart shows three series over the last 30 days.
8. Vaults table renders at the bottom.

Capture any visual issue; small CSS tweaks can be follow-up commits.

---

## Spec Coverage Check

| Spec section | Task |
|---|---|
| Oracle details card with Chainlink V2 feed chain | Task 4 |
| IRM curve chart + current utilization marker + stats | Task 5 |
| Tokens table | Task 6 |
| Activity grid (fee, creation, bad debt, warnings) | Task 6 |
| Pre-liquidation sub-section | Task 6 |
| Derived liquidation (LIF, bonus, governance match) | Task 7 |
| 30-day history chart (3 series) | Task 8 |
| Expand MARKET_QUERY + RawMarket + mapping | Task 2 |
| Add fetchMarketHistory + cache | Task 8 |
| Extended `MarketView`, `OracleInfo`, `IrmCurvePoint`, `PreLiquidationContract`, `MarketActivity`, `AssetMeta`, `HistoryPoint` types | Task 1 |
| Drop `collateralAsset`/`loanAsset` from `MarketParams` | Task 1 + Task 3 |
| Use `view.collateral`/`view.loan` in `MarketParamsCard` | Task 3 |
| Extend `MarketState.apyAtTarget` | Task 9 (step 3) |
| `useMarketHistory` hook | Task 8 |
| Update existing tests for new shape; add new mapping tests | Tasks 2 + 8 |
| Wire all cards in page in order | Task 9 |

No gaps. No placeholders. No type-name inconsistencies (`MarketView.collateral`, `view.loan`, `MarketState.apyAtTarget` consistent across tasks).
