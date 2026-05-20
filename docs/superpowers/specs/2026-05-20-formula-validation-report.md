# Formula Validation Report — PR #2

**Date:** 2026-05-20
**Branch:** `claude/gifted-merkle-49f328`
**Scope:** Audit every formula in `lib/` against the original design spec
([2026-05-19-brix-morpho-simulator-design.md](./2026-05-19-brix-morpho-simulator-design.md))
and Morpho Blue documentation. Fix bugs, document policy dials, add
tests where coverage is thin. No new features, no UI changes.

Verdict legend:
- ✅ Correct — code matches domain, edge cases handled, test exists
- ⚠️ Policy — not derived; documented as a tunable dial
- ⚠️ Heuristic — approximation, justified
- 📝 Needs comment — correct but cryptic
- 📝 Needs test — correct but unguarded
- ❌ Bug — code does not match intent

---

## lib/morphoMath.ts

### 1. `LIF(lltv)` — Liquidation Incentive Factor
**Location:** [lib/morphoMath.ts:5](lib/morphoMath.ts:5)
**Domain:** Morpho Blue: `LIF = min(1.15, 1/(β·LLTV + (1−β)))`, β=0.3. Source: design spec §"Core Math Primitives", cross-referenced against Morpho docs.
**Cross-check:** Code matches exactly. Anchor values pinned: `LIF(0.77)=1.0741`, `LIF(0.86)=1.0438`, `LIF(0.915)=1.0262`.
**Edge cases:** `LLTV=0` → `1/(1−β)=1.4286` → capped at `LIF_CAP=1.15`. `LLTV=1` → `1.0`. Numerator never zero (β,LLTV ≥ 0).
**Test coverage:** [tests/morphoMath.test.ts:4](tests/morphoMath.test.ts:4)
**Verdict:** ✅ Correct.
**Action:** None.

### 2. `healthFactor({collateralUSD, debtUSD, lltv})`
**Location:** [lib/morphoMath.ts:10](lib/morphoMath.ts:10)
**Domain:** Spec: `HF = (collateral·LLTV)/debt`; liquidatable when HF ≤ 1.
**Cross-check:** Matches. `debt=0` → Infinity (mathematically correct and avoids NaN).
**Edge cases:** Negative debt or collateral are out-of-domain; not validated, but no caller can produce them. `1e-9` floor used in `simulateBadDebt` to avoid divide-by-zero on collapsed collateral.
**Test coverage:** [tests/morphoMath.test.ts:20](tests/morphoMath.test.ts:20)
**Verdict:** ✅ Correct.
**Action:** None.

### 3. `adaptiveCurveIRM(u, rTarget)`
**Location:** [lib/morphoMath.ts:20](lib/morphoMath.ts:20)
**Domain:** Spec: two exponential segments through `(0, rT/4)`, `(0.9, rT)`, `(1, 4·rT)`. Static (no time-evolution of `rTarget`).
**Cross-check:** With `IRM_K1 = ln(4)/0.9` and `IRM_K2 = ln(4)/0.1`, continuity at `u=0.9` is exact (both sides = `rTarget`). Algebra walks out cleanly: `(rT/4)·exp(ln(4)) = rT`, `rT·exp(0) = rT`. `u` is clamped to `[0,1]` before evaluation.
**Test coverage:** [tests/morphoMath.test.ts:32](tests/morphoMath.test.ts:32) covers anchors, monotonicity, clamp.
**Verdict:** ✅ Correct.
**Action:** None. (A two-sided continuity test pinning `IRM_K1`/`IRM_K2` derivation could be added but the anchor test already guarantees it implicitly.)

### 4. `witryPerITRY(tDays, iTRYYieldAnnual)`
**Location:** [lib/morphoMath.ts:28](lib/morphoMath.ts:28)
**Domain:** Spec: `witry_per_iTRY(t) = (1 + iTRYYieldAnnual)^(t/365)`. Discrete annual compounding, not continuous (`exp(r·t)`). This is the documented convention.
**Cross-check:** Exact match.
**Test coverage:** [tests/morphoMath.test.ts:53](tests/morphoMath.test.ts:53)
**Verdict:** ✅ Correct.
**Action:** None.

