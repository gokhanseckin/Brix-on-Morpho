# Development Log

This project was built phase-by-phase from a written design spec and implementation plan. Each commit is intentionally small and TDD-driven where the work was math-heavy.

- Spec: [`docs/superpowers/specs/2026-05-19-brix-morpho-simulator-design.md`](docs/superpowers/specs/2026-05-19-brix-morpho-simulator-design.md)
- Plan: [`docs/superpowers/plans/2026-05-19-brix-morpho-simulator.md`](docs/superpowers/plans/2026-05-19-brix-morpho-simulator.md)

## Phase summary

| Phase | What landed | Tests | Commits |
|---|---|---|---|
| **A. Scaffold** | Next.js 14 (App Router) + TypeScript (strict) + Tailwind + Vitest; static export config | — | 3 |
| **B. FX data** | `scripts/build-fx-data.ts` (Yahoo `TRY=X` fallback after FRED discontinued `DEXTUUS`); `lib/fxData.ts` accessor | 3 | 2 |
| **C. Math primitives** | `lib/morphoMath.ts`: `LIF`, `healthFactor`, `adaptiveCurveIRM` (two-exponential, hoisted constants), `witryUSD` with iTRY yield accrual | 12 | 5 |
| **D. FX path models** | `lib/fxModel.ts`: bootstrap, block bootstrap, GBM, Merton jump-diffusion; percentiles + rolling drawdown; deterministic under seed (`lib/rng.ts`) | 9 | 6 |
| **E. Types** | `types/simulator.ts`: `SidebarInputs`, `SimulatorOutputs`, `GOV_LLTVS`, all literal unions | — | 1 |
| **F. Simulator logic** | `lib/simulator.ts`: liquidity-need, β-LTV sampling, liquidator profit + slippage, bad-debt cascade, fixed-point LLTV derivation, strategy, vault JSON | 14 | 7 |
| **G. Web Worker** | `lib/simulation.worker.ts` (Comlink); `lib/useSimulationWorker.ts` lifecycle hook | — | 2 |
| **H. State** | `lib/useUrlState.ts` (nuqs URL sync, 22 fields); `lib/useSimulator.ts` composite hook | — | 2 |
| **I. UI** | Sticky-sidebar shell, full Sidebar, 5 section components (LiquidityNeed, FXRisk, LiquidityStrategy, LiquidationDesign, VaultRecommendations), README | — | 8 |
| **J. Verification** | `tests/sanity.test.ts`; Playwright smoke (`tests-e2e/smoke.spec.ts`) + perf (`tests-e2e/perf.spec.ts`) | 2 + 4 e2e | 3 |
| **Final fixes** | `borrowAPY` from IRM (not hardcoded), depth-sensitive slippage in LLTV derivation, pre-liquidation cascade implemented, perf ceiling tightened, spec LIF numbers corrected | +1 | 6 |
| **Total** | | **43 unit + 4 e2e** | **47** |

## Two plan/spec corrections surfaced by TDD

These were caught when the failing tests didn't match the formula:

1. **LIF anchor numbers.** Plan v1 cited `LIF(0.77) ≈ 1.0837`, `LIF(0.86) ≈ 1.0457`, `LIF(0.915) ≈ 1.0289`. With β = 0.3 and the canonical Morpho formula `LIF = min(1.15, 1/(β·LLTV + (1−β)))`, the correct values are **1.0741 / 1.0438 / 1.0262**. Plan and spec were patched (`b39bdb0`, `f794b7d`); test fixtures match the formula.
2. **Liquidator profit-cliff formula.** Plan v1 said profit ≈ 0 at `slip = LIF − 1`. The correct derivation: `revenue = debt × LIF × (1 − slip)`, so `profit = 0 ⇔ slip = 1 − 1/LIF`. Test and plan corrected.

## Three demo-affecting bugs surfaced by the final whole-implementation review

All fixed in `524eaf0..b2df52c`:

1. **`borrowAPY` was hardcoded at 0.04** in `useSimulator.ts`, ignoring `targetUtilization`. Replaced with `adaptiveCurveIRM(s.targetUtilization, rTarget)` so Section 3 supply gauges reflect the actual IRM.
2. **LLTV derivation was insensitive to pool depth.** Replaced the hardcoded `slippageEstimate = 0.02` with `slippage(p95LiquidationSize, poolDepth_USD)`, so the recommendation in Section 5 reacts to the `wiTRY/USDM pool depth` slider — restoring the demo story that ties Sections 4 and 5 together.
3. **Pre-liquidation toggle was a UI-only no-op.** `simulateBadDebt` accepted `preLiquidationEnabled` but never read it. The cascade now closes 50% of the position at `preLIF₁ = 1.01` when LTV crosses `LLTV − 0.05`. Regression test pins a deterministic improvement (64,333 → 47,969 USD on the test path).

## Verification anchors (from spec §Verification Plan)

| # | Anchor | Test |
|---|---|---|
| 1 | LIF values match Morpho doc table | `tests/morphoMath.test.ts` |
| 2 | `healthFactor` boundary cases | `tests/morphoMath.test.ts` |
| 3 | `adaptiveCurveIRM(0/0.9/1.0)` anchors | `tests/morphoMath.test.ts` |
| 4 | Bootstrap reproducibility under seed | `tests/fxModel.test.ts` |
| 5 | GBM convergence to S₀·exp(μT) | `tests/fxModel.test.ts` |
| 6 | Slippage `L=2, D=98 → 0.02` | `tests/simulator.test.ts` |
| 7 | requiredUSDM ≈ $3.3M at canonical inputs | `tests/sanity.test.ts` |
| 8 | Annualized σ in plausible range | `tests/sanity.test.ts` |
| 10 | Liquidator profit cliff at `slip = 1 − 1/LIF` | `tests/simulator.test.ts` |
| 11–14 | App loads, sections render, LLTV reactivity, share-link round-trip | `tests-e2e/smoke.spec.ts` |
| Perf | Monte Carlo `1000 × 90` under budget | `tests-e2e/perf.spec.ts` |

## Performance

Default Monte Carlo (1000 paths × 90 days) measured end-to-end (navigation → first KPI): **~1.9–2.9 s** on an Apple-silicon laptop. The worker run alone is a strict subset. CI ceiling: 6 s.

## Known acceptable deviations from the spec

- Section 4 heatmap is a **visual heuristic** rather than a live `simulateBadDebt` grid recompute (per the plan's perf escape hatch).
- Pre-liquidation A/B comparison shows the **active** scenario only; toggle the sidebar to compare.
- Auto-deleverage cascade closes a **fixed 50%** at the safe-end bonus (`preLIF₁ = 1.01`) rather than continuously interpolating between `preLCF₁/preLCF₂` and `preLIF₁/preLIF₂`. Captures the spec's intent (smaller bonus while position is still healthy) without the full continuous schedule.
- `iTRYYieldAnnual` default is 38% (placeholder). Open question for the Brix team.
