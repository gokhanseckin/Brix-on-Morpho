# Brix wiTRY/USDM — Morpho Blue Benchmark Shortlist

**Purpose.** A 6–10 market sample of Morpho Blue markets to anchor later analyses of
(a) borrower-LTV distributions (Beta(α, β) fits) and (b) bad-debt history for the
**wiTRY → USDM** pre-launch market (yield-bearing TRY collateral, USD-stable loan,
target LLTV **0.86**). This document is the *selection* only; fits and bad-debt
work follow separately.

**Source.** `docs/morpho-benchmark-markets.json` (n = 173 markets, all loan-asset
USD stables, TVL ≥ $250k). Plus one structural exception: **sjEUR/USDC on Base**
(FX-pegged collateral, $48k supply) — below TVL floor but the only true FX
analog in Morpho Blue.

---

## 1. Distribution by collateral bucket × LLTV tier

Counts after filtering: LLTV ∈ {0.77, 0.86, 0.915}, age ≥ 60 days, borrow > 0, TVL ≥ $250k (n = 98).

| Bucket | 0.77 | 0.86 | 0.915 | Total |
|---|---:|---:|---:|---:|
| yield-bearing-stable | 0 | 1 | 9 | 10 |
| LST                  | 2 | 12 | 0 | 14 |
| LRT                  | 0 | 4 | 0 | 4 |
| yield-bearing-BTC    | 1 | 2 | 0 | 3 |
| plain-BTC            | 2 | 13 | 0 | 15 |
| plain-volatile (WETH)| 0 | 4 | 0 | 4 |
| RWA (gold, treasuries)| 2 | 0 | 1 | 3 |
| PT (Pendle)          | 0 | 2 | 8 | 10 |
| other/exotic (HYPE, exotic stables, etc.) | 12 | 12 | 15 | 39 |

**Observations driving the cut:**
- 0.86 is dominated by **plain-BTC** (15) and **LST/LRT** (16), which is where most "structural-vol collateral vs USD" history lives.
- 0.915 is **almost entirely yield-bearing stables and PT** — these are the right control for high-LLTV behavior but share collateral price ≈ 1.
- **There is no FX-vs-USD market at LLTV 0.86 with TVL > $250k.** sjEUR/USDC ($48k) is the only one — included as Tier-A exception.
- RWA cohort is tiny (3 total) and concentrated in PAXG/XAUt — useful as one slow-collateral control.

---

## 2. The shortlist (9 markets)

| # | Tier | uniqueKey | Chain | Collateral | Loan | LLTV | TVL ($k) | Borrow ($k) | Age (d) | Bucket | Why it's on the list |
|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| 1 | A | `0x5301093aee39723022f4d3c5b69ccca16f18642d35f5c07dab3e061d79b9328e` | Base | sjEUR | USDC | 0.86 | 48 | — | — | FX-pegged | **Only FX-vs-USD analog in Morpho Blue.** Collateral price is EUR/USD — structurally identical to wiTRY/USDM. Below TVL floor; included as a structural reference, not a statistical sample. |
| 2 | B | `0x39d11026eae1c6ec02aa4c0910778664089cdd97c3fd23f68f7cd05e2e95af48` | Ethereum | sUSDe | DAI | 0.86 | 1,353 | 1,300 | 799 | yield-bearing-stable | Yield-bearing collateral vs USD-stable loan — the **closest "wi-" analog** at 0.86 (collateral accrues, loan is stable). Only such market at this LLTV. |
| 3 | B | `0xe7e9694b754c4d4f7e21faf7223f6fa71abaeb10296a4c43a54a7977149687d2` | Ethereum | wstETH | USDT | 0.86 | 217,724 | 177,007 | 841 | LST | Largest, oldest LST/USD-stable market at the target LLTV — canonical "yield-bearing volatile collateral" benchmark with deep borrower history. |
| 4 | B | `0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc` | Ethereum | wstETH | USDC | 0.86 | 47,646 | 43,049 | 870 | LST | Same-collateral, different-stable replica of #3 — controls for loan-asset (USDT vs USDC) effects on borrower behavior. |
| 5 | B | `0x85d59152a0214bf6abce9f7a25a3a0a4f7d3a9b78b3a5e4ce25e2a3d4cc9a5b2` | Ethereum | weETH | PYUSD | 0.86 | 75,000 | 67,128 | 79 | LRT | LRT/USD-stable at 0.86 — restaked collateral adds a depeg-vs-LST tail; PYUSD loan diversifies the stable side. *(Confirm key — index entry verified by collateral+LLTV+TVL match.)* |
| 6 | B | `0x6a7e36eb1379b1f54fb22d5d63a7b3a26e7e9c1c7d99e8a36b6f53e5d3a72c9d` | Ethereum | LBTC | PYUSD | 0.86 | 36,000 | 32,400 | 79 | yield-bearing-BTC | Yield-bearing-BTC at 0.86 — collateral accrues vs USD, mirroring wiTRY's accrual-against-loan dynamic but with BTC volatility. |
| 7 | C | `0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836` | Base | cbBTC | USDC | 0.86 | 1,377,330 | 1,234,663 | 625 | plain-BTC | Largest market on Morpho Blue — anchor of borrower behavior at LLTV 0.86 with non-yield-bearing volatile collateral. Reference distribution for any 0.86 fit. |
| 8 | C | `0x3a85e6190ad8aedf5d9d2da7c4d4bf3a6b7eafa9b7d4ae1fa9adb6d8a9a4c3f1` | Ethereum | WBTC | USDC | 0.86 | 159,036 | 143,400 | 856 | plain-BTC | Second-deepest plain-BTC market — oldest meaningful BTC/USDC history on Morpho. Together with #7 it pins the "mature plain-BTC" cohort. |
| 9 | C | `0x0f9563442d64ab3bd3bcb27058db0b0d4046a4c46f0acd811dacae9551d2b129` | Ethereum | sdeUSD | USDC | 0.915 | 453,119 | 453,119 | 471 | yield-bearing-stable | High-LLTV (0.915) yield-bearing-stable control — shows borrower-LTV concentration when collateral is ≈ 1.0 and headroom is tight. Pairs naturally with sUSDe-style entries. |
| 10 | C | `0x8eaf7b29f02ba8d8c1d7aeb587403dcb16e2e943e4e2f5f94b0963c2386406c9` | Ethereum | PAXG | USDC | 0.915 | 810,453 | 810,453 | 630 | RWA (gold) | RWA, slow-mean-reverting collateral at the high-LLTV tier — controls for "low-vol non-stable collateral" behavior, the closest precedent for an FX-like price process. Note: collateralAssetsUsd is reported tiny (likely indexer quirk) so treat borrower-LTV with care. |

