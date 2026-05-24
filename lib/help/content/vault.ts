// lib/help/content/vault.ts
// Real content for Section 5 (Vault Recommendations). PR #7 (roadmap).
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 5)
// Section 5 has no sidebar inputs of its own — all parameters are derived
// from earlier sections. The vault config consumes lltv, fees, caps, and the
// pre-liquidation toggle, all already documented in their owning sections.
// ---------------------------------------------------------------------------

export const VAULT_PARAMS: Partial<Record<string, ParamHelp>> = {};

// ---------------------------------------------------------------------------
// KPI help (section 5)
// ---------------------------------------------------------------------------

const recommendedLLTV: KpiHelp = {
  title: 'Recommended LLTV (snapped)',
  oneLiner:
    'The largest LLTV the vault can safely run at, computed by fixed-point iteration on the FX P95 drawdown and slippage budget, then snapped DOWN to the nearest Morpho governance tier.',
  formula: {
    plain:
      'fixed-point on L:\n  L ← (1 − p95Drawdown) / (LIF(L) × (1 + slippage)) − safetyMargin\n  iterate from L₀ = 0.80 until |ΔL| < 1e-4 (max 20 iters)\nraw = clamp(L, 0, 0.98)\nsnapped = max { lv ∈ GOV_LLTVS : lv ≤ raw }',
    latex:
      'L_{\\text{raw}} = \\text{fix}\\left( L \\mapsto \\frac{1 - dd_{p95}}{LIF(L)\\cdot(1+\\sigma)} - m \\right),\\quad L^{*} = \\max\\{lv \\in \\text{GOV\\_LLTVS} : lv \\leq L_{\\text{raw}}\\}',
  },
  params: [
    { name: 'p95Drawdown', source: 'derived', note: 'From Section 2 — P95 (or selected /lltv percentile) of 1-day max drawdown across Monte-Carlo paths. Falls back to the empirical 1-day drawdown of the embedded USD/TRY history before the worker returns.' },
    { name: 'slippage', source: 'derived', note: 'From Section 4 — slippage(L_p95, poolDepth), clamped to ≤ SLIPPAGE_ESTIMATE_CAP = 0.5.' },
    { name: 'safetyMargin', source: 'sidebar', ref: 'safetyMargin' },
    { name: 'LIF(L)', source: 'derived', note: 'Liquidation Incentive Factor at trial LLTV — see Section 1 morphoMath.' },
    { name: 'GOV_LLTVS', source: 'constant', value: '[0, 0.385, 0.625, 0.77, 0.86, 0.915, 0.945, 0.965, 0.98]', note: 'Morpho governance tiers; recommendation always snaps down to one of these.' },
  ],
  definitions: [
    { term: 'Why fixed-point', definition: 'LIF(L) is non-linear in L — bigger LLTV ⇒ bigger LIF ⇒ tighter post-drawdown survival condition. The equation cannot be solved in closed form so we iterate. Converges in 5–10 steps for healthy inputs.' },
    { term: 'Snap DOWN, not nearest', definition: 'Spec §5 mandates floor-snapping — running ABOVE the derived value violates the survival inequality. The "raw" value is shown alongside the snapped one in the KPI tile so reviewers can see how much governance friction left on the table.' },
    { term: 'Non-convergence', definition: 'When inputs are degenerate (e.g. p95Drawdown ≥ 1), the iterate diverges and the last value is clamped to [0, 0.98]. `lltvDerivation.converged === false` is the consumer flag — treat it as a hint to widen safetyMargin or rerun with a longer FX history.' },
    { term: 'Cross-section dependency', definition: 'p95Drawdown comes from FX paths (§2); slippage comes from pool depth (§4). Tightening either ripples here. The /help anchor links each input back to its owning section.' },
  ],
  impact: {
    health: 'The single safety-vs-yield dial. Too high → bad debt under FX tail. Too low → wasted borrow capacity.',
    sustainability: 'Self-balancing: the derivation hardens as FX tails widen, so a regime shift pulls the recommendation down automatically.',
    profitability: 'Higher snapped LLTV → larger expected borrow base → more interest. Trade-off bounded by §4 bad-debt curve.',
  },
  workedExample: {
    description: 'Defaults: p95 1-day drawdown ≈ 3%, slippage ≈ 0.05, safetyMargin 1%. (Numbers approximate; live tile updates per the worker.)',
    steps: [
      { label: 'seed', expression: 'L₀ = 0.80, LIF(0.80) ≈ 1.062', usesInputs: [] },
      { label: 'iterate', expression: 'L₁ = (1 − 0.06) / (1.062 × 1.05) − 0.05 ≈ 0.793', usesInputs: ['safetyMargin'] },
      { label: 'converge', expression: 'after 4–6 iters, raw ≈ 0.79', usesInputs: [] },
      { label: 'snap down', expression: 'raw 0.79 → snapped 77% (the largest GOV_LLTVS ≤ 0.79)', usesInputs: [] },
    ],
  },
};

