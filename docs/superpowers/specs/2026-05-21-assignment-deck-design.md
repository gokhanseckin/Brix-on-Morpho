# `/assignment` Deck — Design Spec

**Date:** 2026-05-21
**Owner:** gokhanseckin
**Status:** Approved scope, pending spec review

## Goal

Ship an HTML slide deck, embedded at the route `/assignment` in this Next.js app, that Brix can use internally to pitch the Morpho launch plan for the wiTRY → USDM market. Audience: Brix team, CS-junior reading level. Constraint: client-side only (project uses `output: 'export'`).

## Non-goals

- No backend, no analytics, no external assets at runtime.
- No new simulator logic — the deck consumes existing repo knowledge plus the three attached research docs.
- No PDF export pipeline beyond Chrome's print-to-PDF (handled via `@media print`).
- No re-use of the deck shell for other routes (single-purpose component).

## Route & shell

- Path: `/assignment` (Next 14 App Router) at [app/assignment/page.tsx](app/assignment/page.tsx).
- Client component (`'use client'`) because it uses keyboard listeners and `useState` for the slide index.
- Full-viewport landscape (16:9). The deck escapes the simulator's sidebar layout entirely — its own root layout, no parent `Sidebar`.
- Slides are an in-file typed array `Slide[] = { id, title, render: () => JSX }`. Easy to reorder.

### Navigation

- Keyboard: `←` / `→` (prev/next), `Space` (next), `Home` (first), `End` (last), `?` (toggle a shortcuts overlay).
- On-screen: `Previous` and `Next` buttons, slide counter `n / 14`, jump-to-slide via clickable bottom progress dots.
- URL hash sync: `/assignment#3` opens slide 3. Updating the hash on navigation lets the user bookmark a slide.

### Print

`@media print` shows all slides stacked, each forcing a page break, so Chrome's print-to-PDF produces a sharing artifact.

## Visual language

- "Clean Brix dark." Background near-black (`#0a0a0a` / `bg-neutral-950`); text off-white. Single accent color (Brix blue, matching what the simulator app already uses).
- Display heading: ~56px. Body: ~22–24px. Wide reading distance is the implicit constraint.
- Tables: dark rows, subtle dividers, accent color reserved for the row or cell the audience must read first.
- Diagrams: inline SVG only. No external images. No icons we don't draw ourselves.
- Sparing motion: a 150ms cross-fade between slides; no decorative animation.

## Slide list (14)

Order is locked. Each slide must hold one idea, fit one viewport without scrolling, and read in well under a minute.

