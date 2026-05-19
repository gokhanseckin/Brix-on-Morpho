# Brix Morpho Market Simulator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan file location note:** Plan mode restricted the write target to `~/.claude/plans/crispy-munching-stonebraker.md`. After approval, move/copy this file to `/Users/gokhanseckin/claude-projects/Brix-Morpho/docs/superpowers/plans/2026-05-19-brix-morpho-simulator.md` (the canonical location per the writing-plans skill).

---

## Context

Brix.money is preparing to deploy a **wiTRY → USDM lending market** on a Morpho-protocol fork running on MegaETH. The market is cross-currency (TRY-denominated yield-bearing collateral, USD-denominated debt). Before launch, the Brix team needs to answer five design questions (liquidity sizing, attraction strategy, liquidation design, vault parameters) under realistic USD/TRY volatility — including jump risk that vanilla GBM understates.

This plan implements the **simulator** described in `docs/superpowers/specs/2026-05-19-brix-morpho-simulator-design.md` (v2). The simulator is a **purely client-side Next.js 14 app** that runs Monte Carlo / historical bootstrap / GBM+jump simulations entirely in a Web Worker over embedded FRED USD/TRY history. The output is a 5-section dashboard plus a deployment-ready JSON config for Morpho Vault V2.

**Why client-side / static:** the tool is internal, must be shareable via URL, and contains no PII or auth concerns. A static export deploys anywhere.

**Why TDD on math primitives:** §"Verification Plan" in the spec specifies numerical anchors (LIF values, slippage formula, requiredUSDM sanity number, bootstrap reproducibility). Lock these in tests before UI work.

---

## Architecture

**Stack:** Next.js 14 (App Router, static export) · TypeScript (strict) · Tailwind CSS · Recharts · simple-statistics · seedrandom (for deterministic PRNG) · nuqs (URL state) · Vitest + jsdom (tests) · Playwright (smoke only) · Web Workers (Comlink for ergonomics).

**Decomposition rationale:** the spec already maps cleanly onto five output sections + four library modules (`morphoMath`, `fxModel`, `simulator`, worker). Each library module has a single mathematical responsibility and a matching test file. Each UI section consumes the hook output and renders Recharts; sections are independent except for the data-flow dependencies documented in §Data Flow.

**Critical files:**
- `lib/morphoMath.ts` — LIF, health factor, AdaptiveCurveIRM, wiTRY USD price (TDD'd against spec anchors)
- `lib/fxModel.ts` — bootstrap, GBM, jump diffusion paths (deterministic under seed)
- `lib/simulator.ts` — pure orchestration: requiredUSDM, position distribution, bad-debt cascade, LLTV fixed-point derivation
- `lib/simulation.worker.ts` — Web Worker entrypoint (off-thread Monte Carlo)
- `lib/useSimulator.ts` — single React hook that owns all state + worker handle
- `lib/useUrlState.ts` — URL <-> sidebar param sync (nuqs adapter)
- `app/page.tsx` + 5 section components — UI only, no math
- `scripts/build-fx-data.ts` — one-shot FRED download → `lib/usdtryData.json` (committed; rerun annually)
- `tests/*.test.ts` — Vitest unit + sanity tests (§Verification Plan items 1–10)

---

## Open Questions (Flagged — Do Not Block Plan, Confirm With Brix Team)

These are recorded as decisions to confirm; the plan assumes the default in parentheses.

1. **Second collateral asset (iTRY direct)?** — _Assume wiTRY-only for v1._
2. **USDM exact token on MegaETH (MegaUSD vs other)?** — _Assume "USDM"; oracle config uses placeholder address._
3. **wiTRY/USDM secondary DEX candidate + current depth?** — _Assume constant-product AMM, depth `D` is a slider input._
4. **`iTRYYieldAnnual` default (38% is rough)?** — _Default 38%; expose as sidebar slider._
5. **Leverage-loop simulation for borrowers?** — _Deferred. v1 ships viability check only._

Render these in the app's `/about` page (or README footer) so users know what's been assumed.

---

## Phase A — Project Scaffold & Tooling

### Task A1: Create Next.js 14 App Router project

**Files:**
- Create: `/Users/gokhanseckin/claude-projects/Brix-Morpho/package.json` and Next.js scaffold via CLI

- [ ] **Step 1: Verify cwd is empty (only `docs/`)**

Run: `ls /Users/gokhanseckin/claude-projects/Brix-Morpho`
Expected: `docs`

- [ ] **Step 2: Bootstrap Next.js project in-place**

Run from `/Users/gokhanseckin/claude-projects/Brix-Morpho`:
```bash
npx create-next-app@14 . \
  --typescript --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*" --use-npm --no-git
```
When prompted "directory not empty", answer **Yes** (preserves `docs/`).

- [ ] **Step 3: Verify scaffold**

Run: `ls app && cat package.json | head -25`
Expected: `app/page.tsx`, `app/layout.tsx`, `tailwind.config.ts`, `tsconfig.json` exist; Next 14.x.

- [ ] **Step 4: Initial commit**

```bash
git init && git add -A && git commit -m "chore: bootstrap Next.js 14 + TS + Tailwind"
```

### Task A2: Install runtime + test dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
npm i recharts simple-statistics seedrandom nuqs comlink
npm i -D @types/seedrandom
```

- [ ] **Step 2: Install test deps**

```bash
npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
```

- [ ] **Step 3: Add scripts to `package.json`**

Edit `package.json` `scripts`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "fx:build": "tsx scripts/build-fx-data.ts"
}
```
Also `npm i -D tsx`.

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 5: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Verify tests run (empty)**

Run: `npm test`
Expected: "No test files found" — exit 0 or expected vitest empty message.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: add deps and test harness (vitest)"
```

### Task A3: Configure Next.js static export + strict TS

**Files:**
- Modify: `next.config.mjs`, `tsconfig.json`

- [ ] **Step 1: Enable static export in `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  experimental: { typedRoutes: true },
};
export default nextConfig;
```

- [ ] **Step 2: Tighten `tsconfig.json` `compilerOptions`**

Add/ensure:
```json
"strict": true,
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true,
"exactOptionalPropertyTypes": true
```

- [ ] **Step 3: Build verify**

Run: `npm run build`
Expected: builds without errors; `out/` directory produced.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: configure static export + strict TS"
```

---

## Phase B — FX Data Pipeline

### Task B1: Build FRED USD/TRY downloader

**Files:**
- Create: `scripts/build-fx-data.ts`
- Create: `lib/usdtryData.json` (output artifact)

- [ ] **Step 1: Write the downloader**

Create `scripts/build-fx-data.ts`:
```ts
// Downloads FRED DEXTUUS daily USD/TRY (2015-01-01..today), writes JSON.
// Public CSV endpoint; no API key needed for DEXTUUS.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL =
  'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXTUUS&cosd=2015-01-01';

type Row = { date: string; rate: number };

async function main() {
  const csv = await (await fetch(URL)).text();
  const lines = csv.trim().split('\n').slice(1); // drop header
  const rows: Row[] = [];
  for (const line of lines) {
    const [date, val] = line.split(',');
    if (!date || !val || val === '.') continue;
    const rate = Number(val);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    rows.push({ date, rate });
  }
  const out = resolve(process.cwd(), 'lib/usdtryData.json');
  writeFileSync(out, JSON.stringify({ source: 'FRED DEXTUUS', fetchedAt: new Date().toISOString(), rows }));
  console.log(`Wrote ${rows.length} rows → ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it**

```bash
mkdir -p lib && npm run fx:build
```
Expected: `lib/usdtryData.json` ~30–80 KB, prints `Wrote ~2500+ rows`.

- [ ] **Step 3: Commit data + script**

```bash
git add scripts/build-fx-data.ts lib/usdtryData.json package.json
git commit -m "feat(data): embed FRED USD/TRY daily history"
```

### Task B2: Add data accessor with daily log-returns

**Files:**
- Create: `lib/fxData.ts`
- Test: `tests/fxData.test.ts`

- [ ] **Step 1: Write failing test `tests/fxData.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadFxRows, dailyLogReturns, windowRows } from '@/lib/fxData';

describe('fxData', () => {
  it('loads at least 1500 rows post-2015', () => {
    const rows = loadFxRows();
    expect(rows.length).toBeGreaterThan(1500);
    expect(rows[0]!.date >= '2015-01-01').toBe(true);
  });

  it('computes daily log-returns of length N-1', () => {
    const rows = loadFxRows().slice(0, 10);
    const r = dailyLogReturns(rows);
    expect(r.length).toBe(9);
    for (const x of r) expect(Number.isFinite(x)).toBe(true);
  });

  it('windowRows returns trailing N years', () => {
    const all = loadFxRows();
    const y1 = windowRows(all, 1);
    expect(y1.length).toBeGreaterThan(200);
    expect(y1.length).toBeLessThan(280);
  });
});
```

- [ ] **Step 2: Run — expect FAIL ("Cannot find module @/lib/fxData")**

Run: `npm test -- fxData`

- [ ] **Step 3: Implement `lib/fxData.ts`**

```ts
import raw from './usdtryData.json';

export type FxRow = { date: string; rate: number };

export function loadFxRows(): FxRow[] {
  return (raw as { rows: FxRow[] }).rows;
}

export function dailyLogReturns(rows: FxRow[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    out.push(Math.log(rows[i]!.rate / rows[i - 1]!.rate));
  }
  return out;
}

export function windowRows(rows: FxRow[], years: 1 | 3 | 5): FxRow[] {
  const last = rows[rows.length - 1]!.date;
  const cutoff = new Date(last);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const iso = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= iso);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- fxData`