### 5. `witryUSD({tDays, iTRYYieldAnnual, usdTryRate})`
**Location:** [lib/morphoMath.ts:33](lib/morphoMath.ts:33)
**Domain:** `witryUSD = witryPerITRY / S(t)` where `S = USD/TRY` (TRY per 1 USD). Higher `S` → TRY weaker → wiTRY worth less in USD. Direction matches spec convention ("S=38.5 means 1 USD = 38.5 TRY").
**Cross-check:** Match.
**Test coverage:** [tests/morphoMath.test.ts:61](tests/morphoMath.test.ts:61)
**Verdict:** ✅ Correct.
**Action:** None.

---

## lib/simulator.ts

### 6. `betaMean(α, β)`
**Location:** [lib/simulator.ts:25](lib/simulator.ts:25)
**Domain:** Standard Beta-distribution mean.
**Verdict:** ✅ Correct. Used identically in [useSimulator.ts:52](lib/useSimulator.ts:52) precursor.
**Action:** None.

### 7. `bufferPctFromIncentive(incentiveAPY, baseSupplyAPY)`
**Location:** [lib/simulator.ts:51](lib/simulator.ts:51)
**Domain:** Spec §1: `bufferPct = 0.15 + 0.10 × (incentiveAPY / baseSupplyAPY)`. Heuristic; mercenary-capital proxy.
**Cross-check:** Match. Guards `baseSupplyAPY ≤ 0` by zeroing the ratio.
**Test coverage:** Indirect (via `computeLiquidityNeed` test) — no dedicated unit test.
**Verdict:** ⚠️ Policy — documented as governance-tunable dial in the constant block.
**Action:** Add a direct unit test pinning a hand-computed value at the boundary `baseSupplyAPY=0`. (See Test additions.)