const riskTier: KpiHelp = {
  title: 'Risk tier',
  oneLiner:
    'Classification of the user-chosen LLTV vs the recommended LLTV. Conservative (at or below), Moderate (within +5pp), Aggressive (more than +5pp above), or Indeterminate when no governance tier qualifies — drives the tile color and a deploy-time governance warning.',
  formula: {
    plain:
      'if recommended ≤ 0           → "Indeterminate"\nelif chosen ≤ recommended      → "Conservative"\nelif chosen ≤ recommended + 0.05 → "Moderate"\nelse                            → "Aggressive"',
    latex:
      '\\text{tier}(c, r) = \\begin{cases} \\text{Indeterminate} & r \\leq 0 \\\\ \\text{Conservative} & c \\leq r \\\\ \\text{Moderate} & c \\leq r + 0.05 \\\\ \\text{Aggressive} & c > r + 0.05 \\end{cases}',
  },
  params: [
    { name: 'chosen', source: 'sidebar', ref: 'lltv', note: 'User-selected LLTV from the sidebar.' },
    { name: 'recommended', source: 'derived', note: 'Snapped recommendedLLTV from above. When 0 (no governance tier qualifies), the tier is reported as Indeterminate rather than Aggressive.' },
    { name: 'RISK_TIER_MODERATE_BAND_LLTV', source: 'constant', value: '0.05', note: 'Width of the Moderate band above the recommendation. Policy dial; exported from lib/simulator.ts.' },
  ],
  definitions: [
    { term: 'Boundary inclusion', definition: 'Both boundaries are inclusive on the lower side: chosen == recommended → Conservative; chosen == recommended + 0.05 → Moderate. Strict greater-than tips into the next tier.' },
    { term: 'Indeterminate state', definition: 'When the raw fixed-point recommendation falls below the smallest non-zero governance tier (0.385), the snap returns 0 and the comparison degenerates. Reporting "Aggressive" in that state would be misleading — the system has no opinion, not a negative one. Tighten pool depth or lower safetyMargin to bring the recommendation back into the governance band.' },
    { term: 'Aggressive flag is a warning, not a block', definition: 'The UI tile turns red but the JSON still exports. Governance review is the gating step at deploy time — the simulator is a calibration tool, not an admission controller.' },
    { term: 'Why 5pp', definition: 'Empirical Morpho practice: a 5pp band roughly matches the spacing between adjacent governance tiers in the live range (e.g. 0.77 → 0.86 is 9pp; 0.86 → 0.915 is 5.5pp). Spec §5 codifies it as the Moderate breakpoint.' },
  ],
  impact: {
    health: 'A direct read on how much safety margin the vault is giving up vs the data-driven recommendation.',
    sustainability: 'Persistent Aggressive flag means either the recommendation is too tight (revisit safetyMargin) or the chosen LLTV is, in fact, risky. Forces the conversation.',
    profitability: 'Aggressive tier squeezes more yield from the same TVL — at the cost of larger badDebtP95 (§4). Look at both before promoting an Aggressive setting.',
  },
};

