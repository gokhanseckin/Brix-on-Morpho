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
  title: 'Recommended LLTV (governance tier)',
  oneLiner:
    'The largest Morpho governance LLTV tier that passes both tests: collateral still covers a tail drawdown, and a liquidator still earns enough after that tier\'s own AMM slippage.',
  formula: {
    plain:
      'for each governance tier L:\n  slip(L) = AMM slippage for a 1% expected-borrow liquidation at L\n  bad-debt check: L x LIF(L) <= 1 - drawdown - safetyMargin\n  profit check:   LIF(L) x (1 - slip(L)) >= 1 + safetyMargin\nrecommended = largest tier passing both checks\nraw = tighter continuous limit evaluated at the winning tier slippage',
    latex:
      'L^{*}=\\max\\{L\\in GOV: L\\,LIF(L)\\leq1-dd-m\\;\\land\\;LIF(L)(1-slip(L))\\geq1+m\\}',
  },
  params: [
    { name: 'drawdown', source: 'derived', note: 'Selected /lltv percentile of the 1-day drawdown distribution (default P95). Uses the empirical history fallback until worker results arrive.' },
    { name: 'slippage(L)', source: 'derived', note: 'Computed separately for each candidate governance tier using its own representative liquidation size; clamped to at most 50%.' },
    { name: 'safetyMargin', source: 'sidebar', ref: 'safetyMargin' },
    { name: 'LIF(L)', source: 'derived', note: 'Liquidation Incentive Factor at trial LLTV — see Section 1 morphoMath.' },
    { name: 'GOV_LLTVS', source: 'constant', value: '[0, 0.385, 0.625, 0.77, 0.86, 0.915, 0.945, 0.965, 0.98]', note: 'Morpho governance tiers; recommendation always snaps down to one of these.' },
  ],
  definitions: [
    { term: 'Why scan tiers', definition: 'Morpho permits a fixed set of LLTV values. The code tests every permitted tier with slippage calculated for that same tier, avoiding a recommendation that depends on whichever LLTV the user happened to select.' },
    { term: 'Bad-debt constraint', definition: 'After the selected drawdown, remaining collateral must cover both the debt and the liquidation incentive: L x LIF(L) <= 1 - drawdown - safetyMargin.' },
    { term: 'Liquidator-profit constraint', definition: 'After selling seized collateral through the AMM, the liquidator must retain the safety margin: LIF(L) x (1 - slippage) >= 1 + safetyMargin.' },
    { term: 'Cross-section dependency', definition: 'Drawdown comes from FX paths; slippage comes from the configured pool. Tightening either input can lower the passing governance tier.' },
  ],
  impact: {
    health: 'The single safety-vs-yield dial. Too high → bad debt under FX tail. Too low → wasted borrow capacity.',
    sustainability: 'Self-balancing: the derivation hardens as FX tails widen, so a regime shift pulls the recommendation down automatically.',
    profitability: 'Higher snapped LLTV → larger expected borrow base → more interest. Trade-off bounded by §4 bad-debt curve.',
  },
  workedExample: {
    description: 'Illustrative reading: for each allowed LLTV, use the selected 1-day drawdown percentile, the pool quote at that tier, and the 1% safety margin.',
    steps: [
      { label: 'check coverage', expression: 'tier passes only if L x LIF(L) <= 1 - drawdown - 0.01', usesInputs: ['safetyMargin'] },
      { label: 'quote tier liquidation', expression: 'calculate AMM slippage for that tier\'s representative seized amount', usesInputs: [] },
      { label: 'check execution', expression: 'tier passes only if LIF(L) x (1 - slippage) >= 1 + 0.01', usesInputs: ['safetyMargin'] },
      { label: 'select tier', expression: 'choose the highest governance tier that passes both checks', usesInputs: [] },
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
    { term: 'Indeterminate state', definition: 'When no positive governance tier passes the two checks, the recommendation is 0 and the tier is Indeterminate. Deepen the pool, reduce risk settings, or review the market assumptions before deployment.' },
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
    'A deployment configuration template containing market, vault, and pre-liquidation fields. It is not submit-ready: oracle and IRM are placeholders and the absolute cap is deliberately human-readable USD.',
  formula: {
    plain:
      '{\n  market: { lltv: to18Decimal(selectedLLTV), irm: "0xIRM", oracle: "0xORACLE" },\n  vault: {\n    performanceFee, managementFee, timelock: 604800,\n    caps: { absoluteUSD_human: requiredUSDM + withdrawalBuffer, relative: 1.0 }\n  },\n  preLiquidation: {\n    preLLTV: to18Decimal(max(0, selectedLLTV - preLLTVOffset)),\n    preLCF: [preLCF1, preLCF2],\n    preLIF: [preLIF1, LIF(selectedLLTV)]\n  }\n}',
    latex:
      '\\text{vaultJson} = \\{ market,\\; vault,\\; preLiquidation \\}',
  },
  params: [
    { name: 'lltv', source: 'sidebar', ref: 'lltv', note: 'Uses the user-selected LLTV, not the recommendation tile, and encodes it as an 18-decimal integer string.' },
    { name: 'performanceFee', source: 'sidebar', ref: 'performanceFee' },
    { name: 'managementFee', source: 'sidebar', ref: 'managementFee' },
    { name: 'caps.absoluteUSD_human', source: 'derived', note: 'From Section 1: requiredUSDM + withdrawalBuffer. Expressed in plain dollars (NOT contract-ready wei) — the deploy script must convert to 18-decimal before submission. The "_human" suffix is the signal that this field needs hand-conversion, unlike `market.lltv` which is already wei-scaled.' },
    { name: 'timelock', source: 'constant', value: '604800', note: 'DEFAULT_VAULT_TIMELOCK_SECONDS = 7 days, spec §5 incident-response window.' },
    { name: 'preLLTV / preLCF / preLIF', source: 'derived', note: 'Pre-liquidation block from Section 4 — see preLiquidationParams help.' },
  ],
  definitions: [
    { term: 'to18Decimal', definition: 'The current helper serializes selected LLTV into an 18-decimal integer string, for example 0.77 becomes "770000000000000000". A deployment runner should still validate encoded values before submission.' },
    { term: 'Template status', definition: 'The object includes `0xORACLE` and `0xIRM` placeholders, and `absoluteUSD_human` still needs denomination conversion before an on-chain submission.' },
    { term: 'Minimal subset', definition: 'The recommendation table lists additional operating-policy items. The JSON contains the smaller structured subset generated by `buildVaultConfigJson`.' },
    { term: 'relative cap = 1.0', definition: 'Single-market vault at launch ⇒ 100% allocation to this market. Revisit when graduating to multi-market.' },
    { term: 'Validation', definition: 'Shape matches spec §5; round-trip pinned in [tests/simulator.test.ts:211](tests/simulator.test.ts:211).' },
  ],
  impact: {
    health: 'This template collects risk-critical settings, but placeholder addresses and human-dollar fields must be replaced or converted before use.',
    sustainability: 'It lives downstream of the sizing, selected LLTV, fee, and pre-liquidation inputs, so a changed scenario produces a changed template.',
    profitability: 'Not a yield lever directly; it records the upstream configuration that determines yield and risk.',
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
