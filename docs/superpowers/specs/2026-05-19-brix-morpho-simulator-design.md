# Brix Morpho Market Simulator — Design Spec

**Date:** 2026-05-19  
**Project:** Brix-Morpho  
**Audience:** Internal Brix team  
**Status:** Revised after Opus-level self-review (v2)

---

## Context

Brix.money is launching a wiTRY → USDM lending market on a fork of the Morpho protocol deployed on MegaETH chain. wiTRY is an ERC-4626 yield-bearing token backed by Turkish money market funds (staked iTRY). USDM is the USD-denominated stablecoin on MegaETH. This is a **cross-currency lending market**: collateral is TRY-denominated (with TRY-yield accrual), loans are USD-denominated. The protocol therefore inherits USD/TRY forex risk, but also benefits from a partial offset via wiTRY's continuous yield growth.

This simulator exists so the Brix team can stress-test protocol parameters before launch, answer five core design questions, and iterate on vault configuration without deploying to chain first.

**Five questions the simulator must answer:**
1. What is the USDM liquidity need?
2. How is it calculated and what parameters affect it?
3. How should Brix attract that liquidity (both supply and borrow sides)?
4. How should liquidations be handled (incl. wiTRY/USDM secondary pool sizing, liquidator profitability, expected bad debt)?
5. What are the ideal Morpho Vault V2 parameters?

---

## Out of Scope

The simulator does **not** model:
- MEV / sandwich risk on liquidation transactions
- LayerZero cross-chain message-delivery failure between Ethereum and MegaETH
- Custodian (Zodia) insolvency or operational downtime
- Regulatory blacklist scenarios and on-chain freezing
- Smart contract bugs in the Morpho fork
- Gas dynamics on MegaETH (assumed near-zero)
- Multi-market vault allocation (single-market vault at launch)
- Borrower behavioral models beyond a static LTV distribution

These are documented as known excluded risks in the README so users do not over-trust the output.

---

## Architecture

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts · simple-statistics (or jStat) · Web Workers

**Runtime:** purely client-side. No API calls at runtime. All data either user-entered or drawn from an embedded historical USD/TRY dataset (FRED `DEXTUUS` series, daily close, 2015-01-01 to 2025-12-31, ~2,600 points, ~30kb JSON). Build script `scripts/build-fx-data.ts` re-downloads + commits the JSON; rerun annually.

**State persistence:**
- All sidebar parameters encoded in URL query string (`?lltv=0.77&tvl=5000000&...`) via `nuqs` or hand-rolled hook
- Snapshot of current scenario also written to `localStorage` for reload-survival
- "Copy share link" button copies the URL

**Layout:** Single scrollable page with a sticky left sidebar (all inputs) and a scrollable right content area (5 output sections). State lives in a single `useSimulator` custom hook. Monte Carlo / bootstrap runs in a Web Worker (`simulation.worker.ts`) and posts results back as percentile arrays.

```
/Brix-Morpho
  /scripts
    build-fx-data.ts            # downloads FRED USDTRY → /lib/usdtryData.json
  /app
    page.tsx                    # root: <Sidebar/> + 5 sections in a grid
    /components
      Sidebar.tsx               # all parameter inputs (URL-synced)
      sections/
        LiquidityNeed.tsx       # Section 1
        FXRisk.tsx              # Section 2
        LiquidityStrategy.tsx   # Section 3
        LiquidationDesign.tsx   # Section 4
        VaultRecommendations.tsx# Section 5
      charts/                   # reusable Recharts wrappers
    /lib
      simulator.ts              # pure calculation functions
      fxModel.ts                # historical bootstrap + jump model
      morphoMath.ts             # LIF, IRM curve, health factor helpers
      useSimulator.ts           # React hook combining state + worker results
      useUrlState.ts            # URL <-> sidebar param sync
      simulation.worker.ts      # Web Worker entry
      usdtryData.json           # embedded FRED USD/TRY daily history
    /types
      simulator.ts              # all input/output types
  /tests
    morphoMath.test.ts          # LIF, IRM, health factor unit tests
    fxModel.test.ts             # bootstrap, GBM, jump diffusion
    simulator.test.ts           # end-to-end calculation tests
```

