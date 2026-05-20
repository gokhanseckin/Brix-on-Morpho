# Dashboard Help System — PR #1 (Infrastructure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working but empty help system: every sidebar parameter has an ⓘ icon (stub copy), every output KPI/chart has a `?` button that opens a popover ("Coming soon" with a link), and `/help/<section>` pages exist with stub content. Content lands in PRs #2–#6.

**Architecture:** Two-tier UX. `<InfoTooltip>` for sidebar params (hover/focus/tap). `<HelpPopover>` for KPI/chart `?` buttons → opens a popover with a "More info → /help/<section>#<anchor>" link. Content lives in a single registry at `lib/help/registry.ts`, with type-driven completeness tests so dropping a sidebar input without help breaks CI. KaTeX and mermaid are lazy-loaded only on `/help/*` routes via `next/dynamic`.

**Tech Stack:** Next.js 14 App Router (static export, `output: 'export'`), React 18, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind, Vitest + Testing Library, Playwright, KaTeX + react-katex (new dep, lazy), mermaid (new dep, lazy). No new tooltip/popover library — custom Tailwind + ~60 LOC.

**Spec:** `docs/superpowers/specs/2026-05-20-dashboard-help-system-design.md`

---

## File map

**New files:**

| Path | Responsibility |
|---|---|
| `lib/help/types.ts` | `ParamHelp`, `KpiHelp`, `ChartHelp` shapes; `ParamSource` union. |
| `lib/help/registry.ts` | `PARAM_HELP`, `KPI_HELP`, `CHART_HELP` — single source of truth. Stub entries in PR #1. |
| `lib/help/kpiKeys.ts` | Const array of every KPI key the dashboard renders. Drives the completeness test. |
| `lib/help/chartKeys.ts` | Const array of every chart key. Drives the completeness test. |
| `app/components/help/InfoTooltip.tsx` | ⓘ icon + tooltip (sidebar). |
| `app/components/help/HelpPopover.tsx` | `?` button + popover (KPIs/charts). |
| `app/components/help/HelpSection.tsx` | Shared A/B/C renderer for popover and `/help`. |
| `app/components/help/WorkedExample.tsx` | Plugs live `useSimulator()` values into a formula. Stub in PR #1 — full impl in section PRs. |
| `app/components/help/KatexBlock.tsx` | Lazy KaTeX renderer (`next/dynamic`, ssr: false). |
| `app/components/help/MermaidDiagram.tsx` | Lazy mermaid renderer (`next/dynamic`, ssr: false). |
| `app/help/layout.tsx` | `/help` shell: section nav + back-to-dashboard link. |
| `app/help/page.tsx` | `/help` index — links to the 5 section pages. |
| `app/help/liquidity-need/page.tsx` | Section page (stub content in PR #1). |
| `app/help/fx-risk/page.tsx` | Section page (stub). |
| `app/help/strategy/page.tsx` | Section page (stub). |
| `app/help/liquidation/page.tsx` | Section page (stub). |
| `app/help/vault/page.tsx` | Section page (stub). |
| `tests/help/registry.test.ts` | Completeness + shape tests. |
| `tests/help/InfoTooltip.test.tsx` | Hover/focus/tap behavior. |
| `tests/help/HelpPopover.test.tsx` | Open/close, Esc, focus return. |
| `tests-e2e/help.spec.ts` | Click `?` → popover visible → Esc → dismissed + focus returned. Navigate to `/help/liquidity-need`. |

**Modified files:**

| Path | Change |
|---|---|
| `app/components/Sidebar.tsx` | Each parameter label wrapped with `<InfoTooltip helpKey={...} />`. |
| `app/components/Kpi.tsx` | Add optional `helpKey?: string` prop; render `<HelpPopover>` next to label when present. |
| `app/components/sections/LiquidityNeed.tsx` | Pass `helpKey` to every `<Kpi>`; wrap chart title with `<HelpPopover>`. |
| `app/components/sections/FXRisk.tsx` | Same pattern. |
| `app/components/sections/LiquidityStrategy.tsx` | Same. |
| `app/components/sections/LiquidationDesign.tsx` | Same. |
| `app/components/sections/VaultRecommendations.tsx` | Same. |
| `package.json` | Add `katex`, `react-katex`, `mermaid` deps; types. |
| `app/globals.css` | Import KaTeX CSS only on `/help` routes — handled via dynamic import inside `<KatexBlock>` instead; no change here. |

---

## Tasks

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install runtime + type deps**

Run:
```bash
npm install katex react-katex mermaid
npm install --save-dev @types/katex
```

Expected: `package.json` shows new entries under `dependencies` (`katex`, `react-katex`, `mermaid`) and `devDependencies` (`@types/katex`). `package-lock.json` updated.

- [ ] **Step 2: Verify dashboard build still passes**

Run: `npm run build`
Expected: build completes, `out/` directory regenerated, no new warnings about bundle size on the dashboard route.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add katex, react-katex, mermaid for /help pages"
```

---

### Task 2: Define help types

**Files:**
- Create: `lib/help/types.ts`

- [ ] **Step 1: Write the types**

```ts
// lib/help/types.ts
import type { SidebarInputs } from '@/types/simulator';

export interface ParamHelp {
  /** One short line. What it controls + directional consequence. */
  oneLiner: string;
}

export type ParamSource = 'sidebar' | 'derived' | 'constant';

export interface FormulaSpec {
  /** Monospace, rendered in popover. */
  plain: string;
  /** KaTeX, rendered on /help (falls back to plain if absent). */
  latex?: string;
}

export interface KpiHelpParam {
  name: string;
  source: ParamSource;
  ref?: keyof SidebarInputs;
  /** For constants: e.g. "$1", "0.20". */
  value?: string;
  note?: string;
}

export interface KpiImpact {
  health: string;
  sustainability: string;
  profitability: string;
}

export interface KpiHelp {
  title: string;
  oneLiner: string;
  formula: FormulaSpec;
  params: KpiHelpParam[];
  definitions: Array<{ term: string; definition: string }>;
  impact: KpiImpact;
  /** Worked example. Rendered only on /help. */
  workedExample?: {
    description: string;
    steps: Array<{
      label: string;
      expression: string;
      usesInputs: Array<keyof SidebarInputs>;
    }>;
  };
  /** Chart key to render under the entry on /help. */
  chart?: { component: string };
  /** Raw mermaid syntax, rendered on /help. */
  diagram?: { mermaid: string };
  /** Reserved for future cross-references. Not rendered in PR #1. */
  related?: string[];
}

export interface ChartHelp extends Omit<KpiHelp, 'formula' | 'params'> {
  axes: { x: string; y: string };
  bands?: Array<{ name: string; meaning: string }>;
}

/** Which dashboard section a KPI/chart belongs to (drives /help anchor link). */
export type HelpSection =
  | 'liquidity-need'
  | 'fx-risk'
  | 'strategy'
  | 'liquidation'
  | 'vault';
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/help/types.ts
git commit -m "feat(help): define help registry types"
```

---

### Task 3: Enumerate KPI and chart keys

**Files:**
- Create: `lib/help/kpiKeys.ts`
- Create: `lib/help/chartKeys.ts`

- [ ] **Step 1: List KPI keys**

```ts
// lib/help/kpiKeys.ts
// Every numeric KPI rendered on the dashboard. Sections add to this list
// as they introduce KPIs; the registry test enforces a corresponding entry.
import type { HelpSection } from './types';

export const KPI_KEYS = [
  // LiquidityNeed (section 1)
  'maxBorrowable',
  'expectedBorrow',
  'requiredUSDM',
  'withdrawalBuffer',
  'requiredPlusBuffer',
  'liquidityFloor',
  'lltvSensitivity',
  // FXRisk (section 2)
  'threeDayMaxDrawdownP50',
  'threeDayMaxDrawdownP95',
  'expectedLiquidationVolumeP95',
  'annualizedVol',
  // LiquidityStrategy (section 3)
  'borrowAPY',
  'grossSupplyAPY',
  'netSupplyAPY',
  'incentiveAPY',
  'totalSupplyAPY',
  'daysToTarget',
  'retentionAfterIncentives',
  'totalIncentiveSpend',
  'leverageLoopAPY',
  // LiquidationDesign (section 4)
  'minProfitableLiquidation',
  'maxProfitableLiquidation',
  'recommendedPoolDepth',
  'badDebtP95USD',
  'badDebtP95Pct',
  'preLiquidationParams',
  // VaultRecommendations (section 5)
  'recommendedLLTV',
  'riskTier',
  'vaultConfigJson',
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

export const KPI_SECTION: Record<KpiKey, HelpSection> = {
  maxBorrowable: 'liquidity-need',
  expectedBorrow: 'liquidity-need',
  requiredUSDM: 'liquidity-need',
  withdrawalBuffer: 'liquidity-need',
  requiredPlusBuffer: 'liquidity-need',
  liquidityFloor: 'liquidity-need',
  lltvSensitivity: 'liquidity-need',
  threeDayMaxDrawdownP50: 'fx-risk',
  threeDayMaxDrawdownP95: 'fx-risk',
  expectedLiquidationVolumeP95: 'fx-risk',
  annualizedVol: 'fx-risk',
  borrowAPY: 'strategy',
  grossSupplyAPY: 'strategy',
  netSupplyAPY: 'strategy',
  incentiveAPY: 'strategy',
  totalSupplyAPY: 'strategy',
  daysToTarget: 'strategy',
  retentionAfterIncentives: 'strategy',
  totalIncentiveSpend: 'strategy',
  leverageLoopAPY: 'strategy',
  minProfitableLiquidation: 'liquidation',
  maxProfitableLiquidation: 'liquidation',
  recommendedPoolDepth: 'liquidation',
  badDebtP95USD: 'liquidation',
  badDebtP95Pct: 'liquidation',
  preLiquidationParams: 'liquidation',
  recommendedLLTV: 'vault',
  riskTier: 'vault',
  vaultConfigJson: 'vault',
};
```

- [ ] **Step 2: List chart keys**

```ts
// lib/help/chartKeys.ts
import type { HelpSection } from './types';

export const CHART_KEYS = [
  'irmCurve',              // LiquidityNeed
  'fxBands',               // FXRisk: P5/P50/P95 USD/TRY
  'netWitryUsdPaths',      // FXRisk
  'positionsUnderwater',   // FXRisk
  'badDebtHistogram',      // LiquidationDesign
] as const;

export type ChartKey = (typeof CHART_KEYS)[number];

export const CHART_SECTION: Record<ChartKey, HelpSection> = {
  irmCurve: 'liquidity-need',
  fxBands: 'fx-risk',
  netWitryUsdPaths: 'fx-risk',
  positionsUnderwater: 'fx-risk',
  badDebtHistogram: 'liquidation',
};
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/help/kpiKeys.ts lib/help/chartKeys.ts
git commit -m "feat(help): enumerate KPI and chart keys + section mapping"
```

---

### Task 4: Stub registry

**Files:**
- Create: `lib/help/registry.ts`

- [ ] **Step 1: Write the stub registry**

```ts
// lib/help/registry.ts
// Stub entries for PR #1. Real copy lands in PRs #2-#6.
import type { SidebarInputs } from '@/types/simulator';
import { KPI_KEYS, type KpiKey } from './kpiKeys';
import { CHART_KEYS, type ChartKey } from './chartKeys';
import type { ChartHelp, KpiHelp, ParamHelp } from './types';

const STUB_ONE_LINER = 'Coming soon. See /help for details.';

const STUB_KPI: KpiHelp = {
  title: 'Coming soon',
  oneLiner: STUB_ONE_LINER,
  formula: { plain: '(documentation pending)' },
  params: [],
  definitions: [],
  impact: {
    health: 'Pending.',
    sustainability: 'Pending.',
    profitability: 'Pending.',
  },
};

const STUB_CHART: ChartHelp = {
  title: 'Coming soon',
  oneLiner: STUB_ONE_LINER,
  axes: { x: 'pending', y: 'pending' },
  definitions: [],
  impact: {
    health: 'Pending.',
    sustainability: 'Pending.',
    profitability: 'Pending.',
  },
};

// PARAM_HELP must have an entry for every key of SidebarInputs.
// The registry test asserts this — adding a sidebar input without help breaks CI.
export const PARAM_HELP: Record<keyof SidebarInputs, ParamHelp> = {
  witryTVL_USD: { oneLiner: STUB_ONE_LINER },
  lltv: { oneLiner: STUB_ONE_LINER },
  targetUtilization: { oneLiner: STUB_ONE_LINER },
  borrowerLTVAlpha: { oneLiner: STUB_ONE_LINER },
  borrowerLTVBeta: { oneLiner: STUB_ONE_LINER },
  iTRYYieldAnnual: { oneLiner: STUB_ONE_LINER },
  usdtryBaseline: { oneLiner: STUB_ONE_LINER },
  historicalPeriod: { oneLiner: STUB_ONE_LINER },
  simulationMode: { oneLiner: STUB_ONE_LINER },
  simulationHorizonDays: { oneLiner: STUB_ONE_LINER },
  pathCount: { oneLiner: STUB_ONE_LINER },
  tryShockPct: { oneLiner: STUB_ONE_LINER },
  incentiveBudgetMonthly_USD: { oneLiner: STUB_ONE_LINER },
  attractionRate: { oneLiner: STUB_ONE_LINER },
  lockPeriodDays: { oneLiner: STUB_ONE_LINER },
  poolDepth_USD: { oneLiner: STUB_ONE_LINER },
  performanceFee: { oneLiner: STUB_ONE_LINER },
  managementFee: { oneLiner: STUB_ONE_LINER },
  safetyMargin: { oneLiner: STUB_ONE_LINER },
  preLiquidationEnabled: { oneLiner: STUB_ONE_LINER },
  blockBootstrap: { oneLiner: STUB_ONE_LINER },
  seed: { oneLiner: STUB_ONE_LINER },
};

export const KPI_HELP: Record<KpiKey, KpiHelp> = Object.fromEntries(
  KPI_KEYS.map((k) => [k, STUB_KPI]),
) as Record<KpiKey, KpiHelp>;

export const CHART_HELP: Record<ChartKey, ChartHelp> = Object.fromEntries(
  CHART_KEYS.map((k) => [k, STUB_CHART]),
) as Record<ChartKey, ChartHelp>;
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If TS complains that `PARAM_HELP` is missing a key, add it — that means a sidebar input has no stub.

- [ ] **Step 3: Commit**

```bash
git add lib/help/registry.ts
git commit -m "feat(help): stub PARAM_HELP, KPI_HELP, CHART_HELP registry"
```

---

### Task 5: Completeness tests for the registry

**Files:**
- Create: `tests/help/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/help/registry.test.ts
import { describe, expect, it } from 'vitest';
import { PARAM_HELP, KPI_HELP, CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS } from '@/lib/help/kpiKeys';
import { CHART_KEYS } from '@/lib/help/chartKeys';

// We can't enumerate keyof SidebarInputs at runtime, so we hard-code the
// expected list here. If a sidebar input is added without a PARAM_HELP entry,
// TS will fail in registry.ts; if one is removed without updating this list,
// this test fails. Either way, the drift is caught.
const EXPECTED_PARAM_KEYS = [
  'witryTVL_USD',
  'lltv',
  'targetUtilization',
  'borrowerLTVAlpha',
  'borrowerLTVBeta',
  'iTRYYieldAnnual',
  'usdtryBaseline',
  'historicalPeriod',
  'simulationMode',
  'simulationHorizonDays',
  'pathCount',
  'tryShockPct',
  'incentiveBudgetMonthly_USD',
  'attractionRate',
  'lockPeriodDays',
  'poolDepth_USD',
  'performanceFee',
  'managementFee',
  'safetyMargin',
  'preLiquidationEnabled',
  'blockBootstrap',
  'seed',
] as const;

describe('help registry', () => {
  it('PARAM_HELP has an entry for every expected sidebar input', () => {
    const got = Object.keys(PARAM_HELP).sort();
    const want = [...EXPECTED_PARAM_KEYS].sort();
    expect(got).toEqual(want);
  });

  it('every PARAM_HELP entry has a non-empty oneLiner', () => {
    for (const [k, v] of Object.entries(PARAM_HELP)) {
      expect(v.oneLiner, `PARAM_HELP.${k}.oneLiner empty`).toBeTruthy();
    }
  });

  it('KPI_HELP has an entry for every KPI_KEYS entry', () => {
    for (const k of KPI_KEYS) {
      expect(KPI_HELP[k], `KPI_HELP missing ${k}`).toBeDefined();
    }
  });

  it('every KPI_HELP entry has all required fields', () => {
    for (const [k, v] of Object.entries(KPI_HELP)) {
      expect(v.title, `KPI_HELP.${k}.title`).toBeTruthy();
      expect(v.formula.plain, `KPI_HELP.${k}.formula.plain`).toBeTruthy();
      expect(v.impact.health, `KPI_HELP.${k}.impact.health`).toBeTruthy();
      expect(v.impact.sustainability, `KPI_HELP.${k}.impact.sustainability`).toBeTruthy();
      expect(v.impact.profitability, `KPI_HELP.${k}.impact.profitability`).toBeTruthy();
    }
  });

  it('CHART_HELP has an entry for every CHART_KEYS entry', () => {
    for (const k of CHART_KEYS) {
      expect(CHART_HELP[k], `CHART_HELP missing ${k}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/help/registry.test.ts`
Expected: 5 tests pass.

- [ ] **Step 3: Negative check — delete one PARAM_HELP entry temporarily**

Manually remove the `seed` entry from `lib/help/registry.ts`. Run:
```bash
npx tsc --noEmit
```
Expected: TS error: `Property 'seed' is missing in type ...`. Restore the entry.

- [ ] **Step 4: Commit**

```bash
git add tests/help/registry.test.ts
git commit -m "test(help): registry completeness + field shape"
```

---

### Task 6: InfoTooltip component

**Files:**
- Create: `app/components/help/InfoTooltip.tsx`
- Create: `tests/help/InfoTooltip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/help/InfoTooltip.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoTooltip } from '@/app/components/help/InfoTooltip';

describe('InfoTooltip', () => {
  it('renders an info button with aria-label', () => {
    render(<InfoTooltip text="hello world" />);
    expect(screen.getByRole('button', { name: /more info/i })).toBeInTheDocument();
  });

  it('shows the tooltip text after click', () => {
    render(<InfoTooltip text="hello world" />);
    expect(screen.queryByText('hello world')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /more info/i }));
    expect(screen.getByText('hello world')).toBeVisible();
  });

  it('toggles closed on a second click', () => {
    render(<InfoTooltip text="hello world" />);
    const btn = screen.getByRole('button', { name: /more info/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText('hello world')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/help/InfoTooltip.test.tsx`
Expected: FAIL — `Cannot find module '@/app/components/help/InfoTooltip'`.

- [ ] **Step 3: Write the component**

```tsx
// app/components/help/InfoTooltip.tsx
'use client';
import { useId, useState } from 'react';

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        aria-label="More info"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 text-[10px] leading-none text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ⓘ
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 z-50 mt-1 w-64 -translate-x-1/2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-xs shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/help/InfoTooltip.test.tsx`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/components/help/InfoTooltip.tsx tests/help/InfoTooltip.test.tsx
git commit -m "feat(help): InfoTooltip component for sidebar params"
```

---

### Task 7: Wire InfoTooltip into Sidebar

**Files:**
- Modify: `app/components/Sidebar.tsx`

- [ ] **Step 1: Add the wrapper next to every parameter label**

Open `app/components/Sidebar.tsx`. Add the import at the top:

```tsx
import { InfoTooltip } from './help/InfoTooltip';
import { PARAM_HELP } from '@/lib/help/registry';
```

Then change each `NumberField`, `SelectField`, `RangeField`, `CheckboxField` to render an `InfoTooltip` next to its label. The cleanest way: extend each field component to accept a `helpKey?: keyof typeof PARAM_HELP` prop and render the tooltip in the label slot. Apply this once in each field component, not at every call site.

Edit `NumberField`:

```tsx
function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  helpKey?: keyof typeof PARAM_HELP;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-600 dark:text-neutral-400">
        {props.label}
        {props.helpKey && <InfoTooltip text={PARAM_HELP[props.helpKey].oneLiner} />}
      </span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (Number.isFinite(parsed)) props.onChange(parsed);
        }}
        className="rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm"
      />
    </label>
  );
}
```

Apply the analogous change to `RangeField`, `SelectField`, `CheckboxField`. For `RangeField`, the help icon goes after the value display.

Then pass `helpKey` at every call site, e.g.:

```tsx
<NumberField
  label="wiTRY TVL (USD)"
  helpKey="witryTVL_USD"
  value={s.witryTVL_USD}
  onChange={(v) => setS({ witryTVL_USD: v })}
  min={100_000}
  max={100_000_000}
  step={100_000}
/>
```

Add `helpKey` to all 22 field instances. The key matches the `SidebarInputs` field name.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Visually verify**

Run the dev server (`npm run dev` in another shell — may already be running on port 3000). Open `http://localhost:3000/`. Hover one ⓘ icon — tooltip with "Coming soon" appears. Tab to it via keyboard — same.

- [ ] **Step 5: Commit**

```bash
git add app/components/Sidebar.tsx
git commit -m "feat(sidebar): wire InfoTooltip into all parameter fields"
```

---

### Task 8: HelpSection (shared A/B/C renderer)

**Files:**
- Create: `app/components/help/HelpSection.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/components/help/HelpSection.tsx
'use client';
import type { KpiHelp } from '@/lib/help/types';

export function HelpSection({ help }: { help: KpiHelp }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-neutral-700 dark:text-neutral-300">{help.oneLiner}</p>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
          A. How it&apos;s calculated
        </h3>
        <pre className="font-mono text-xs whitespace-pre-wrap bg-neutral-100 dark:bg-neutral-800 rounded p-2">
          {help.formula.plain}
        </pre>
        {help.params.length > 0 && (
          <ul className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 space-y-0.5">
            {help.params.map((p) => (
              <li key={p.name}>
                <span className="font-mono">{p.name}</span>{' '}
                <span className="text-neutral-500">[{p.source}{p.value ? `: ${p.value}` : ''}]</span>
                {p.note && <span className="ml-1 text-neutral-500">— {p.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
          B. Definitions
        </h3>
        {help.definitions.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">No definitions yet.</p>
        ) : (
          <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
            {help.definitions.map((d) => (
              <li key={d.term}>
                <span className="font-medium">{d.term}:</span> {d.definition}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
          C. Impact on vault
        </h3>
        <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
          <li><span className="font-medium">Health:</span> {help.impact.health}</li>
          <li><span className="font-medium">Sustainability:</span> {help.impact.sustainability}</li>
          <li><span className="font-medium">Profitability:</span> {help.impact.profitability}</li>
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/components/help/HelpSection.tsx
git commit -m "feat(help): HelpSection shared A/B/C renderer"
```

---

### Task 9: HelpPopover component

**Files:**
- Create: `app/components/help/HelpPopover.tsx`
- Create: `tests/help/HelpPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/help/HelpPopover.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HelpPopover } from '@/app/components/help/HelpPopover';

describe('HelpPopover', () => {
  it('renders a ? button', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    expect(screen.getByRole('button', { name: /help: liquidity floor/i })).toBeInTheDocument();
  });

  it('opens the popover on click', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    fireEvent.click(screen.getByRole('button', { name: /help: liquidity floor/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/how it's calculated/i)).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    const btn = screen.getByRole('button', { name: /help: liquidity floor/i });
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(btn);
  });

  it('renders a More info link to the right section anchor', () => {
    render(<HelpPopover kpiKey="liquidityFloor" />);
    fireEvent.click(screen.getByRole('button', { name: /help: liquidity floor/i }));
    const link = screen.getByRole('link', { name: /more info/i });
    expect(link).toHaveAttribute('href', '/help/liquidity-need#liquidityFloor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/help/HelpPopover.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// app/components/help/HelpPopover.tsx
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { KPI_HELP } from '@/lib/help/registry';
import { CHART_HELP } from '@/lib/help/registry';
import { KPI_SECTION, type KpiKey } from '@/lib/help/kpiKeys';
import { CHART_SECTION, type ChartKey } from '@/lib/help/chartKeys';
import { HelpSection } from './HelpSection';

type Props =
  | { kpiKey: KpiKey; chartKey?: never }
  | { kpiKey?: never; chartKey: ChartKey };

export function HelpPopover(props: Props) {
  const isKpi = 'kpiKey' in props && props.kpiKey !== undefined;
  const help = isKpi ? KPI_HELP[props.kpiKey!] : CHART_HELP[props.chartKey!];
  const section = isKpi ? KPI_SECTION[props.kpiKey!] : CHART_SECTION[props.chartKey!];
  const anchor = isKpi ? props.kpiKey! : props.chartKey!;
  const triggerLabel = `Help: ${help.title}`;

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const dlg = document.getElementById(id);
      if (dlg && !dlg.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, id]);

  // For PR #1, every entry is a stub but we need a sensible title for aria.
  // Section PRs replace stub titles with the real KPI label.
  const effectiveTitle = help.title === 'Coming soon' ? humanize(anchor) : help.title;

  return (
    <span className="relative inline-block align-middle ml-2">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Help: ${effectiveTitle}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-400 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-modal="false"
          aria-label={effectiveTitle}
          className="absolute right-0 z-50 mt-2 w-[380px] max-h-[80vh] overflow-auto rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 shadow-xl sm:right-0 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-lg max-sm:rounded-b-none max-sm:w-auto"
        >
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-sm font-semibold">{effectiveTitle}</h2>
            <button
              type="button"
              aria-label="Close help"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              ×
            </button>
          </div>
          <HelpSection help={isKpi ? KPI_HELP[props.kpiKey!] : asKpiHelp(CHART_HELP[props.chartKey!])} />
          <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 text-right">
            <Link
              href={`/help/${section}#${anchor}`}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              More info →
            </Link>
          </div>
        </div>
      )}
    </span>
  );
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// Adapt ChartHelp (no formula/params) to the KpiHelp-shaped renderer.
function asKpiHelp(ch: import('@/lib/help/types').ChartHelp): import('@/lib/help/types').KpiHelp {
  return {
    title: ch.title,
    oneLiner: ch.oneLiner,
    formula: { plain: `Axes: x=${ch.axes.x}, y=${ch.axes.y}` },
    params: [],
    definitions: ch.definitions,
    impact: ch.impact,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/help/HelpPopover.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/components/help/HelpPopover.tsx tests/help/HelpPopover.test.tsx
git commit -m "feat(help): HelpPopover with focus management + section link"
```

---

### Task 10: Extend Kpi with helpKey prop

**Files:**
- Modify: `app/components/Kpi.tsx`

- [ ] **Step 1: Edit Kpi.tsx**

Replace `app/components/Kpi.tsx` with:

```tsx
'use client';
import { HelpPopover } from './help/HelpPopover';
import type { KpiKey } from '@/lib/help/kpiKeys';

export function Kpi({
  label,
  value,
  hint,
  tone,
  helpKey,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  helpKey?: KpiKey;
}) {
  const toneCls =
    tone === 'good'
      ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30'
      : tone === 'warn'
        ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/30'
        : tone === 'bad'
          ? 'border-red-500/50 bg-red-50 dark:bg-red-950/30'
          : 'border-neutral-300 dark:border-neutral-700';
  return (
    <div className={`p-4 border rounded-lg ${toneCls}`}>
      <div className="text-xs uppercase tracking-wide text-neutral-500 flex items-center">
        <span>{label}</span>
        {helpKey && <HelpPopover kpiKey={helpKey} />}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-neutral-500 mt-1">{hint}</div>}
    </div>
  );
}

export function formatUSD(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function formatPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
```

- [ ] **Step 2: Verify typecheck and existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean typecheck, all tests pass (existing 43 + new 12 from help tests = 55+).

- [ ] **Step 3: Commit**

```bash
git add app/components/Kpi.tsx
git commit -m "feat(kpi): optional helpKey prop renders HelpPopover"
```

---

### Task 11: Wire helpKey into all section components

**Files:**
- Modify: `app/components/sections/LiquidityNeed.tsx`
- Modify: `app/components/sections/FXRisk.tsx`
- Modify: `app/components/sections/LiquidityStrategy.tsx`
- Modify: `app/components/sections/LiquidationDesign.tsx`
- Modify: `app/components/sections/VaultRecommendations.tsx`

- [ ] **Step 1: Add helpKey to every `<Kpi>` in each section**

Open each section file. For each `<Kpi>` element, add a `helpKey="<key>"` prop where `<key>` is the matching `KPI_KEYS` entry. Example for `LiquidityNeed.tsx`:

```tsx
<Kpi
  label="Liquidity Floor"
  helpKey="liquidityFloor"
  value={formatUSD(liquidity.liquidityFloor_USD)}
  hint="20% of required, or dead-deposit cost"
/>
<Kpi
  label="Required (steady-state)"
  helpKey="requiredUSDM"
  value={formatUSD(liquidity.requiredUSDM)}
  hint={`TVL × LLTV × E[LTV] / u_target`}
/>
<Kpi
  label="Required + Buffer"
  helpKey="requiredPlusBuffer"
  value={formatUSD(liquidity.requiredUSDM + liquidity.withdrawalBuffer_USD)}
/>
```

Repeat across all five section components. Map every `<Kpi>` label to its `KPI_KEYS` key.

- [ ] **Step 2: Wire chart `?` buttons**

For each chart in the section components, wrap its title in a flex container with a `<HelpPopover chartKey="..." />`. Example:

```tsx
import { HelpPopover } from '../help/HelpPopover';

// somewhere in LiquidityNeed.tsx, next to the IRM chart title:
<div className="flex items-center gap-1">
  <h3 className="text-sm font-medium">IRM curve</h3>
  <HelpPopover chartKey="irmCurve" />
</div>
```

Add to every chart in `LiquidityNeed`, `FXRisk`, `LiquidationDesign`. See `CHART_KEYS` for the full list.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green.

- [ ] **Step 4: Visually verify**

Open `http://localhost:3000/`. Each KPI shows a `?` button. Click one → popover opens with stub content + "More info →" link.

- [ ] **Step 5: Commit**

```bash
git add app/components/sections/
git commit -m "feat(sections): wire helpKey into every KPI and chart"
```

---

### Task 12: KatexBlock (lazy KaTeX renderer)

**Files:**
- Create: `app/components/help/KatexBlock.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/components/help/KatexBlock.tsx
'use client';
import dynamic from 'next/dynamic';

// react-katex's BlockMath, lazy-loaded so it never enters the dashboard bundle.
// SSR off — KaTeX renders to DOM in client only, which is fine for a static export.
const BlockMath = dynamic(
  () => import('react-katex').then((m) => m.BlockMath),
  { ssr: false, loading: () => <span className="font-mono text-xs">loading math…</span> },
);

import 'katex/dist/katex.min.css';

export function KatexBlock({ latex, fallback }: { latex?: string; fallback: string }) {
  if (!latex) {
    return <pre className="font-mono text-xs whitespace-pre-wrap">{fallback}</pre>;
  }
  return <BlockMath math={latex} />;
}
```

- [ ] **Step 2: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: typecheck clean, build succeeds. Check `out/_next/static/chunks/` — KaTeX CSS should be in a help-related chunk, not in the main app chunk.

- [ ] **Step 3: Commit**

```bash
git add app/components/help/KatexBlock.tsx
git commit -m "feat(help): KatexBlock lazy KaTeX renderer for /help pages"
```

---

### Task 13: MermaidDiagram (lazy mermaid renderer)

**Files:**
- Create: `app/components/help/MermaidDiagram.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/components/help/MermaidDiagram.tsx
'use client';
import { useEffect, useId, useRef, useState } from 'react';

export function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        const { svg } = await mermaid.render(`mermaid-${id}`, source);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return (
      <pre className="font-mono text-xs text-red-600 whitespace-pre-wrap border border-red-200 rounded p-2">
        mermaid error: {error}
      </pre>
    );
  }
  return <div ref={ref} className="not-prose" />;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. Mermaid should not appear in the dashboard chunk.

- [ ] **Step 3: Commit**

```bash
git add app/components/help/MermaidDiagram.tsx
git commit -m "feat(help): MermaidDiagram lazy renderer for /help diagrams"
```

---

### Task 14: WorkedExample component (stub for PR #1)

**Files:**
- Create: `app/components/help/WorkedExample.tsx`

- [ ] **Step 1: Write the stub**

```tsx
// app/components/help/WorkedExample.tsx
'use client';
import { useSimulator } from '@/lib/useSimulator';
import type { KpiHelp } from '@/lib/help/types';

// In PR #1 this is a stub: it renders the description + the step expressions
// verbatim. Section PRs will use `useSimulator()` to substitute live values
// into each step expression. The useSimulator() import stays here so the wiring
// is in place; just unused for now.
export function WorkedExample({ example }: { example: NonNullable<KpiHelp['workedExample']> }) {
  void useSimulator(); // wire is here for PR #2+
  return (
    <div className="text-sm space-y-2">
      <p className="text-neutral-700 dark:text-neutral-300">{example.description}</p>
      <ol className="list-decimal list-inside space-y-1 font-mono text-xs">
        {example.steps.map((s, i) => (
          <li key={i}>
            <span className="text-neutral-500">{s.label}:</span> {s.expression}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/components/help/WorkedExample.tsx
git commit -m "feat(help): WorkedExample stub (live substitution in PR #2+)"
```

---

### Task 15: /help shell — layout + index

**Files:**
- Create: `app/help/layout.tsx`
- Create: `app/help/page.tsx`

- [ ] **Step 1: Write the layout**

```tsx
// app/help/layout.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

const SECTIONS: Array<{ slug: string; label: string }> = [
  { slug: 'liquidity-need', label: '1. Liquidity Need' },
  { slug: 'fx-risk', label: '2. FX Risk' },
  { slug: 'strategy', label: '3. Strategy' },
  { slug: 'liquidation', label: '4. Liquidation' },
  { slug: 'vault', label: '5. Vault' },
];

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <h1 className="text-lg font-semibold">Help</h1>
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to dashboard
        </Link>
      </header>
      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        {SECTIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/help/${s.slug}`}
            className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Write the index page**

```tsx
// app/help/page.tsx
import Link from 'next/link';

const SECTIONS: Array<{ slug: string; label: string; blurb: string }> = [
  { slug: 'liquidity-need', label: '1. Liquidity Need', blurb: 'How much USDM the vault must hold.' },
  { slug: 'fx-risk', label: '2. FX Risk', blurb: 'USD/TRY shocks, drawdowns, positions underwater.' },
  { slug: 'strategy', label: '3. Strategy', blurb: 'APYs, incentives, days to target.' },
  { slug: 'liquidation', label: '4. Liquidation', blurb: 'Liquidator economics and bad debt.' },
  { slug: 'vault', label: '5. Vault', blurb: 'Recommended LLTV, risk tier, deploy JSON.' },
];

export default function HelpIndex() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Pick a section to read detailed explanations, formulas, worked examples, and diagrams.
      </p>
      <ul className="space-y-2">
        {SECTIONS.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/help/${s.slug}`}
              className="block rounded border border-neutral-300 dark:border-neutral-700 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span className="font-medium">{s.label}</span>{' '}
              <span className="text-sm text-neutral-500">— {s.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Verify dev server renders /help**

Visit `http://localhost:3000/help`. See heading, 5 section cards, back link.

- [ ] **Step 4: Commit**

```bash
git add app/help/layout.tsx app/help/page.tsx
git commit -m "feat(help): /help shell layout and index page"
```

---

### Task 16: Section page stubs (5 pages)

**Files:**
- Create: `app/help/liquidity-need/page.tsx`
- Create: `app/help/fx-risk/page.tsx`
- Create: `app/help/strategy/page.tsx`
- Create: `app/help/liquidation/page.tsx`
- Create: `app/help/vault/page.tsx`

- [ ] **Step 1: Write each stub page**

Each page renders, for every KPI/chart whose `HelpSection` is this section, an `<h3 id="<key>">` anchor + a stub note. Real content lands in PRs #2-#6.

Example for `liquidity-need/page.tsx`:

```tsx
// app/help/liquidity-need/page.tsx
import { KPI_HELP } from '@/lib/help/registry';
import { CHART_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';

export default function HelpLiquidityNeed() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'liquidity-need');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'liquidity-need');
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">1. Liquidity Need</h2>
      {kpis.map((k) => (
        <Entry key={k} id={k} title={KPI_HELP[k].title} oneLiner={KPI_HELP[k].oneLiner} />
      ))}
      {charts.map((c) => (
        <Entry key={c} id={c} title={CHART_HELP[c].title} oneLiner={CHART_HELP[c].oneLiner} />
      ))}
    </div>
  );
}

function Entry({ id, title, oneLiner }: { id: string; title: string; oneLiner: string }) {
  return (
    <section id={id}>
      <h3 className="text-base font-semibold">{title === 'Coming soon' ? humanize(id) : title}</h3>
      <p className="text-sm text-neutral-500 mt-1">{oneLiner}</p>
      <p className="text-xs text-neutral-400 italic mt-2">
        Full formula, worked example, chart, and diagram land in a follow-up PR.
      </p>
    </section>
  );
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}
```

Repeat the analogous file for `fx-risk`, `strategy`, `liquidation`, `vault` — same shape, filter by the matching section slug.

- [ ] **Step 2: Verify dev server renders all 5**

Visit `http://localhost:3000/help/liquidity-need`, `/help/fx-risk`, `/help/strategy`, `/help/liquidation`, `/help/vault`. Each shows the section header and one stub entry per KPI/chart belonging to that section.

- [ ] **Step 3: Verify static export builds them**

Run: `npm run build`
Expected: build succeeds. Check `out/help/liquidity-need/index.html`, `out/help/fx-risk/index.html`, etc. all exist:

```bash
ls out/help/*/index.html
```

Expected: 5 files listed.

- [ ] **Step 4: Commit**

```bash
git add app/help/
git commit -m "feat(help): 5 section page stubs (liquidity-need..vault)"
```

---

### Task 17: E2E test for help system

**Files:**
- Create: `tests-e2e/help.spec.ts`

- [ ] **Step 1: Write the e2e test**

```ts
// tests-e2e/help.spec.ts
import { test, expect } from '@playwright/test';

test('clicking a KPI ? button opens a popover with A/B/C sections', async ({ page }) => {
  await page.goto('/');
  // Pick the Liquidity Floor ? button (first KPI in section 1).
  const trigger = page.getByRole('button', { name: /help: liquidity floor/i }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/how it's calculated/i)).toBeVisible();
  await expect(dialog.getByText(/definitions/i)).toBeVisible();
  await expect(dialog.getByText(/impact on vault/i)).toBeVisible();
  await expect(dialog.getByRole('link', { name: /more info/i })).toHaveAttribute(
    'href',
    '/help/liquidity-need#liquidityFloor',
  );
});

test('Esc closes the popover and returns focus to the trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /help: liquidity floor/i }).first();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('/help/liquidity-need renders all section entries', async ({ page }) => {
  await page.goto('/help/liquidity-need');
  await expect(page.getByRole('heading', { name: '1. Liquidity Need' })).toBeVisible();
  // Anchor for the Liquidity Floor entry exists.
  await expect(page.locator('#liquidityFloor')).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npm run test:e2e -- tests-e2e/help.spec.ts`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests-e2e/help.spec.ts
git commit -m "test(e2e): help popover + /help routing"
```

---

### Task 18: Verify bundle budget

**Files:** none (verification only)

- [ ] **Step 1: Build and measure**

Run:
```bash
npm run build
```

Inspect `out/_next/static/chunks/`:
```bash
ls -lh out/_next/static/chunks/*.js | sort -k5 -h | tail -10
```

Expected: the largest dashboard chunk is no more than ~5KB larger than before the PR (run `git stash && npm run build && ls -lh out/_next/static/chunks/*.js | sort -k5 -h | tail -10` on `main` for comparison, then `git stash pop`). KaTeX and mermaid should appear in chunks only loaded by `/help` routes; check by grepping:

```bash
grep -l "katex" out/_next/static/chunks/*.js | head
grep -l "mermaid" out/_next/static/chunks/*.js | head
```

Expected: the matched files are NOT the main app bundle. They should be dynamic-import chunks (typically named with `app/help/`-derived hashes).

- [ ] **Step 2: If budget exceeded**

If the dashboard chunk grew >5KB:
- Double-check `KatexBlock.tsx` and `MermaidDiagram.tsx` both use `next/dynamic` with `ssr: false`.
- Move the `import 'katex/dist/katex.min.css'` from `KatexBlock.tsx` into the dynamic import body if Next is hoisting it.

- [ ] **Step 3: Commit any bundle-related fixes**

```bash
git add app/components/help/
git commit -m "perf(help): keep katex+mermaid out of dashboard chunk"
```

(Skip if no fix needed.)

---

### Task 19: Run full test suite + lint, push branch, open PR

**Files:** none

- [ ] **Step 1: Full check**

Run:
```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

Expected: all green.

- [ ] **Step 2: Run e2e suite (full, not just help)**

Run: `npm run test:e2e`
Expected: all pass — existing smoke + perf + new help spec.

- [ ] **Step 3: Push and open PR**

Run:
```bash
git push -u origin <current-branch>
gh pr create --title "Dashboard help system — infrastructure (PR #1 of 6)" --body "$(cat <<'EOF'
## Summary
Ships the empty scaffolding for the dashboard help system per [the design spec](docs/superpowers/specs/2026-05-20-dashboard-help-system-design.md).

- Every sidebar parameter gets an ⓘ tooltip (stub copy)
- Every KPI and chart gets a `?` popover (stub copy) with A/B/C structure and a link to `/help/<section>#<anchor>`
- 5 `/help/<section>` routes statically generated with stub entries
- KaTeX and mermaid lazy-loaded only on `/help` routes; dashboard bundle unaffected
- Type-driven completeness tests catch drift if a KPI/param is added without help

Content (real prose, formulas, examples, charts, diagrams) lands in PRs #2-#6, one per dashboard section.

## Test plan
- [x] `npm run lint`
- [x] `npx tsc --noEmit`
- [x] `npm test` — registry completeness + tooltip + popover unit tests
- [x] `npm run test:e2e` — popover open/close, focus return, /help routing
- [x] `npm run build` — static export produces `out/help/<section>/index.html` × 5
- [x] Dashboard chunk grew by ≤5KB; katex+mermaid in lazy chunks only

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Confirm PR URL**

Expected: PR URL printed. Verify it on GitHub: file list matches expectations, CI passes if configured.

---

## Self-review notes

- **Spec coverage**: every architecture section of the spec maps to a task. Components: tasks 6, 8, 9, 12, 13, 14. Registry: tasks 2, 3, 4, 5. Sidebar wiring: 7. KPI wiring: 10, 11. `/help` routes: 15, 16. Tests: 5, 6, 9, 17. Bundle budget: 18.
- **Placeholders**: every task has actual code. Stub data is intentional (the whole PR is infrastructure for empty stubs).
- **Type consistency**: `KpiKey` is exported from `lib/help/kpiKeys.ts` and consumed by `Kpi.tsx` (Task 10) and `HelpPopover.tsx` (Task 9). `helpKey` prop name used consistently. `ChartKey` analogous.
- **TDD discipline**: components with behavior (InfoTooltip, HelpPopover, registry) follow red-green-commit. Purely structural code (types, registry stubs, layout) doesn't — that's appropriate since there's no behavior to drive.
- **Acceptance criteria from spec**: completeness tests (✓ Task 5), `?` opens popover (✓ Tasks 9, 17), "More info →" routes correctly (✓ Tasks 9, 17), 5 section pages build statically (✓ Task 16), bundle budget (✓ Task 18). Worked examples, KaTeX rendering, mermaid rendering deferred to content PRs.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-dashboard-help-system-pr1-infrastructure.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