const vaultConfigJson: KpiHelp = {
  title: 'Vault config JSON',
  oneLiner:
    'The deploy-ready blob of market + vault + pre-liquidation parameters, serialized in the exact shape MetaMorpho deploy scripts expect. Copy-paste straight into the deployment runner.',
  formula: {
    plain:
      '{\n  market: { lltv: to18Decimal(lltv), irm, oracle },\n  vault: {\n    performanceFee,\n    managementFee,\n    timelock: 604_800,             // 7 days\n    caps: { absoluteUSD_human: requiredUSDM + withdrawalBuffer, relative: 1.0 },\n  },\n  preLiquidation: {\n    preLLTV: to18Decimal(lltv − 0.05),\n    preLCF: [0.05, 0.5],\n    preLIF: [1.01, LIF(lltv)],\n  },\n}',
    latex:
      '\\text{vaultJson} = \\{ market,\\; vault,\\; preLiquidation \\}',
  },
  params: [
    { name: 'lltv', source: 'sidebar', ref: 'lltv', note: 'Encoded as 18-decimal fixed-point integer string (e.g. 0.77 → "770000000000000000").' },
    { name: 'performanceFee', source: 'sidebar', ref: 'performanceFee' },
    { name: 'managementFee', source: 'sidebar', ref: 'managementFee' },
    { name: 'caps.absoluteUSD_human', source: 'derived', note: 'From Section 1: requiredUSDM + withdrawalBuffer. Expressed in plain dollars (NOT contract-ready wei) — the deploy script must convert to 18-decimal before submission. The "_human" suffix is the signal that this field needs hand-conversion, unlike `market.lltv` which is already wei-scaled.' },
    { name: 'timelock', source: 'constant', value: '604800', note: 'DEFAULT_VAULT_TIMELOCK_SECONDS = 7 days, spec §5 incident-response window.' },
    { name: 'preLLTV / preLCF / preLIF', source: 'derived', note: 'Pre-liquidation block from Section 4 — see preLiquidationParams help.' },
  ],
  definitions: [
    { term: 'to18Decimal', definition: 'Morpho on-chain convention: numeric values like LLTV are serialized as 18-decimal integer strings. 0.77 becomes "770000000000000000". Round-trip is exact for inputs ≤ 1 within JS-safe BigInt precision.' },
    { term: 'Minimal subset', definition: 'The Recommendation TABLE in the UI lists 17 governance parameters (oracle policy, Sentinel/Curator/Allocator roles, MaxRate, dead deposits, seed utilization, Public Allocator, forceDeallocate). The exported JSON intentionally carries only the deploy-script-critical subset — operational policy is documented out-of-band.' },
    { term: 'relative cap = 1.0', definition: 'Single-market vault at launch ⇒ 100% allocation to this market. Revisit when graduating to multi-market.' },
    { term: 'Validation', definition: 'Shape matches spec §5; round-trip pinned in [tests/simulator.test.ts:211](tests/simulator.test.ts:211).' },
  ],
  impact: {
    health: 'The artifact that actually goes on-chain. A wrong number here is a real bug, not a UI mishap.',
    sustainability: 'Lives downstream of every other section — any sizing or LLTV change re-emits a new JSON. The audit trail is the URL state.',
    profitability: 'Not a yield lever directly; it is the encoding step. Profitability lives in the upstream sections that drive its fields.',
  },
};

export const VAULT_KPIS = {
  recommendedLLTV,
  riskTier,
  vaultConfigJson,
};

// ---------------------------------------------------------------------------
// Chart help (section 5) — none today.
// ---------------------------------------------------------------------------

export const VAULT_CHARTS: Partial<Record<string, ChartHelp>> = {};
