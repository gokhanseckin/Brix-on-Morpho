# Dashboard Help System — Design Spec

**Date**: 2026-05-20
**Status**: Approved for implementation
**Author**: brainstormed in chat, written for the next session

## Goal

Make every parameter on the sidebar and every output on the dashboard self-explanatory, so a user can answer three questions about any output:

- **A.** How is this calculated, and which parameters directly impact it?
- **B.** What definitions do I need to understand it?
- **C.** How does it impact the **health**, **sustainability**, and **profitability** of the vault and market?

Two surfaces:

1. **Sidebar parameters** — brief tooltip (ⓘ icon, hover/focus/tap) explaining what the parameter does and the directional consequence of changing it.
2. **Output KPIs and charts** — detailed popover (`?` icon, click) answering A/B/C, with a "More info →" link to a dedicated `/help/<section>` page that adds worked numerical examples, live mini-charts, and mermaid flow diagrams.

## Non-goals

- Math rendering in popovers (plain monospace formulas only — KaTeX is `/help`-only).
- Cross-references between KPIs (`related` field exists in the type for future use, not rendered in phase 1).
- i18n (English only).
- Help-mode tour or first-run walkthrough.
- URL-synced popover state (deep-linking happens via `/help/<section>#<anchor>`).
- Full-text search across `/help`.

## UX

### Sidebar tooltip

A small ⓘ icon (~14px) appears next to each parameter label in `app/components/Sidebar.tsx`. Behavior:

- **Desktop**: tooltip on hover or keyboard focus of the icon, ~280px wide, 1–2 short lines.
- **Touch**: tap to toggle.
- Plain text only. No formulas, no formatting.

Example copy: *"Loan-to-value ceiling. Higher → more borrowing capacity, higher liquidation risk."*

### Output popover

A small `?` button (~16px) appears next to each KPI label and each chart title. Click opens a popover anchored to the button, ~380px wide × ~440px tall, dismisses on outside click or Esc.

Layout:

```
┌─ <Title> ────────────────────────── × ┐
│ <oneLiner sentence>                   │
│                                       │
│ A. How it's calculated                │
│   <plain monospace formula>           │
│   • <param>    [sidebar | derived |   │
│                 constant]             │
│                                       │
│ B. Definitions                        │
│   • <term>: <definition>              │
│                                       │
│ C. Impact on vault                    │
│   Health:         <1-2 sentences>     │
│   Sustainability: <1-2 sentences>     │
│   Profitability:  <1-2 sentences>     │
│                                       │
│              [ More info → /help ]    │
└───────────────────────────────────────┘
```

Content target: ~200–300 words total, fits viewport without scrolling.

**Mobile** (width < 640px): popover repositions as a bottom sheet that slides up from the screen bottom, full-width, max 80vh tall, scrollable inside.

### `/help/<section>` page

Five routes under `/help` (one per dashboard section). Each page renders, for every KPI/chart in that section:

1. The same A/B/C content from the popover (`<HelpSection>` is shared between popover and `/help`).
2. A **worked numerical example** that plugs the current `useSimulator()` values into the formula and walks step-by-step. Pulls live; numbers stay in sync with the sidebar.
3. A **live mini-chart** for visualizations that benefit (e.g. the IRM curve on the LiquidityNeed page). Reuses existing Recharts components.
4. A **mermaid flow diagram** where the math alone doesn't convey the sequence (e.g. liquidation cascade resolving to bad debt, FX shock propagating to position underwater %).

Formulas on `/help` render with **KaTeX** (lazy-loaded, code-split to `/help` routes only).

The `/help` shell (`app/help/layout.tsx`) provides a top-of-page nav linking to the five section pages and a "back to dashboard" link.

## Architecture

### File layout (new)

```
lib/help/
  types.ts              # ParamHelp, KpiHelp, ChartHelp shapes
  registry.ts           # PARAM_HELP, KPI_HELP, CHART_HELP — single source of truth
  formulas.ts           # KaTeX LaTeX strings reused between popover + /help

app/components/help/
  InfoTooltip.tsx       # ⓘ icon + tooltip for sidebar params
  HelpPopover.tsx       # ? button + popover for KPIs/charts
  HelpSection.tsx       # A/B/C block; shared between popover and /help
  WorkedExample.tsx     # Plugs live useSimulator values into a formula
  MermaidDiagram.tsx    # Lazy-loaded mermaid renderer
  KatexBlock.tsx        # Lazy-loaded KaTeX renderer (/help only)

app/help/
  layout.tsx            # /help shell with section nav + back-to-dashboard link
  page.tsx              # /help index — redirects or links to all 5 sections
  liquidity-need/page.tsx
  fx-risk/page.tsx
  strategy/page.tsx
  liquidation/page.tsx
  vault/page.tsx
```

### Existing files edited

