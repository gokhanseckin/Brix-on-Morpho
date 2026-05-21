# /swapliquidity — wTRY/USDM Uni v3 Pool Lab

Date: 2026-05-21
Status: Draft (pending user review)

## 1. Problem

Liquidators in the Brix Morpho TRY market must dump seized wTRY → USDM to repay debt. Their realized recovery rate depends on the on-chain swap venue. Target venue is **kumbaya.xyz**, a Uniswap v3 fork on the same chain as the Morpho market.

The pair is **not** a stablecoin pair. wTRY is TRY-denominated (MMF-backed; NAV drifts up at the TRY risk-free rate). USDM is USD-pegged. Therefore:

```
price(wTRY/USDM) = wTRY_NAV_in_TRY / USDTRY_spot
```

The numerator is monotonic and predictable (MMF yield, ~basis-point daily). The denominator inherits **full USDTRY volatility** — historical ~20–25% annualized with regime shifts (see `lib/usdtryData.json`, 5Y window captures 2018 crisis).

**Implication:** This is a *trending volatile* pair, structurally similar to ETH/USDC, not USDC/USDT. Passive concentrated LP positions are systematically drained by the TRY-depreciation trend. Pool design must account for one-way flow.

The `/swapliquidity` page is a **simulation lab** to pick pool parameters and quantify liquidator slippage under stress. Its outputs feed the homepage Section 4 ("Liquidation Design") to replace the current heuristic recovery-rate placeholder.

## 2. Recommended Uniswap v3 parameters

| Parameter | Value | Rationale |
|---|---|---|
| Primary fee tier | **0.30%** (tick spacing 60) | Matches ETH/USDC tier. LP fee income must compensate for directional loss at ~25% annualized vol; 0.05% does not. |
| Secondary fee tier | **1.00%** (tick spacing 200) | Sister pool that absorbs stress flow when the 0.30% pool is arbed dry. Liquidators route across both via splitter. |
| Skip tier | 0.05% | LPs lose money at this fee on a trending pair. Documented, not deployed. |
| Initial sqrtPriceX96 | encode(`wTRY_NAV / USDTRY_spot`) | NAV bootstrapped from MMF data; USDTRY from oracle / hist file. |
| Oracle cardinality | ≥ 1440 | 24h of 1-min observations. Liquidation contracts MUST consume a TWAP, not spot, to resist single-block manipulation. |
| LP shape | Asymmetric ladder (see §3) | Pre-stages USDM below spot to absorb liquidator sells. |
| Rebalance trigger | Spot crosses ±15% from band midpoint, OR every 14 days | Trend forces re-centering. Passive LP guarantees IL in one-way regime. |

### Asymmetric LP ladder (the key design choice)

Three concentrated bands, biased to the downside (since seized wTRY flows OUT of the pool):

| Band | Tick range vs spot | Capital split (USDM:wTRY) | Purpose |
|---|---|---|---|
| Core | ±5% | 50:50 | Normal flow, fee harvesting |
| Absorb | −25% to −10% | 100:0 (all USDM) | Liquidator-only zone; LPs are buyers of distressed wTRY |
| Tail | −50% to +15% | 80:20 | Cushion for fat-tail FX shock |

Default TVL allocation: 30% Core / 50% Absorb / 20% Tail. Tunable in sidebar.

## 3. Page structure

Route: `/swapliquidity` (new Next.js page under `app/swapliquidity/page.tsx`).

```
┌─ Sidebar (PoolConfig) ───────────────┐  ┌─ Main ────────────────────────────────┐
│ Fee tier            [0.30 | 1.00]    │  │ §1 Pool state                          │
│ Initial spot        editable          │  │   • Price + tick chart                 │
│ Total TVL ($)       editable          │  │   • Liquidity-per-tick histogram       │
│ Band split (%)      3 sliders         │  │                                        │
│ MMF yield (%/yr)    editable          │  │ §2 Liquidator swap simulator           │
│ Rebalance policy    dropdown          │  │   • Input: sell N wTRY                 │
│                                       │  │   • Output: USDM, eff. price,          │
│ ── Stress scenario ──                 │  │     slippage %, fee, ticks crossed     │
│ Shock −X% in Y days                   │  │                                        │
│ Concurrent liquidator queue           │  │ §3 Monte Carlo recovery                │
│                                       │  │   • 1000 USDTRY paths (existing sim)   │
│                                       │  │   • Recovery-rate distribution         │
│                                       │  │   • 5th-pctile bad debt ($)            │
│                                       │  │                                        │
│                                       │  │ §4 Export preset → homepage §4         │
└──────────────────────────────────────┘  └───────────────────────────────────────┘
```

State sync via existing `useUrlState` hook so configs are shareable.

