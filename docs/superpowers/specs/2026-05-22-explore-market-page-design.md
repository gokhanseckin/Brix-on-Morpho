# /explore-market Page — Design

**Date:** 2026-05-22
**Status:** Approved (awaiting spec review)

## Goal

Add a read-only reference page at `/explore-market` where a user pastes a Morpho market URL (e.g. `https://app.morpho.org/ethereum/market/0xe07d.../savusd-usdc`) and sees that market's creator-set parameters, live stats, and the MetaMorpho vaults exposed to it. Purely for comparing against Brix wiTRY → USDM calibration — does not feed the simulator.

## Non-Goals

- No "import to simulator" button. No coupling to `useSimulator` or sidebar state.
- No historical charts.
- No risk/health section (LIF, bad-debt history, oracle staleness).
- No on-chain RPC fallback. If the GraphQL API is unreachable, surface the error.

## Constraints

- Static export (`output: 'export'`) — all data fetching happens in the browser.
- No new heavy deps. Recharts already in tree; nothing else added.
- Follows existing patterns: `nuqs` URL state, `lib/format.ts` for number formatting, existing card primitives in `app/components/`.

## Architecture

```
URL input ──parseMorphoUrl──┐
                            ├──> useMorphoMarket ──fetchMarket──> Morpho Blue GraphQL
                            │                       (in-memory cache, keyed chainId:marketId)
                            │                            ↓
                            │                       MarketView
                            ▼
                    nuqs ?url=... (shareable)
                            ↓
                    /explore-market page
                    ├── Card: Market Parameters
                    ├── Card: Live State
                    └── Card: Exposed Vaults
```

## Components

### `lib/morphoApi.ts` (new)
Pure async module. No React.

- `parseMorphoUrl(input: string): { chainId: number; marketId: \`0x${string}\` } | { error: string }`
  - Accepts `https://app.morpho.org/<chain>/market/<0xMarketId>[/<slug>][#anchor]`.
  - Maps chain slug → chainId (`ethereum` → 1, `base` → 8453, etc.). Unknown chain → error.
  - Validates marketId matches `^0x[0-9a-f]{64}$`.
- `fetchMarket(chainId: number, marketId: string): Promise<MarketView>`
  - Single GraphQL POST to `https://blue-api.morpho.org/graphql`.
  - Query selects: `collateralAsset`, `loanAsset`, `lltv`, `irmAddress`, `oracleAddress`, `uniqueKey`, `state { supplyAssetsUsd, borrowAssetsUsd, utilization, supplyApy, borrowApy, liquidityAssetsUsd, rateAtUTarget }`, `supplyingVaults { address, name, symbol, state { totalAssetsUsd }, allocation { supplyAssetsUsd, supplyCapUsd } }`.
  - Module-level `Map<string, MarketView>` cache. Key: `${chainId}:${marketId}`. Cleared on page reload (no persistence needed).

### `lib/useMorphoMarket.ts` (new)
Thin React hook.

- `useMorphoMarket(url: string | null): { loading: boolean; error: string | null; data: MarketView | null }`
- Re-runs when `url` changes. Aborts in-flight fetch via `AbortController` on rapid URL changes.
- No worker — single small payload, main-thread fetch is fine.

### `app/explore-market/page.tsx` (new)
Single page.

- Top: `<input>` for URL paste. `?url=` synced via `nuqs` (matches existing pattern in the app).
- Below input: loading spinner / error banner / 3 cards (only one of these three shown at a time).
- Cards (each reuses existing card primitive — no new design system work):
  1. **Market Parameters** — labeled grid: collateral token, loan token, LLTV (raw 1e18 + %, with ⚠️ chip if not in `GOV_LLTVS`), IRM address, oracle address, marketId. Addresses are click-to-copy + link to Etherscan for the relevant chain.
  2. **Live State** — supply USD, borrow USD, utilization %, supply APY, borrow APY, liquidity USD, rate-at-target. Numbers formatted via `lib/format.ts`.
  3. **Exposed Vaults** — table sorted by allocation desc: vault name, total assets USD, allocation USD, allocation % of vault, supply cap USD. Empty-state message if `supplyingVaults` is empty.

### `types/morphoMarket.ts` (new)
Kept separate from `types/simulator.ts` since this feature is independent.

```ts
export type MarketView = {
  chainId: number;
  marketId: `0x${string}`;
  params: {
    collateralAsset: { address: string; symbol: string; decimals: number };
    loanAsset: { address: string; symbol: string; decimals: number };
    lltv: bigint;            // raw 1e18
    irmAddress: string;
    oracleAddress: string;
  };
  state: {
    supplyAssetsUsd: number;
    borrowAssetsUsd: number;
    utilization: number;     // 0..1
    supplyApy: number;       // 0..1
    borrowApy: number;       // 0..1
    liquidityAssetsUsd: number;
    rateAtUTarget: number;   // 0..1
  };
  vaults: VaultAllocation[];
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
```

## Data Flow

1. User pastes URL → `nuqs` updates `?url=...`.
2. Page reads `url` query param → calls `parseMorphoUrl`.
3. On valid parse → `useMorphoMarket({chainId, marketId})` fires.
4. Hook checks in-memory cache → hit returns immediately; miss does fetch → caches → returns.
5. Page renders the 3 cards from `MarketView`.

## Error Handling

- Bad URL format → inline error under the input ("Could not parse a Morpho market URL"). No fetch.
- GraphQL network error → red banner with the error message + a "Retry" button that re-invokes the fetch.
- Market not found (GraphQL returns null) → "Market not found on Morpho Blue API" banner.
- No fallback to RPC — explicit non-goal.

## Testing

### Unit (vitest)
- `tests/morphoApi.test.ts`:
  - `parseMorphoUrl` against:
    - The example URL (with and without `#risk` anchor and slug).
    - Bare `https://app.morpho.org/ethereum/market/0x...` (no slug).
    - Malformed: missing chain, bad marketId hex, unknown chain slug, plain text.
  - `fetchMarket` with mocked `global.fetch`: golden GraphQL response → assert mapping to `MarketView` shape and number coercions.
  - Cache hit: two `fetchMarket` calls with same key → `fetch` invoked once.

### E2E
- None added. The page is read-only with a single network dependency; unit-level coverage is sufficient.

## Files Touched

**New:**
- `app/explore-market/page.tsx`
- `lib/morphoApi.ts`
- `lib/useMorphoMarket.ts`
- `types/morphoMarket.ts`
- `tests/morphoApi.test.ts`

**Modified:**
- `app/components/Sidebar.tsx` (or wherever navigation lives) — add `/explore-market` link, same pattern as the existing `/utilization` link.

## Open Questions

None at design time. Implementation plan should confirm:
- Exact GraphQL field names on `blue-api.morpho.org` (schema introspection during plan phase).
- Whether `supplyingVaults` is the actual field name or if it's nested under `state`.