### Data Flow

```
[Sidebar inputs] ──┬─→ Section 1 (Liquidity Need)
                   ├─→ Section 2 (FX Risk) ──→ produces P5/P50/P95 paths
                   ├─→ Section 3 (Strategy) ──── needs Section 1 output
                   ├─→ Section 4 (Liquidation) ─ needs Section 2 + 3 outputs
                   └─→ Section 5 (Vault Params) ─ aggregates 1,2,3,4
```

Sections 1 and 2 are independent and run synchronously. Section 4 depends on Monte Carlo results from Section 2 (async via worker). Section 5 reads computed values from all prior sections.

---

## Core Math Primitives (lib/morphoMath.ts)

**Health factor:**
```
HF = (collateral_USD × LLTV) / debt_USD
```
Position is liquidatable when `HF ≤ 1`, equivalently `LTV ≥ LLTV`.

**Liquidation Incentive Factor (from Morpho docs):**
```
LIF = min(1.15, 1 / (β × LLTV + (1 − β))),  with β = 0.3
```
At LLTV=86% → LIF ≈ 1.0438 (≈ 4.4% bonus). At LLTV=77% → LIF ≈ 1.0741. At LLTV=91.5% → LIF ≈ 1.0262. (Corrected during implementation: prior values 1.0457 / 1.0837 / 1.0289 didn't satisfy β=0.3.)

**AdaptiveCurveIRM (simplified for simulator):**
Implement the actual Morpho `AdaptiveCurveIRM` curve. For purposes of the simulator (no time evolution), use the static instantaneous curve only — anchored at:

| utilization | rate |
|---|---|
| 0% | `r_target / 4` |
| 90% (target) | `r_target` |
| 100% | `4 × r_target` |

Interpolate via two exponential segments (one for `u ∈ [0, 0.9]`, one for `u ∈ [0.9, 1.0]`), chosen so the curve passes through the three anchor points smoothly. Reference: [Morpho IRM docs](https://docs.morpho.org/learn/concepts/interest-rate-model/). The slow adaptive drift of `r_target` over days is ignored — converges slower than parameters we tune. Documented as a simplification.

**wiTRY USD price:**
Let `S(t) = USD/TRY` exchange rate (e.g. 38.5 means 1 USD = 38.5 TRY). Then:
```
witry_USD(t) = witry_per_iTRY(t) / S(t)
witry_per_iTRY(t) ≈ (1 + iTRYYieldAnnual)^(t/365)         // iTRY ≈ 1 TRY by peg
```
`iTRYYieldAnnual` is a sidebar input (default 38% — typical Turkish MMF). The numerator grows over time from staking yield; the denominator grows over time from TRY depreciation. Net wiTRY USD value rises when yield > depreciation rate, falls otherwise. This **partial offset** is critical to the FX risk model.

---

## Section 1 — USDM Liquidity Need

**Purpose:** "How much USDM does the market need to function at the target utilization?"

**Inputs (from sidebar):**
- `witryTVL_USD` — assumed total wiTRY deposits valued in USD at current rate
- `lltv` — selected LLTV (governance-approved list)
- `targetUtilization` — desired steady-state borrow utilization
- `borrowerLTVDistribution` — Beta(α, β) parameters describing how aggressively borrowers use their headroom (default: Beta(2, 1.2) → mean LTV ≈ 62% of LLTV)

**Calculations:**
```
// borrowerLTVDist is interpreted as the *fraction of LLTV headroom* a borrower
// chooses to use. Beta(α,β) on [0,1]. Mean = α/(α+β). E.g. Beta(2,1.2) → 0.625
// means the average borrower sits at 62.5% of LLTV.

maxBorrowable    = witryTVL_USD × lltv
expectedBorrow   = maxBorrowable × mean(borrowerLTVDist)
                = witryTVL_USD × lltv × mean(borrowerLTVDist)
requiredUSDM     = expectedBorrow / targetUtilization      // <-- DIVISION
withdrawalBuffer = requiredUSDM × bufferPct(incentiveLevel) // see below
liquidityFloor   = max(deadDepositCost × 100, requiredUSDM × 0.20)
```

**Withdrawal buffer rationale** (replaces the old `1 + 2σ` formula):
Supply-side volatility (lenders entering/exiting) is the actual driver, not FX volatility. We approximate it with a heuristic:
```
bufferPct = 0.15 + 0.10 × (incentiveAPY / baseSupplyAPY)
```
i.e. higher incentive APY → more mercenary capital → more withdrawal risk → bigger buffer (15–35%). Documented as an estimate, exposed as an editable assumption.

**Output:**
- KPI cards: **Liquidity Floor / Required (steady-state) / Required + Withdrawal Buffer**
- AdaptiveCurveIRM borrow APY curve chart (utilization 0→100%), with target utilization marked
- Sensitivity table: requiredUSDM at LLTV ∈ {62.5%, 77%, 86%, 91.5%}

---

## Section 2 — FX Risk Engine

**Purpose:** Quantify how USD/TRY volatility (and wiTRY yield accrual) drive collateral value movement and liquidation risk.

**Inputs (from sidebar):**
- `usdtryBaseline` — current USD/TRY rate (default: latest in embedded data)
- `historicalPeriod` — 1Y / 3Y / 5Y (selects bootstrap sample window)
- `simulationMode` — "Scenario" | "Bootstrap" | "GBM+Jumps" (default Bootstrap)
- `simulationHorizonDays` — 7 / 30 / 60 / 90
- `iTRYYieldAnnual` — default 38% (drives wiTRY appreciation)
- `pathCount` — 1000 default

**Why bootstrap over GBM:** USD/TRY exhibits heavy tails (e.g. −15% in a single day, Aug 2018; −15% over a week, Nov 2021). Vanilla GBM understates these. Historical bootstrap resamples actual daily log-returns and preserves the empirical jump distribution. GBM and jump-diffusion remain selectable for sensitivity work.

**Bootstrap Mode (default):**
```
Δt = 1 day
For each of pathCount paths:
  S[0] = usdtryBaseline
  For t = 1..horizonDays:
    r_t = sample(historical_daily_log_returns)   // with replacement
    S[t] = S[t-1] × exp(r_t)
```
For autocorrelation preservation, optionally use **block bootstrap** with block length 5 (toggle).

**GBM Mode (for sensitivity):**
```
μ, σ = fitted from selected historical window
S_t = S_0 × exp((μ − σ²/2)Δt + σ√Δt × Z),  Z ~ N(0,1)
```

**GBM+Jumps Mode (Merton jump-diffusion):**
```
S_t = S_0 × exp((μ − σ²/2 − λκ)Δt + σ√Δt × Z + Σ_{i=1..N_t} J_i)
where N_t ~ Poisson(λ Δt), J_i ~ N(μ_J, σ_J²)
Defaults calibrated from historical jumps: λ = 4/yr, μ_J = −0.05, σ_J = 0.04
```

**Scenario Mode:**
- Slider: TRY shock over horizon (-10% to -80%)
- Optional: combine with wiTRY yield accrual over same horizon → net collateral change

**Outputs (all three modes feed into):**
- P5 / P50 / P95 paths of USD/TRY (chart)
- **Net wiTRY/USD path** (TRY path × yield accrual offset) — separate line
- **Position distribution over time**: given Beta(α, β) borrower LTV distribution at t=0, compute % of positions with `LTV > LLTV` at t = 1, 3, 7, 30 days under each scenario
- **3-day max drawdown distribution** (because secondary-market exit takes ~3 days if liquidator can't dump on DEX immediately)
- Expected USDM liquidation volume in P95 scenario
- **Annualized realized volatility** of the chosen historical window (displayed)

**Clarifying note (rendered prominently):**
> Liquidators receive seized **wiTRY directly** at the moment of liquidation. The 3-day cooldown only applies if they choose to redeem through Brix. They can also dump on the wiTRY/USDM secondary market (see Section 4). The 3-day window therefore measures **secondary-market exit risk**, not protocol-imposed delay.

**Oracle latency callout (always shown):**
> wiTRY NAV updates are currently manual (not yet on Redstone). The on-chain price can lag the true off-chain NAV by hours-to-a-day. The simulator's stress scenarios assume oracle prices update instantly; real liquidations will face an additional **staleness gap** documented in Section 4.

---

## Section 3 — Liquidity Strategy (Supply + Borrow Sides)

**Purpose:** Answer "how should Brix attract liquidity?" — covering both USDM suppliers and wiTRY borrowers.

### 3A. Supply Side (USDM lenders)

**Inputs:** `requiredUSDM` (from Section 1), `incentiveBudgetMonthly_USD`, `lockPeriodDays`, `attractionRate` (now a sidebar slider)

**Calculations:**
```
borrowAPY      = IRM(targetUtilization)
grossSupplyAPY = borrowAPY × targetUtilization
netSupplyAPY   = grossSupplyAPY × (1 − performanceFee) − managementFee
incentiveAPY   = (incentiveBudgetMonthly_USD × 12) / requiredUSDM
totalSupplyAPY = netSupplyAPY + incentiveAPY
daysToTarget   = requiredUSDM / (incentiveBudgetMonthly_USD × attractionRate / 30)
```

**`attractionRate` is now an exposed slider** (default 5: $1 incentive/month attracts $5 incremental TVL/month). The UI shows a footnote: *"Calibrated from Aave Polygon/Optimism liquidity-mining campaigns 2021–2022 ($1 → $4–7 TVL/month). Highly market-dependent; adjust based on Brix go-to-market."*

**Mercenary capital analysis:**
- Compute: `retentionAfterIncentivesEnd = totalTVL × (netSupplyAPY / competingAPY)`
- Show: "If you stop incentives, expected residual TVL = $X (Y% of peak)"
- Show: total incentive spend over campaign duration

### 3B. Borrow Side (wiTRY → USDM borrowers)

**Inputs:** `iTRYYieldAnnual`, `usdHedgeCost` (cost to hedge TRY exposure, default 0% if no hedge), `expectedTRYDepreciation_annual`

**Calculations:**
```
leverageLoopAPY = iTRYYieldAnnual − borrowAPY × (1 + expectedTRYDepreciation_annual)
                                              ↑ net of FX: TRY weakening makes
                                                USD debt cost more in TRY terms.
                                                Spec typo corrected 2026-05-20
                                                during PR #2 audit (see report).
viableForLoops  = leverageLoopAPY > 0
```
Show:
- Whether leverage loops are profitable at current parameters
- Break-even borrow APY for leverage loops
- Independent borrower use case: spending USD without selling TRY exposure (no APY threshold required)

**Output:**
- Supply APY gauge (base + incentive breakdown)
- Borrow APY gauge with leverage-loop viability indicator (green/red)
- 90-day incentive budget vs. TVL ramp chart
- Lock & Earn curve: lock period vs. required premium
- Competitive benchmark bars (USDC on Aave, on other Morpho markets; hardcoded reference)
- Merkl campaign design recommendation card (split supply/borrow %, blacklist treasury)

**Recommendation card:**
> "Bootstrap to $[required] USDM in [N] days with $[Y]/mo Merkl incentives split [S%]/[B%] supply/borrow. Borrow-side leverage loops are [viable / not viable] at current parameters; if not viable, borrower acquisition cost will be ~$[Z]/mo."

---

## Section 4 — Liquidation Design (Including Bad Debt & Liquidator Economics)

**Purpose:** Quantify whether liquidations will actually fire, how much bad debt to expect, and whether a wiTRY/USDM secondary pool is needed.

### 4A. Liquidator Profitability Model

For a liquidation of `debt_USD` against `collateral_USD`:
```
collateralSeized_USD = debt_USD × LIF
L                    = collateralSeized_USD              // wiTRY (in USD) sold to pool
poolSlippagePct      = L / (L + D)                       // D = pool wiTRY reserve in USD
revenueAfterSlippage = collateralSeized_USD × D / (L + D) = collateralSeized × (1 − slippage)
profit               = revenueAfterSlippage − debt_USD − gasCost − holdingRisk
holdingRisk          = collateralSeized_USD × σ_daily × √holdingDays
```
**Key insight surfaced:** if `poolSlippagePct > LIF − 1`, the liquidator loses money → liquidation does **not** happen → bad debt accumulates.

**Output:** "Minimum profitable liquidation size" and "Maximum profitable liquidation size" at current pool depth `D`.

### 4B. wiTRY/USDM Pool Sizing

Constant-product AMM model. **Define `D` = one-side reserve in USD** (so a balanced 50/50 pool has total USD value `2D`; `D` is the wiTRY-side reserve valued in USD).

- A liquidator selling `L` USD-worth of wiTRY incurs slippage `L / (L + D)`
- Max swap absorbable at ≤ 2% slippage: solve `L/(L+D) = 0.02` → `L_max ≈ 0.0204 × D`
- Liquidator seizes `debt × LIF` worth of wiTRY and dumps it, so max **debt size** liquidatable cleanly: `debt_max = L_max / LIF ≈ 0.0194 × D`

Slider: pool depth `D` ($0 – $10M). Chart shows max liquidation size as a function of `D` overlaid with **distribution of expected liquidation sizes** from the Monte Carlo (Section 2). Read the recommended `D` off where the curves cross at the P95 quantile.

**Recommendation:** "Given the P95 expected single-event liquidation size of $X, a wiTRY/USDM pool of at least $Y is needed for liquidators to clear it at <2% slippage."

### 4C. Bad Debt Model

For each Monte Carlo path, simulate the full liquidation cascade:
1. At each timestep, identify positions where `LTV > LLTV`
2. Compute liquidator profitability (4A); only execute if profitable
3. If executed: position closed at LIF; residual = max(0, debt − collateralSeized − slippageLoss)
4. If not executed: residual = max(0, debt − collateralValueNow)
5. Sum residuals across all positions → bad debt for that path

**Output:**
- Distribution of bad debt across 1000 paths
- Headline: "P95 bad debt = $X (Y% of TVL)"
- Heatmap: bad debt vs. (LLTV × pool depth)

### 4D. Pre-Liquidation (Auto-Deleverage) Design

Full Morpho pre-liquidation has 6 params: `preLLTV`, `preLCF₁`, `preLCF₂`, `preLIF₁`, `preLIF₂`, oracle. Spec recommends:
```
preLLTV  = LLTV − 0.05      // 5pp buffer below hard liquidation
preLCF₁  = 0.05             // at preLLTV, close 5%
preLCF₂  = 0.50             // at LLTV, close 50%
preLIF₁  = 1.01             // 1% bonus at the safe end of the buffer
preLIF₂  = LIF              // matches hard-liquidation bonus at the unsafe end
```
Toggle in the UI shows the bad-debt reduction with pre-liquidation enabled vs disabled (re-runs the cascade simulation).

**Recommendation card synthesizes 4A–4D:**
> "At LLTV=[X]%, P95 single liquidation = $[A]. Recommended wiTRY/USDM pool depth = $[B]. Enable pre-liquidation with preLLTV=[X−5]%; this cuts expected bad debt from $[C] to $[D] in P95 scenarios."

---

## Section 5 — Vault V2 Parameter Recommendations

**Purpose:** Aggregate everything above into a deployment-ready Morpho Vault V2 config.

### LLTV Derivation

The exact no-bad-debt condition for a worst-case borrower at LTV=L when collateral drops by X% and the liquidator pays LIF × (1+slippage) per unit debt repaid is:
```
L ≤ (1 − X) / (LIF × (1 + slippage)) − safetyMargin
```
Because `LIF` itself depends on `L`, this is a fixed-point problem. Solve iteratively:
```
L_0 = 0.80
For iter in 0..10:
  LIF        = computeLIF(L_iter)
  drop       = P95_drawdown_over_TimeToLiquidate    // from §2; 1d DEX OR 3d Brix
  slippage   = expectedSlippage(P95_liquidation_size, poolDepth)   // from §4
  L_{iter+1} = (1 − drop) / (LIF × (1 + slippage)) − safetyMargin
  break if |L_{iter+1} − L_iter| < 1e-4
```
`safetyMargin` default 2%. Snap result down to **nearest governance-approved LLTV** from `{0, 38.5, 62.5, 77.0, 86.0, 91.5, 94.5, 96.5, 98.0}%`. No artificial restriction to 77/86.

A first-order linear approximation (shown in UI as the "back-of-envelope"): `L ≈ 1 − X − (LIF−1) − slippage − margin`. Useful for intuition; final recommendation uses the fixed-point.

### Oracle Configuration

`MorphoChainlinkOracleV2` setup for wiTRY/USDM market:
- Collateral token: wiTRY (ERC-4626 on MegaETH)
- Loan token: USDM
- Feeds path: `wiTRY.convertToAssets(1e18)` → iTRY → (NAV TRY/USD feed via Redstone when live; manual NAV today) → USDM
- `baseVault` = wiTRY contract address
- `baseVaultConversionSample` = `1e18` (wiTRY is 18-decimal ERC-4626)
- Inverse: yes if feed is TRY/USD (we need collateral price in loan-token = USD)

Until Redstone wiTRY-NAV feed is live, the spec recommends a **manually updated oracle contract** with:
- Multi-sig push (3-of-5) by Brix operations
- Maximum update frequency: 4 hours
- On-chain freshness check (revert if last update > 6 hours)
- Documented in UI as a known risk

### Recommendation Table (live, generated from all sidebar inputs)

| Parameter | Recommended Value | Source |
|---|---|---|
| LLTV | computed (snapped to gov list) | §5 LLTV derivation |
| IRM | `AdaptiveCurveIRM` | Only governance-approved option |
| Oracle | Manual NAV pusher (today) → Redstone (when live) | §5 Oracle Configuration |
| Performance fee | 10% | Industry standard; well under 50% cap |
| Management fee | 1% APR | Well under 5% cap |
| Timelock | 7 days | Incident response window; not the 3d cooldown (rationale corrected) |
| Absolute cap | = `requiredUSDM + withdrawalBuffer` | §1 |
| Relative cap | 100% | Single-market vault at launch |
| MaxRate | 200% APR (protocol max) | Allows IRM to fully self-correct |
| Dead deposit (market) | 1e9 shares to `0xdead` | Per Morpho docs |
| Dead deposit (vault) | 1e18 shares for 18-dec asset | Per Morpho docs |
| Seed utilization | $1 supply + $0.90 borrow at deploy | Avoid IRM rate decay |
| Public Allocator | **Disabled** at launch (single market) | Re-evaluate when multi-market |
| `forceDeallocate` | **Enabled** with small penalty | Noncustodial guarantee |
| Pre-liquidation | Enabled, params per §4D | Cuts bad debt |
| Sentinel role | Brix multisig (2-of-3) | Emergency de-risk |
| Curator role | Brix risk multisig (3-of-5) | Day-to-day config |
| Allocator role | Brix ops EOA + bot | Liquidity adapter management |

### Risk Gauge

Color-coded Conservative / Moderate / Aggressive based on **how close the user-chosen LLTV is to the computed recommendation**:
- ≤ recommended → green (Conservative)
- recommended to recommended+5pp → yellow (Moderate)
- > recommended+5pp → red (Aggressive)

### Export

"Copy JSON" button outputs deployment-ready config:
```json
{
  "market": { "lltv": "770000000000000000", "irm": "0x...", "oracle": "0x..." },
  "vault":  { "performanceFee": 0.10, "managementFee": 0.01, "timelock": 604800, "caps": {...} },
  "preLiquidation": { "preLLTV": "...", "preLCF": [...], "preLIF": [...] }
}
```

---

## Sidebar Inputs (Complete)

| Input | Default | Range / Type |
|---|---|---|
| wiTRY TVL assumption (USD) | $5M | $100k – $100M |
| LLTV | 77% | governance list |
| Target utilization | 70% | 0–100% |
| Borrower LTV distribution | Beta(2, 1.2) | α, β sliders |
| iTRY annual yield | 38% | 0–100% |
| USD/TRY baseline | latest from data | manual |
| Historical period | 3Y | 1Y / 3Y / 5Y |
| Simulation mode | Bootstrap | Bootstrap / GBM / GBM+Jumps / Scenario |
| Simulation horizon | 30 days | 7 / 30 / 60 / 90 |
| Path count | 1000 | 100 / 1000 / 5000 |
| TRY shock (scenario) | −30% | −10% to −80% |
| Incentive budget/month | $10,000 | $0 – $500k |
| Attraction rate | 5 | 1 – 10 |
| Lock period | 90 days | 30 / 60 / 90 / 180 |
| wiTRY/USDM pool depth | $500k | $0 – $10M |
| Performance fee | 10% | 0–50% |
| Management fee | 1% | 0–5% |
| Safety margin (LLTV) | 2% | 0–10% |
| Pre-liquidation | Enabled | toggle |

URL-synced via query string. Copy-share-link button included.

---

## Verification Plan

**Unit tests (Vitest):**
1. `LIF(0.86) ≈ 1.0457`, `LIF(0.77) ≈ 1.0837`, `LIF(0.915) ≈ 1.0289` (matches Morpho docs)
2. `healthFactor(coll=100, debt=80, lltv=0.86) ≈ 1.075` and the boundary `HF=1` at `debt = coll × LLTV`
3. AdaptiveCurveIRM: `r(0.9) = r_target`; `r(1.0) = 4 × r_target`; `r(0) = r_target / 4`
4. Bootstrap reproducibility: same RNG seed → identical paths
5. GBM convergence: 10k paths, expected `E[S_T] ≈ S_0 × exp(μT)`
6. Slippage formula: `slippage(L=2, D=98) ≈ 0.02`

**Sanity checks:**
7. requiredUSDM with `LLTV=0.77, TVL=$5M, util=0.7, mean LTV ratio 0.6` should equal `5M × 0.77 × 0.6 / 0.7 = $3.3M` ± rounding
8. Computed annualized USD/TRY σ on 3Y window should be in [15%, 35%] range (cross-check against published GARCH estimates from NYU V-Lab)
9. P50 path drift over 1 year should roughly match historical realized depreciation for the chosen window
10. Liquidator-profit cliff: at pool depth where `slippage = LIF − 1`, profit should cross zero

**End-to-end:**
11. Load app with default params → all 5 sections render and Monte Carlo finishes within 3s on M1 MacBook
12. Tweak LLTV slider → all 5 sections update reactively
13. Export JSON → matches recommendation table values exactly
14. URL state: copy link, paste in incognito → identical scenario reproduced

**Cross-checks against deployed markets:**
15. Compare recommended LLTV for wiTRY/USDM against Morpho's deployed LLTVs for high-volatility collateral markets (e.g. emerging-market RWA, exotic LST markets) — should be in the same ballpark or rational deviation explained
16. Sensitivity: recommendedLLTV shift when historical period changes 1Y → 3Y → 5Y should be ≤ 1 governance step (otherwise the recommendation is too period-dependent and we need a longer-window default)

---

## Implementation Notes

- **Performance budget:** all reactive recomputes < 100ms on main thread; Monte Carlo runs in worker, completes < 3s for 1000 paths × 90 days
- **Numerical stability:** use log-space for path products (avoid float overflow on large `exp` chains)
- **Determinism:** seed the PRNG so the team can reproduce shared scenarios
- **Accessibility:** keyboard-navigable sidebar, all charts have alt text and data tables behind them
- **No tracking, no analytics, no external assets:** purely static export deployable to any host

---

## Open Questions for Brix Team (Resolve Before Implementation)

1. Should the simulator include a **second collateral asset** (e.g. iTRY directly, not just wiTRY)? Current spec is wiTRY-only.
2. Confirm USDM exact token: is it MegaUSD or a different MegaETH-native USD? Affects oracle setup details.
3. Is there a published wiTRY/USDM secondary market candidate (Uniswap-style DEX on MegaETH)? If so, what's its current depth?
4. Confirm `iTRYYieldAnnual` default. 38% is a rough estimate of Turkish MMF yields; should be calibrated against the actual fund.
5. Should the simulator include **leverage-loop simulation** for borrowers, not just viability check? (deferred — out of scope for v1)
