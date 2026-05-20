# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pre-launch parameter calibration simulator for the **Brix wiTRY → USDM** lending market on a Morpho Blue fork (MegaETH). Purely client-side Next.js 14 with static export (`output: 'export'`) — no server runtime, no analytics, no external assets at runtime. All state lives in the URL query string via `nuqs`; Monte Carlo runs in a Web Worker via Comlink.

## Commands

```bash
npm run dev                          # Next dev server (http://localhost:3000)
npm run build                        # Static export to out/
npm run lint                         # next lint
npm test                             # vitest run (unit + sanity)
npm run test:watch                   # vitest watch
npx vitest run tests/simulator.test.ts          # single test file
npx vitest run -t "computeLiquidityNeed"        # single test by name
npm run test:e2e                     # Playwright (auto-starts dev server)
npx playwright test tests-e2e/perf.spec.ts      # single e2e file
npm run fx:build                     # refresh lib/usdtryData.json from Yahoo TRY=X
```

TS path alias: `@/*` → repo root (e.g. `@/types/simulator`).

## Architecture

The app is a single page (`app/page.tsx`) with a sticky `Sidebar` of inputs and 5 output sections. **All sections derive from one composite hook**, `lib/useSimulator.ts`, which is the only orchestration layer.

Data flow:

```
URL ──nuqs──> useUrlState ──> useSimulator ──┬──> useSimulationWorker (Comlink → simulation.worker.ts)
                                              │       └─ FX path generation + bad-debt cascade (heavy)
                                              ├──> computeLiquidityNeed / computeStrategy / deriveRecommendedLLTV (sync)
                                              └──> buildVaultConfigJson
                                                       ↓
                                              5× <Section/> components (read-only)
```

Key constraint: **sections do not call simulator primitives directly**; they consume `useSimulator()` output. Adding a new derived quantity means extending `useSimulator` (and usually `types/simulator.ts`), not adding logic in section components.

### Layer responsibilities

- `lib/simulator.ts` — pure sync primitives (liquidity need, IRM curve, strategy APYs, LLTV derivation, vault JSON, liquidator min/max profit, slippage). No React, no async.
- `lib/morphoMath.ts` — Morpho Blue formulas: `LIF(lltv)`, `adaptiveCurveIRM`, `healthFactor`, wiTRY-per-iTRY accrual. Treat these as canonical; tests in `tests/morphoMath.test.ts` lock the numerics.
- `lib/fxModel.ts` — USD/TRY path generators: `bootstrap`, `blockBootstrap`, `GBM`, `GBM+Jumps`, `Scenario`. Plus percentile and drawdown helpers.
- `lib/fxData.ts` + `lib/usdtryData.json` — embedded daily history (Yahoo `TRY=X`, see README on why not FRED `DEXTUUS`). `windowRows(rows, years)` slices history; `dailyLogReturns` for the resampling kernel.
- `lib/rng.ts` — `seedrandom`-backed `createRng(seed)` + `gauss`. All stochastic code MUST go through this so runs are reproducible from the `seed` sidebar input.
- `lib/simulation.worker.ts` — Comlink worker entry. Inputs: `{ inputs: SidebarInputs, returnsWindow }`. Outputs: papercentile bands, position-underwater curve, 3-day max drawdown, bad-debt cascade samples. Heavy work (path × horizon × cascade) lives here to keep main thread reactive.
- `lib/useSimulationWorker.ts` — thin React wrapper around the worker; debounces and exposes `{ running, result, run }`.
- `lib/useUrlState.ts` — `nuqs`-backed sidebar state ↔ URL serialization. The shape mirrors `SidebarInputs` exactly.
- `types/simulator.ts` — single source of truth for input/output shapes and `GOV_LLTVS` (the 8 fixed Morpho-governance LLTV tiers).

### Section components (`app/components/sections/`)

Each consumes one slice of `useSimulator()` output. Order in `page.tsx`:

1. `LiquidityNeed` — IRM curve + required USDM + LLTV sensitivity
2. `FXRisk` — Monte Carlo bands, drawdowns, underwater positions
3. `LiquidityStrategy` — supplier/borrower APY breakdown, incentive economics
4. `LiquidationDesign` — liquidator profit window, bad-debt P95, pre-liquidation params
5. `VaultRecommendations` — recommended LLTV (snapped to `GOV_LLTVS`), risk tier, deploy-ready JSON

## Testing conventions

- **Unit (`tests/`, vitest + jsdom)**: every `lib/*.ts` module has a sibling test file. Numerics use tight tolerances (`toBeCloseTo(_, 6)` is typical for Morpho math). `tests/sanity.test.ts` is a coarse end-to-end through `useSimulator`-shaped inputs — keep it green when changing primitives.
- **E2E (`tests-e2e/`, Playwright)**: `smoke.spec.ts` walks the UI; `perf.spec.ts` enforces a hard ceiling on Monte Carlo time-to-first-KPI (currently 6 s for 1000 paths × 90 days). If you change worker work, expect this to move — update the ceiling in the same PR.

When adding stochastic logic, write the test against a fixed `seed` and lock the expected percentile to `toBeCloseTo` with explicit tolerance — RNG paths drift across Node versions otherwise.

## TypeScript

`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are on. Indexed access returns `T | undefined` — handle it (the `quantile` helper in `useSimulator.ts` is the canonical pattern: `?? 0`).

## Domain gotchas

- `LIF(lltv)` is non-linear in LLTV; never linearly interpolate it. Tests in `morphoMath.test.ts` pin the values per `GOV_LLTVS` tier.
- `GOV_LLTVS` is fixed by Morpho governance — recommended LLTVs must be **snapped** via `snapToGovernanceLLTV`, not used raw.
- `borrowAPY` comes from a static `adaptiveCurveIRM(targetUtilization, rTarget=0.04)` evaluation, NOT from the worker. It's a `useMemo` dep — when adding strategy inputs that affect it, update the dep list (this caused a real bug, see `b2df52c`).
- Pre-liquidation auto-deleverage runs inside the bad-debt cascade in the worker; toggled by `preLiquidationEnabled`. Cascade samples are what feed P95 bad debt.

## Out of scope (don't add without explicit ask)

MEV, LayerZero failure, custodian risk, regulatory freeze, smart-contract bugs, gas dynamics, multi-market vault allocation, leverage-loop path simulation (only a viability check exists). See README "Out of Scope" and "Open Questions" for the canonical list.
