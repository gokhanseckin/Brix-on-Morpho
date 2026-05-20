# PR #2: Validate Formulas and Logic — Handover

**Date opened:** 2026-05-20
**Branch:** `claude/magical-sinoussi-0fd621` (continue) or branch from `main` once PR #1 merges
**Goal in one sentence:** Audit every formula in `lib/` against domain references, fix what's wrong, document what's policy, and make sure the math is trustworthy before content PRs build worked examples and "how it's calculated" copy on top of it.

---

## Start here (for a fresh Claude session)

Read these in order:

1. **This file** — orientation, methodology, scope.
2. **[CLAUDE.md](../../../CLAUDE.md)** — architecture overview and domain gotchas. Key facts: this is a Next.js static-export simulator with a single composite hook (`lib/useSimulator.ts`) that orchestrates 4 layers — Morpho math, FX paths, simulator primitives, and the Web Worker.
3. **[docs/superpowers/specs/2026-05-19-brix-morpho-simulator-design.md](../specs/2026-05-19-brix-morpho-simulator-design.md)** — the **original** design spec authored before any implementation. This is the canonical reference for what each formula is supposed to compute. Use it as the source of truth when cross-checking.
4. **[docs/superpowers/specs/2026-05-20-dashboard-help-system-design.md](../specs/2026-05-20-dashboard-help-system-design.md)** — the help system spec. PR #2 (this one) is now inserted as a prerequisite for the content PRs (#3–#7).
5. **The four math files** — `lib/morphoMath.ts`, `lib/simulator.ts`, `lib/fxModel.ts`, `lib/simulation.worker.ts`. Read each in full.
6. **CHANGELOG.md** — the phase-by-phase development log. Notes three demo-affecting bugs caught in final review and two numerical inconsistencies caught by TDD. Use it to understand what's already been fought over.

Do **not** start by running the dev server or touching UI code. PR #2 has no UI surface — the surface is a markdown report, code fixes, and added tests.

---

## Context: what's been done, what's already fixed

PR #1 (Infrastructure) shipped on this branch (~22 commits). The help components, registry, `/help` routes, and lazy-loaded KaTeX/mermaid are all in place but populated with `"Coming soon"` stubs. No real prose exists yet.

While writing PR #1, three formula issues were noticed and fixed in two commits at the end of the branch — **do not re-fix these**:

| Issue | Commit | What changed |
|---|---|---|
| Withdrawal buffer never responded to incentive settings — `useSimulator` passed `incentiveAPY=0` and `baseSupplyAPY=0.05` hardcoded to `computeLiquidityNeed`. | `89f02f8` | Reordered useMemos in `lib/useSimulator.ts`: `requiredUSDMPrecursor` → `strategy` → `liquidity`. Now `strategy.incentiveAPY` and `strategy.netSupplyAPY` flow into `bufferPctFromIncentive`. |
| Liquidity Floor hint "20% of required, or dead-deposit cost" understated the `deadDepositCost × 100` branch by 100×. | `0af8c72` | Hint corrected to `"max(20% of required, 100 × dead-deposit cost)"`. |
| Four magic numbers (`0.20`, `100`, `0.15`, `0.10`) had no rationale and no name. | `0af8c72` | Extracted as exported named constants in `lib/simulator.ts` (`LIQUIDITY_FLOOR_FRACTION`, `DEAD_DEPOSIT_MULTIPLIER`, `BUFFER_PCT_BASE`, `BUFFER_PCT_INCENTIVE_SLOPE`) with a comment block flagging them as governance-tunable policy dials, not derived. |

Verify these are present by running `git log --oneline -5` — you should see `0af8c72 refactor(sim): name policy constants...` and `89f02f8 fix(sim): thread real incentiveAPY...` as the most recent commits.

---

## Out of scope for PR #2

- **Writing help content.** That's PR #3 (LiquidityNeed) onward. PR #2 produces inputs to the content authoring process.
- **Restructuring the simulator architecture.** If you find a formula is mis-located (e.g. belongs in `morphoMath.ts` but lives in `simulator.ts`), note it in the report but don't move it.
- **Performance optimization.** Even if a formula is inefficient, don't refactor unless it's also incorrect.
- **Adding new features.** No new KPIs, no new chart types, no new sidebar parameters.
- **UI changes.** If a hint or label is wrong, fix the *text* — don't redesign the component.
- **Out-of-scope risks from the README** (MEV, LayerZero, custodian, gas, etc.) — these are explicitly excluded from the simulator; do not add code modeling them.

---

## Methodology: how to validate one formula

For each formula in the inventory below, fill out this rubric:

