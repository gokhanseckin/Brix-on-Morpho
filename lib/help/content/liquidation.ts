// lib/help/content/liquidation.ts
// Real content for Section 4 (Liquidation Design). PR #6 (roadmap).
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 4)
// ---------------------------------------------------------------------------

export const LIQUIDATION_PARAMS: Partial<Record<string, ParamHelp>> = {
  safetyMargin: {
    oneLiner:
      'Extra reserve required by both LLTV safety checks: collateral coverage after drawdown and liquidator profitability after slippage. Default 1%; higher means fewer governance tiers pass.',
  },
  preLiquidationEnabled: {
    oneLiner:
      'Optional borrower-authorization scenario. ON: eligible profitable partial closes can execute repeatedly through the configurable pre-liquidation band. OFF (launch default): only hard-LLTV liquidations execute.',
  },
};

// ---------------------------------------------------------------------------
// KPI help (section 4)
// ---------------------------------------------------------------------------

const COMMON_PARAMS: Record<string, KpiHelp['params'][number]> = {
  lltv: { name: 'lltv', source: 'sidebar', ref: 'lltv' },
  poolDepth: { name: 'poolTVL_USD', source: 'sidebar', ref: 'poolTVL_USD' },
  safety: { name: 'safetyMargin', source: 'sidebar', ref: 'safetyMargin' },
  preLiq: { name: 'preLiquidationEnabled', source: 'sidebar', ref: 'preLiquidationEnabled' },
  gas: { name: 'DEFAULT_GAS_COST_USD', source: 'constant', value: '$5', note: 'Nominal gas cushion in useSimulator.ts; MegaETH gas is ≈ 0 in practice.' },
};

const badDebtP95USD: KpiHelp = {
  title: 'P95 residual Morpho debt (USD)',
  oneLiner:
    'The 95th-percentile lender loss across simulated FX paths. Within each path, profitable liquidations sell through one shared AMM ladder in sequence, so earlier swaps can leave less liquidity for later ones.',
  formula: {
    plain:
      'for each path:\n  residual_i = max(0, debt_i − revenue_i)   if profitable\n             = max(0, debt_i − collAfter_i)  otherwise\n  badDebtPerPath = Σ residual_i across all positions\nbadDebtP95_USD = P95(badDebtPerPath across paths)',
    latex:
      'P95\\big(\\sum_{i} \\max(0,\\, \\text{debt}_i - \\text{recovery}_i)\\big)',
  },
  params: [
    { name: 'paths', source: 'derived', note: 'Monte-Carlo FX paths from Section 2.' },
    { name: 'positions', source: 'derived', note: 'Synthetic Beta(α, β)-distributed borrower LTV cohort.' },
    COMMON_PARAMS.preLiq!,
    COMMON_PARAMS.poolDepth!,
    COMMON_PARAMS.lltv!,
  ],
  definitions: [
    { term: 'Two residual branches', definition: 'If a hard liquidation is profitable, residual = max(0, debt - AMM revenue). If it is unprofitable, it does not execute; as the path continues, residual becomes max(0, remaining debt - collateral value).' },
    { term: 'Sequential ladder consumption', definition: 'The pool is initialized once per FX path. Every profitable pre-liquidation or hard liquidation changes that pool before the next borrower is processed.' },
    { term: 'Pre-liquidation effect', definition: 'If the optional authorization scenario is on, profitable partial closes use the configured interpolated terms and can repeat while a position stays in the pre-liquidation band.' },
    { term: 'P95 vs E[]', definition: 'P95 is the planning number — we size pool depth and reserves to absorb this, not the mean. Mean is dominated by zero-bad-debt paths and understates risk.' },
  ],
  impact: {
    health: 'The headline solvency risk for the lender. Must clear safety reserves + insurance to be tolerable.',
    sustainability: 'Driven equally by FX tail (Section 2 P95 drawdown) and AMM tail (poolDepth). Both are dials.',
    profitability: 'A real expected loss the protocol earnings must out-yield. If badDebtP95Pct > netSupplyAPY × LTV-of-bad-debt, the market is uneconomic.',
  },
};

const badDebtP95Pct: KpiHelp = {
  title: 'P95 residual Morpho debt (% TVL)',
  oneLiner:
    'The P95 residual debt above, divided by wiTRY TVL. Tile coloring is <1% good, 1-5% warn, and >5% bad.',
  formula: {
    plain: 'badDebtP95Pct = badDebtP95_USD / TVL',
    latex: 'badDebtP95Pct = \\frac{badDebtP95\\_USD}{TVL}',
  },
  params: [
    { name: 'badDebtP95_USD', source: 'derived' },
    { name: 'TVL', source: 'sidebar', ref: 'witryTVL_USD' },
  ],
  definitions: [
    { term: 'TVL convention', definition: 'Uses `witryTVL_USD` as the denominator — total deposited collateral in USD. Same number Section 1 uses to size required USDM.' },
    { term: 'Tile coloring thresholds', definition: '<1% green ("good"), 1–5% amber ("warn"), >5% red ("bad"). Heuristic governance thresholds — tweak in `LiquidationDesign.tsx` if the policy committee picks different bands.' },
  ],
  impact: {
    health: 'Direct read of "is this market underwriting profitable?". Compare against expected supplier yield × bad-debt LTV to break even.',
    sustainability: 'Robust to TVL scale, so it travels across launch sizes. Easier to govern than the absolute USD number.',
    profitability: 'A 5% P95 effectively erases a year of supplier yield at default rates. Above that the market is structurally unprofitable.',
  },
};

