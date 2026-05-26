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

const minProfitableLiquidation: KpiHelp = {
  title: 'Min profitable liquidation',
  oneLiner:
    'The smallest debt size for which a liquidator breaks even. Below this, fixed gas cost eats the LIF spread — small positions never get liquidated and silently accumulate bad debt.',
  formula: {
    plain:
      'seized = debt x LIF(lltv)\nrevenue = quoteSellUSD(current AMM ladder, spot, seized)\nprofit(debt) = revenue - debt - $5 gas\nmin_USD = smallest searched debt with profit >= 0',
    latex:
      '\\text{profit}(D) = \\operatorname{quote}_{AMM}(D \\cdot LIF) - D - \\text{gas}',
  },
  params: [COMMON_PARAMS.lltv!, COMMON_PARAMS.poolDepth!, COMMON_PARAMS.gas!],
  definitions: [
    { term: 'LIF(lltv)', definition: 'Liquidation Incentive Factor: collateral seized per dollar of debt repaid. At LLTV=86%, LIF is about 1.044, so a liquidator receives about $1.044 of collateral per $1 debt before swap costs.' },
    { term: 'AMM quote', definition: 'The code sells seized wiTRY through the configured concentrated-liquidity ladder. Fees and price impact are both included in the returned USDM revenue.' },
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
      'max_USD = largest searched debt with\n  quoteSellUSD(AMM ladder, debt x LIF(lltv)) - debt - $5 >= 0',
    latex:
      'max\\_USD = \\sup\\{ D : \\text{profit}(D) \\geq 0 \\}',
  },
  params: [COMMON_PARAMS.lltv!, COMMON_PARAMS.poolDepth!, COMMON_PARAMS.gas!],
  definitions: [
    { term: 'Slippage cliff', definition: 'Ignoring the small gas term, the liquidator breaks even when AMM proceeds equal repaid debt. In fraction form this is approximately slippage = 1 - 1/LIF.' },
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
    'The recommendation sentence in the homepage uses the P95 one-day concurrent seized amount as its stress notional, then compares that requirement with current effective depth and a launch floor.',
  formula: {
    plain:
      'displayedPoolDepthFloor = max(\n  seizedConcurrent_USD / 0.0438,\n  effectiveDepth_USD,\n  $250,000\n)\n0.0438 is the displayed LIF-spread approximation used by the recommendation sentence.',
    latex:
      'D_{\\mathrm{floor}} = \\max\\left(\\frac{\\mathrm{seizedConcurrent}}{0.0438},\\;D_{\\mathrm{effective}},\\;250000\\right)',
  },
  params: [
    { name: 'seizedConcurrent_USD', source: 'derived', note: 'From the visible P95 concurrent-stress tile.' },
    { name: 'effectiveDepth_USD', source: 'derived', note: 'Materialized concentrated-liquidity ladder valued at current spot.' },
    { name: '0.0438', source: 'constant', value: '4.38%', note: 'Homepage approximation for the available liquidation spread.' },
    COMMON_PARAMS.lltv!,
    COMMON_PARAMS.poolDepth!,
  ],
  definitions: [
    { term: 'Concurrent stress amount', definition: 'Aggregate collateral that would be seized if the Beta-sampled positions crossing LLTV under the P95 one-day move were liquidated together.' },
    { term: 'Different from cumulative volume', definition: 'The worker also reports total executed liquidation flow over an entire path. The depth recommendation shown on the homepage instead uses the one-day concurrent amount.' },
    { term: 'Capital cost', definition: 'Recommended depth is supplier capital locked at AMM yield instead of Morpho yield — a real opportunity cost. Bigger pool = safer but lower-yielding.' },
  ],
  impact: {
    health: 'Undersized pool ⇒ tail liquidations exceed slippage budget ⇒ liquidators sit out ⇒ bad debt accrues.',
    sustainability: 'A pool that needs to be 20× the largest liquidation is fragile. Pre-liquidation (next KPI) lets you run with a thinner pool.',
    profitability: 'Pool TVL competes with lending TVL for the same supplier dollars. Trade-off is real and is governance-tunable.',
  },
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

const concurrentStressP95: KpiHelp = {
  title: 'Concurrent stress at P95 1-day move',
  oneLiner:
    'A one-day arrival-capacity screen: estimate how much collateral would be seized when the Beta-distribution tail crosses LLTV during a P95 daily TRY weakening, then compare it with assumed AMM clearing capacity.',
  formula: {
    plain:
      'dd = P95(oneDayDD)\nfMin = max(0, 1 - dd)\ndebtAtRisk = sum(f_i x LLTV x TVL / 1000) for sampled f_i >= fMin\nseizedConcurrent = debtAtRisk x LIF(LLTV)\ncapacity = maxProfitableDebt x 48\nstatus = VIABLE if seizedConcurrent <= capacity, else STRESSED',
    latex:
      '\\mathrm{seizedConcurrent} = LIF(LLTV)\\sum_{f_i \\ge 1-dd_{95}} f_i\\,LLTV\\,\\frac{TVL}{1000}',
  },
  params: [
    { name: 'oneDayDD', source: 'derived', note: 'Per-path worst 1-day upward USD/TRY move from the FX worker.' },
    { name: 'Beta borrower sample', source: 'derived', note: '1000 fractions sampled from sidebar alpha and beta with the selected seed.' },
    { name: 'maxProfitableDebt', source: 'derived', note: 'Upper end of the gas-aware profitable debt range for the current pool.' },
    { name: 'ARB_REFILL_PER_DAY', source: 'constant', value: '48', note: 'Screening assumption: one AMM refill every 30 minutes.' },
  ],
  definitions: [
    { term: 'f_i', definition: 'Borrower i actual LTV as a fraction of the LLTV cap. A borrower crosses the hard threshold after drawdown dd when f_i >= 1 - dd.' },
    { term: 'Capacity screen', definition: 'The homepage multiplies the largest profitable single debt clear by 48 assumed refills. It is a fast operational screen, separate from the sequential full-path bad-debt simulation.' },
  ],
  impact: {
    health: 'STRESSED means a clustered one-day arrival could exceed the assumed refill cadence even when individual liquidations are profitable.',
    sustainability: 'The result is sensitive to pool depth, borrower tail shape, LLTV, FX drawdown, and the assumed 30-minute refill cadence.',
    profitability: 'More depth can improve the screen but commits more capital to AMM liquidity rather than lending yield.',
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
  minProfitableLiquidation,
  maxProfitableLiquidation,
  recommendedPoolDepth,
  badDebtP95USD,
  badDebtP95Pct,
  concurrentStressP95,
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