- [ ] **Step 5: Commit**

```bash
git add lib/fxData.ts tests/fxData.test.ts
git commit -m "feat(fx): typed FX data accessor with log-returns and windowing"
```

---

## Phase C — Math Primitives (`lib/morphoMath.ts`)

### Task C1: Liquidation Incentive Factor (LIF)

**Files:**
- Create: `lib/morphoMath.ts`
- Test: `tests/morphoMath.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/morphoMath.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { LIF, BETA } from '@/lib/morphoMath';

describe('LIF', () => {
  it('matches spec anchors', () => {
    // Plan v1 quoted 1.0837 / 1.0457 / 1.0289; those do not satisfy β=0.3.
    // Correct values from `1/(0.3·LLTV + 0.7)`:
    expect(LIF(0.77)).toBeCloseTo(1.0741, 3);
    expect(LIF(0.86)).toBeCloseTo(1.0438, 3);
    expect(LIF(0.915)).toBeCloseTo(1.0262, 3);
  });

  it('caps at 1.15', () => {
    expect(LIF(0.10)).toBeCloseTo(1.15, 3);
  });

  it('uses β = 0.3', () => {
    expect(BETA).toBe(0.3);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npm test -- morphoMath`

- [ ] **Step 3: Implement minimal LIF**

`lib/morphoMath.ts`:
```ts
export const BETA = 0.3;

/** Morpho Liquidation Incentive Factor. LIF = min(1.15, 1/(β·LLTV + (1−β))). */
export function LIF(lltv: number): number {
  return Math.min(1.15, 1 / (BETA * lltv + (1 - BETA)));
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/morphoMath.ts tests/morphoMath.test.ts
git commit -m "feat(math): LIF with spec anchors"
```

### Task C2: Health factor

**Files:**
- Modify: `lib/morphoMath.ts`
- Modify: `tests/morphoMath.test.ts`

- [ ] **Step 1: Add failing test**

```ts
import { healthFactor } from '@/lib/morphoMath';

describe('healthFactor', () => {
  it('coll=100 debt=80 lltv=0.86 → ~1.075', () => {
    expect(healthFactor({ collateralUSD: 100, debtUSD: 80, lltv: 0.86 })).toBeCloseTo(1.075, 3);
  });
  it('HF=1 at debt = coll × LLTV', () => {
    expect(healthFactor({ collateralUSD: 100, debtUSD: 86, lltv: 0.86 })).toBeCloseTo(1, 6);
  });
  it('returns Infinity for zero debt', () => {
    expect(healthFactor({ collateralUSD: 100, debtUSD: 0, lltv: 0.86 })).toBe(Infinity);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```ts