const preLiquidationParams: KpiHelp = {
  title: 'Pre-liquidation parameters',
  oneLiner:
    'The Morpho pre-liquidation module configuration: a soft band below the hard LLTV where positions get partially closed at a tighter incentive, draining tail bad debt before it triggers.',
  formula: {
    plain:
      'preLLTV = max(0, lltv - preLLTVOffset)\npreLIF2 = LIF(lltv)\nprogress = clamp((effectiveLTV - preLLTV) / (lltv - preLLTV), 0, 1)\ncloseFactor = interpolate(preLCF1, preLCF2, progress)\nincentiveFactor = interpolate(preLIF1, preLIF2, progress)\nexecute and repeat only while AMM revenue - closedDebt - gas > 0',
    latex: '\\mathrm{preLLTV}=\\max(0,LLTV-\\Delta),\\quad LCF=\\operatorname{lerp}(LCF_1,LCF_2,p),\\quad LIF=\\operatorname{lerp}(LIF_1,LIF(LLTV),p)',
  },
  params: [
    COMMON_PARAMS.lltv!,
    COMMON_PARAMS.preLiq!,
    { name: 'preLLTVOffset', source: 'derived', note: 'Editable on /lltv; default 0.05.' },
    { name: 'preLCF1 / preLCF2', source: 'derived', note: 'Editable endpoint close factors; defaults 0.05 and 0.50.' },
    { name: 'preLIF1', source: 'derived', note: 'Editable incentive at preLLTV; default 1.01.' },
  ],
  definitions: [
    { term: 'Close factor (LCF)', definition: 'The fraction of remaining debt repaid in one partial close. It is interpolated between the configured endpoints as effective LTV moves through the band.' },
    { term: 'Simulation execution', definition: 'Authorized positions can receive repeated profitable partial closes while they remain inside the band. Each close consumes AMM liquidity before the next quote.' },
    { term: 'Exported in vault JSON', definition: 'Section 5\'s vault config JSON embeds these directly under `preLiquidation.{preLLTV, preLCF, preLIF}`, so the help here doubles as the deploy-time documentation.' },
  ],
  impact: {
    health: 'The single most effective dial for tail bad debt. Toggling preLiquidationEnabled in the sidebar typically cuts badDebtP95 noticeably.',
    sustainability: 'Adds borrower friction (positions partially closed before they want to deleverage). Worth it for a TRY-collateralized vault where FX shocks are sudden.',
    profitability: 'Liquidators see smaller LIF at the soft band (1.01 vs ~1.05) — less profit per liquidation but more total volume cleared.',
  },
};

export const LIQUIDATION_KPIS = {
  badDebtP95USD,
  badDebtP95Pct,
  preLiquidationParams,
};

// ---------------------------------------------------------------------------
// Chart help (section 4)
// ---------------------------------------------------------------------------

const badDebtHistogram: ChartHelp = {
  title: 'Bad-debt distribution across simulated paths',
  oneLiner:
    'Histogram of total residual bad debt per simulated path. A long right tail (heavy mass in the worst bins) is what makes the P95 KPI move; a tight cluster near zero means liquidations are clearing cleanly.',
  axes: { x: 'Bad-debt range (USD)', y: 'Number of paths in this bin' },
  definitions: [
    { term: 'One bar = one bin of paths', definition: 'All paths are bucketed into 10 equal-width bins between $0 and the max observed bad debt. Tall left-most bar = most paths produced little or no bad debt; long right tail = the tail risk this section is sized against.' },
    { term: 'Relationship to P95 KPI', definition: 'P95 bad debt is the value below which 95% of paths fall — visually, the boundary that leaves the rightmost 5% of path-mass to its right.' },
    { term: 'Toggle pre-liq to see the shift', definition: 'With pre-liquidation enabled, mass migrates from the right tail toward the zero bin. Validation in [tests/simulator.test.ts:136](tests/simulator.test.ts:136) pins "preLiq on ≤ preLiq off".' },
  ],
  bands: [
    { name: 'Left-most bin', meaning: 'Paths with zero or near-zero bad debt. Healthy outcome cluster.' },
    { name: 'Middle bins', meaning: 'Paths where some liquidations missed (slippage or gas cliff) but residual was modest.' },
    { name: 'Right tail', meaning: 'Tail-FX paths where multiple positions stranded above the max profitable size. These drive the P95.' },
  ],
  impact: {
    health: 'A bimodal distribution (mass at 0 AND at the far right) flags a regime where there is no middle ground — either liquidations clear cleanly or they cascade.',
    sustainability: 'A skinny right tail = system is robust to FX outliers. A fat right tail = needs deeper pool, lower LLTV, or pre-liquidation.',
    profitability: 'Bad debt is realized loss. The expected value over this distribution is the recurring underwriting cost.',
  },
};

export const LIQUIDATION_CHARTS = { badDebtHistogram };
