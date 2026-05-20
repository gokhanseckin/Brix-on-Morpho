# Roadmap PR #5: Strategy (section 3) content — Handover

**Date opened:** 2026-05-20
**Branch:** create fresh from `main` (e.g. `claude/pr5-strategy-content`)
**Goal in one sentence:** Replace the "Coming soon" stubs for Section 3 (LiquidityStrategy) with real KPI / chart / sidebar-param help, following the exact pattern PRs #3 and #4 established.

---

## Start here (for a fresh Claude session)

Read in order:

1. **This file** — orientation + the rubric to follow.
2. **[CLAUDE.md](../../../CLAUDE.md)** — architecture overview.
3. **[Help-system design spec](../specs/2026-05-20-dashboard-help-system-design.md)** — read the roadmap table (note the convention block at the top: roadmap PR# ≠ GH PR#).
4. **[Formula validation report](../specs/2026-05-20-formula-validation-report.md)** — the math is locked. Section 3 KPIs all live in `lib/simulator.ts` `computeStrategy()` and reference the report's leverage-loop sign decision (open question #1, resolved).
5. **Existing content as templates:**
   - [lib/help/content/liquidityNeed.ts](../../../lib/help/content/liquidityNeed.ts) — voice, structure, depth.
   - [lib/help/content/fxRisk.ts](../../../lib/help/content/fxRisk.ts) — the most recent, follow this shape.
6. **The simulator code you're documenting:**
   - [lib/simulator.ts](../../../lib/simulator.ts) — `computeStrategy()` lines 402–428 + the named constants block.
   - [lib/useSimulator.ts](../../../lib/useSimulator.ts) — how strategy outputs are wired into the dashboard.
   - [app/components/sections/LiquidityStrategy.tsx](../../../app/components/sections/LiquidityStrategy.tsx) — the section UI, including which KPIs are visible today and what `hint=` they currently show (re-use the hint phrasing for the popover oneLiner where it's already crisp).

Do **not** start by touching simulator code. PR #5 is content-only.

---

## What's done before this PR

| Roadmap PR | GH PR | Status |
|---|---|---|
| #1 Infrastructure          | (initial)  | ✅ merged |
| #2 Validate formulas       | GH #2      | ✅ merged |
| #3 LiquidityNeed content   | GH #5      | ✅ merged |
| #4 FXRisk content          | GH #6      | ✅ merged |
| **#5 Strategy content**    | (this PR)  | ⏭️ next |
| #6 Liquidation content     | tbd        | pending |
| #7 Vault content           | tbd        | pending |

Open issues (don't close in this PR):
- [#3 — Consolidate `quantile` helpers](https://github.com/gokhanseckin/Brix-on-Morpho/issues/3) (refactor)
- [#4 — Implement `expectedLiquidationVolumeP95_USD`](https://github.com/gokhanseckin/Brix-on-Morpho/issues/4) (pair with PR #6)

---

## Scope of PR #5

### Sidebar params (section 3)
Six entries to populate. Use the `helpKey` values from `app/components/Sidebar.tsx`:

| Param                            | Default | Notes |
|---|---|---|
| `incentiveBudgetMonthly_USD`     | $10,000 | $/month, drives `incentiveAPY` denominator. |
| `attractionRate`                 | 5       | $1 incentive → $X TVL/month. Spec §3A footnote: calibrated from Aave LM campaigns 2021–22. |
| `lockPeriodDays`                 | 90 d    | Currently not wired into a computation (informational); the param exists on the sidebar though. Document as-is. |
| `performanceFee`                 | 10%     | Subtracted multiplicatively from gross APY. |
| `managementFee`                  | 1%      | Subtracted ADDITIVELY (verify in code; report #2 entry #10 pins this). |
| (also `iTRYYieldAnnual` is reused here for leverage-loop viability, but it already has copy from PR #4 — don't overwrite.) |

`safetyMargin` and `seed` belong to vault / cross-cut sections; leave for PR #7 / PR #4 (already done).

### KPIs (section 3) — 9 entries
From `lib/help/kpiKeys.ts`:

```
borrowAPY
grossSupplyAPY
netSupplyAPY
incentiveAPY
totalSupplyAPY
daysToTarget
retentionAfterIncentives
totalIncentiveSpend
leverageLoopAPY
```

Every formula is in `computeStrategy()`. Validation report §10 has each one written out with sub-formula labels — copy from there into the `formula.plain` / `formula.latex` fields.

### Charts (section 3) — 0 entries

`lib/help/chartKeys.ts` declares no charts under `'strategy'`. If the UI grows a strategy chart later (e.g. Lock & Earn curve, 90-day TVL ramp), add the key alongside the help entry in the same PR.

### Pages
- Populate `/help/strategy` using the shared `KpiEntry` / `ChartEntry` from `app/components/help/SectionPage.tsx`. Mirror `/help/fx-risk/page.tsx` exactly.

### Regression test
Add a `PR #5 — strategy content is no longer stubbed` block to `tests/help/registry.test.ts`, mirroring the existing PR #3 / #4 blocks.

---

## Pattern to follow (exact)

1. **Create** `lib/help/content/strategy.ts` mirroring `fxRisk.ts`:
   - `STRATEGY_PARAMS: Partial<Record<string, ParamHelp>>` — one entry per sidebar key.
   - `STRATEGY_KPIS = { borrowAPY, grossSupplyAPY, … }` — each value is a `KpiHelp` with all required fields populated and at least one definition.
   - `STRATEGY_CHARTS = {}` — empty for now (no charts in this section).

2. **Wire** into `lib/help/registry.ts`:
   ```ts
   import { STRATEGY_PARAMS, STRATEGY_KPIS, STRATEGY_CHARTS } from './content/strategy';

   const SECTION_PARAMS = { ...LIQUIDITY_NEED_PARAMS, ...FX_RISK_PARAMS, ...STRATEGY_PARAMS };
   const SECTION_KPIS   = { ...LIQUIDITY_NEED_KPIS,   ...FX_RISK_KPIS,   ...STRATEGY_KPIS };
   const SECTION_CHARTS = { ...LIQUIDITY_NEED_CHARTS, ...FX_RISK_CHARTS, ...STRATEGY_CHARTS };
   ```
   Update the section-status comment block at the top of registry.ts.

3. **Replace** `app/help/strategy/page.tsx` with the rich render — copy `app/help/fx-risk/page.tsx`, change the heading + intro prose.

4. **Add** the regression test block to `tests/help/registry.test.ts`.

5. **Verify**:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm test            # should be 69/69 (66 + 3 new strategy guards)
   npm run test:e2e    # 7/7
   npm run build       # static export
   ```

6. **Commit** as a single feature commit. PR title pattern:
   `Roadmap PR #5: Strategy (section 3) content`

7. **Mark draft**, ship for copy review, iterate in chat (same loop as PR #3 / #4).

---

## Voice + depth (what's been working)

- **oneLiner**: one sentence. State what the KPI/param IS and what it DRIVES. ~25 words.
- **formula.plain**: monospace expression as it appears in code. Multi-line OK for derivation chains.
- **formula.latex**: same expression in KaTeX. Keep it copy-pasteable.
- **params**: every variable referenced in the formula, marked `sidebar` / `derived` / `constant`. For constants, pull the named export from `lib/simulator.ts` (e.g. `BUFFER_PCT_BASE`) and note its value.
- **definitions**: 2–4 entries. Define jargon (LIF, P95, mercenary capital, etc.) AND any term in the formula a non-quant might miss. Reach for tables (like the Beta presets) when intuition is hard.
- **impact (health / sustainability / profitability)**: one sentence each. Health = "does this break?". Sustainability = "is this maintainable?". Profitability = "what's the yield/cost lever?".
- **workedExample** (optional, KPI-only): include for non-obvious chains (Section 3 candidates: `daysToTarget`, `totalIncentiveSpend`, `leverageLoopAPY`).

Tone callout from PR #3 review: when a slider's intuition is non-obvious (α/β was the example), lead the tooltip with a directional verb ("pulls TOWARD / AWAY") and anchor with the default value's interpretation.

---

## Gotchas

- **`leverageLoopAPY` sign**: validation-report open-question #1 is resolved. Code uses `iTRY − borrow × (1 + TRYDepreciation)`. Don't relitigate; just cite the resolution in the help copy.
- **`expectedTRYDepreciation_annual` and `competingAPY`** are hardcoded constants in `useSimulator.ts` (`DEFAULT_TRY_DEPRECIATION_ANNUAL = 0.30`, `COMPETING_STABLECOIN_APY = 0.05`). Document them as policy dials in the `leverageLoopAPY` and `retentionAfterIncentives` `params` arrays.
- **`netSupplyAPY` subtracts mgmt fee, not multiplies** — report #2 entry #10. Don't write `× (1 − managementFee)` by reflex.
- **`lockPeriodDays`** isn't wired into a calculation today. Document what it WOULD control (lock-period bonuses, exit fees) and flag that it currently has no computational effect — surface it as an "exposed for spec completeness; functional wiring in a later PR" note.

---

## Done criteria

- [ ] `lib/help/content/strategy.ts` exists with `STRATEGY_PARAMS`, `STRATEGY_KPIS`, `STRATEGY_CHARTS` exports.
- [ ] `lib/help/registry.ts` overlays all three.
- [ ] `app/help/strategy/page.tsx` uses shared `KpiEntry` / `ChartEntry`.
- [ ] New regression test block in `tests/help/registry.test.ts` (3 cases mirroring PR #3 / #4).
- [ ] `npx tsc --noEmit` + `npm run lint` + `npm test` + `npm run test:e2e` + `npm run build` all pass.
- [ ] Draft PR open with body that lists the 9 KPIs + 6 sidebar params populated, links the validation report for the formulas, and notes that no simulator code changed.

After review and any copy iteration: mark ready, squash-merge, branch off main for **roadmap PR #6 (Liquidation content)**.

---

## Where to start (concrete first action)

```bash
cd /Users/gokhanseckin/claude-projects/Brix-Morpho
git fetch && git checkout main && git pull
git checkout -b claude/pr5-strategy-content

# Then in your worktree of choice — fresh or reuse:
code lib/help/content/fxRisk.ts          # template
code lib/help/content/strategy.ts        # new file you'll write
code lib/simulator.ts                    # formulas you're documenting (lines 402–428)
```

First file to write: `lib/help/content/strategy.ts`. Copy `fxRisk.ts`, rename the exports, blank out the body, then fill KPI-by-KPI using `computeStrategy` as the source of truth.