```
### <formula name>

**Location:** lib/<file>.ts:<line>
**Domain definition:** What is this formula supposed to compute?
  Cite source: design spec section X, or Morpho docs URL, or
  textbook reference (e.g. "Beta distribution mean, Wikipedia").
**Code implementation:** Paste the actual code (the relevant lines).
**Inputs:**
  | Name | Type | Source              | Default | Notes |
  | ---- | ---- | ------------------- | ------- | ----- |
  | x    | number | sidebar (`witryTVL_USD`) | $5M | ... |
  | y    | number | derived (`borrowAPY`)    | n/a | from `adaptiveCurveIRM(u_target, 0.04)` |
  | z    | number | constant (`LIF_CAP`)     | 1.15 | ... |
**Cross-check:** Does the code match the domain definition? Walk through
  the algebra. If they don't match, explain the discrepancy.
**Edge cases:**
  - Division by zero?
  - Negative inputs?
  - Boundary values (0, 1, ∞)?
  - NaN / Infinity propagation?
**Test coverage:** Which test file/case pins this? If none, note that
  a test is needed.
**Verdict:** one of
  - ✅ Correct — code matches domain, edge cases handled, test exists
  - ⚠️ Policy — not derived, but documented as a tunable dial
  - ⚠️ Heuristic — approximation, documented and justified
  - 📝 Needs comment — correct but cryptic
  - 📝 Needs test — correct but unguarded
  - ❌ Bug — code does not match intent; explain how
**Action:** What to do about it in this PR.
```

When in doubt about what a formula "should" compute, prefer the original design spec (`2026-05-19-brix-morpho-simulator-design.md`) over the current code. If the code disagrees with the spec, that's a finding — flag it, then ask the human whether the spec or the code is canonical.

For Morpho-specific formulas (LIF, adaptive curve IRM, health factor), cross-check against the Morpho Blue whitepaper or the public documentation at `docs.morpho.org`. Do not invent numbers — if you can't find a reference, mark the formula as `📝 Needs source` and surface it in the report's "open questions" section.

---

## Inventory of formulas to validate

Numbered for reference in the report. Read each entry's *current* implementation before validating — don't trust the descriptions below.

### lib/morphoMath.ts

1. **`LIF(lltv)`** — Liquidation Incentive Factor. Currently `min(LIF_CAP, 1/(BETA·LLTV + (1−BETA)))` with `BETA=0.3`, `LIF_CAP=1.15`. Cross-check against Morpho Blue docs.
2. **`healthFactor({collateralUSD, debtUSD, lltv})`** — `(collateral·lltv)/debt`, returns `Infinity` if `debt=0`. Standard Morpho health factor formula; verify sign and inversion convention.
3. **`adaptiveCurveIRM(u, rTarget)`** — two-segment IRM: `(rTarget/4)·exp(IRM_K1·u)` for `u ≤ 0.9`, else `rTarget·exp(IRM_K2·(u−0.9))`. Verify continuity at `u=0.9`, verify `IRM_K1 = ln(4)/0.9` and `IRM_K2 = ln(4)/0.1` produce the claimed shape. Compare to Morpho's adaptive curve documentation.
4. **`witryPerITRY(tDays, iTRYYieldAnnual)`** — `(1 + yield)^(tDays/365)`. Compound annual to per-day; verify this is the intended accrual model (not continuous compounding).
5. **`witryUSD({tDays, iTRYYieldAnnual, usdTryRate})`** — `witryPerITRY / usdTryRate`. Verify the FX direction (USD per TRY vs TRY per USD).

### lib/simulator.ts

6. **`betaMean(α, β)`** — `α/(α+β)`. Standard Beta distribution mean.
7. **`bufferPctFromIncentive(incentiveAPY, baseSupplyAPY)`** — `BUFFER_PCT_BASE + BUFFER_PCT_INCENTIVE_SLOPE · (incentiveAPY/baseSupplyAPY)`. Already named, but verify the intuition (more incentives → more chase-yield → bigger buffer) is the design intent and that the slope+base values are right.
8. **`computeLiquidityNeed`** — full function. Validate each sub-formula:
   - `maxBorrowable = TVL · LLTV`
   - `expectedBorrow = maxBorrowable · meanLTVFrac`
   - `requiredUSDM = expectedBorrow / targetUtilization`
   - `withdrawalBuffer = requiredUSDM · bufferPct`
   - `liquidityFloor = max(deadDepositCost · DEAD_DEPOSIT_MULTIPLIER, requiredUSDM · LIQUIDITY_FLOOR_FRACTION)`