| # | Title | Core message |
|---|---|---|
| 1 | Cover | Title, subtitle "Pitch to plan the Morpho launch on MegaETH", date, author. |
| 2 | The economy flow | One SVG diagram. Actors: wiTRY LPs, borrowers, USDM lenders, Morpho market, Kumbaya AMM (wiTRY/USDM v3 fork), liquidators, **MegaETH chain LP / MegaMafia**, curator slot (TBD — see slide 6), Merkl + feather.zone incentive layer. Solid arrows = assets; dashed = incentives. |
| 3 | USDM liquidity requirement | `required supply ≈ borrow / utilization`. Two baselines: $1M borrow @ 80–90% util → $1.11–1.25M supply; $5M borrow → $5.56–6.25M supply. Buffer rule: curators typically want 10–20% slack to avoid 100% util. |
| 4 | Tracking & managing liquidity | What to monitor (util, idle USDM, time-at-100%, supply/borrow caps, curator allocation). Tools (Morpho frontend + an internal dashboard powered by this simulator). One sentence per metric. |
| 5 | Attracting liquidity — 3-layer incentive stack | (a) **Merkl** program targeting borrowers, managed by **feather.zone** (to validate). (b) **MegaETH rewards** — MEGA token + MegaMafia points + KPI-tranche eligibility; supply-side help during cold-start that we don't pay for. (c) **Brix-native** kicker only if (a)+(b) underperform. Punchline: incentivize *borrowers*, not lenders. Curators *are* distribution. |
| 6 | Curator shortlist | Ranked table — 5 candidates, no fallback. Re7 Labs, Gauntlet, Steakhouse, MEV Capital, Wintermute/Armitage. Columns: fit-for-this-market, TVL/credibility, risk note. Footnote: Alphaping declined due to exclusive NAV-auditor requirement. |
| 7 | Partner stack | Table of partner roles. Rewards: Merkl. Merkl mgmt: feather.zone (TBV). Oracle: RedStone (already chosen). Risk monitoring: Hypernative. Allocator bot: `morpho-org/vault-v2-reallocation-bot`. OEV recapture (later): Oval by UMA. |
| 8 | Liquidations — mechanics | Close factor, LIF formula, atomic flow: seize wiTRY → swap on Kumbaya wiTRY/USDM → repay USDM → keep bonus. **Atomic-only requirement** (no CEX, no redemption). MegaETH realities: single sequencer, no public mempool, proximity-seat auctions → liquidator competition collapses to who pays for inclusion. |
| 9 | Pool depth is the binding constraint | Why 5× rule: at 86% LLTV, LIF is only ~5%; that bonus is the entire slippage + gas budget. On a v3 pool with concentrated liquidity, a swap = 20% of one-sided depth ≈ 1% slippage calm / 3–4% stress. Cap largest liquidation at ≤ 1/5 pool depth → liquidator stays profitable in both regimes. Pre-liq splits the actual liquidation into smaller chunks. Mechanism: supply cap and per-position borrow cap are functions of *current* Kumbaya pool depth, reviewed monthly. |
| 10 | Slippage & pool sizing | Table. Rows: typical liq (1% of borrow = $10k / $50k) and tail (10% = $100k / $500k). Columns: 0.5% / 1% / 5% slippage tiers. Recommendation: seed Kumbaya wiTRY/USDM with $300–500k for the $1M market, $1.5–2.5M for the $5M market — sized so that the *typical* liquidation stays under 1% slippage and a tail liquidation stays under LIF. |
| 11 | Liquidator stack | Ranked table. (1) **Wintermute / Armitage** — in-house, accountable, MegaETH backer. (2) **Brix internal bot** — fork of `morpho-org/morpho-blue-liquidation-bot` with RedStone + Kumbaya pricer, weeks 0–60 from treasury. (3) **Curator-introduced MM network** (Gauntlet's ACRED pattern: pre-arranged prime brokers / market makers). (4) **Permissionless / FastLane Atlas** — public bot fork + auction layer; treated as bonus, not primary. |
| 12 | Making liquidations profitable + parameters | `profit = (LIF − 1) × seized − slippage − gas`. Levers: pool depth (slide 9), LIF tier, pre-liq cushion. Parameter table: LLTV 86%, LIF ~5%, pre-liq **on** day-1, supply cap = 5× live Kumbaya depth, per-wallet borrow cap = pool/5. Footnote on ERC-4626 wiTRY-as-collateral risk and the Morpho V1.1 factory mitigation (no bad-debt realization → share price can't decrease). |
| 13 | Pre-liquidations + statistical risk | What pre-liq protects against: TRY can gap; standard liquidations can miss the window. Pre-liq auto-deleverages before health hits 1. **Anchor from our FX simulator** (link to `/` and `/utilization`): at LLTV 86, util 85%, roughly **3–6% one-year probability** of a 3-day TRY drawdown causing bad debt without pre-liq; **≈1%** with pre-liq enabled. Confidence: medium — internal model, not market-validated. Recommendation: **enable pre-liq, day 1.** |
| 14 | Recap + Next steps | Six recap bullets (formula, curators=distribution, 3-layer incentives, pool-depth rule, liquidator coverage, pre-liq on). Six action items with implicit owners: confirm curator shortlist outreach, scope Merkl + validate feather.zone, email Wintermute OTC, talk to MegaMafia program, seed Kumbaya pool sizing with Kumbaya team, deploy pre-liq contract. |

## Data inputs (concrete numbers used on slides)

- **Baselines:** $1M and $5M USDM borrow. Utilization 80–90%. LLTV 86%. LIF ~5%.
- **Pool sizing:** $300–500k seed (for $1M market) and $1.5–2.5M seed (for $5M market).
- **Pre-liq risk anchor:** 3–6% one-year p(bad-debt) without pre-liq; ~1% with. Labeled as simulator output, not field-validated.
- **Research-derived partner facts:** TVL figures, founder locations, Stream/xUSD exposures pulled from the three docs under [docs/](docs/) (`curators-morpho.md`, `liquidator-research-claude.md`, `morpho-related-partners.md`).

## Risks the deck explicitly surfaces

- Pre-liq probabilities are model-derived, not validated.
- feather.zone is unvalidated by independent research — marked TBV in the partner table.
- LLTV 86% is a *choice* whose cost is paid in pool depth and pre-liq enforcement — surfaced on slide 12.
- ERC-4626 wiTRY-as-collateral risk acknowledged with the V1.1 factory mitigation.
- MegaETH MEV supply chain is still being built — proximity seats and KPI tranches are forward-looking.

## Out of scope (consistent with `CLAUDE.md`)

MEV beyond the proximity-seat note, LayerZero, custodian risk, regulatory freeze, smart-contract bugs, gas dynamics, multi-market vault allocation, leverage loops.

## Implementation notes

- Single file: [app/assignment/page.tsx](app/assignment/page.tsx). If it grows past ~600 lines, extract per-slide components into `app/assignment/slides/`.
- Tailwind for layout. No new dependencies; no chart library beyond what already ships.
- SVG diagrams hand-authored inline (one for slide 2, possibly one for slide 9).
- Tables are plain `<table>` styled with Tailwind, no virtualization.
- Accessibility: each slide is a `<section role="region" aria-label="…">`. Keyboard nav announced via a visually-hidden live region.
- No tests required (presentation surface, no logic). Manual sweep: `npm run dev` → walk all 14 slides with arrow keys, then print-preview to confirm pagination.

## Acceptance

- [ ] `/assignment` renders 14 slides, one viewport each, landscape.
- [ ] `← → Space Home End` all work; on-screen buttons match; URL hash syncs.
- [ ] Print preview shows all 14 slides stacked, each on its own page.
- [ ] Curator and liquidator tables match the spec exactly (Alphaping in footnote of slide 6, no Morpho Labs fallback).
- [ ] Slide 9 contains the "5× rule" explanation paragraph verbatim from this spec.
- [ ] Slide 5 shows the 3-layer incentive stack with MegaETH rewards as layer 2.
- [ ] Build passes (`npm run build`) — static export still works.

## Follow-on (not in this spec)

- Hooking the pre-liq numbers on slide 13 to a *live* simulator run rather than the prose estimate.
- Adding a slide on Brix-Morpho-specific oracle staleness handling (RedStone hybrid feed semantics).
- Localizing the deck to Turkish.