## 4. Module boundaries

### `lib/univ3.ts` (new — pure math, no React)

```ts
// Tick math
export function priceToTick(price: number): number;
export function tickToPrice(tick: number): number;
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number;
export function priceToSqrtPriceX96(price: number): bigint;

// Liquidity math
export function liquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint;
export function liquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint;
export function amountsForLiquidity(
  sqrtP: bigint, sqrtA: bigint, sqrtB: bigint, L: bigint,
): { amount0: bigint; amount1: bigint };

// Pool state
export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  feeBps: number;          // 30 or 100
  tickSpacing: number;     // 60 or 200
  ticks: Map<number, { liquidityNet: bigint; liquidityGross: bigint }>;
}

// Core swap
export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  feePaid: bigint;
  avgPrice: number;
  slippagePct: number;     // vs entry sqrtPrice
  finalSqrtPriceX96: bigint;
  ticksCrossed: number;
}
export function swapExactIn(
  pool: PoolState,
  amountIn: bigint,
  zeroForOne: boolean,
): { quote: SwapQuote; newPool: PoolState };

// Liquidator-facing wrapper
export function quoteLiquidatorSell(
  preset: PoolPreset,
  spot: number,
  wTRYAmount: bigint,
): SwapQuote;
```

### `lib/poolPreset.ts` (new — preset builder)

```ts
export interface PoolPreset {
  feeTier: 500 | 3000 | 10000;
  tickSpacing: number;
  positions: Array<{ tickLower: number; tickUpper: number; liquidityUSD: number }>;
  rebalancePolicy: { triggerPct: number; intervalDays: number };
}
export function buildAsymmetricLadder(
  spot: number,
  totalTVL_USD: number,
  split: { core: number; absorb: number; tail: number },
  feeTier: 3000 | 10000,
): PoolPreset;
```

### `app/swapliquidity/page.tsx` + `app/components/swapliquidity/*`

UI only. Reuses existing `Sidebar.tsx` chrome.

### Integration with homepage §4

`app/components/sections/LiquidationDesign.tsx` imports `quoteLiquidatorSell` and a default preset. Each Monte Carlo path's liquidation event runs through the swap function to compute realized USDM recovery, replacing the current heuristic.

Export contract (stable):

```ts
import { quoteLiquidatorSell, type PoolPreset } from '@/lib/univ3';
import { DEFAULT_PRESET } from '@/lib/poolPreset';
```

## 5. Scope guardrails (NOT in this spec)

- No wallet connect, no on-chain calls. Pure simulation.
- No fee-tier optimization solver — three hand-picked presets.
- No JIT / MEV modeling. Liquidator is a price-taker.
- No multi-block trajectory inside one liquidation — atomic swap.
- No LP P&L panel beyond a single IL-vs-HODL number. This page is for **liquidator design**, not LP design.
- No support for non-USDM stables.

## 6. Testing

- **Unit (vitest):** tick math round-trips, single-tick swap, multi-tick swap crossing N initialized ticks, swap that exhausts the pool.
- **Property:** value conservation (`amountIn ≥ amountOut * priceAfter` modulo fees); fees monotonic in input size; quote idempotent if `newPool` not applied.
- **Spec anchor:** reproduce a known mainnet ETH/USDC swap quote to within 1 wei. Pulled from Etherscan via MCP and frozen as a fixture.
- **E2E (Playwright):** `/swapliquidity` renders; changing swap-size input updates slippage; preset export round-trips through URL state.

## 7. Acceptance criteria

1. `/swapliquidity` route reachable, builds in static export (`out/`) without errors.
2. Default preset ($500k AMM TVL, 30/50/20 asymmetric ladder) produces a SwapQuote for a **$25k wTRY sell with slippage < 2%** under base-case USDTRY spot. (Realistic launch params: AMM seed is $500k, not $10M; per-liquidation sells are $5k–$50k for a small vault.)
3. Under a −15% / 30-day stress path, the 5th-percentile recovery rate is computed and displayed.
4. `LiquidationDesign.tsx` on homepage consumes `quoteLiquidatorSell` and reports a realized recovery distribution (replaces TODO/heuristic).
5. All vitest tests pass; analytic-reference swap matches constant-product approximation within 1%.
6. E2E smoke test green.

## 8. Open questions (resolved by defaults)

- *MMF yield assumption?* Default 40%/yr (current TR policy rate ballpark). Editable.
- *Starting AMM TVL?* Default **$500k** ($250k each side at spot), split 30/50/20 across bands. Realistic seed liquidity for a new pool.
- *Stress shock baseline?* Default −20% in 14 days (2018-class event, but compressed).

Defaults chosen so the page is usable without configuration; all are sidebar-editable.