9. **`irmCurvePoints(rTarget, steps=51)`** — generates `{u, r}` pairs by sampling `adaptiveCurveIRM` at `u = 0, 1/(steps−1), ..., 1`. Verify off-by-one.
10. **`computeStrategy`** — full function. Validate each output:
    - `grossSupplyAPY = borrowAPY · targetUtilization`
    - `netSupplyAPY = grossSupplyAPY · (1 − performanceFee) − managementFee`  *(note: subtract, not multiply by, the management fee)*
    - `incentiveAPY = (incentiveBudgetMonthly · 12) / requiredUSDM`
    - `totalSupplyAPY = netSupplyAPY + incentiveAPY`
    - `dailyAttract = (incentiveBudgetMonthly · attractionRate) / 30`
    - `daysToTarget = requiredUSDM / dailyAttract`
    - `retentionAfterIncentivesEnd = requiredUSDM · min(1, netSupplyAPY/competingAPY)`
    - `totalIncentiveSpend = incentiveBudgetMonthly · (daysToTarget / 30)`
    - `leverageLoopAPY = iTRYYield − borrowAPY · (1 + TRYDepreciation)`
    - `leverageLoopsViable` — what is the cutoff? Read the code.
11. **`minMaxProfitableLiquidation({lltv, poolDepth_USD, gasCost_USD})`** — liquidator's profitable position-size window. Validate using `LIF(lltv) − 1` as the spread.
12. **`slippage(size_USD, depth_USD)`** — constant-product pool slippage approximation. Verify the formula matches a constant-product AMM.
13. **`deriveRecommendedLLTV({p95Drawdown, slippage, safetyMargin})`** — fixed-point or closed-form derivation. Read the code carefully.
14. **`snapToGovernanceLLTV(raw)`** — snaps to the nearest entry of `GOV_LLTVS`. Verify the snap direction (nearest vs floor vs ceil).
15. **`classifyRiskTier(lltv, recommendedLLTV)`** — buckets into Conservative/Moderate/Aggressive. Verify the thresholds.
16. **`buildVaultConfigJson`** — JSON shape, no math. Verify field names match Morpho's vault config.

### lib/fxModel.ts

17. **`bootstrap`** — i.i.d. resampling of `dailyLogReturns`. Verify it builds a price path by exponentiating cumulative log-returns from `baseline`.
18. **`blockBootstrap`** — same with blocks of `k` consecutive days. Verify block length and concatenation logic.
19. **`GBM`** — geometric Brownian motion. `S_{t+1} = S_t · exp((μ − σ²/2)·dt + σ·√dt·Z)`. Verify `μ` and `σ` are estimated from the historical window correctly (mean and stdev of log returns, annualized).
20. **`GBM+Jumps`** — Merton jump diffusion. Verify the Poisson jump intensity and lognormal jump-size distribution. Verify that the drift correction includes the jump compensator if intended.
21. **`Scenario`** — deterministic linear interpolation from baseline to `baseline·(1+shockPct)` over the horizon. Verify the path shape (linear vs front-loaded vs end-loaded).
22. **`percentile`** — verify it matches a documented percentile convention (R-7 / linear interpolation / nearest-rank). Off-by-one risks.
23. **`maxDrawdown`** — verify the rolling-max basis and that drawdown is reported as a positive number (or negative — be explicit).
24. **`windowDrawdown(path, windowDays)`** — rolling drawdown over a fixed window.

### lib/simulation.worker.ts

25. **Path generation loop** — verify that `pathCount` × `horizon` paths are produced with one independent RNG draw per step.
26. **Per-position underwater check** — for each path, what's the rule for a position becoming "underwater"? Cross-check against `healthFactor < 1`.
27. **Bad-debt cascade** — when a liquidation occurs, the cascade reads the pool depth, applies `slippage`, and reports residual bad debt. Walk through one step.
28. **Pre-liquidation auto-deleverage** — when `preLiquidationEnabled`, deleveraging happens above the LLTV threshold according to a piecewise linear LCF/LIF schedule. Verify the schedule matches Morpho's pre-liquidation primitive spec.
29. **`expectedLiquidationVolumeP95_USD`** — what aggregation is taken across paths? P95 of per-path total liquidated USD? Verify.
30. **`annualizedVol`** — `stdev(dailyLogReturns) · √252`. Verify the constant (252 vs 365).

### lib/rng.ts

31. **`createRng(seed)`** — verify `seedrandom` is used correctly and that the same seed reproduces.
32. **`gauss(rng)`** — Box-Muller transform. Verify the second variate is not silently discarded (small numerical issue if so).

### Cross-cutting