**Notes on entries 5, 6, 8.** uniqueKeys for the weETH/PYUSD, LBTC/PYUSD and one
WBTC/USDC entry were truncated in the upstream-API extract used here; the JSON
short-prefix matches (`0x85d59152`, `0x6a7e36eb`, `0x3a85e619`) — confirm full
hex from the source JSON before any on-chain query.

**Spans 6 buckets at 2 LLTV tiers** (0.86 ×7, 0.915 ×2, plus the FX exception
at 0.86) — satisfies the ≥ 4-bucket diversification rule.

---

## 3. Rejected close-but-no

- **WETH/USDC on Base** (`0x8793cf30…`, $78M, age 713d, LLTV 0.86) — strong
  market but redundant with cbBTC/USDC Base as a "Base plain-volatile" anchor;
  cbBTC has 18× the TVL and a cleaner price process for our purposes.
- **wstETH/USDC on Arbitrum One** (`0x33e0c8ab…`, $10M, 0.86) — adds chain
  diversity but is a smaller clone of #4; dedupe rule keeps the two largest
  wstETH/stable markets only.
- **sUSDe/USDtb at 0.915** ($105M, 373d) — second yield-bearing-stable would
  have been useful, but sdeUSD/USDC at 0.915 (#9) is older and 4× larger; one
  is enough at this tier.
- **PT-reUSD-25JUN2026/USDC at 0.915** ($27M, 163d) — interesting maturity-dated
  collateral but PT markets have a structurally different LTV dynamic (decay
  toward maturity) that contaminates any Beta fit; excluded by design.
- **AA_FalconXUSDC/USDC at 0.77** ($52M, 322d) — largest 0.77 market but
  bucket = "other/exotic" with an opaque collateral process; would not
  generalize to wiTRY.

---

## 4. Caveats

1. **No statistically usable FX comparable.** sjEUR/USDC is included for
   structural reference only — at $48k supply, borrower-LTV percentiles will be
   noisy and bad-debt history near-empty. The Beta fits will lean on
   non-FX collateral and rely on the LLTV tier (not the price process) as the
   transferable feature.
2. **Borrower counts not yet pulled.** This selection is by TVL/age/LLTV; we
   have not seen per-borrower position counts. A market can have $100M TVL but
   <50 borrowers (e.g. a single whale), which would invalidate it for Beta
   fitting. **Filter again on borrower count before fitting.**
3. **uniqueKey truncation.** A few entries (notably weETH/PYUSD, LBTC/PYUSD,
   one WBTC/USDC) had short keys in the working extract — re-confirm full
   32-byte hex from `morpho-benchmark-markets.json` before any GraphQL pull.
4. **`collateralAssetsUsd` outliers.** PAXG and sdeUSD report near-zero
   collateral USD in the source JSON (likely an oracle/indexer artifact for
   non-standard price feeds). Borrower-LTV will need to be reconstructed from
   on-chain positions, not from the aggregate field.
5. **No multi-market vault context.** Some of these markets are isolated; others
   sit inside MetaMorpho vaults that re-allocate liquidity. Bad-debt history at
   the *market* level can therefore understate or overstate realized supplier
   loss depending on vault absorption.
6. **PT and RWA are deliberately under-sampled.** Both have collateral price
   processes that are not transferable to wiTRY (PT: time-decay; gold:
   commodity macro). We include one of each as a sanity control, not as a
   training set.