- `app/components/Sidebar.tsx` — wrap each parameter label with `<InfoTooltip text={PARAM_HELP[key]} />`.
- `app/components/Kpi.tsx` — add optional `helpKey?: string` prop. When present, render `<HelpPopover helpKey={helpKey} />` next to the label.
- `app/components/sections/LiquidityNeed.tsx` — pass `helpKey` to each `<Kpi>`; wrap each chart title in a small flex container with the chart's `<HelpPopover>`.
- `app/components/sections/FXRisk.tsx` — same pattern.
- `app/components/sections/LiquidityStrategy.tsx` — same.
- `app/components/sections/LiquidationDesign.tsx` — same.
- `app/components/sections/VaultRecommendations.tsx` — same.

### Content registry shape

```ts
// lib/help/types.ts
import type { SidebarInputs } from '@/types/simulator';

export interface ParamHelp {
  oneLiner: string;        // e.g. "Total wiTRY collateral. Drives required USDM linearly."
}

export type ParamSource = 'sidebar' | 'derived' | 'constant';

export interface KpiHelp {
  title: string;
  oneLiner: string;
  formula: {
    plain: string;         // monospace, rendered in popover
    latex?: string;        // KaTeX, rendered on /help (falls back to plain if absent)
  };
  params: Array<{
    name: string;
    source: ParamSource;
    ref?: keyof SidebarInputs;
    value?: string;        // for constants: "$1", "0.20"
    note?: string;
  }>;
  definitions: Array<{ term: string; definition: string }>;
  impact: {
    health: string;
    sustainability: string;
    profitability: string;
  };
  // /help-only:
  workedExample?: {
    description: string;   // e.g. "Using your current sidebar values:"
    steps: Array<{
      label: string;
      expression: string;
      usesInputs: Array<keyof SidebarInputs>;
    }>;
  };
  chart?: {
    component: 'IRMCurve' | 'FXBands' | 'BadDebtHist' | 'PositionUnderwater' | string;
  };
  diagram?: {
    mermaid: string;       // raw mermaid syntax
  };
  related?: string[];      // KPI keys; reserved for future, not rendered in phase 1
}

export interface ChartHelp extends Omit<KpiHelp, 'formula' | 'params'> {
  axes: { x: string; y: string };
  bands?: Array<{ name: string; meaning: string }>;
}

// lib/help/registry.ts
export const PARAM_HELP: Record<keyof SidebarInputs, ParamHelp> = { ... };
export const KPI_HELP: Record<string, KpiHelp> = { ... };
export const CHART_HELP: Record<string, ChartHelp> = { ... };
```

### Coverage inventory

Per the inputs of `types/simulator.ts` and the current section components, scope is:

- **Sidebar params (22)**: every key of `SidebarInputs`.
- **LiquidityNeed (≈8)**: Max borrowable, Expected borrow, Required USDM (steady-state), Withdrawal buffer, Required + Buffer, Liquidity floor, IRM curve (chart), LLTV sensitivity table.
- **FXRisk (≈8)**: P5/P50/P95 USD/TRY bands (chart), Net wiTRY USD paths (chart), % positions underwater (chart), 3-day max drawdown, Expected liquidation volume (P95), Annualized vol.
- **LiquidityStrategy (≈8)**: Borrow APY, Gross supply APY, Net supply APY, Incentive APY, Total supply APY, Days to target, Retention after incentives, Total incentive spend, Leverage-loop APY + viability.
- **LiquidationDesign (≈5)**: Min/Max profitable liquidation size, Recommended pool depth, Bad-debt P95 ($ and %), Pre-liquidation params (preLLTV, preLCF, preLIF).
- **VaultRecommendations (≈3)**: Recommended LLTV, Risk tier, Vault config JSON.