33. **Reproducibility** — given a fixed `seed`, do `useSimulationWorker` outputs reproduce across runs? Verify by running a sanity test.
34. **`useSimulator.ts` orchestration** — the dependency order between `borrowAPY`, `requiredUSDMPrecursor`, `strategy`, `liquidity`, `lltvDerivation`, `vaultJson`. Verify all useMemo deps include every input read inside.
35. **`useSimulator.ts` p95Drawdown source** — currently `result?.threeDayDD ? quantile(result.threeDayDD, 0.95) : 0.15`. Verify the fallback `0.15` is sane and the quantile-of-array helper handles edge cases.
36. **Constants** — search for remaining magic numbers (`0.04` rTarget, `0.3` expectedTRYDepreciation, `0.05` competingAPY, `5` gasCost_USD, `0.01` liquidation-size fraction, `0.5` slippage cap). For each, decide: name it, document it as a policy dial, or move it to the sidebar.

---

## Deliverables

### 1. Validation report

Write `docs/superpowers/specs/2026-05-20-formula-validation-report.md`. One entry per inventory item (use the rubric above). End with three summary sections:

- **Bugs found and fixed** (commit references)
- **Policy/heuristic items** (documented but not fixed — these become governance-tunable in PR #3+ help copy)
- **Open questions for the human** (where you couldn't decide)

### 2. Code fixes

For each `❌ Bug` finding: fix in a small, focused commit. Reference the report entry by number in the commit message (e.g. `fix(sim): formula #14 — snap to LLTV ceiling instead of nearest`).

For each `📝 Needs comment` finding: add a comment in the relevant file explaining the derivation or referencing the design spec.

For each remaining magic number that's a policy dial: extract to a named constant with a comment block in the same style as the PR #1 fixes.

### 3. Missing tests

For each `📝 Needs test` finding: add a vitest case pinning the formula to a hand-computed expected value (or to a published reference value where available). Use tight tolerances (`toBeCloseTo(_, 6)` for math primitives, looser for Monte Carlo outputs against a fixed seed).

### 4. Doc updates

If `CLAUDE.md` or the original design spec is wrong or stale, update it. If a formula's intent in the design spec turns out to be ambiguous, propose clarifying language and ask the human to confirm.

---

## Done criteria

PR #2 is complete when **all of these** are true:

- [ ] Every item 1–36 in the inventory has a row in the validation report with a verdict and an action.
- [ ] Every `❌ Bug` has either a fix commit on this branch or an explicit "deferred — see open question #N" note in the report.
- [ ] Every `📝 Needs test` has a vitest case on this branch, and `npm test` passes.
- [ ] No magic numbers remain in `lib/simulator.ts`, `lib/morphoMath.ts`, `lib/fxModel.ts`, `lib/simulation.worker.ts` that aren't either (a) a named exported constant with a comment block, (b) explicitly noted in the report as "intentional literal — see entry #N", or (c) trivially obvious (e.g. `0` or `1` used as identity).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build` all pass.
- [ ] The validation report is committed and linked from the help-system design spec roadmap row for PR #2.
- [ ] A draft PR is opened with the report file changes + any fix commits + any new tests, ready for human review.

---

## Suggested workflow

1. **Spend the first chunk reading, not writing.** Read all four math files, the original design spec, and the CHANGELOG before validating anything. Aim to hold the full math layer in your head.
2. **Walk the inventory top-to-bottom in one pass**, filling the report as you go. Don't fix bugs inline — note them in the report, finish the audit, then come back and fix in priority order.
3. **Commit per finding.** Each bug fix is its own commit referencing the report number.
4. **Cite sources.** If you assert a formula is "the standard X formula", link to a reference (Wikipedia, paper, Morpho docs). The human will spot-check.
5. **Ask, don't guess.** If a formula's intent is genuinely ambiguous between two readings, leave it as an open question. Don't pick the more plausible reading silently.
6. **Bias toward smaller PRs if scope balloons.** If the audit surfaces five+ non-trivial bugs, ship the report + the 1–2 most demo-affecting fixes as PR #2A and defer the rest to a follow-up PR #2B before PR #3 starts. Coordinate with the human.

---

## Where to start (concrete first action)

```bash
cd /Users/gokhanseckin/claude-projects/Brix-Morpho/.claude/worktrees/magical-sinoussi-0fd621
git log --oneline -10                                # verify the three fixes from PR #1 close-out are present
cat docs/superpowers/specs/2026-05-19-brix-morpho-simulator-design.md  # the original spec
```

Then read the four math files in this order: `morphoMath.ts` (smallest, most foundational), `fxModel.ts`, `simulator.ts` (biggest), `simulation.worker.ts` (uses everything above).

Then begin the validation report.
