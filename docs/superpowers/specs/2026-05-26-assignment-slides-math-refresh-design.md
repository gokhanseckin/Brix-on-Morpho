# Assignment slides — math refresh (2026-05-26)

## Context

The simulator's math has moved on. Three ground-truth changes need to land in the `/assignment` deck:

1. **1-day drawdown** is now the canonical execution window (was 3-day). See `lib/simulation.worker.ts:114` and `lib/useSimulator.ts:199`.
2. **90% kink is soft**, not a hard ceiling. Borrow rate continues to rise above kink (`lib/morphoMath.ts:16–25`), producing more lender yield. With Merkl/Brix rewards, loops can be more profitable than holding wiTRY even above kink — the protocol intentionally pushes through it.
3. **AMM is not the only liquidator exit.** Liquidators have three paths: AMM swap (with slippage), wiTRY vault redemption (small fee, possibly subsidized), or long-USD-3d cooldown hedge (funding-rate cost). Bad-debt risk no longer hinges on AMM depth alone.
4. **rTarget IRM rate is the real binding parameter.** Morpho market params are immutable post-deploy, so the IRM rate-on-target must keep borrowing profitable vs holding wiTRY at 85–90% utilization *even without rewards*, or borrowers migrate to a competing vault with lower rTarget.

The simulator code already reflects (1) and (2); (3) and (4) are explicit in the new narrative but not yet enforced in the math.

## Scope

**In scope:** `app/assignment/page.tsx` — slide content only.

**Out of scope:** every other page, every `lib/*` module, every test, every doc. The simulator's math is the source of truth; only slides need to catch up.

## Per-slide changes

| # | Title | Intensity | Change summary |
|---|-------|-----------|----------------|
| 1 | Cover | NONE | — |
| 2 | The economy flow | NONE | — |
| 3 | USDM liquidity requirement | NONE | — |
| 4 | Tracking & managing liquidity | NONE | — |
| **5** | Attracting liquidity | MINOR | Add a line tying Merkl + Brix rewards to "loops profitable even when borrow rate > wiTRY yield." Reinforces that above-kink behavior is intentional. |
| 6 | Curator shortlist | NONE | — |
| 7 | Partner stack | NONE | — |
| **8** | Liquidations | MINOR | Add a single line/footnote to the 4-step atomic flow making clear that AMM swap is one of multiple exits — full treatment lives on slide 9. |
| **9** | (retitled) | MAJOR — full rewrite | New narrative covers all three new ground truths. See §"Slide 9 detailed spec" below. |
| **10** | Slippage & pool sizing | MINOR | One sentence: pool sizing is conservative because liquidators have non-AMM exits; depth here is a comfort target, not a hard floor. |
| 11 | Liquidator stack | NONE | — |
| **12** | Profitable liquidations + parameters | MINOR | (a) Label the profit formula as AMM-swap-specific. (b) Add an `rTarget = 4%` row to the parameter table with a note that it's immutable and calibrated to keep borrowing feasible at 85–90% util without rewards. |
| **13** | Pre-liquidations | MAJOR | (a) Replace "3-day TRY drawdown" → "1-day". (b) Refresh the bad-debt-probability numbers using fresh simulator output. (c) Light copy edit to align with the new framing on slide 9. |
| **14** | Recap + next steps | MINOR | The recap bullet "Pool depth is the binding constraint. 5× rule." softens to reflect slide 9's new framing. |

## Slide 9 detailed spec

