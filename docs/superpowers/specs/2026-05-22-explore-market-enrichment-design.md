# /explore-market Enrichment — Design

**Date:** 2026-05-22
**Status:** Approved
**Builds on:** `2026-05-22-explore-market-page-design.md`

## Goal

Enrich the `/explore-market` page with four additional cards plus a basic historical chart, exposing every parameter the market creator configured and every piece of contextual state the Morpho Blue API surfaces. Still read-only; still no on-chain reads (Morpho's GraphQL has everything).

## Non-Goals

- No on-chain RPC reads.
- No interactive chart controls (range picker, brush, series toggles). The history chart is a fixed 30-day three-series line chart.
- No support for non-Chainlink oracle types beyond showing the address + a "details unavailable" note.
- No collapsible sections / TOC.

## Cards to Add (in order)

### 4. Oracle Details Card

For `oracle.type === "ChainlinkOracleV2"` (the common case):

- Render the feed chain as a horizontal sequence: `baseFeedOne → baseFeedTwo` (if present) `/ quoteFeedOne → quoteFeedTwo` (if present).
- Each feed shows `address` (click-to-copy, link to Etherscan) and `decimals`.
- Show `scaleFactor` (BigInt).
- Show the current oracle price from `state.price` (raw + decimal-adjusted using both asset decimals + scaleFactor) and the asset's USD price with last-update age.

For other types (legacy V1, custom): show only the oracle address with a small note "Oracle type `<type>` — feed details not exposed via API."

### 5. IRM Curve Card

- Recharts `LineChart` of `currentIrmCurve` — X: utilization (0..1), Y: APY. Two lines: `supplyApy` and `borrowApy`.
- A vertical reference line at current utilization (`state.utilization`).
- Below the chart, a small grid: current `rateAtTarget` (raw + as APY), `apyAtTarget`, IRM address (with a "AdaptiveCurveIRM" tag if address matches the known deployments — for now, just show the address).

### 6. Tokens & Activity Card

Two-section card.

**Tokens** (mini table, one row per asset):
- Collateral: name, symbol, decimals, current USD price, price-update age.
- Loan: same.

**Activity** (label/value grid):
- Protocol fee (`state.fee`), formatted as %.
- Creation block (`creationBlockNumber`, link to Etherscan block).
- Creation date (`creationTimestamp` → ISO date).
- Collateral USD locked (`state.collateralAssetsUsd`).
- Current bad debt (`badDebt.usd`).
- Realized bad debt (`realizedBadDebt.usd`).
- API warnings (`warnings[]`), if non-empty — render as yellow chips.

**Pre-liquidations** (sub-section, only if `preLiquidations.items.length > 0`):
- For each contract: address (link), `preLltv` (%), `preLCF1`/`preLCF2` (close factor low/high), `preLIF1`/`preLIF2` (incentive factor low/high). Small table.

### 7. Derived Liquidation Card

Pure computation from LLTV — no API fields.

- LIF via existing `LIF(lltv)` from `lib/morphoMath.ts` (same canonical function the simulator uses).
- Max liquidator bonus = `(LIF - 1) * 100%`.
- Governance match: which `GOV_LLTVS` tier this corresponds to (chip), or "⚠ off-grid" if no match.

### 8. History Chart Card

- Recharts `LineChart` over the last 30 days, daily interval.
- Three series on one chart with a shared X axis (timestamp → date): `supplyApy`, `borrowApy`, `utilization`. Utilization plotted on a right Y axis (0..1 scale) since it shares the chart with APY values; APYs on left Y.
- Tooltip shows date + all three values formatted (% for all).
- No range picker, no series toggles, no brush — fixed 30 days, all three series visible.

If the API returns zero points (new market), show an empty state: "Not enough history yet."

## Data Layer Changes

### `lib/morphoApi.ts`

- Expand `MARKET_QUERY` to additionally select:
  - `creationBlockNumber`, `creationTimestamp`, `warnings { type level }`
  - `state { fee price collateralAssetsUsd apyAtTarget timestamp }` (in addition to existing)
  - `badDebt { usd }`, `realizedBadDebt { usd }`
  - `collateralAsset { name price { usd timestamp } }`, `loanAsset { name price { usd timestamp } }` (decimals/symbol/address already selected; name + price added)
  - `oracle { address type data { ... on MorphoChainlinkOracleV2Data { baseFeedOne { address decimals } baseFeedTwo { address decimals } quoteFeedOne { address decimals } quoteFeedTwo { address decimals } scaleFactor } } }`
  - `currentIrmCurve { utilization supplyApy borrowApy }`
  - `preLiquidations { items { address preLltv preLCF1 preLCF2 preLIF1 preLIF2 } }`
- Add a **second** exported function `fetchMarketHistory(chainId, marketId, days=30)` returning `Array<{ timestamp: number; supplyApy: number; borrowApy: number; utilization: number }>`. This is a separate GraphQL call (different timeseries options on each field, easier to compose alone). Cached separately per `(chainId, marketId, days)`.

### Types (`types/morphoMarket.ts`)

Add to the existing file:

```ts
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

export type AssetMeta = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
  priceTimestamp: number | null;
};

export type MarketWarning = { type: string; level: string };

export type MarketActivity = {
  feePct: number;          // state.fee
  creationBlockNumber: number;
  creationTimestamp: number;
  collateralAssetsUsd: number;
  badDebtUsd: number;
  realizedBadDebtUsd: number;
  warnings: MarketWarning[];
  oraclePrice: bigint;     // state.price (raw)
};

export type HistoryPoint = {
  timestamp: number;
  supplyApy: number;
  borrowApy: number;
  utilization: number;
};
```

Extend `MarketView`:

```ts
export type MarketView = {
  chainId: number;
  marketId: `0x${string}`;
  params: MarketParams;
  state: MarketState;
  vaults: VaultAllocation[];
  // NEW
  collateral: AssetMeta;
  loan: AssetMeta;
  oracle: OracleInfo;
  irmCurve: IrmCurvePoint[];
  activity: MarketActivity;
  preLiquidations: PreLiquidationContract[];
};
```

`MarketParams.collateralAsset` and `MarketParams.loanAsset` are now redundant with `collateral` / `loan`. **Action:** remove the asset fields from `MarketParams` (keep `lltv`, `irmAddress`, `oracleAddress`) and update `MarketParamsCard` to read from `view.collateral` / `view.loan`. Net: cleaner model, one source of truth per asset.

## Components

New files under `app/explore-market/components/`:

- `OracleDetailsCard.tsx` (1 component, handles both ChainlinkV2 and unknown types)
- `IrmCurveCard.tsx` (Recharts LineChart + small stat grid)
- `TokensActivityCard.tsx` (the combined tokens + activity + pre-liq section)
- `DerivedLiquidationCard.tsx` (pure computation, no extra hook)
- `HistoryChartCard.tsx` (consumes a new `useMarketHistory` hook)

New hook: `lib/useMarketHistory.ts` — mirror of `useMorphoMarket.ts`, calling `fetchMarketHistory`.

Modified: `MarketParamsCard.tsx` to drop the asset fields it no longer owns.

Page (`app/explore-market/page.tsx`) renders all 8 cards in order (params, state, oracle, irmCurve, tokensActivity, derivedLiquidation, history, vaults). The history card is independent — it fires its own fetch in parallel with the main one.

## Testing

### Unit (`tests/morphoApi.test.ts`)

Extend existing fixture and add tests:

- Existing 19 tests still pass after fixture update.
- Test that oracle data maps correctly for `ChainlinkOracleV2` (feeds + scaleFactor as bigint).
- Test that oracle data maps to `Unknown` kind when type is something else (e.g., legacy V1).
- Test that preLiquidations bigint fields are parsed correctly.
- Test that `creationTimestamp` is coerced to number from BigInt string.
- Test `fetchMarketHistory`: maps `[{x, y}, ...]` triple-series response into `HistoryPoint[]` joined on timestamp, sorted ascending. Empty-history case returns `[]`.

### E2E

Skip. Same reasoning as v1: read-only, single network dependency.

## Out of Scope (explicit)

- Vault curator names, vault timelocks, vault deposit history.
- Block explorer enrichment beyond Etherscan links (Tenderly, Defender, etc.).
- Watchlists / saved markets / multi-market comparison.
- Importing market params into the simulator (still deliberately decoupled).
- Cross-chain market discovery.

## Open Questions

None at design time. Plan-phase will confirm:
- Exact field names for `state.collateralAssetsUsd` and `state.fee` (verified in schema probe — both present).
- Whether `IrmCurve[]` always starts at `utilization: 0` and ends at `1` (sample showed it does).
