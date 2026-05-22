// lib/help/content/liquidation.ts
// Real content for Section 4 (Liquidation Design). PR #6 (roadmap).
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 4)
// ---------------------------------------------------------------------------

export const LIQUIDATION_PARAMS: Partial<Record<string, ParamHelp>> = {
  safetyMargin: {
    oneLiner:
      'Extra haircut subtracted from the LLTV that the fixed-point derivation lands on, before snapping to a governance tier. Default 5% — bigger margin = more conservative recommended LLTV.',
  },
  preLiquidationEnabled: {
    oneLiner:
      'Toggle the Morpho pre-liquidation module. ON: positions get a one-shot 50% partial close once effLTV crosses preLLTV = LLTV − 5%, reducing tail bad debt. OFF: liquidations only fire at the hard LLTV.',
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

const minProfitableLiquidation: KpiHelp = {
  title: 'Min profitable liquidation',
  oneLiner:
    'The smallest debt size for which a liquidator breaks even. Below this, fixed gas cost eats the LIF spread — small positions never get liquidated and silently accumulate bad debt.',
  formula: {
    plain:
      'profit(debt) = debt × LIF(lltv) × (1 − slippage) − debt − gas\nmin_USD = smallest debt in [0, peak] with profit ≥ 0\n  where slippage = debt × LIF / (debt × LIF + poolDepth)',
    latex:
      '\\text{profit}(D) = D \\cdot LIF \\cdot (1 - \\sigma(D)) - D - \\text{gas},\\quad \\sigma(D) = \\frac{D \\cdot LIF}{D \\cdot LIF + \\text{poolDepth}}',
  },
  params: [COMMON_PARAMS.lltv!, COMMON_PARAMS.poolDepth!, COMMON_PARAMS.gas!],
  definitions: [
    { term: 'LIF(lltv)', definition: 'Liquidation Incentive Factor — collateral seized per unit of debt repaid. Governance-tier specific; e.g. LIF(0.77) ≈ 1.0526. Non-linear in LLTV — see Section 1.' },
    { term: 'Profit non-monotonicity', definition: 'Gas dominates at small debt → profit is negative; LIF spread dominates in the middle → profit positive; slippage dominates at large debt → profit negative again. Hence a profitable WINDOW, not a half-line.' },
    { term: 'Bad-debt implication', definition: 'Positions with debt below this floor are stranded — no one liquidates them even when health factor < 1. Spec §4A flags this as the small-position bad-debt vector.' },
  ],
  impact: {
    health: 'Sets the bad-debt floor. Lower min → fewer stranded positions.',
    sustainability: 'Driven by gas cost. As long as MegaETH gas stays near zero, the floor is tiny.',
    profitability: 'Smaller min lets liquidators clear more positions, tightening the bad-debt distribution.',
  },
};

const maxProfitableLiquidation: KpiHelp = {
  title: 'Max profitable liquidation',
  oneLiner:
    'The largest debt size for which a liquidator still breaks even. Above this, AMM slippage exceeds the LIF spread and liquidations stop firing — large positions silently turn into bad debt.',
  formula: {
    plain:
      'max_USD = largest debt in [peak, peak × 1e6] with profit(debt) ≥ 0',
    latex:
      'max\\_USD = \\sup\\{ D : \\text{profit}(D) \\geq 0 \\}',
  },
  params: [COMMON_PARAMS.lltv!, COMMON_PARAMS.poolDepth!, COMMON_PARAMS.gas!],
  definitions: [
    { term: 'Slippage cliff', definition: 'Spec §4A: profit ≈ 0 when slippage = 1 − 1/LIF. With LIF(0.77) ≈ 1.0526, the breakeven slippage is ≈ 5%. Pool depth ≈ 19× debt is the rough rule-of-thumb to keep slippage under that ceiling.' },
    { term: 'Binary-search bracket', definition: 'The implementation log-scans for the profit peak, then binary-searches both zero-crossings in [peak, peak × 1e6]. Returns NaN/NaN when no debt size is profitable (e.g. pool depth essentially zero).' },
    { term: 'Pool depth is the lever', definition: 'Doubling pool depth roughly doubles the max. This is the single most effective dial for handling whale-sized positions.' },
  ],
  impact: {
    health: 'Sets the ceiling on liquidatable position size. Whales above this are uncovered.',
    sustainability: 'Depends entirely on bootstrapped wiTRY/USDM pool depth — Brix must seed and incentivize it alongside the lending market.',
    profitability: 'A tight profitable window means fewer hands willing to liquidate, less competition, slower clearing.',
  },
};

const recommendedPoolDepth: KpiHelp = {
  title: 'Recommended pool depth',
  oneLiner:
    'Suggested floor for the wiTRY/USDM secondary AMM so a single tail liquidation can clear without exceeding the slippage budget. Drives the bootstrapping requirement Brix must seed at launch.',
  formula: {
    plain:
      'p95LiquidationSize_USD = TVL × LLTV × E[LTV/LLTV] × P95_LIQUIDATION_FRACTION × LIF(lltv)\nrecommendedPoolDepth ≈ p95LiquidationSize_USD / slippageBudget\n  (UI floor: max(currentPoolDepth, $250k))',
    latex:
      'L_{p95} = TVL \\cdot LLTV \\cdot \\tfrac{\\alpha}{\\alpha+\\beta} \\cdot \\rho \\cdot LIF(LLTV),\\quad D^{*} \\approx L_{p95} / \\sigma_{\\text{budget}}',
  },
  params: [
    { name: 'L_p95', source: 'derived', note: 'P95 single-event liquidation size used in the LLTV derivation.' },
    { name: 'P95_LIQUIDATION_FRACTION_OF_BORROWS', source: 'constant', value: '0.01', note: 'Heuristic — 1% of expected borrows hit at once. From validation report #36g.' },
    { name: 'SLIPPAGE_ESTIMATE_CAP', source: 'constant', value: '0.5', note: 'Hard ceiling clamp on the derived slippage; protects the LLTV solver from runaway values.' },
    COMMON_PARAMS.lltv!,
    COMMON_PARAMS.poolDepth!,
  ],
  definitions: [
    { term: 'P95 single-event size', definition: 'A heuristic — 1% of expected borrows × LIF — taken as a representative tail liquidation to seed the LLTV derivation. The Section 4 recommendation card uses the path-aggregated `expectedLiquidationVolumeP95_USD` from the bad-debt cascade (P95 of total seized USD per path) as the live sizing number.' },
    { term: 'Slippage budget', definition: 'Typically 2% target — keeps liquidators inside the LIF profit window. The simulator does not store this as a constant today; the UI hint floors recommended depth at $250k as a launch minimum.' },
    { term: 'Capital cost', definition: 'Recommended depth is supplier capital locked at AMM yield instead of Morpho yield — a real opportunity cost. Bigger pool = safer but lower-yielding.' },
  ],
  impact: {
    health: 'Undersized pool ⇒ tail liquidations exceed slippage budget ⇒ liquidators sit out ⇒ bad debt accrues.',
    sustainability: 'A pool that needs to be 20× the largest liquidation is fragile. Pre-liquidation (next KPI) lets you run with a thinner pool.',
    profitability: 'Pool TVL competes with lending TVL for the same supplier dollars. Trade-off is real and is governance-tunable.',
  },
};

const badDebtP95USD: KpiHelp = {
  title: 'P95 Morpho debt — atomized (USD)',
  oneLiner:
    'The 95th-percentile USD amount of residual debt absorbed by the lender (Morpho market) across Monte-Carlo paths, assuming each liquidation hits the AMM as its own independent swap. Lower bound on tail loss — pairs with the coincident-execution viability tile to bracket the real exposure.',
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
    { term: 'Two residual branches', definition: 'If the liquidation was profitable, residual = debt − revenue (AMM dust). If unprofitable (gas/slippage cliff), no one liquidates and residual = debt − collAfter (collateral worth less than debt). Both branches are floored at 0.' },
    { term: 'Pre-liquidation effect', definition: 'When enabled, positions in [preLLTV, LLTV] get a one-shot 50% partial close at LIF=1.01, draining tail mass before the hard LLTV. Toggle in the sidebar to A/B.' },
    { term: 'P95 vs E[]', definition: 'P95 is the planning number — we size pool depth and reserves to absorb this, not the mean. Mean is dominated by zero-bad-debt paths and understates risk.' },
  ],
  impact: {
    health: 'The headline solvency risk for the lender. Must clear safety reserves + insurance to be tolerable.',
    sustainability: 'Driven equally by FX tail (Section 2 P95 drawdown) and AMM tail (poolDepth). Both are dials.',
    profitability: 'A real expected loss the protocol earnings must out-yield. If badDebtP95Pct > netSupplyAPY × LTV-of-bad-debt, the market is uneconomic.',
  },
};

const badDebtP95Pct: KpiHelp = {
  title: 'P95 Morpho debt — atomized (% TVL)',
  oneLiner:
    'P95 atomized Morpho debt as a fraction of TVL — the rate-comparable version. Tile coloring: <1% good, 1–5% warn, >5% bad. This is the loss the lender (not the AMM) absorbs in the optimistic per-position-swap regime.',
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
      'preLLTV = max(0, lltv − PRE_LIQUIDATION_LLTV_OFFSET)\n        = max(0, lltv − 0.05)\npreLCF = [0.05, 0.5]    // close factor: 5% at preLLTV → 50% at LLTV\npreLIF = [1.01, LIF(lltv)]  // incentive: 1% at preLLTV → full LIF at LLTV',
    latex: 'preLLTV = LLTV - 0.05,\\quad preLCF = [0.05, 0.5],\\quad preLIF = [1.01, LIF(LLTV)]',
  },
  params: [
    COMMON_PARAMS.lltv!,
    COMMON_PARAMS.preLiq!,
    { name: 'PRE_LIQUIDATION_LLTV_OFFSET', source: 'constant', value: '0.05', note: 'Distance below hard LLTV where pre-liq kicks in. Policy dial.' },
    { name: 'PRE_LIQUIDATION_LCF', source: 'constant', value: '[0.05, 0.5]', note: 'Close-factor at preLLTV (5%) and at hard LLTV (50%). Linear interp between.' },
    { name: 'PRE_LIQUIDATION_LIF_MIN', source: 'constant', value: '1.01', note: 'Incentive at preLLTV; ramps to LIF(lltv) at the hard boundary.' },
  ],
  definitions: [
    { term: 'Close factor (LCF)', definition: 'The fraction of debt a liquidator can repay in a single call. Starts at 5% near preLLTV (small bites — borrowers can self-cure) and ramps to 50% (Morpho default) at the hard LLTV.' },
    { term: 'Linear interpolation', definition: 'Spec §4D defines full piecewise-linear LCF/LIF schedules vs effLTV. The simulator uses a coarse one-shot approximation (50% close at LIF=1.01) — see validation report "Bonus" entry for the documented simplification.' },
    { term: 'Exported in vault JSON', definition: 'Section 5\'s vault config JSON embeds these directly under `preLiquidation.{preLLTV, preLCF, preLIF}`, so the help here doubles as the deploy-time documentation.' },
  ],
  impact: {
    health: 'The single most effective dial for tail bad debt. Toggling preLiquidationEnabled in the sidebar typically cuts badDebtP95 noticeably.',
    sustainability: 'Adds borrower friction (positions partially closed before they want to deleverage). Worth it for a TRY-collateralized vault where FX shocks are sudden.',
    profitability: 'Liquidators see smaller LIF at the soft band (1.01 vs ~1.05) — less profit per liquidation but more total volume cleared.',
  },
};

export const LIQUIDATION_KPIS = {
  minProfitableLiquidation,
  maxProfitableLiquidation,
  recommendedPoolDepth,
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