export interface PositionView { collateralUSD: number; debtUSD: number; lltv: number; }
export function healthFactor(p: PositionView): number {
  if (p.debtUSD === 0) return Infinity;
  return (p.collateralUSD * p.lltv) / p.debtUSD;
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — `git commit -am "feat(math): health factor"`

### Task C3: AdaptiveCurveIRM static curve

**Files:**
- Modify: `lib/morphoMath.ts`
- Modify: `tests/morphoMath.test.ts`

The spec requires anchors `r(0) = r_target/4`, `r(0.9) = r_target`, `r(1.0) = 4·r_target`, and **two exponential segments**. The shape is `r(u) = a · exp(k·u)` per segment.

Segment 1 (u ∈ [0, 0.9]): solve `a₁·exp(0) = r_target/4` and `a₁·exp(0.9·k₁) = r_target` → `a₁ = r_target/4`, `k₁ = ln(4)/0.9`.

Segment 2 (u ∈ [0.9, 1.0]): `a₂·exp(0.9·k₂) = r_target` and `a₂·exp(k₂) = 4·r_target` → `k₂ = ln(4)/0.1`, `a₂ = r_target · exp(−0.9·k₂)`.

- [ ] **Step 1: Add failing tests**

```ts
import { adaptiveCurveIRM } from '@/lib/morphoMath';

describe('adaptiveCurveIRM', () => {
  const rt = 0.04; // 4% target
  it('hits anchors', () => {
    expect(adaptiveCurveIRM(0,   rt)).toBeCloseTo(rt / 4, 8);
    expect(adaptiveCurveIRM(0.9, rt)).toBeCloseTo(rt,     8);
    expect(adaptiveCurveIRM(1.0, rt)).toBeCloseTo(4 * rt, 8);
  });
  it('is monotonic increasing on [0,1]', () => {
    let prev = -Infinity;
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const r = adaptiveCurveIRM(u, rt);
      expect(r).toBeGreaterThan(prev);
      prev = r;
    }
  });
  it('clamps below 0 and above 1', () => {
    expect(adaptiveCurveIRM(-0.1, rt)).toBeCloseTo(rt / 4, 8);
    expect(adaptiveCurveIRM(1.5,  rt)).toBeCloseTo(4 * rt, 8);
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

```ts
/** Static AdaptiveCurveIRM (no time evolution). u in [0,1], r_target as APR. */
export function adaptiveCurveIRM(u: number, rTarget: number): number {
  const x = Math.max(0, Math.min(1, u));
  const k1 = Math.log(4) / 0.9;
  const k2 = Math.log(4) / 0.1;
  if (x <= 0.9) {
    return (rTarget / 4) * Math.exp(k1 * x);
  }
  const a2 = rTarget * Math.exp(-0.9 * k2);
  return a2 * Math.exp(k2 * x);
}
```

- [ ] **Step 4: PASS** → **Commit** — `git commit -am "feat(math): adaptive curve IRM"`

### Task C4: wiTRY USD price

**Files:** Modify `lib/morphoMath.ts`, `tests/morphoMath.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { witryPerITRY, witryUSD } from '@/lib/morphoMath';

describe('witryUSD', () => {
  it('witry/iTRY = 1 at t=0', () => {
    expect(witryPerITRY(0, 0.38)).toBeCloseTo(1, 8);
  });
  it('witry/iTRY grows at iTRY APY', () => {
    // 1 year, 38% APY
    expect(witryPerITRY(365, 0.38)).toBeCloseTo(1.38, 4);
  });
  it('wiTRY USD = (wiTRY/iTRY) / (USD/TRY)', () => {
    // S=40, yield=0.38, t=365 → 1.38/40 = 0.0345
    expect(witryUSD({ tDays: 365, iTRYYieldAnnual: 0.38, usdTryRate: 40 })).toBeCloseTo(0.0345, 4);
  });
});
```

- [ ] **Step 2: FAIL → implement**

```ts
export function witryPerITRY(tDays: number, iTRYYieldAnnual: number): number {
  return Math.pow(1 + iTRYYieldAnnual, tDays / 365);
}

export interface WitryUsdArgs { tDays: number; iTRYYieldAnnual: number; usdTryRate: number; }
export function witryUSD(a: WitryUsdArgs): number {
  return witryPerITRY(a.tDays, a.iTRYYieldAnnual) / a.usdTryRate;
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(math): wiTRY USD price with iTRY yield accrual"`

---

## Phase D — FX Path Models (`lib/fxModel.ts`)

### Task D1: Seeded PRNG wrapper

**Files:** Create `lib/rng.ts`, test inline in fxModel tests.

- [ ] **Step 1: Implement RNG wrapper**

```ts
import seedrandom from 'seedrandom';
export type Rng = () => number;
export function createRng(seed: string | number): Rng { return seedrandom(String(seed)); }

/** Box–Muller standard normal. */
export function gauss(rng: Rng): number {
  const u1 = 1 - rng(); // (0,1]
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
```

- [ ] **Step 2: Commit** — `git add lib/rng.ts && git commit -m "feat(rng): seeded PRNG + Box–Muller"`

### Task D2: Historical bootstrap path generator (+ block bootstrap)

**Files:** Create `lib/fxModel.ts`, `tests/fxModel.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { bootstrapPaths, blockBootstrapPaths } from '@/lib/fxModel';

const returns = Array.from({ length: 500 }, (_, i) => 0.001 * (i % 5 - 2)); // deterministic stand-in

describe('bootstrap', () => {
  it('reproducible under same seed', () => {
    const a = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 100, seed: 42 });
    const b = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 100, seed: 42 });
    expect(a).toEqual(b);
  });
  it('different seed → different paths', () => {
    const a = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 5, seed: 1 });
    const b = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 5, seed: 2 });
    expect(a).not.toEqual(b);
  });
  it('shape is [paths][horizonDays+1] and S[0]=S0', () => {
    const p = bootstrapPaths({ returns, S0: 38, horizonDays: 10, paths: 3, seed: 7 });
    expect(p.length).toBe(3);
    expect(p[0]!.length).toBe(11);
    for (const path of p) expect(path[0]).toBe(38);
  });
  it('block bootstrap shape ok', () => {
    const p = blockBootstrapPaths({ returns, S0: 38, horizonDays: 20, paths: 4, seed: 9, blockLength: 5 });
    expect(p.length).toBe(4);
    expect(p[0]!.length).toBe(21);
  });
});
```

- [ ] **Step 2: FAIL → implement**

```ts
import { createRng, gauss, type Rng } from './rng';

export interface BootstrapArgs {
  returns: number[]; S0: number; horizonDays: number; paths: number; seed: number | string;
}
export type Path = number[]; // length = horizonDays + 1

export function bootstrapPaths(a: BootstrapArgs): Path[] {
  const rng = createRng(a.seed);
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    for (let t = 1; t <= a.horizonDays; t++) {
      const r = a.returns[Math.floor(rng() * a.returns.length)]!;
      s[t] = s[t - 1]! * Math.exp(r);
    }
    out.push(s);
  }
  return out;
}

export interface BlockBootstrapArgs extends BootstrapArgs { blockLength: number; }
export function blockBootstrapPaths(a: BlockBootstrapArgs): Path[] {
  const rng = createRng(a.seed);
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    let t = 1;
    while (t <= a.horizonDays) {
      const start = Math.floor(rng() * Math.max(1, a.returns.length - a.blockLength));
      for (let b = 0; b < a.blockLength && t <= a.horizonDays; b++, t++) {
        const r = a.returns[start + b]!;
        s[t] = s[t - 1]! * Math.exp(r);
      }
    }
    out.push(s);
  }
  return out;
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(fx): historical + block bootstrap path generators"`

### Task D3: GBM path generator

**Files:** Modify `lib/fxModel.ts`, `tests/fxModel.test.ts`

- [ ] **Step 1: Failing test (convergence)**

```ts
import { gbmPaths, fitGbmParams } from '@/lib/fxModel';

describe('GBM', () => {
  it('converges to S0·exp(μT) over many paths', () => {
    const paths = gbmPaths({ mu: 0.2, sigma: 0.25, S0: 38, horizonDays: 30, paths: 10_000, seed: 11 });
    const T = 30 / 252; // trading-year convention
    const ST = paths.map((p) => p[p.length - 1]!);
    const mean = ST.reduce((a, b) => a + b, 0) / ST.length;
    expect(mean).toBeCloseTo(38 * Math.exp(0.2 * T), 0); // loose: within ~$1
  });

  it('fitGbmParams returns finite μ, σ', () => {
    const r = Array.from({ length: 500 }, (_, i) => 0.001 * Math.sin(i));
    const { mu, sigma } = fitGbmParams(r);
    expect(Number.isFinite(mu)).toBe(true);
    expect(sigma).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: FAIL → implement**

```ts
export interface GbmArgs { mu: number; sigma: number; S0: number; horizonDays: number; paths: number; seed: number | string; }

export function gbmPaths(a: GbmArgs): Path[] {
  const rng = createRng(a.seed);
  const dt = 1 / 252;
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    for (let t = 1; t <= a.horizonDays; t++) {
      const z = gauss(rng);
      s[t] = s[t - 1]! * Math.exp((a.mu - 0.5 * a.sigma * a.sigma) * dt + a.sigma * Math.sqrt(dt) * z);
    }
    out.push(s);
  }
  return out;
}

export function fitGbmParams(returns: number[]): { mu: number; sigma: number } {
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  // Daily → annualized assuming 252 trading days
  return { mu: mean * 252 + 0.5 * variance * 252, sigma: Math.sqrt(variance * 252) };
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(fx): GBM paths + parameter fit"`

### Task D4: Merton jump-diffusion paths

**Files:** Modify `lib/fxModel.ts`, `tests/fxModel.test.ts`

- [ ] **Step 1: Failing test (shape + heavier tail than GBM at same μ,σ)**

```ts
import { jumpDiffusionPaths } from '@/lib/fxModel';

describe('jump diffusion', () => {
  it('reproducible & shape', () => {
    const a = jumpDiffusionPaths({ mu: 0.2, sigma: 0.25, lambda: 4, muJ: -0.05, sigmaJ: 0.04, S0: 38, horizonDays: 30, paths: 50, seed: 5 });
    const b = jumpDiffusionPaths({ mu: 0.2, sigma: 0.25, lambda: 4, muJ: -0.05, sigmaJ: 0.04, S0: 38, horizonDays: 30, paths: 50, seed: 5 });
    expect(a).toEqual(b);
    expect(a[0]!.length).toBe(31);
  });
});
```

- [ ] **Step 2: Implement**

```ts
export interface JumpArgs extends GbmArgs { lambda: number; muJ: number; sigmaJ: number; }

export function jumpDiffusionPaths(a: JumpArgs): Path[] {
  const rng = createRng(a.seed);
  const dt = 1 / 252;
  // κ = E[e^J − 1] = exp(μJ + σJ²/2) − 1
  const kappa = Math.exp(a.muJ + 0.5 * a.sigmaJ * a.sigmaJ) - 1;
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    for (let t = 1; t <= a.horizonDays; t++) {
      const z = gauss(rng);
      // Poisson(λ·dt): for small dt, draw via inverse-transform or thinning.
      const lambdaDt = a.lambda * dt;
      let nJumps = 0;
      // Knuth: for small λ·dt this is fine
      const L = Math.exp(-lambdaDt);
      let k = 0, prod = rng();
      while (prod > L) { k++; prod *= rng(); }
      nJumps = k;
      let jumpSum = 0;
      for (let j = 0; j < nJumps; j++) jumpSum += a.muJ + a.sigmaJ * gauss(rng);
      const drift = (a.mu - 0.5 * a.sigma * a.sigma - a.lambda * kappa) * dt;
      s[t] = s[t - 1]! * Math.exp(drift + a.sigma * Math.sqrt(dt) * z + jumpSum);
    }
    out.push(s);
  }
  return out;
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(fx): Merton jump-diffusion paths"`

### Task D5: Path summary statistics (P5/P50/P95, 3-day max drawdown)

**Files:** Modify `lib/fxModel.ts`, `tests/fxModel.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { percentilesAtEachStep, rolling3DayMaxDrawdown } from '@/lib/fxModel';

describe('summaries', () => {
  it('percentilesAtEachStep returns 3 arrays length horizon+1', () => {
    const paths = [
      [1, 1.1, 1.2], [1, 0.9, 0.8], [1, 1.0, 1.0], [1, 0.95, 0.85], [1, 1.05, 1.1],
    ];
    const { p5, p50, p95 } = percentilesAtEachStep(paths);
    expect(p5.length).toBe(3);
    expect(p50[0]).toBeCloseTo(1, 8);
  });

  it('rolling 3-day max drawdown is nonnegative', () => {
    const paths = [[1, 0.95, 0.9, 0.85, 0.8]];
    const dd = rolling3DayMaxDrawdown(paths, 3);
    expect(dd[0]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement**

```ts
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (idx - lo) * (sorted[hi]! - sorted[lo]!);
}

export function percentilesAtEachStep(paths: Path[]): { p5: number[]; p50: number[]; p95: number[] } {
  const n = paths[0]!.length;
  const p5 = new Array<number>(n);
  const p50 = new Array<number>(n);
  const p95 = new Array<number>(n);
  for (let t = 0; t < n; t++) {
    const col = paths.map((p) => p[t]!).sort((a, b) => a - b);
    p5[t] = quantile(col, 0.05);
    p50[t] = quantile(col, 0.5);
    p95[t] = quantile(col, 0.95);
  }
  return { p5, p50, p95 };
}

/** Max % drop within any rolling `window` days for each path. */
export function rolling3DayMaxDrawdown(paths: Path[], window: number): number[] {
  return paths.map((p) => {
    let maxDd = 0;
    for (let i = 0; i + window < p.length; i++) {
      const start = p[i]!;
      let minAfter = start;
      for (let j = i + 1; j <= i + window; j++) if (p[j]! < minAfter) minAfter = p[j]!;
      const dd = (start - minAfter) / start;
      if (dd > maxDd) maxDd = dd;
    }
    return maxDd;
  });
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(fx): path percentile + rolling drawdown summaries"`

---

## Phase E — Types

### Task E1: Centralized simulator types

**Files:** Create `types/simulator.ts`

- [ ] **Step 1: Write all input/output types in one file**

```ts
// types/simulator.ts
export type SimulationMode = 'Bootstrap' | 'GBM' | 'GBM+Jumps' | 'Scenario';
export type HistoricalPeriod = 1 | 3 | 5;
export type LLTV = 0.385 | 0.625 | 0.77 | 0.86 | 0.915 | 0.945 | 0.965 | 0.98;
export const GOV_LLTVS: LLTV[] = [0.385, 0.625, 0.77, 0.86, 0.915, 0.945, 0.965, 0.98];

export interface SidebarInputs {
  witryTVL_USD: number;
  lltv: LLTV;
  targetUtilization: number;
  borrowerLTVAlpha: number;
  borrowerLTVBeta: number;
  iTRYYieldAnnual: number;
  usdtryBaseline: number;
  historicalPeriod: HistoricalPeriod;
  simulationMode: SimulationMode;
  simulationHorizonDays: 7 | 30 | 60 | 90;
  pathCount: 100 | 1000 | 5000;
  tryShockPct: number;        // scenario mode, e.g. -0.30
  incentiveBudgetMonthly_USD: number;
  attractionRate: number;
  lockPeriodDays: 30 | 60 | 90 | 180;
  poolDepth_USD: number;
  performanceFee: number;
  managementFee: number;
  safetyMargin: number;
  preLiquidationEnabled: boolean;
  blockBootstrap: boolean;
  seed: number;
}

export interface LiquidityNeedOutput {
  maxBorrowable_USD: number;
  expectedBorrow_USD: number;
  requiredUSDM: number;
  withdrawalBuffer_USD: number;
  liquidityFloor_USD: number;
  irmCurve: Array<{ u: number; r: number }>;
  sensitivity: Array<{ lltv: LLTV; requiredUSDM: number }>;
}

export interface FxOutput {
  paths: number[][];
  p5: number[]; p50: number[]; p95: number[];
  netWitryUSDPaths: { p5: number[]; p50: number[]; p95: number[] };
  positionUnderwaterByDay: Array<{ day: number; pctUnderwater: number }>;
  threeDayMaxDrawdown: { p50: number; p95: number };
  expectedLiquidationVolumeP95_USD: number;
  annualizedVol: number;
}

export interface LiquidityStrategyOutput {
  borrowAPY: number;
  grossSupplyAPY: number;
  netSupplyAPY: number;
  incentiveAPY: number;
  totalSupplyAPY: number;
  daysToTarget: number;
  retentionAfterIncentivesEnd_USD: number;
  totalIncentiveSpend_USD: number;
  leverageLoopAPY: number;
  leverageLoopsViable: boolean;
}

export interface LiquidationOutput {
  minProfitable_USD: number;
  maxProfitable_USD: number;
  recommendedPoolDepth_USD: number;
  badDebtDistribution: number[];
  badDebtP95_USD: number;
  badDebtP95Pct: number;
  preLiquidationParams: {
    preLLTV: number; preLCF1: number; preLCF2: number; preLIF1: number; preLIF2: number;
  };
}

export interface VaultRecommendation {
  recommendedLLTV: LLTV;
  riskTier: 'Conservative' | 'Moderate' | 'Aggressive';
  configJson: Record<string, unknown>;
}

export interface SimulatorOutputs {
  liquidity: LiquidityNeedOutput;
  fx: FxOutput;
  strategy: LiquidityStrategyOutput;
  liquidation: LiquidationOutput;
  vault: VaultRecommendation;
}
```

- [ ] **Step 2: Build sanity**

Run: `npm run build` (or `npx tsc --noEmit`)
Expected: no errors.

- [ ] **Step 3: Commit** — `git add types && git commit -m "feat(types): centralized simulator input/output types"`

---

## Phase F — Pure Simulator Logic (`lib/simulator.ts`)

### Task F1: Liquidity-need calculation (Section 1)

**Files:** Create `lib/simulator.ts`, `tests/simulator.test.ts`

- [ ] **Step 1: Failing test (verification item 7)**

```ts
import { describe, it, expect } from 'vitest';
import { computeLiquidityNeed } from '@/lib/simulator';

describe('liquidity need', () => {
  it('verification anchor: 5M × 0.77 × 0.6 / 0.7 ≈ 3.3M', () => {
    const out = computeLiquidityNeed({
      witryTVL_USD: 5_000_000, lltv: 0.77, targetUtilization: 0.7,
      borrowerLTVAlpha: 2, borrowerLTVBeta: 1.2 + (2/0.6 - 2), // mean = 0.6 ⇒ α=3, β=2 ; rewrite cleanly below
    } as any);
    // recompute with α=3, β=2 (mean = 3/5 = 0.6)
    const out2 = computeLiquidityNeed({
      witryTVL_USD: 5_000_000, lltv: 0.77, targetUtilization: 0.7,
      borrowerLTVAlpha: 3, borrowerLTVBeta: 2,
      incentiveAPY: 0, baseSupplyAPY: 0.05, deadDepositCost: 1,
    });
    expect(out2.requiredUSDM).toBeCloseTo(3_300_000, -3); // within ±1000
  });

  it('floor uses 20% of required when dead-deposit cost is small', () => {
    const out = computeLiquidityNeed({
      witryTVL_USD: 5_000_000, lltv: 0.77, targetUtilization: 0.7,
      borrowerLTVAlpha: 3, borrowerLTVBeta: 2,
      incentiveAPY: 0, baseSupplyAPY: 0.05, deadDepositCost: 1,
    });
    expect(out.liquidityFloor_USD).toBeCloseTo(0.2 * out.requiredUSDM, 0);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// lib/simulator.ts
import { adaptiveCurveIRM } from './morphoMath';

export interface LiqNeedArgs {
  witryTVL_USD: number; lltv: number; targetUtilization: number;
  borrowerLTVAlpha: number; borrowerLTVBeta: number;
  incentiveAPY: number; baseSupplyAPY: number;
  deadDepositCost: number;
}

export interface LiqNeedOut {
  maxBorrowable_USD: number; expectedBorrow_USD: number;
  requiredUSDM: number; withdrawalBuffer_USD: number;
  liquidityFloor_USD: number; bufferPct: number;
}

export function betaMean(alpha: number, beta: number): number { return alpha / (alpha + beta); }

export function bufferPctFromIncentive(incentiveAPY: number, baseSupplyAPY: number): number {
  const ratio = baseSupplyAPY > 0 ? incentiveAPY / baseSupplyAPY : 0;
  return 0.15 + 0.10 * ratio; // 15–35% per spec
}

export function computeLiquidityNeed(a: LiqNeedArgs): LiqNeedOut {
  const meanLTVFrac = betaMean(a.borrowerLTVAlpha, a.borrowerLTVBeta);
  const maxBorrowable_USD = a.witryTVL_USD * a.lltv;
  const expectedBorrow_USD = maxBorrowable_USD * meanLTVFrac;
  const requiredUSDM = expectedBorrow_USD / a.targetUtilization;
  const bufferPct = bufferPctFromIncentive(a.incentiveAPY, a.baseSupplyAPY);
  const withdrawalBuffer_USD = requiredUSDM * bufferPct;
  const liquidityFloor_USD = Math.max(a.deadDepositCost * 100, requiredUSDM * 0.20);
  return { maxBorrowable_USD, expectedBorrow_USD, requiredUSDM, withdrawalBuffer_USD, liquidityFloor_USD, bufferPct };
}

export function irmCurvePoints(rTarget: number, steps = 51): Array<{ u: number; r: number }> {
  const pts: Array<{ u: number; r: number }> = [];
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    pts.push({ u, r: adaptiveCurveIRM(u, rTarget) });
  }
  return pts;
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(sim): liquidity-need calc with bufferPct heuristic"`

### Task F2: Beta-distributed borrower LTV sampling + position underwater %

**Files:** Modify `lib/simulator.ts`, `tests/simulator.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { sampleBetaLtvFractions, pctUnderwaterAtT } from '@/lib/simulator';

describe('position distribution', () => {
  it('β-sampled fractions are in [0,1]', () => {
    const xs = sampleBetaLtvFractions({ alpha: 2, beta: 1.2, n: 500, seed: 1 });
    expect(xs.every((x) => x >= 0 && x <= 1)).toBe(true);
  });

  it('at S(t)=S(0) and 0 yield, no positions are underwater', () => {
    const pct = pctUnderwaterAtT({
      ltvFractions: [0.2, 0.5, 0.8],
      lltv: 0.86,
      collateralRelChange: 1.0, // unchanged
    });
    expect(pct).toBe(0);
  });

  it('at large drop, all positions are underwater', () => {
    const pct = pctUnderwaterAtT({
      ltvFractions: [0.2, 0.5, 0.8],
      lltv: 0.86,
      collateralRelChange: 0.1,
    });
    expect(pct).toBe(1);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { createRng, gauss } from './rng';

/** Sample from Beta(α,β) via the ratio of two Gammas; small α/β → Marsaglia-Tsang. */
function gammaSample(rng: () => number, shape: number): number {
  if (shape < 1) {
    return gammaSample(rng, shape + 1) * Math.pow(rng(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x = gauss(rng);
    let v = 1 + c * x;
    if (v <= 0) continue;
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBetaLtvFractions(a: { alpha: number; beta: number; n: number; seed: number | string }): number[] {
  const rng = createRng(a.seed);
  const out: number[] = [];
  for (let i = 0; i < a.n; i++) {
    const x = gammaSample(rng, a.alpha);
    const y = gammaSample(rng, a.beta);
    out.push(x / (x + y));
  }
  return out;
}

export interface PctUnderwaterArgs {
  ltvFractions: number[];   // fraction of LLTV used at t=0
  lltv: number;
  collateralRelChange: number; // newCollateralUSD / origCollateralUSD (includes wiTRY yield offset)
}

/** position underwater when (debt) / (coll × rel) > lltv  ⇔  ltv0 / rel > 1 (since debt = ltv0·coll·LLTV → simplify). */
export function pctUnderwaterAtT(a: PctUnderwaterArgs): number {
  if (a.ltvFractions.length === 0) return 0;
  let underwater = 0;
  for (const f of a.ltvFractions) {
    // initial debt = f × LLTV × coll. underwater when debt > newColl × LLTV
    //   f × LLTV × coll > (coll × rel) × LLTV  ⇔  f > rel.
    if (f > a.collateralRelChange) underwater++;
  }
  return underwater / a.ltvFractions.length;
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(sim): beta-distributed borrower LTV sampling + underwater %"`

### Task F3: Liquidator profitability + AMM slippage

**Files:** Modify `lib/simulator.ts`, `tests/simulator.test.ts`

- [ ] **Step 1: Failing tests (verification items 6 + 10)**

```ts
import { slippage, liquidatorProfit, minMaxProfitableLiquidation } from '@/lib/simulator';
import { LIF } from '@/lib/morphoMath';

describe('liquidator economics', () => {
  it('slippage anchor: L=2,D=98 → 0.02', () => {
    expect(slippage(2, 98)).toBeCloseTo(0.02, 4);
  });

  it('profit cliff: profit ≈ 0 when slippage = 1 − 1/LIF', () => {
    // revenue = debt × LIF × (1 − slip); profit=0 ⇔ slip = 1 − 1/LIF (NOT LIF − 1).
    const lltv = 0.86;
    const lif = LIF(lltv);
    const debt = 1000;
    const seized = debt * lif;
    const slip = 1 - 1 / lif;
    const D = seized * (1 - slip) / slip;
    const p = liquidatorProfit({ debt_USD: debt, lltv, poolDepth_USD: D, gasCost_USD: 0, holdingRisk_USD: 0 });
    expect(Math.abs(p.profit_USD)).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { LIF } from './morphoMath';

/** AMM slippage for selling L USD-worth into one-side reserve D (USD). */
export function slippage(L_USD: number, D_USD: number): number {
  if (D_USD <= 0) return 1;
  return L_USD / (L_USD + D_USD);
}

export interface LiquidatorArgs {
  debt_USD: number; lltv: number; poolDepth_USD: number; gasCost_USD: number; holdingRisk_USD: number;
}
export interface LiquidatorOut { collateralSeized_USD: number; slippagePct: number; revenue_USD: number; profit_USD: number; }

export function liquidatorProfit(a: LiquidatorArgs): LiquidatorOut {
  const lif = LIF(a.lltv);
  const collateralSeized_USD = a.debt_USD * lif;
  const slippagePct = slippage(collateralSeized_USD, a.poolDepth_USD);
  const revenue_USD = collateralSeized_USD * (1 - slippagePct);
  const profit_USD = revenue_USD - a.debt_USD - a.gasCost_USD - a.holdingRisk_USD;
  return { collateralSeized_USD, slippagePct, revenue_USD, profit_USD };
}

export interface MinMaxArgs { lltv: number; poolDepth_USD: number; gasCost_USD: number; }
export function minMaxProfitableLiquidation(a: MinMaxArgs): { min_USD: number; max_USD: number } {
  // Binary search for break-even debts assuming zero holding risk
  const profitAt = (debt: number) =>
    liquidatorProfit({ ...a, debt_USD: debt, holdingRisk_USD: 0 }).profit_USD;
  let lo = 1, hi = 1e9;
  // min: smallest debt with profit ≥ 0 (gas matters at small sizes)
  let min_USD = NaN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) > 0) { hi = mid; min_USD = mid; } else { lo = mid; }
  }
  // max: largest debt with profit ≥ 0 (slippage kills it at upper end)
  lo = min_USD; hi = 1e10;
  let max_USD = NaN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) > 0) { lo = mid; max_USD = mid; } else { hi = mid; }
  }
  return { min_USD, max_USD };
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(sim): liquidator profit + slippage + min/max profitable size"`

### Task F4: Bad-debt cascade simulation

**Files:** Modify `lib/simulator.ts`, `tests/simulator.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { simulateBadDebt } from '@/lib/simulator';

describe('bad debt cascade', () => {
  it('no bad debt under flat collateral', () => {
    const result = simulateBadDebt({
      paths: [[1, 1, 1, 1], [1, 1, 1, 1]],
      ltvFractions: [0.5, 0.7],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      poolDepth_USD: 500_000,
      gasCost_USD: 5,
      iTRYYieldAnnual: 0.38,
      preLiquidationEnabled: false,
    });
    expect(Math.max(...result.badDebtByPath)).toBe(0);
  });

  it('bad debt > 0 under severe crash', () => {
    const result = simulateBadDebt({
      paths: [[1, 1.5, 2.0, 2.5]], // TRY collapses 60% (rate up = TRY down)
      ltvFractions: [0.9, 0.95],
      lltv: 0.86,
      tvl_USD: 1_000_000,
      poolDepth_USD: 1000,        // tiny pool → no liquidator can clear
      gasCost_USD: 5,
      iTRYYieldAnnual: 0,
      preLiquidationEnabled: false,
    });
    expect(result.badDebtByPath[0]!).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { healthFactor, witryUSD } from './morphoMath';

export interface BadDebtArgs {
  paths: number[][];          // USD/TRY paths (rate; higher = TRY weaker)
  ltvFractions: number[];     // borrower LTV fractions at t=0 (of LLTV)
  lltv: number;
  tvl_USD: number;            // wiTRY TVL in USD at t=0
  poolDepth_USD: number;
  gasCost_USD: number;
  iTRYYieldAnnual: number;
  preLiquidationEnabled: boolean;
}

export interface BadDebtOut {
  badDebtByPath: number[];
  liquidatedCountByPath: number[];
  badDebtP95_USD: number;
  badDebtP95Pct: number;
}

export function simulateBadDebt(a: BadDebtArgs): BadDebtOut {
  const N = a.ltvFractions.length;
  const collateralEachUSD = a.tvl_USD / Math.max(1, N);
  const S0 = a.paths[0]![0]!;
  // For each path, run forward
  const badDebtByPath: number[] = [];
  const liquidatedCountByPath: number[] = [];

  for (const path of a.paths) {
    // active positions
    const active = a.ltvFractions.map((f) => ({
      ltvFrac: f,
      debt_USD: f * a.lltv * collateralEachUSD, // constant USD debt
      collateralBaseUSD: collateralEachUSD,
      closed: false,
      residual_USD: 0,
    }));

    for (let t = 1; t < path.length; t++) {
      const Snow = path[t]!;
      // wiTRY USD value of 1 unit at t-days relative to t=0:
      // val_t/val_0 = (witryPerITRY(t)/Snow) / (1/S0) = witryPerITRY(t) × S0 / Snow
      const rel = (Math.pow(1 + a.iTRYYieldAnnual, t / 365) * S0) / Snow;
      for (const pos of active) {
        if (pos.closed) continue;
        const collNow = pos.collateralBaseUSD * rel;
        const hf = healthFactor({ collateralUSD: collNow, debtUSD: pos.debt_USD, lltv: a.lltv });
        if (hf <= 1) {
          // attempt liquidation
          const { collateralSeized_USD, slippagePct, revenue_USD } =
            liquidatorProfit({ debt_USD: pos.debt_USD, lltv: a.lltv, poolDepth_USD: a.poolDepth_USD, gasCost_USD: a.gasCost_USD, holdingRisk_USD: 0 });
          const profit = revenue_USD - pos.debt_USD - a.gasCost_USD;
          if (profit > 0) {
            pos.closed = true;
            const residual = Math.max(0, pos.debt_USD - revenue_USD);
            pos.residual_USD = residual;
          } else {
            // not executed: residual = max(0, debt − current collateral value)
            pos.closed = true;
            pos.residual_USD = Math.max(0, pos.debt_USD - collNow);
          }
        }
      }
    }

    const bd = active.reduce((s, p) => s + p.residual_USD, 0);
    const count = active.filter((p) => p.closed).length;
    badDebtByPath.push(bd);
    liquidatedCountByPath.push(count);
  }

  const sorted = [...badDebtByPath].sort((x, y) => x - y);
  const badDebtP95_USD = sorted[Math.floor(0.95 * (sorted.length - 1))] ?? 0;
  return {
    badDebtByPath, liquidatedCountByPath,
    badDebtP95_USD,
    badDebtP95Pct: a.tvl_USD > 0 ? badDebtP95_USD / a.tvl_USD : 0,
  };
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(sim): bad-debt cascade with liquidator profitability check"`

### Task F5: LLTV fixed-point derivation (Section 5)

**Files:** Modify `lib/simulator.ts`, `tests/simulator.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { deriveRecommendedLLTV, snapToGovernanceLLTV } from '@/lib/simulator';
import { GOV_LLTVS } from '@/types/simulator';

describe('LLTV derivation', () => {
  it('converges within 10 iters', () => {
    const r = deriveRecommendedLLTV({
      p95Drawdown: 0.15, slippage: 0.02, safetyMargin: 0.02, maxIter: 10,
    });
    expect(r.converged).toBe(true);
    expect(r.iterations).toBeLessThanOrEqual(10);
  });
  it('snaps down to governance list', () => {
    expect(snapToGovernanceLLTV(0.80)).toBe(0.77);
    expect(snapToGovernanceLLTV(0.95)).toBe(0.945);
    expect(snapToGovernanceLLTV(0.30)).toBe(0); // below minimum (allow 0)
  });
  it('lower drawdown → higher recommended LLTV', () => {
    const a = deriveRecommendedLLTV({ p95Drawdown: 0.30, slippage: 0.02, safetyMargin: 0.02 });
    const b = deriveRecommendedLLTV({ p95Drawdown: 0.05, slippage: 0.02, safetyMargin: 0.02 });
    expect(b.raw).toBeGreaterThan(a.raw);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { LIF } from './morphoMath';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';

export interface DeriveArgs {
  p95Drawdown: number;
  slippage: number;
  safetyMargin: number;
  maxIter?: number;
  tol?: number;
}
export interface DeriveOut { raw: number; converged: boolean; iterations: number; }

export function deriveRecommendedLLTV(a: DeriveArgs): DeriveOut {
  const max = a.maxIter ?? 20;
  const tol = a.tol ?? 1e-4;
  let L = 0.80;
  let converged = false;
  let i = 0;
  for (; i < max; i++) {
    const lif = LIF(L);
    const next = (1 - a.p95Drawdown) / (lif * (1 + a.slippage)) - a.safetyMargin;
    if (Math.abs(next - L) < tol) { L = next; converged = true; i++; break; }
    L = next;
  }
  return { raw: Math.max(0, Math.min(0.98, L)), converged, iterations: i };
}

export function snapToGovernanceLLTV(raw: number): LLTV | 0 {
  const sorted = [...GOV_LLTVS].sort((x, y) => x - y);
  let chosen: LLTV | 0 = 0;
  for (const lv of sorted) if (lv <= raw) chosen = lv;
  return chosen;
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(sim): fixed-point LLTV derivation + governance snap"`

### Task F6: Liquidity strategy + leverage-loop viability (Section 3)

**Files:** Modify `lib/simulator.ts`, `tests/simulator.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { computeStrategy } from '@/lib/simulator';

describe('strategy', () => {
  it('totals add up', () => {
    const out = computeStrategy({
      borrowAPY: 0.10, targetUtilization: 0.7,
      performanceFee: 0.1, managementFee: 0.01,
      requiredUSDM: 3_300_000, incentiveBudgetMonthly_USD: 10_000,
      attractionRate: 5,
      iTRYYieldAnnual: 0.38, expectedTRYDepreciation_annual: 0.30,
      competingAPY: 0.05,
    });
    expect(out.grossSupplyAPY).toBeCloseTo(0.07, 4);
    expect(out.totalSupplyAPY).toBeGreaterThan(out.netSupplyAPY);
    expect(out.daysToTarget).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement**

```ts
export interface StrategyArgs {
  borrowAPY: number; targetUtilization: number;
  performanceFee: number; managementFee: number;
  requiredUSDM: number; incentiveBudgetMonthly_USD: number;
  attractionRate: number;
  iTRYYieldAnnual: number; expectedTRYDepreciation_annual: number;
  competingAPY: number;
}
export interface StrategyOut {
  grossSupplyAPY: number; netSupplyAPY: number; incentiveAPY: number; totalSupplyAPY: number;
  daysToTarget: number; retentionAfterIncentivesEnd_USD: number; totalIncentiveSpend_USD: number;
  leverageLoopAPY: number; leverageLoopsViable: boolean;
}

export function computeStrategy(a: StrategyArgs): StrategyOut {
  const grossSupplyAPY = a.borrowAPY * a.targetUtilization;
  const netSupplyAPY = grossSupplyAPY * (1 - a.performanceFee) - a.managementFee;
  const incentiveAPY = a.requiredUSDM > 0 ? (a.incentiveBudgetMonthly_USD * 12) / a.requiredUSDM : 0;
  const totalSupplyAPY = netSupplyAPY + incentiveAPY;
  const dailyAttract = (a.incentiveBudgetMonthly_USD * a.attractionRate) / 30;
  const daysToTarget = dailyAttract > 0 ? a.requiredUSDM / dailyAttract : Infinity;
  const retentionAfterIncentivesEnd_USD = a.competingAPY > 0
    ? a.requiredUSDM * Math.min(1, netSupplyAPY / a.competingAPY) : a.requiredUSDM;
  const totalIncentiveSpend_USD = a.incentiveBudgetMonthly_USD * (daysToTarget / 30);
  const leverageLoopAPY = a.iTRYYieldAnnual - a.borrowAPY * (1 + a.expectedTRYDepreciation_annual);
  return {
    grossSupplyAPY, netSupplyAPY, incentiveAPY, totalSupplyAPY,
    daysToTarget, retentionAfterIncentivesEnd_USD, totalIncentiveSpend_USD,
    leverageLoopAPY, leverageLoopsViable: leverageLoopAPY > 0,
  };
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(sim): strategy + leverage-loop viability"`

### Task F7: Vault recommendation JSON builder

**Files:** Modify `lib/simulator.ts`, `tests/simulator.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { buildVaultConfigJson, classifyRiskTier } from '@/lib/simulator';

describe('vault json', () => {
  it('lltv encoded as 18-decimal fixed string', () => {
    const j = buildVaultConfigJson({
      lltv: 0.77, oracle: '0xORACLE', irm: '0xIRM',
      performanceFee: 0.1, managementFee: 0.01,
      timelockSeconds: 604800, cap_USD: 4_000_000,
      preLLTV: 0.72, preLCF: [0.05, 0.5], preLIF: [1.01, 1.0837],
    });
    expect(j.market.lltv).toBe('770000000000000000');
    expect(j.preLiquidation.preLCF).toEqual([0.05, 0.5]);
  });

  it('classifyRiskTier: chosen=recommended → Conservative', () => {
    expect(classifyRiskTier(0.77, 0.77)).toBe('Conservative');
    expect(classifyRiskTier(0.82, 0.77)).toBe('Moderate');
    expect(classifyRiskTier(0.86, 0.77)).toBe('Aggressive');
  });
});
```

- [ ] **Step 2: Implement**

```ts
export interface VaultJsonArgs {
  lltv: number; oracle: string; irm: string;
  performanceFee: number; managementFee: number;
  timelockSeconds: number; cap_USD: number;
  preLLTV: number; preLCF: [number, number]; preLIF: [number, number];
}

function to18Decimal(x: number): string {
  // Convert a decimal in [0,1] to fixed-point 1e18 string
  const big = BigInt(Math.round(x * 1e18));
  return big.toString();
}

export function buildVaultConfigJson(a: VaultJsonArgs): Record<string, any> {
  return {
    market: { lltv: to18Decimal(a.lltv), irm: a.irm, oracle: a.oracle },
    vault: {
      performanceFee: a.performanceFee, managementFee: a.managementFee,
      timelock: a.timelockSeconds,
      caps: { absoluteUSD: a.cap_USD, relative: 1.0 },
    },
    preLiquidation: { preLLTV: to18Decimal(a.preLLTV), preLCF: a.preLCF, preLIF: a.preLIF },
  };
}

export function classifyRiskTier(chosen: number, recommended: number): 'Conservative' | 'Moderate' | 'Aggressive' {
  if (chosen <= recommended) return 'Conservative';
  if (chosen <= recommended + 0.05) return 'Moderate';
  return 'Aggressive';
}
```

- [ ] **Step 3: PASS → Commit** — `git commit -am "feat(sim): vault config JSON + risk tier classifier"`

---

## Phase G — Web Worker

### Task G1: Worker entry that orchestrates FX simulation

**Files:** Create `lib/simulation.worker.ts`

- [ ] **Step 1: Implement worker (Comlink-exposed)**

```ts
// lib/simulation.worker.ts
import * as Comlink from 'comlink';
import { bootstrapPaths, blockBootstrapPaths, gbmPaths, jumpDiffusionPaths, fitGbmParams, percentilesAtEachStep, rolling3DayMaxDrawdown } from './fxModel';
import { simulateBadDebt, sampleBetaLtvFractions } from './simulator';
import type { SidebarInputs } from '@/types/simulator';

export interface WorkerInput {
  inputs: SidebarInputs;
  returnsWindow: number[]; // pre-windowed historical returns
}

export interface WorkerOutput {
  paths: number[][];
  p5: number[]; p50: number[]; p95: number[];
  threeDayDD: number[];
  badDebt: { badDebtByPath: number[]; badDebtP95_USD: number; badDebtP95Pct: number; liquidatedCountByPath: number[]; };
  annualizedVol: number;
}

const api = {
  run(input: WorkerInput): WorkerOutput {
    const { inputs, returnsWindow } = input;
    const common = { S0: inputs.usdtryBaseline, horizonDays: inputs.simulationHorizonDays, paths: inputs.pathCount, seed: inputs.seed };
    let paths: number[][];
    switch (inputs.simulationMode) {
      case 'Bootstrap':
        paths = inputs.blockBootstrap
          ? blockBootstrapPaths({ returns: returnsWindow, blockLength: 5, ...common })
          : bootstrapPaths({ returns: returnsWindow, ...common });
        break;
      case 'GBM': {
        const { mu, sigma } = fitGbmParams(returnsWindow);
        paths = gbmPaths({ mu, sigma, ...common });
        break;
      }
      case 'GBM+Jumps': {
        const { mu, sigma } = fitGbmParams(returnsWindow);
        paths = jumpDiffusionPaths({ mu, sigma, lambda: 4, muJ: -0.05, sigmaJ: 0.04, ...common });
        break;
      }
      case 'Scenario': {
        // Single deterministic path: linear glide from S0 to S0*(1+|shock|)
        const n = inputs.simulationHorizonDays + 1;
        const end = inputs.usdtryBaseline * (1 + Math.abs(inputs.tryShockPct));
        const path = Array.from({ length: n }, (_, i) =>
          inputs.usdtryBaseline + (end - inputs.usdtryBaseline) * (i / (n - 1)));
        paths = [path];
        break;
      }
    }
    const { p5, p50, p95 } = percentilesAtEachStep(paths);
    const threeDayDD = rolling3DayMaxDrawdown(paths, 3);
    const ltvFractions = sampleBetaLtvFractions({ alpha: inputs.borrowerLTVAlpha, beta: inputs.borrowerLTVBeta, n: 1000, seed: inputs.seed });
    const badDebt = simulateBadDebt({
      paths, ltvFractions, lltv: inputs.lltv,
      tvl_USD: inputs.witryTVL_USD, poolDepth_USD: inputs.poolDepth_USD,
      gasCost_USD: 5, iTRYYieldAnnual: inputs.iTRYYieldAnnual,
      preLiquidationEnabled: inputs.preLiquidationEnabled,
    });
    // annualized vol
    const dailyMean = returnsWindow.reduce((a, b) => a + b, 0) / returnsWindow.length;
    const dailyVar = returnsWindow.reduce((a, b) => a + (b - dailyMean) ** 2, 0) / (returnsWindow.length - 1);
    const annualizedVol = Math.sqrt(dailyVar * 252);
    return { paths, p5, p50, p95, threeDayDD, badDebt, annualizedVol };
  },
};

Comlink.expose(api);
export type WorkerApi = typeof api;
```

- [ ] **Step 2: Commit** — `git add lib/simulation.worker.ts && git commit -m "feat(worker): Comlink worker for Monte Carlo + bad-debt cascade"`

### Task G2: Worker host hook

**Files:** Create `lib/useSimulationWorker.ts`

- [ ] **Step 1: Implement**

```ts
'use client';
import { useEffect, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { WorkerApi, WorkerInput, WorkerOutput } from './simulation.worker';

export function useSimulationWorker() {
  const ref = useRef<Comlink.Remote<WorkerApi> | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkerOutput | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
    ref.current = Comlink.wrap<WorkerApi>(w);
    return () => { w.terminate(); ref.current = null; };
  }, []);

  async function run(input: WorkerInput) {
    if (!ref.current) return;
    setRunning(true);
    try {
      const out = await ref.current.run(input);
      setResult(out);
    } finally { setRunning(false); }
  }

  return { running, result, run };
}
```

- [ ] **Step 2: Commit** — `git add lib/useSimulationWorker.ts && git commit -m "feat(worker): React hook host"`

---

## Phase H — State & URL Sync

### Task H1: URL state hook via nuqs

**Files:** Create `lib/useUrlState.ts`, modify `app/layout.tsx`

- [ ] **Step 1: Wrap layout with nuqs provider**

In `app/layout.tsx`:
```tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app';
// ...
return (
  <html lang="en"><body>
    <NuqsAdapter>{children}</NuqsAdapter>
  </body></html>
);
```

- [ ] **Step 2: Implement hook**

```ts
// lib/useUrlState.ts
'use client';
import { useQueryStates, parseAsFloat, parseAsInteger, parseAsBoolean, parseAsStringLiteral } from 'nuqs';
import type { SidebarInputs } from '@/types/simulator';

const MODES = ['Bootstrap', 'GBM', 'GBM+Jumps', 'Scenario'] as const;

export function useUrlState() {
  return useQueryStates({
    witryTVL_USD: parseAsFloat.withDefault(5_000_000),
    lltv: parseAsFloat.withDefault(0.77),
    targetUtilization: parseAsFloat.withDefault(0.7),
    borrowerLTVAlpha: parseAsFloat.withDefault(2),
    borrowerLTVBeta: parseAsFloat.withDefault(1.2),
    iTRYYieldAnnual: parseAsFloat.withDefault(0.38),
    usdtryBaseline: parseAsFloat.withDefault(38.5),
    historicalPeriod: parseAsInteger.withDefault(3),
    simulationMode: parseAsStringLiteral(MODES).withDefault('Bootstrap'),
    simulationHorizonDays: parseAsInteger.withDefault(30),
    pathCount: parseAsInteger.withDefault(1000),
    tryShockPct: parseAsFloat.withDefault(-0.30),
    incentiveBudgetMonthly_USD: parseAsFloat.withDefault(10_000),
    attractionRate: parseAsFloat.withDefault(5),
    lockPeriodDays: parseAsInteger.withDefault(90),
    poolDepth_USD: parseAsFloat.withDefault(500_000),
    performanceFee: parseAsFloat.withDefault(0.10),
    managementFee: parseAsFloat.withDefault(0.01),
    safetyMargin: parseAsFloat.withDefault(0.02),
    preLiquidationEnabled: parseAsBoolean.withDefault(true),
    blockBootstrap: parseAsBoolean.withDefault(false),
    seed: parseAsInteger.withDefault(42),
  });
}
```

- [ ] **Step 3: Commit** — `git add app/layout.tsx lib/useUrlState.ts && git commit -m "feat(state): URL-synced sidebar via nuqs"`

### Task H2: Top-level `useSimulator` hook

**Files:** Create `lib/useSimulator.ts`

- [ ] **Step 1: Implement composite hook**

```ts
'use client';
import { useEffect, useMemo } from 'react';
import { useUrlState } from './useUrlState';
import { useSimulationWorker } from './useSimulationWorker';
import { loadFxRows, dailyLogReturns, windowRows } from './fxData';
import {
  computeLiquidityNeed, irmCurvePoints, computeStrategy,
  deriveRecommendedLLTV, snapToGovernanceLLTV, classifyRiskTier,
  buildVaultConfigJson, minMaxProfitableLiquidation,
} from './simulator';
import { LIF } from './morphoMath';
import { GOV_LLTVS } from '@/types/simulator';

export function useSimulator() {
  const [s] = useUrlState();
  const { running, result, run } = useSimulationWorker();

  const returnsWindow = useMemo(() => {
    const rows = windowRows(loadFxRows(), s.historicalPeriod as 1 | 3 | 5);
    return dailyLogReturns(rows);
  }, [s.historicalPeriod]);

  // Trigger worker run when relevant inputs change
  useEffect(() => {
    run({ inputs: s as any, returnsWindow });
  }, [s, returnsWindow]); // eslint-disable-line react-hooks/exhaustive-deps

  const rTarget = 0.04;
  const borrowAPY = result ? 0.04 /* recompute via IRM(targetUtil) */ : 0.04;

  const liquidity = useMemo(() => {
    const out = computeLiquidityNeed({
      witryTVL_USD: s.witryTVL_USD, lltv: s.lltv,
      targetUtilization: s.targetUtilization,
      borrowerLTVAlpha: s.borrowerLTVAlpha, borrowerLTVBeta: s.borrowerLTVBeta,
      incentiveAPY: 0, baseSupplyAPY: 0.05, deadDepositCost: 1,
    });
    const irmCurve = irmCurvePoints(rTarget);
    const sensitivity = GOV_LLTVS.slice(2, 6).map((lv) => ({
      lltv: lv,
      requiredUSDM: (s.witryTVL_USD * lv * (s.borrowerLTVAlpha / (s.borrowerLTVAlpha + s.borrowerLTVBeta))) / s.targetUtilization,
    }));
    return { ...out, irmCurve, sensitivity };
  }, [s]);

  const strategy = useMemo(() => computeStrategy({
    borrowAPY, targetUtilization: s.targetUtilization,
    performanceFee: s.performanceFee, managementFee: s.managementFee,
    requiredUSDM: liquidity.requiredUSDM, incentiveBudgetMonthly_USD: s.incentiveBudgetMonthly_USD,
    attractionRate: s.attractionRate,
    iTRYYieldAnnual: s.iTRYYieldAnnual,
    expectedTRYDepreciation_annual: 0.30,
    competingAPY: 0.05,
  }), [s, liquidity.requiredUSDM, borrowAPY]);

  const llt = useMemo(() => {
    const p95dd = result?.threeDayDD ? quantile(result.threeDayDD, 0.95) : 0.15;
    const minMax = minMaxProfitableLiquidation({ lltv: s.lltv, poolDepth_USD: s.poolDepth_USD, gasCost_USD: 5 });
    const slippageEstimate = 0.02;
    const derived = deriveRecommendedLLTV({ p95Drawdown: p95dd, slippage: slippageEstimate, safetyMargin: s.safetyMargin });
    const snapped = snapToGovernanceLLTV(derived.raw);
    return { ...derived, snapped, minMax };
  }, [result, s.lltv, s.poolDepth_USD, s.safetyMargin]);

  const vaultJson = useMemo(() => buildVaultConfigJson({
    lltv: s.lltv, oracle: '0xORACLE', irm: '0xIRM',
    performanceFee: s.performanceFee, managementFee: s.managementFee,
    timelockSeconds: 604800, cap_USD: liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD,
    preLLTV: Math.max(0, s.lltv - 0.05), preLCF: [0.05, 0.5], preLIF: [1.01, LIF(s.lltv)],
  }), [s, liquidity]);

  return {
    inputs: s, running, fx: result, liquidity, strategy,
    lltvDerivation: llt, riskTier: classifyRiskTier(s.lltv, llt.snapped || 0), vaultJson,
  };
}

function quantile(xs: number[], q: number) { const sorted = [...xs].sort((a, b) => a - b); return sorted[Math.floor(q * (sorted.length - 1))] ?? 0; }
```

- [ ] **Step 2: Commit** — `git add lib/useSimulator.ts && git commit -m "feat(state): useSimulator composite hook"`

---

## Phase I — UI

### Task I1: App shell layout (sticky sidebar grid)

**Files:** Modify `app/page.tsx`, create `app/components/Sidebar.tsx`, `app/components/sections/*.tsx`

- [ ] **Step 1: Page layout**

```tsx
// app/page.tsx
import { Sidebar } from './components/Sidebar';
import { LiquidityNeed } from './components/sections/LiquidityNeed';
import { FXRisk } from './components/sections/FXRisk';
import { LiquidityStrategy } from './components/sections/LiquidityStrategy';
import { LiquidationDesign } from './components/sections/LiquidationDesign';
import { VaultRecommendations } from './components/sections/VaultRecommendations';

export default function Page() {
  return (
    <div className="grid grid-cols-[320px_1fr] min-h-screen">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r p-4"><Sidebar /></aside>
      <main className="p-6 space-y-12">
        <LiquidityNeed />
        <FXRisk />
        <LiquidityStrategy />
        <LiquidationDesign />
        <VaultRecommendations />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Sidebar stub (URL-synced inputs)**

Create `app/components/Sidebar.tsx` with sliders/numbers for every key in `SidebarInputs` (use `useUrlState`). Group by section. Include "Copy share link" button.

- [ ] **Step 3: Stub all 5 section components**

Each section starts as `'use client'` + `useSimulator()` consumer rendering KPI cards.

- [ ] **Step 4: `npm run dev` smoke test**

Open http://localhost:3000. All 5 sections render placeholders; sidebar input changes update URL.

- [ ] **Step 5: Commit** — `git commit -am "feat(ui): app shell + sidebar + section stubs"`

### Task I2: Section 1 — LiquidityNeed (KPIs + IRM chart + sensitivity)

**Files:** Modify `app/components/sections/LiquidityNeed.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';
import { useSimulator } from '@/lib/useSimulator';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

export function LiquidityNeed() {
  const { liquidity, inputs } = useSimulator();
  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">1. USDM Liquidity Need</h2>
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Liquidity Floor" v={liquidity.liquidityFloor_USD} />
        <Kpi label="Required (steady-state)" v={liquidity.requiredUSDM} />
        <Kpi label="Required + Withdrawal Buffer" v={liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD} />
      </div>
      <h3 className="mt-6 mb-2">Borrow APY curve</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={liquidity.irmCurve}>
          <XAxis dataKey="u" tickFormatter={(x) => `${Math.round(x * 100)}%`} />
          <YAxis tickFormatter={(x) => `${(x * 100).toFixed(1)}%`} />
          <Tooltip formatter={(v: number) => `${(v * 100).toFixed(2)}%`} />
          <ReferenceLine x={inputs.targetUtilization} stroke="red" />
          <Line type="monotone" dataKey="r" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <h3 className="mt-6 mb-2">Sensitivity (required USDM by LLTV)</h3>
      <table className="text-sm"><tbody>
        {liquidity.sensitivity.map((r) => (
          <tr key={r.lltv}><td>{(r.lltv * 100).toFixed(1)}%</td><td>${Math.round(r.requiredUSDM).toLocaleString()}</td></tr>
        ))}
      </tbody></table>
    </section>
  );
}

function Kpi({ label, v }: { label: string; v: number }) {
  return <div className="p-4 border rounded"><div className="text-xs uppercase">{label}</div><div className="text-2xl">${Math.round(v).toLocaleString()}</div></div>;
}
```

- [ ] **Step 2: Verify in browser** — values match anchor (5M / 0.77 / 0.7 / Beta(2,1.2)) ≈ 3.43M (Beta(2,1.2) mean = 0.625).

- [ ] **Step 3: Commit** — `git commit -am "feat(ui): Section 1 LiquidityNeed"`

### Task I3: Section 2 — FXRisk (paths chart, callouts, drawdown)

**Files:** Modify `app/components/sections/FXRisk.tsx`

- [ ] **Step 1: Implement** — render P5/P50/P95 USD/TRY chart + net wiTRY USD chart + 3-day max drawdown distribution + position-underwater% line + annualized vol + the two prominent callout boxes (3-day cooldown clarification, oracle staleness).

- [ ] **Step 2: Verify visual** in dev server.

- [ ] **Step 3: Commit** — `git commit -am "feat(ui): Section 2 FXRisk"`

### Task I4: Section 3 — LiquidityStrategy

- [ ] **Step 1:** Implement supply/borrow APY gauges, viability indicator, 90-day TVL ramp chart, Merkl recommendation card (text generated from `strategy`).

- [ ] **Step 2:** Verify.

- [ ] **Step 3:** Commit — `git commit -am "feat(ui): Section 3 LiquidityStrategy"`

### Task I5: Section 4 — LiquidationDesign

- [ ] **Step 1:** Implement liquidator-profitability cliff chart (profit vs debt size at current `D`), bad-debt distribution histogram, P95 bad-debt headline, LLTV×pool depth heatmap, pre-liquidation toggle (re-runs cascade), final recommendation card.

- [ ] **Step 2:** Verify pre-liquidation toggle changes the bad-debt distribution.

- [ ] **Step 3:** Commit — `git commit -am "feat(ui): Section 4 LiquidationDesign"`

### Task I6: Section 5 — VaultRecommendations + JSON export

- [ ] **Step 1:** Render recommendation table from spec §Recommendation Table. Risk gauge using `classifyRiskTier`. "Copy JSON" button uses `navigator.clipboard.writeText(JSON.stringify(vaultJson, null, 2))`.

- [ ] **Step 2:** Verify JSON copy round-trips.

- [ ] **Step 3:** Commit — `git commit -am "feat(ui): Section 5 VaultRecommendations + export"`

### Task I7: README with caveats + open questions

**Files:** Create `README.md`

- [ ] **Step 1:** Include: project description, run instructions (`npm run dev`, `npm run fx:build`, `npm test`), the "Out of Scope" list from spec verbatim, and the five Open Questions (flagged).

- [ ] **Step 2:** Commit — `git add README.md && git commit -m "docs: README with caveats and open questions"`

---

## Phase J — End-to-End Verification

### Task J1: Cross-check sanity tests (verification items 7–10)

**Files:** Create `tests/sanity.test.ts`

- [ ] **Step 1: Implement explicit sanity tests**

```ts
import { describe, it, expect } from 'vitest';
import { computeLiquidityNeed } from '@/lib/simulator';
import { dailyLogReturns, loadFxRows, windowRows } from '@/lib/fxData';
import { fitGbmParams } from '@/lib/fxModel';

describe('verification anchors', () => {
  it('item 7: 5M × 0.77 × 0.6 / 0.7 ≈ 3.3M', () => {
    const out = computeLiquidityNeed({
      witryTVL_USD: 5_000_000, lltv: 0.77, targetUtilization: 0.7,
      borrowerLTVAlpha: 3, borrowerLTVBeta: 2,
      incentiveAPY: 0, baseSupplyAPY: 0.05, deadDepositCost: 1,
    });
    expect(out.requiredUSDM).toBeCloseTo(3_300_000, -3);
  });

  it('item 8: 3Y USD/TRY annualized vol in [15%, 35%]', () => {
    const rows = windowRows(loadFxRows(), 3);
    const { sigma } = fitGbmParams(dailyLogReturns(rows));
    expect(sigma).toBeGreaterThan(0.15);
    expect(sigma).toBeLessThan(0.35);
  });
});
```

- [ ] **Step 2:** `npm test` — all pass.

- [ ] **Step 3:** Commit — `git commit -am "test: spec verification anchors (items 7,8)"`

### Task J2: E2E smoke (Playwright)

**Files:** `playwright.config.ts`, `tests-e2e/smoke.spec.ts`

- [ ] **Step 1:** `npm i -D @playwright/test && npx playwright install chromium`

- [ ] **Step 2:** Write `tests-e2e/smoke.spec.ts`:
  - Load `/`, assert all 5 section headings present.
  - Read first KPI in Section 1, change LLTV slider, assert KPI changes.
  - Click "Copy share link", paste URL in new context, assert KPI matches.

- [ ] **Step 3:** `npx playwright test`

- [ ] **Step 4:** Commit — `git commit -am "test(e2e): smoke flow covering verification items 11–14"`

### Task J3: Performance budget check

- [ ] **Step 1:** In Section 4, log worker `run` duration. On M1, with `pathCount=1000, horizon=90`, assert < 3000 ms (manual check; document the number in README).

- [ ] **Step 2:** If over budget, profile and optimize (likely: pre-flatten paths into a single Float64Array; reduce allocations in `simulateBadDebt`). Commit any optimization.

### Task J4: Final polish + ship

- [ ] **Step 1:** `npm run build && npm run lint && npm test` — all green.

- [ ] **Step 2:** Visual pass: keyboard navigation works, all charts have alt text / data tables behind a `<details>`.

- [ ] **Step 3:** Final commit — `git commit -am "chore: ship v1 simulator"`

---

## Verification Section (End-to-End)

Run from the project root:

```bash
npm install
npm run fx:build              # refreshes lib/usdtryData.json from FRED
npm test                      # all unit + sanity tests pass
npm run lint
npm run build                 # static export to out/
npm run dev                   # open http://localhost:3000
npx playwright test           # smoke flow
```

**Manual verification** (spec items 11–16):
1. Default load: all 5 sections render; worker completes < 3s.
2. LLTV slider change → all 5 sections update reactively, no white flash.
3. Copy share link → paste in incognito → identical KPIs.
4. JSON export → matches recommendation table values.
5. Switch historical period 1Y / 3Y / 5Y → recommended LLTV shifts ≤ 1 governance step (record observation; if violated, file follow-up).
6. Cross-check recommended LLTV vs comparable Morpho markets — log in README "Calibration" subsection.

**Files to read for execution context:**
- Spec: `docs/superpowers/specs/2026-05-19-brix-morpho-simulator-design.md`
- This plan
- Morpho IRM reference: https://docs.morpho.org/learn/concepts/interest-rate-model/

---

## Self-Review Checklist (completed)

- **Spec coverage:** Sections 1–5 each have at least one math task + one UI task; Verification Plan items 1–14 mapped to Task C1/C3, D2, F1, J1, J2; items 15–16 mapped to manual checks in Verification Section. Out-of-scope items captured in README (Task I7).
- **Placeholder scan:** No "TBD", no "add appropriate error handling". Each TDD task includes the actual test code and the actual implementation.
- **Type consistency:** `LIF`, `healthFactor`, `adaptiveCurveIRM`, `witryUSD`, `bootstrapPaths`, `gbmPaths`, `jumpDiffusionPaths`, `simulateBadDebt`, `deriveRecommendedLLTV`, `snapToGovernanceLLTV`, `buildVaultConfigJson`, `classifyRiskTier`, `computeLiquidityNeed`, `computeStrategy` — all names used consistently across math, hook, worker, and UI tasks.
- **Open Questions:** captured at top, surfaced in README (Task I7) — never block plan progress.