**New title (working):** "The constraints that actually bind" (final wording at agent's discretion within: "constraints" or "binding parameters", not "5× rule").

**Kicker:** keeps the slot — short tagline like "09 · What pins the market." Final wording at agent's discretion.

**Heading (`<H2>`):** something like *"LLTV + LIF + rTarget — immutable. AMM depth — comfortable, not binding."* Final wording at agent's discretion within that meaning.

**Layout:** keep the existing `grid grid-cols-[1.1fr_1fr]` two-column structure for visual continuity with the current deck.

### Left card — "Liquidation paths"

Three exit routes liquidators can choose, with cost basis for each:

- **AMM swap (Kumbaya wiTRY/USDM)** — slippage 1% in calm, 3–4% under stress. Fast but eats into LIF.
- **wiTRY vault redemption** — flat redemption fee. Brix can subsidize the fee for liquidators if it ever becomes a chokepoint. Sidesteps AMM slippage entirely; trades it for the redemption fee.
- **Long-USD cooldown hedge** — liquidator longs USD on a perp / forward for 3 days, waits out the wiTRY cooldown, redeems at par. Only cost: funding rate over 3 days.

**Concluding line:** *If we assume these paths are available to liquidators, bad-debt risk for the protocol is very low* (agent may paraphrase, but keep the protective conclusion).

### Right column — three NumberBlocks + small card

Use the existing `<NumberBlock>` component pattern.

- **NumberBlock: LLTV 86%** — Morpho governance tier. Immutable once deployed.
- **NumberBlock: LIF 4.38%** — direct function of LLTV. Immutable.
- **NumberBlock: rTarget 4%** — IRM rate at target utilization. Immutable. *The real binding parameter.*

**Small `<Card>` below the blocks — "Why rTarget matters":**

> Market params can't be changed post-deploy. At 85–90% utilization, the borrow rate must stay profitable for loopers *without* relying on Merkl rewards — otherwise borrowers migrate to a vault with a lower rTarget and our utilization collapses. Above the 90% kink, the rate climbs fast on purpose: lenders earn more, and Merkl + Brix rewards subsidize borrowers through the steep zone.

### Tone & style guardrails for the agent

- Match the existing slide voice: terse, declarative, no marketing fluff. Look at slides 8 and 12 for cadence.
- Keep the `<Accent>` highlights for the load-bearing numbers (86%, 4.38%, 4%) and load-bearing concepts ("immutable", "very low").
- Don't add new components or styles; reuse `Card`, `H2`, `Body`, `NumberBlock`, `Accent`, `SL`, `Footnote`.
- Cross-link with `<SL n={…}>` when referring to other slides.

## Slide 13 detailed spec

Two changes:

1. **Drawdown window label.** Replace every "3-day" mention with "1-day" — at minimum the `hint` on line 776: `"Per-year probability of a 3-day TRY drawdown big enough to cause bad debt at LLTV 86 / util 85%."` → `"Per-year probability of a 1-day TRY drawdown big enough to cause bad debt at LLTV 86 / util 85%."`

2. **Refresh numbers using fresh simulator output.** Before the agent rewrites the slide, run the canonical inputs through the simulator and lock in the numbers:
   - LLTV 86%, target utilization 85%, 5-year historical window, P95 percentile
   - With pre-liq off → headline bad-debt %
   - With pre-liq on → pre-liq bad-debt %
   - Method: invoke `simulateBadDebt` directly via a one-off `tsx`/`vitest` script (no UI). The simulator's `lib/simulator.ts` and `lib/simulation.worker.ts` already use 1-day drawdown; we just need fresh output to substitute for the legacy 3-day numbers.

   The agent does NOT run the simulator. The main session runs it once before dispatching the slide-13 agent, then passes the locked numbers in the agent prompt.

## Orchestration

One **Sonnet 4.6** sub-agent per changing slide, dispatched in parallel.

- Slides with changes: **5, 8, 9, 10, 12, 13, 14** (7 agents).
- Each agent receives:
  - Path to `app/assignment/page.tsx` and the line range of its slide
  - The current slide's source verbatim
  - The new ground truths (the four points above) — same context for every agent
  - Slide-specific change brief (from the table above and §slide-9 / §slide-13 details)
  - Style guardrails (terse, no new components, reuse existing primitives)
  - Explicit non-goals (don't touch other slides, don't touch `lib/*`)
- Each agent edits only its slide's JSX block via the `Edit` tool. No new imports, no component definitions.
- Main session pre-runs the simulator and bakes the slide-13 numbers into that agent's prompt before dispatch.
- After all agents return, main session:
  - Runs `npm run lint` and `npm test` (sanity — slides shouldn't break tests but lint can catch JSX issues)
  - Runs `npm run build` to confirm static export still builds
  - Visually spot-checks slide 9 by `npm run dev` + reading the page (the user has approved the layout but new copy should render)

**Why agents:** slides 9, 8, 13 are large enough that parallel work meaningfully shortens wall-time. Slide-9 in particular benefits from a focused agent context — the agent doesn't need to know about other slides' content, only the layout primitives and the ground truths.

**Why NOT Haiku:** the rewrite requires understanding nuance (kink-soft vs hard, multi-route liquidation, IRM-rate-as-binding-parameter). The user has explicitly excluded Haiku for this work.

## Risks & mitigations

- **Risk:** parallel agents land inconsistent copy/voice between adjacent slides.
  **Mitigation:** every agent gets the same ground-truth block and style guardrails. Main session reviews diffs side-by-side before commit.

- **Risk:** simulator run produces numbers that contradict the slide's narrative (e.g., bad-debt % is now higher than the 3-day version).
  **Mitigation:** main session inspects the numbers before passing to the slide-13 agent. If the numbers undermine the "very low bad-debt risk" thesis, we stop and re-discuss before writing.

- **Risk:** agents add new imports or components that break the static export.
  **Mitigation:** style guardrail forbids new components. Post-implementation build check catches violations.

- **Risk:** slide-9 rewrite leaves dangling `<SL n=9 />` cross-references on other slides with stale context (e.g., slide 4 references slide 9 for caps; slide 12 references slide 9).
  **Mitigation:** the cross-references point to a slide *number*, not a *title*. Even after retitling, the slot is still slide 9. Agent prompts explicitly preserve slot identity.

## Acceptance criteria

1. `app/assignment/page.tsx` modified; no other files modified.
2. Every "3-day" reference in slides is now "1-day" (or removed).
3. Slide 9 carries all three new ground truths (exit menu + rTarget binding + soft kink).
4. Slide 13 numbers are sourced from a documented simulator run (numbers + inputs recorded in commit message).
5. `npm run lint`, `npm test`, `npm run build` all pass.
6. `npm run dev` renders slide 9 without runtime errors; visual layout matches the existing 1.1fr/1fr two-column structure.

## Out of scope (do not do)

- No changes to `lib/*`, no math edits, no test changes.
- No changes to other pages (`/`, `/lltv`, `/swapliquidity`, `/utilization`).
- No new slides; no slide reordering.
- No new components, no Tailwind extensions, no new dependencies.
- No e2e test updates.