Total: ~22 + ~32 ≈ 54 entries. (Exact counts firm up in PR #1 as I read the section components.)

## Dependencies

- **katex** + **react-katex**: ~70KB. Lazy-loaded via dynamic import inside `<KatexBlock>`. Only `/help/*` routes pull it; the dashboard bundle is unaffected.
- **mermaid**: ~200KB. Lazy-loaded inside `<MermaidDiagram>`, only when a diagram actually renders.
- **No tooltip/popover library.** Plain Tailwind + ~60 lines of custom positioning (anchor-aware, edge-aware) using the CSS-only popover API where supported, JS fallback otherwise. Avoids Radix to keep the static-export bundle lean and consistent with the project's "no runtime dependencies beyond what's necessary" posture.

## Accessibility

- `<InfoTooltip>` trigger is `<button type="button">` with `aria-describedby` pointing to the tooltip body. Visible on hover, keyboard focus, and tap.
- `<HelpPopover>` is `role="dialog"`, `aria-labelledby` = KPI title, `aria-modal="false"` (page remains scrollable behind it). Focus trapped inside while open. Esc closes and returns focus to the trigger button.
- All ⓘ and `?` buttons are keyboard-reachable in document tab order with a visible focus ring (Tailwind `focus-visible:ring-2`).
- Color is not the only cue (icons + text labels everywhere).

## Testing

### Unit (vitest)

- **Type-driven completeness**: `Object.keys(PARAM_HELP)` must match `keyof SidebarInputs` exactly. Same shape test for `KPI_HELP` against a const KPI-keys list and `CHART_HELP` against a const charts list. Catches drift the moment a sidebar input or KPI is added without help.
- **Field completeness**: every `KpiHelp` entry must have non-empty `formula.plain`, all 3 `impact.*` fields, and ≥1 definition. Snapshot the shape, not the prose.
- **Render snapshot**: render one full popover (Liquidity Floor) and one `/help` page (LiquidityNeed) to lock structure across refactors.

### E2E (Playwright)

- Open dashboard → click the first `?` → assert popover visible with A/B/C headings → press Esc → assert popover dismissed and focus returned to the trigger.
- Navigate to `/help/liquidity-need` → assert a KaTeX-rendered formula is present (look for `.katex` class) → assert a worked-example block is present.

## Seven-PR roadmap

| PR | Scope | Notes |
|---|---|---|
| **#1 Infrastructure** | All components, empty registry, `/help` routes with stub content, KaTeX + mermaid lazy loading, unit tests, one e2e | Ships a usable empty help system: every `?` opens a popover that says "Coming soon" with a link to `/help/<section>`. ✅ Done. |
| **#2 Validate formulas and logic** | Audit every formula in `lib/simulator.ts`, `lib/morphoMath.ts`, `lib/fxModel.ts`, `lib/simulation.worker.ts`; cross-check against the original design spec, Morpho governance docs, and standard finance references. Produce a validation report. Fix bugs found, eliminate remaining magic numbers, add missing tests. | Prerequisite for content PRs — worked examples and "how it's calculated" copy depend on the formulas being correct. Handover doc: `docs/superpowers/plans/2026-05-20-pr2-validate-formulas-handover.md`. ✅ Done — see [validation report](./2026-05-20-formula-validation-report.md). |
| **#3 LiquidityNeed content** | Sidebar tooltips for params in section 1 + all KPI/chart help for LiquidityNeed + populated `/help/liquidity-need` | Iterate copy in chat. |
| **#4 FXRisk content** | Sidebar tooltips for section 2 + all FXRisk KPI/chart help + populated `/help/fx-risk` | Iterate in chat. |
| **#5 Strategy content** | Sidebar tooltips for section 3 + all LiquidityStrategy KPI help + populated `/help/strategy` | Iterate in chat. |
| **#6 Liquidation content** | Sidebar tooltips for section 4 + all LiquidationDesign KPI help + populated `/help/liquidation` | Iterate in chat. |
| **#7 Vault content** | Sidebar tooltips for section 5 + all VaultRecommendations KPI help + populated `/help/vault` | Iterate in chat. |

Each PR is independently reviewable and ships a strict improvement over the previous state. PR #2 has no UI surface — it's a code-and-docs audit that hardens the math layer before content is written on top of it.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Popover positioning breaks on long pages or near viewport edges | Custom positioner tested at all 4 corners + middle-of-viewport during PR #1. E2E test asserts visibility. |
| KaTeX or mermaid bundle creeps into the dashboard bundle | Both wrapped in `<KatexBlock>` / `<MermaidDiagram>` with `next/dynamic({ ssr: false })`. PR #1 verifies via `next build` bundle analysis. |
| Help content drifts from actual formulas as `lib/simulator.ts` changes | Unit tests assert registry completeness; a CONTRIBUTING note in PR #1 tells future contributors to update `lib/help/registry.ts` when adding a KPI. |
| Static export breaks `/help` routes | All `/help/*` routes are RSC + static. Verified by `npm run build` producing `out/help/*/index.html`. |
| Iteration on copy across 5 content PRs takes much longer than estimated | Each KPI is independently revisable post-merge; nothing blocks shipping infra + a single section. |

## Acceptance criteria

- Every key of `SidebarInputs` has a `PARAM_HELP` entry, enforced by a unit test.
- Every KPI rendered by a section component has a `KPI_HELP` entry, enforced by a unit test against a const keys list.
- Clicking any `?` on the dashboard opens a popover with A/B/C structure.
- Clicking "More info →" navigates to the correct `/help/<section>#<anchor>`.
- `/help/<section>` pages render formulas via KaTeX, a worked example, a live chart, and (where applicable) a mermaid diagram.
- `npm test` and `npm run test:e2e` pass.
- `npm run build` succeeds and produces `out/help/*/index.html` for all five section pages.
- Bundle size impact on the dashboard route (non-`/help`) is ≤5KB after gzip.
