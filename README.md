# Brix · wiTRY → USDM Market Simulator

A purely client-side, static-export Next.js app for pre-launch parameter calibration of the **Brix wiTRY → USDM lending market** on a Morpho Blue fork (MegaETH). Simulates USDM liquidity need, USD/TRY FX risk, supplier/borrower strategy, liquidator economics + bad debt, and produces a deployment-ready vault JSON.

**See [`CHANGELOG.md`](CHANGELOG.md) for the phase-by-phase development log** (47 commits, 43 unit tests + 4 Playwright e2e, with notes on three demo-affecting bugs caught in final review and two numerical inconsistencies caught by TDD).

## Run

```bash
npm install                # install dependencies
npm run fx:build           # (optional) refresh lib/usdtryData.json from market data
npm test                   # vitest unit + sanity tests
npm run lint               # eslint
npm run dev                # http://localhost:3000
npm run build              # static export to out/
```

All state lives in the URL query string (via `nuqs`); the **Copy share link** button in the sidebar copies the full scenario. Monte Carlo runs in a Web Worker.

## Architecture (quick tour)

- `app/page.tsx` — grid shell, sticky sidebar, 5 scrollable sections.
- `app/components/Sidebar.tsx` — every parameter, URL-synced.
- `app/components/sections/*.tsx` — one section per output: LiquidityNeed, FXRisk, LiquidityStrategy, LiquidationDesign, VaultRecommendations.
- `lib/morphoMath.ts` — LIF, adaptive-curve IRM, health factor, wiTRY-per-iTRY accrual.
- `lib/fxModel.ts` — bootstrap / block-bootstrap / GBM / GBM+Jumps / scenario path generators + percentile + drawdown helpers.
- `lib/simulator.ts` — pure calculation primitives (liquidity need, liquidator profit, bad-debt cascade, fixed-point LLTV derivation, strategy & vault JSON).
- `lib/simulation.worker.ts` — Comlink-wrapped worker entry; consumes `SidebarInputs` + returns window, runs the path simulator + bad-debt cascade.
- `lib/useUrlState.ts` / `lib/useSimulator.ts` — state + composite hook consumed by every section.
- `lib/usdtryData.json` — embedded daily USD/TRY history.

## Data source

The historical USD/TRY series is sourced from **Yahoo Finance (`TRY=X`)** rather than the FRED `DEXTUUS` series referenced in the original design document — FRED discontinued `DEXTUUS` in late 2023. `TRY=X` is the same daily mid-rate concept and remains continuously updated. `scripts/build-fx-data.ts` fetches the latest history and writes `lib/usdtryData.json`.

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

These are documented as known excluded risks so users do not over-trust the output.

## Open Questions for the Brix Team

These were flagged in the original design spec and remain unresolved. Each ships with a default assumption baked into the simulator; users should confirm before deployment.

1. **Second collateral asset?** Should the simulator include a second collateral asset (e.g. iTRY directly, not just wiTRY)? *Default assumption: wiTRY-only, matching the v1 launch scope.*
2. **USDM exact token?** Confirm USDM exact token: is it MegaUSD or a different MegaETH-native USD? Affects oracle setup details. *Default assumption: a generic 18-decimal USD-pegged stablecoin on MegaETH.*
3. **wiTRY/USDM secondary market?** Is there a published wiTRY/USDM secondary market candidate (Uniswap-style DEX on MegaETH)? If so, what's its current depth? *Default assumption: a sidebar-tunable constant-product pool with default depth $500k.*
4. **iTRYYieldAnnual default?** Confirm `iTRYYieldAnnual` default. 38% is a rough estimate of Turkish MMF yields; should be calibrated against the actual fund. *Default assumption: 38% annual.*
5. **Leverage-loop simulation?** Should the simulator include leverage-loop simulation for borrowers, not just a viability check? *Default assumption: viability check only (full leverage-loop path simulation deferred — out of scope for v1).*

## Performance

Default Monte Carlo (1000 paths × 90 days) completes in ~1900 ms end-to-end on an Apple-silicon laptop, measured as time-to-first-KPI from navigation. This includes navigation, hydration, and worker boot; the worker run itself is a strict subset of that budget. Measured via `tests-e2e/perf.spec.ts`.

## Caveats

- All charts and numbers are **scenario projections**, not production risk parameters. Production parameters require the multi-stakeholder sign-off documented in the deployment runbook.
- Performance budget: worker should complete < 3 s for `pathCount=1000`, `horizon=90` on a modern laptop. The LLTV × pool-depth heatmap in Section 4 uses a heuristic rather than a live grid-recompute to stay within the main-thread 100 ms reactive budget.
- No tracking, no analytics, no external assets at runtime: the static `out/` directory is deployable to any host.