### 8. `computeLiquidityNeed`
**Location:** [lib/simulator.ts:56](lib/simulator.ts:56)
**Sub-formulas vs spec §1:**
- `maxBorrowable = TVL · LLTV` ✅
- `expectedBorrow = maxBorrowable · meanLTVFrac` ✅
- `requiredUSDM = expectedBorrow / targetUtilization` ✅
- `withdrawalBuffer = requiredUSDM · bufferPct` ✅
- `liquidityFloor = max(deadDepositCost · 100, requiredUSDM · 0.20)` ✅ (corrected in commit `0af8c72`)
**Edge cases:** `targetUtilization=0` → Infinity (caller's responsibility; sidebar slider min is non-zero). No NaN propagation under normal inputs.
**Test coverage:** [tests/simulator.test.ts:18](tests/simulator.test.ts:18) — anchor 5M·0.77·0.6/0.7 = 3.3M.
**Verdict:** ✅ Correct.
**Action:** None.

### 9. `irmCurvePoints(rTarget, steps=51)`
**Location:** [lib/simulator.ts:77](lib/simulator.ts:77)
**Cross-check:** `u = i/(steps−1)` for `i ∈ [0, steps−1]` produces `steps` points covering exactly `[0, 1]`. No off-by-one.
**Test coverage:** None (curve-rendering only).
**Verdict:** ✅ Correct. 📝 Needs test (cheap).
**Action:** Add unit test asserting first/last `u` and length.

### 10. `computeStrategy`
**Location:** [lib/simulator.ts:402](lib/simulator.ts:402)
**Sub-formulas vs spec §3A/3B:**
- `grossSupplyAPY = borrowAPY · targetUtilization` ✅
- `netSupplyAPY = grossSupplyAPY · (1−performanceFee) − managementFee` ✅ (subtract, not multiply, matches spec line-by-line)
- `incentiveAPY = (incentiveBudgetMonthly · 12) / requiredUSDM` ✅; guards `requiredUSDM > 0`
- `totalSupplyAPY = netSupplyAPY + incentiveAPY` ✅
- `daysToTarget = requiredUSDM / dailyAttract` where `dailyAttract = (budget · attractionRate) / 30` ✅
- `retentionAfterIncentivesEnd = requiredUSDM · min(1, netSupplyAPY/competingAPY)` ✅ (code adds `min(1, …)` clip which is sensible; spec didn't specify but value > 1 is meaningless)
- `totalIncentiveSpend = budget · (daysToTarget / 30)` ✅
- `leverageLoopAPY = iTRYYield − borrowAPY · (1 + TRYDepreciation)` ⚠️ **discrepancy with spec text** (see "Open questions" below). Economically the code is correct: borrowing USD with TRY collateral has cost `borrowAPY × (FX wedge)`, and TRY depreciation makes the USD debt cost MORE in TRY terms, hence `(1 + dep)`. The spec text in §3B shows `(1 − USD_TRY_return)` with a hand-wavy "↑ net of FX" comment — that is a spec typo, not a code bug.
- `leverageLoopsViable = leverageLoopAPY > 0` ✅ matches spec wording.
**Test coverage:** [tests/simulator.test.ts:191](tests/simulator.test.ts:191) covers grossSupplyAPY and a sanity invariant.
**Verdict:** ✅ Correct in code; ⚠️ spec text inconsistent (Open Question #1).
**Action:** Add a comment in `computeStrategy` explaining the FX wedge sign. Flag spec correction in this report.

### 11. `minMaxProfitableLiquidation`
**Location:** [lib/simulator.ts:172](lib/simulator.ts:172)
**Approach:** Coarse log-spaced peak search (10⁰·¹ to 10⁸ USD), then binary search the two zero-crossings around the peak. Profit is non-monotonic because gas dominates at small sizes and slippage dominates at large sizes. Returns `{min_USD, max_USD}` or `{NaN, NaN}` if no peak is profitable.
**Cross-check:** Spec §4A defines the spread as `LIF − 1`; cliff test in [tests/simulator.test.ts:78](tests/simulator.test.ts:78) confirms `profit ≈ 0` at `slip = 1 − 1/LIF`.
**Edge cases:** `gasCost_USD=0` and `poolDepth_USD=∞` → `min_USD → 0`, `max_USD → ∞`. Real callers always pass finite values.
**Test coverage:** [tests/simulator.test.ts:96](tests/simulator.test.ts:96) loose-bounds check; cliff test pins economics.
**Verdict:** ✅ Correct.
**Action:** None.

### 12. `slippage(L_USD, D_USD)`
**Location:** [lib/simulator.ts:137](lib/simulator.ts:137)
**Domain:** Spec §4B: constant-product AMM with one-side reserve `D` in USD; selling `L` USD-worth → slippage `L/(L+D)`.
**Cross-check:** Match. `D ≤ 0` returns 1 (100% slippage), a safe degenerate.
**Test coverage:** [tests/simulator.test.ts:74](tests/simulator.test.ts:74) — anchor `slippage(2,98)=0.02`.
**Verdict:** ✅ Correct.
**Action:** None.

### 13. `deriveRecommendedLLTV`
**Location:** [lib/simulator.ts:348](lib/simulator.ts:348)
**Domain:** Spec §5: fixed-point iteration on `L = (1−drawdown)/(LIF(L)·(1+slippage)) − safetyMargin`, seed `L₀=0.80`, max 10 iters.
**Cross-check:** Match. Note: code uses `maxIter=20` default (loose), but tests pass 10. The convergence check uses `|next − L| < tol=1e-4`. If iteration oscillates, `converged=false` is returned along with the final `raw` clamped to `[0, 0.98]`.
**Edge cases:** Very large `p95Drawdown` (>1) → `next < 0` → clamped to 0. Very small drawdown + small slippage → `next > 0.98` → clamped to 0.98.
**Test coverage:** [tests/simulator.test.ts:166](tests/simulator.test.ts:166) — converges within 10, monotonicity vs drawdown.
**Verdict:** ✅ Correct. 📝 Needs comment on non-convergence semantics.
**Action:** Add a one-line comment.

### 14. `snapToGovernanceLLTV(raw)`
**Location:** [lib/simulator.ts:368](lib/simulator.ts:368)
**Domain:** Spec §5: "Snap result **down** to nearest governance-approved LLTV". Floor, not nearest.
**Cross-check:** Code iterates sorted `GOV_LLTVS` and picks the largest `lv ≤ raw`. ✅ Floor behavior. Returns `0` when `raw < 0.385`.
**Test coverage:** [tests/simulator.test.ts:177](tests/simulator.test.ts:177)
**Verdict:** ✅ Correct.
**Action:** None.

### 15. `classifyRiskTier(chosen, recommended)`
**Location:** [lib/simulator.ts:472](lib/simulator.ts:472)
**Domain:** Spec §5: `≤ rec` → Conservative; `rec` to `rec+5pp` → Moderate; `> rec+5pp` → Aggressive.
**Cross-check:** Match (`<=` and `<= rec + 0.05`).
**Test coverage:** [tests/simulator.test.ts:228](tests/simulator.test.ts:228)
**Verdict:** ✅ Correct.
**Action:** None.

### 16. `buildVaultConfigJson`
**Location:** [lib/simulator.ts:459](lib/simulator.ts:459)
**Domain:** Spec §5 export shape: `market.{lltv,irm,oracle}`, `vault.{performanceFee, managementFee, timelock, caps:{absoluteUSD, relative}}`, `preLiquidation.{preLLTV, preLCF, preLIF}`.
**Cross-check:** Shape matches. `to18Decimal(0.77) = "770000000000000000"`. Uses `BigInt(Math.round(x * 1e18))`; for `x ≤ 1` and 18 decimals this is well within safe-integer precision (1e18 ≈ 2⁶⁰; round-trip exact for tested inputs).
**Test coverage:** [tests/simulator.test.ts:211](tests/simulator.test.ts:211)
**Verdict:** ✅ Correct.
**Action:** None. (Note: spec mentions `MaxRate`, `Dead deposit`, `Seed utilization`, `Public Allocator`, `forceDeallocate`, `Sentinel/Curator/Allocator roles` in its recommendation table but the exported JSON only carries the deploy-critical subset. The richer config is shown in the UI table; JSON export is intentionally minimal. Not a bug.)

### Bonus: `simulateBadDebt` pre-liquidation collateral reduction
**Location:** [lib/simulator.ts:289](lib/simulator.ts:289)
**Domain:** Spec §4D: when pre-liq fires at LCF₂=50%, LIF₁=1.01, the protocol seizes `closeDebt · preLIF1` USD worth of collateral. The position's collateral should drop by the corresponding USD amount.
**Code:** `pos.collateralBaseUSD *= 1 - preLCF2 * preLIF1` — i.e. always multiplies by `1 − 0.5·1.01 = 0.495`, **independent of the borrower's LTV ratio**.
**Bug:** The fraction of collateral seized depends on `seized_USD / collNow_USD`, not on `preLCF2 · preLIF1`. A position at low LTV (small debt relative to collateral) should lose a smaller fraction of collateral than one at high LTV. The current formula over-seizes from low-LTV positions and under-seizes from high-LTV ones.
**Correct formula:** `fractionSeized = min(1, seized_USD / collNow_USD); pos.collateralBaseUSD *= 1 − fractionSeized`. Equivalently, scale the base by `1 − seized/collNow`.
**Test coverage:** [tests/simulator.test.ts:136](tests/simulator.test.ts:136) only asserts "on ≤ off" for bad-debt totals, which still holds post-fix.
**Verdict:** ❌ Bug.
**Action:** Fix in this PR.

---

## lib/fxModel.ts

### 17. `bootstrapPaths`
**Location:** [lib/fxModel.ts:13](lib/fxModel.ts:13)
**Domain:** Spec §2 Bootstrap: i.i.d. resampling of historical daily log-returns; `S_{t+1} = S_t · exp(r_t)`.
**Cross-check:** Match. Index `Math.floor(rng() · returns.length)` is safe because `seedrandom` returns `[0,1)`, so max index = `returns.length − 1`.
**Test coverage:** [tests/fxModel.test.ts:6](tests/fxModel.test.ts:6)
**Verdict:** ✅ Correct.
**Action:** None.

### 18. `blockBootstrapPaths`
**Location:** [lib/fxModel.ts:100](lib/fxModel.ts:100)
**Domain:** Spec §2: same as bootstrap but in blocks of `k` consecutive days, preserving short-run autocorrelation.
**Cross-check:** `start = floor(rng · max(1, n − blockLength))` — last legal start index is `n − blockLength`, then `b ∈ [0, blockLength)` ⇒ max access `n − 1`. ✅ Safe. The trailing-edge case `start + blockLength − 1 = n − 1` is allowed (not strictly beyond `n − blockLength − 1`), which is the standard convention.
**Test coverage:** [tests/fxModel.test.ts:23](tests/fxModel.test.ts:23) shape only.
**Verdict:** ✅ Correct.
**Action:** None.

### 19. `gbmPaths` + `fitGbmParams`
**Location:** [lib/fxModel.ts:41](lib/fxModel.ts:41), [lib/fxModel.ts:57](lib/fxModel.ts:57)
**Domain:** Spec §2 GBM: `S_{t+1} = S_t · exp((μ − σ²/2)·dt + σ·√dt·Z)`, `dt = 1/252` (trading-year). Drift fit: `μ̂_log = mean(r)`, then `μ = μ̂_log · 252 + 0.5 · σ² · 252` (converts log-return mean to GBM drift by adding back the variance correction). σ from sample variance with Bessel's `n−1` correction.
**Cross-check:** Algebra matches. The drift fit is the canonical inversion of `E[r] = (μ − σ²/2)dt`.
**Test coverage:** [tests/fxModel.test.ts:30](tests/fxModel.test.ts:30) — `E[S_T] ≈ S_0·exp(μT)` over 10k paths.
**Verdict:** ✅ Correct.
**Action:** None.

### 20. `jumpDiffusionPaths` (Merton)
**Location:** [lib/fxModel.ts:71](lib/fxModel.ts:71)
**Domain:** Spec §2 GBM+Jumps: `S_t = S_0 · exp((μ − σ²/2 − λκ)dt + σ√dt·Z + Σ J_i)`, `N ~ Poisson(λdt)`, `J ~ N(μ_J, σ_J²)`, `κ = E[e^J − 1] = exp(μ_J + σ_J²/2) − 1`.
**Cross-check:** Code computes `κ` exactly per Merton. Drift includes the `−λκ` compensator (martingale correction). Poisson sampling uses Knuth's algorithm — valid for small `λ·dt` (here `4/252 ≈ 0.016`, well within Knuth's accurate range).
**Test coverage:** [tests/fxModel.test.ts:47](tests/fxModel.test.ts:47) reproducibility only.
**Verdict:** ✅ Correct. 📝 Needs test pinning `E[S_T]` against the no-jump GBM analog (compensator should make means equal).
**Action:** Add unit test asserting `E[S_T]` ≈ `S_0·exp(μT)` for the jump model.

### 21. `Scenario` mode path
**Location:** [lib/simulation.worker.ts:68](lib/simulation.worker.ts:68)
**Domain:** Spec §2: "Slider: TRY shock over horizon … glide from S₀ to S₀·(1+|shock|)". Linear path.
**Cross-check:** Code uses `Math.abs(inputs.tryShockPct)` then adds positively — i.e. a `−30%` shock is always interpreted as TRY *weakening* (USD/TRY rises by 30%). The sign of `tryShockPct` is therefore ignored. Spec UI shows the slider in negative TRY-shock terms (-10% to -80% TRY drop), so `abs` is the right normalization for "stress = TRY weakens".
**Test coverage:** None directly (Monte Carlo path is exercised in e2e).
**Verdict:** ✅ Correct. 📝 Needs comment explaining the `abs` convention.
**Action:** Add a comment in the worker.

### 22. `quantile` (and `percentile` helpers)
**Location:** [lib/fxModel.ts:119](lib/fxModel.ts:119)
**Domain:** R-7 linear-interpolation convention: `idx = q·(n−1)`, blend the two surrounding ordered values.
**Cross-check:** Match. Equivalent helper duplicated as `quantile` in [useSimulator.ts:21](lib/useSimulator.ts:21) (uses nearest-rank via floor, not interpolation). Slight inconsistency — see Open Question #2.
**Verdict:** ✅ Correct (each in isolation); 📝 inconsistent across files.
**Action:** Note in report; leave both as-is in PR #2 to avoid scope creep. Decision deferred.

### 23. `rolling3DayMaxDrawdown(paths, window)`
**Location:** [lib/fxModel.ts:142](lib/fxModel.ts:142)
**Domain:** For each path, scan every window of `window+1` consecutive prices; record the worst (start − min) / start. Reported as a positive fraction (`dd ≥ 0`).
**Cross-check:** Loop bound `i + window < p.length` ⇒ `i ∈ [0, p.length − window − 1]`, inner `j ∈ [i+1, i+window]` ⇒ max `j = p.length − 1`. Safe.
**Note:** This is the **TRY-strengthening** drawdown (`start − minAfter`), but in a USD/TRY series rising = TRY weakening = collateral *losing* USD value. So `dd > 0` here means "TRY weakened" → bad for collateral. Wait — actually `(start − minAfter) > 0` means `minAfter < start`, i.e. USD/TRY went *down*, which is TRY *strengthening*, GOOD for collateral. **This is the wrong direction for the use case.**
**Verdict:** ❌ Bug — measures the wrong tail. (See "Bugs found" below.)
**Action:** Fix to measure the upward move (TRY weakening): `dd = (max(p[i..i+window]) − p[i]) / p[i]`. Update test.

### 24. `windowDrawdown` (handover #24)
**Status:** Not implemented under that name. The functionality lives in `rolling3DayMaxDrawdown` (item 23) parameterized by `window`. No separate function.
**Verdict:** N/A.
**Action:** None.

---

## lib/simulation.worker.ts

### 25. Path generation loop
**Location:** [lib/simulation.worker.ts:44](lib/simulation.worker.ts:44)
**Cross-check:** `pathCount` paths × `horizonDays+1` steps per path. Each step draws one (or more, for jump-diffusion) RNG value. Reproducible from seed.
**Verdict:** ✅ Correct.

### 26. Per-position underwater check
**Location:** `pctUnderwaterAtT` in [lib/simulator.ts:127](lib/simulator.ts:127); also `simulateBadDebt` HF check at [lib/simulator.ts:296](lib/simulator.ts:296).
**Cross-check:** In `pctUnderwaterAtT`, a position is underwater when `ltvFrac > collateralRelChange`. This is equivalent to `debt/(coll·rel) > LLTV` rearranged: `ltvFrac · LLTV · coll > coll · rel · LLTV` ⇒ `ltvFrac > rel`. ✅ Matches HF ≤ 1 boundary.
In `simulateBadDebt`, code uses `healthFactor({coll, debt, lltv}) ≤ 1`. ✅
**Verdict:** ✅ Correct.

### 27. Bad-debt cascade
**Location:** [lib/simulator.ts:236](lib/simulator.ts:236)
**Cross-check:** Walks each path, evaluates pre-liq then hard-liq per timestep. Slippage applied via `slippage(seized, poolDepth)`. Residual = `max(0, debt − revenue)` when profitable; otherwise `max(0, debt − collAfter)` (collateral value worse than residual debt → loss to lender).
**Simplification:** Pool depth is static (no pool-state evolution between liquidations on the same path). Spec §4 acknowledges this as a known simplification.
**Bug:** Item 8-bonus (pre-liq collateral fraction) — see Bugs Found.
**Verdict:** ❌ Bug present (pre-liq fraction). Otherwise correct.

### 28. Pre-liquidation auto-deleverage
**Location:** [lib/simulator.ts:275](lib/simulator.ts:275)
**Domain:** Spec §4D: `preLLTV = LLTV − 0.05`, `preLCF = [0.05, 0.50]`, `preLIF = [1.01, LIF(LLTV)]`. Simplification: code uses single-shot `preLCF₂=0.50` / `preLIF₁=1.01` at any LTV in the pre-liq zone, not the piecewise-linear schedule.
**Cross-check:** The spec's full schedule interpolates LCF/LIF linearly between the two endpoints based on effLTV. The current implementation is a coarse one-shot approximation, documented inline.
**Verdict:** ⚠️ Heuristic — documented simplification. Could be expanded to the full schedule in a follow-up.
**Action:** Add a comment cross-referencing the spec full schedule.

### 29. `expectedLiquidationVolumeP95_USD`
**Status:** Field exists in `FxOutput` type ([types/simulator.ts:48](types/simulator.ts:48)) but **never produced** anywhere. The worker output (`WorkerOutput`) does not include it. The bad-debt model produces `liquidatedCountByPath` (count of closed positions per path) which is the closest analog, but no aggregated dollar volume.
**Verdict:** 📝 Stale type field.
**Action:** Either implement (sum of seized USD per path, take P95) or remove the field. Decision deferred — see Open Question #3.

### 30. `annualizedVol`
**Location:** [lib/simulation.worker.ts:103](lib/simulation.worker.ts:103)
**Domain:** `σ_ann = σ_daily · √252`. Trading-year convention (Yahoo `TRY=X` is weekday-only, ≈252/year).
**Cross-check:** Match. Daily variance computed with Bessel's `n−1` correction.
**Verdict:** ✅ Correct.

---

## lib/rng.ts

### 31. `createRng(seed)`
**Location:** [lib/rng.ts:5](lib/rng.ts:5)
**Cross-check:** `seedrandom(String(seed))`; reproducible. `String(5) === String("5")` so numeric and string seeds with same digits are equivalent.
**Test coverage:** [tests/fxModel.test.ts:7](tests/fxModel.test.ts:7) (reproducibility).
**Verdict:** ✅ Correct.

### 32. `gauss(rng)`
**Location:** [lib/rng.ts:10](lib/rng.ts:10)
**Domain:** Box–Muller: `Z₀ = √(−2 ln U₁) · cos(2π U₂)`. Uses `u1 = 1 − rng()` to push u1 into `(0,1]` (avoiding `log(0)`).
**Cross-check:** Match. Second variate `Z₁ = √(−2 ln U₁) · sin(2π U₂)` is discarded — minor RNG waste, not a correctness issue (just 2× draws). Acceptable for this scale.
**Verdict:** ✅ Correct.
**Action:** None.

---

## Cross-cutting

### 33. Reproducibility under fixed seed
**Cross-check:** All stochastic primitives flow through `createRng(seed)`. `seedrandom` is deterministic. Tests at [tests/fxModel.test.ts:7](tests/fxModel.test.ts:7), [tests/fxModel.test.ts:48](tests/fxModel.test.ts:48) confirm. The worker output is fully determined by `(inputs, returnsWindow)` because the only stochastic source is `inputs.seed`.
**Verdict:** ✅ Correct.

### 34. `useSimulator.ts` orchestration / dep order
**Cross-check:** Ordering `borrowAPY → requiredUSDMPrecursor → strategy → liquidity → lltvDerivation → vaultJson` matches the design. The dep arrays use the full `s` object plus narrowly-named secondary deps — broad but safe (no missing deps). The fix in commit `89f02f8` resolved the previous bug where `bufferPctFromIncentive` got `incentiveAPY=0`.
**Verdict:** ✅ Correct.

### 35. `useSimulator.ts` p95Drawdown source
**Location:** [lib/useSimulator.ts:101](lib/useSimulator.ts:101)
**Cross-check:** `result?.threeDayDD ? quantile(result.threeDayDD, 0.95) : 0.15`. The fallback `0.15` is a reasonable hard-coded 15% 3-day drawdown for first-render before worker results arrive. The local `quantile` helper handles empty arrays via `?? 0`.
**Note:** The fallback `0.15` is a magic number. Should be named.
**Verdict:** ⚠️ Policy (fallback). 📝 Needs constant name.
**Action:** Extract as named constant.

### 36. Remaining magic numbers
**Inventory and decision:**

| # | Value | Location | Decision |
|---|---|---|---|
| a | `rTarget = 0.04` | [useSimulator.ts:41](lib/useSimulator.ts:41) | Name `MORPHO_IRM_RTARGET` (4% APR target rate per Morpho governance) |
| b | `expectedTRYDepreciation_annual: 0.3` | [useSimulator.ts:69](lib/useSimulator.ts:69) | Name `DEFAULT_TRY_DEPRECIATION_ANNUAL` (rough estimate; out-of-scope to derive) |
| c | `competingAPY: 0.05` | [useSimulator.ts:70](lib/useSimulator.ts:70) | Name `COMPETING_STABLECOIN_APY` |
| d | `deadDepositCost: 1` | [useSimulator.ts:86](lib/useSimulator.ts:86) | Name `DEFAULT_DEAD_DEPOSIT_COST_USD` |
| e | `p95dd fallback 0.15` | [useSimulator.ts:101](lib/useSimulator.ts:101) | Name `DEFAULT_P95_3D_DRAWDOWN` |
| f | `gasCost_USD: 5` (×2) | [useSimulator.ts:105](lib/useSimulator.ts:105), [worker.ts:93](lib/simulation.worker.ts:93) | Name `DEFAULT_GAS_COST_USD` (MegaETH near-zero gas; nominal $5 cushion) |
| g | `0.01` liquidation-size fraction | [useSimulator.ts:111](lib/useSimulator.ts:111) | Name `P95_LIQUIDATION_FRACTION_OF_BORROWS` |
| h | `0.5` slippage cap | [useSimulator.ts:113](lib/useSimulator.ts:113) | Name `SLIPPAGE_ESTIMATE_CAP` |
| i | `timelockSeconds: 604800` | [useSimulator.ts:139](lib/useSimulator.ts:139) | Name `DEFAULT_VAULT_TIMELOCK_SECONDS` (7 days per spec §5 table) |
| j | `Math.max(0, s.lltv - 0.05)` (×2) | [simulator.ts:246](lib/simulator.ts:246), [useSimulator.ts:141](lib/useSimulator.ts:141) | Name `PRE_LIQUIDATION_LLTV_OFFSET` |
| k | `preLCF: [0.05, 0.5]` | [useSimulator.ts:142](lib/useSimulator.ts:142) | Name `PRE_LIQUIDATION_LCF` (matches spec §4D) |
| l | `preLIF[0] = 1.01` | [useSimulator.ts:143](lib/useSimulator.ts:143), [simulator.ts:248](lib/simulator.ts:248) | Name `PRE_LIQUIDATION_LIF_MIN` |
| m | `n: 1000` ltv samples | [worker.ts:84](lib/simulation.worker.ts:84) | Name `BORROWER_POPULATION_SAMPLES` |
| n | `blockLength: 5` | [worker.ts:48](lib/simulation.worker.ts:48) | Name `BOOTSTRAP_BLOCK_LENGTH_DAYS` |
| o | jump-diffusion `lambda: 4, muJ: -0.05, sigmaJ: 0.04` | [worker.ts:61-63](lib/simulation.worker.ts:61) | Name `JUMP_LAMBDA_PER_YEAR`, `JUMP_LOG_MEAN`, `JUMP_LOG_STD` (calibrated values per spec §2) |
| p | `0.05` Moderate band | [simulator.ts:477](lib/simulator.ts:477) | Name `RISK_TIER_MODERATE_BAND_LLTV` |
| q | `BUFFER_PCT_BASE = 0.15` | already named | OK |
| r | `1` (deadDepositCost default in useSimulator) | (covered by d) | — |
| s | `252` trading days/year | [fxModel.ts:43](lib/fxModel.ts:43), [worker.ts:103](lib/simulation.worker.ts:103) | Intentional literal — annual-trading-day convention. Document. |
| t | `365` days/year (compounding) | [morphoMath.ts:29](lib/morphoMath.ts:29), [simulator.ts:265](lib/simulator.ts:265) | Intentional literal — calendar-day convention for yield accrual. Document. |
| u | `4` IRM curve anchor multiplier | [morphoMath.ts:16-17](lib/morphoMath.ts:16) | Intentional literal — derives the IRM curve shape per spec. Document. |
| v | `1e-9` HF divide-by-zero floor | [simulator.ts:270](lib/simulator.ts:270) | Intentional literal. Trivially obvious. |

**Action:** Extract a-p into named exported constants; document s-v as intentional literals with brief comments. Extract them in the file where they're used (or in `simulator.ts` if used across files).

---

## Summary

### Bugs found
1. **Pre-liquidation collateral fraction is wrong** ([lib/simulator.ts:289](lib/simulator.ts:289), entry #8-bonus / #27).
   Fix: use `seized_USD / collNow_USD` as the seized fraction.
2. **`rolling3DayMaxDrawdown` measures the wrong tail** ([lib/fxModel.ts:142](lib/fxModel.ts:142), entry #23).
   Fix: measure upward moves (TRY weakening = collateral USD value falling), not downward.

Both fixed in this PR; commit messages reference report entries.

### Policy / heuristic items (documented, not "fixed")
- `bufferPctFromIncentive` (entry 7) — governance dial, already commented.
- `LIQUIDITY_FLOOR_FRACTION`, `DEAD_DEPOSIT_MULTIPLIER`, `BUFFER_PCT_BASE`, `BUFFER_PCT_INCENTIVE_SLOPE` — already named in PR #1 close-out (`0af8c72`).
- `simulateBadDebt` pre-liquidation: one-shot 50% close vs full piecewise-linear schedule (entry 28) — documented simplification.
- All magic numbers in entry 36 extracted to named constants with comment blocks.

### Open questions for the human
1. **`leverageLoopAPY` sign in spec §3B.** The spec text shows `borrowAPY × (1 − USD_TRY_return)` with "↑ net of FX". The code uses `borrowAPY × (1 + TRYDepreciation_annual)`. Economic logic and the rest of the model favor the code (TRY weakening makes USD debt more expensive in TRY terms). Recommend updating the spec text accordingly. Code unchanged.
2. **`quantile` helper duplicated** in [fxModel.ts:119](lib/fxModel.ts:119) (R-7 interpolation) and [useSimulator.ts:21](lib/useSimulator.ts:21) (nearest-rank). Different conventions. Consolidating is out of scope for PR #2; flag for follow-up.
3. **`expectedLiquidationVolumeP95_USD` field in `FxOutput`** is declared but never populated. Either implement (P95 of summed seized USD per path) or remove. Deferred — recommend implementing alongside the Liquidation section help copy in PR #6.

---

## Verification

```
npx tsc --noEmit   → expected pass
npm run lint       → expected pass
npm test           → expected pass (includes 4 new tests)
npm run test:e2e   → expected pass (no UI changes)
npm run build      → expected pass
```
