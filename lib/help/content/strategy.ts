// lib/help/content/strategy.ts
// Real content for Section 3 (Liquidity Strategy). PR #5 (roadmap).
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 3)
// ---------------------------------------------------------------------------

export const STRATEGY_PARAMS: Partial<Record<string, ParamHelp>> = {
  incentiveBudgetMonthly_USD: {
    oneLiner:
      'Monthly Merkl incentive budget in USD. Sets the numerator of incentiveAPY (annualized as 12× this value) and the daily TVL ramp rate. Default $10,000/mo.',
  },
  attractionRate: {
    oneLiner:
      '$1 of incentive spend pulls in $X of TVL/month. Calibrated from Aave LM campaigns 2021–22 (see spec §3A). Higher = capital is more mercenary-responsive; lower = stickier suppliers, slower ramp.',
  },
  lockPeriodDays: {
    oneLiner:
      'Target supplier lock period in days. Currently informational — the heuristic Lock & Earn table renders against it, but no live KPI depends on it yet. Functional wiring (lock-bonus curve, exit fees) lands in a later PR.',
  },
  performanceFee: {
    oneLiner:
      'Vault performance fee, as a decimal. Subtracted MULTIPLICATIVELY from grossSupplyAPY before incentives. Default 10% — typical Morpho vault range is 5–15%.',
  },
  managementFee: {
    oneLiner:
      'Vault management fee, as a decimal annual APR. Subtracted ADDITIVELY from netSupplyAPY (not multiplicatively — see validation report #10). Default 1% APR.',
  },
};

// ---------------------------------------------------------------------------
// KPI help (section 3)
// ---------------------------------------------------------------------------

const COMMON_PARAMS: Record<string, KpiHelp['params'][number]> = {
  uTarget: { name: 'targetUtilization', source: 'sidebar', ref: 'targetUtilization' },
  perfFee: { name: 'performanceFee', source: 'sidebar', ref: 'performanceFee' },
  mgmtFee: { name: 'managementFee', source: 'sidebar', ref: 'managementFee' },
  budget: { name: 'incentiveBudgetMonthly_USD', source: 'sidebar', ref: 'incentiveBudgetMonthly_USD' },
  attract: { name: 'attractionRate', source: 'sidebar', ref: 'attractionRate' },
  iTRY: { name: 'witryYieldAnnual', source: 'sidebar', ref: 'witryYieldAnnual' },
  requiredUSDM: { name: 'requiredUSDM', source: 'derived', note: 'From Section 1 (Liquidity Need).' },
  borrowAPY: { name: 'borrowAPY', source: 'derived', note: 'AdaptiveCurveIRM evaluated at targetUtilization.' },
};

const borrowAPY: KpiHelp = {
  title: 'Borrow APY',
  oneLiner:
    'The borrow rate the IRM produces at the configured target utilization. This is the static AdaptiveCurveIRM value (slow Rate at Target drift ignored) — it sets the ceiling on supplier yield.',
  formula: {
    plain: 'borrowAPY = adaptiveCurveIRM(targetUtilization, r_target = 4%)',
    latex: 'borrowAPY = \\text{adaptiveCurveIRM}(u_{\\text{target}},\\; r_{\\text{target}} = 0.04)',
  },
  params: [
    COMMON_PARAMS.uTarget!,
    { name: 'r_target', source: 'constant', value: '0.04', note: 'Morpho governance default target APR at u=90%.' },
  ],
  definitions: [
    { term: 'AdaptiveCurveIRM', definition: 'Morpho\'s only governance-approved interest-rate model. Anchored at r/4 at u=0, r at u=90% (target), and 4r at u=100%, with two exponential segments interpolating between.' },
    { term: 'Rate at Target', definition: 'Morpho\'s official name (code: rateAtTarget; written as r_target in formulas) for the target borrow APY at the target utilization. Currently fixed at 4% APR — the "adaptive" drift converges much slower than the parameters we are tuning, so we treat Rate at Target as static.' },
    { term: 'Section 1 chart', definition: 'The full curve and where targetUtilization lands on it are visualized in Section 1\'s "Borrow APY curve" chart.' },
  ],
  impact: {
    health: 'The ceiling on what suppliers can earn before fees and incentives. Sets the cost of leverage for borrowers.',
    sustainability: 'Far from target utilization, the curve steepens — both extremes are self-correcting via the rate.',
    profitability: 'Every downstream APY in this section flows from this number. Move targetUtilization and the whole strategy re-prices.',
  },
};

const grossSupplyAPY: KpiHelp = {
  title: 'Gross supply APY',
  oneLiner:
    'Pre-fee yield suppliers would earn at steady-state utilization. The pure interest take before vault fees and before any incentive layer.',
  formula: {
    plain: 'grossSupplyAPY = borrowAPY × targetUtilization',
    latex: 'grossSupplyAPY = borrowAPY \\times u_{\\text{target}}',
  },
  params: [COMMON_PARAMS.borrowAPY!, COMMON_PARAMS.uTarget!],
  definitions: [
    { term: 'Why utilization shows up here', definition: 'Borrow interest accrues only on the borrowed fraction of the vault. Suppliers earn that interest spread across ALL their capital, so realized supplier yield = borrow rate × the share that is actually borrowed.' },
    { term: 'Pre-fee', definition: 'This is the gross take before the vault\'s performance and management fees skim. The net number after fees is below.' },
  ],
  impact: {
    health: 'The theoretical ceiling on supplier yield from interest alone. Below this and the strategy is leaking value to fees or idle capital.',
    sustainability: 'Stable as long as utilization tracks the target. Persistent under-utilization here means the market is over-supplied or under-borrowed.',
    profitability: 'The headline interest take. Performance fee scales off this number.',
  },
};

const netSupplyAPY: KpiHelp = {
  title: 'Net supply APY',
  oneLiner:
    'Post-fee supplier yield before incentives. Performance fee is taken MULTIPLICATIVELY off the gross take; management fee is then subtracted ADDITIVELY as a flat APR.',
  formula: {
    plain: 'netSupplyAPY = grossSupplyAPY × (1 − performanceFee) − managementFee',
    latex: 'netSupplyAPY = grossSupplyAPY \\cdot (1 - \\text{perfFee}) - \\text{mgmtFee}',
  },
  params: [
    { name: 'grossSupplyAPY', source: 'derived' },
    COMMON_PARAMS.perfFee!,
    COMMON_PARAMS.mgmtFee!,
  ],
  definitions: [
    { term: 'Performance fee', definition: 'Skimmed as a percentage of interest earned (multiplicative). 10% perf fee with 5% gross APY → suppliers see 4.5% before mgmt fee.' },
    { term: 'Management fee', definition: 'Flat annual APR subtracted from supplier yield regardless of interest. 1% mgmt fee with 4.5% post-perf → 3.5% net. NOT a multiplier — see validation report #10 for the sign convention.' },
    { term: 'Pre-incentive', definition: 'This is the sustainable yield once Merkl rewards end. Compare against the "retention after incentives" KPI to judge how much sticky capital this number will hold.' },
  ],
  impact: {
    health: 'The yield suppliers can rely on once the campaign ends. If this is below competing stablecoin rates, capital leaves.',
    sustainability: 'The only yield that is self-funding from real borrow demand. Incentives must bridge until netSupplyAPY alone is competitive.',
    profitability: 'Direct lever on supplier economics. Lower fees = stickier capital but lower vault take.',
  },
  workedExample: {
    description: 'Defaults: targetUtilization 70%, borrowAPY ≈ 2.1% (IRM at 70%), perfFee 10%, mgmtFee 1%.',
    steps: [
      { label: 'gross supply APY', expression: '2.1% × 0.70 = 1.47%', usesInputs: ['targetUtilization'] },
      { label: 'after performance fee', expression: '1.47% × (1 − 0.10) = 1.32%', usesInputs: ['performanceFee'] },
      { label: 'after management fee', expression: '1.32% − 1.00% = 0.32%', usesInputs: ['managementFee'] },
    ],
  },
};

const incentiveAPY: KpiHelp = {
  title: 'Incentive APY',
  oneLiner:
    'The annualized USD yield boost from the Merkl campaign, expressed per dollar of required USDM. Annualizes the monthly budget against the vault\'s target size.',
  formula: {
    plain: 'incentiveAPY = (incentiveBudgetMonthly_USD × 12) / requiredUSDM',
    latex: 'incentiveAPY = \\frac{12 \\cdot B_{\\text{month}}}{requiredUSDM}',
  },
  params: [COMMON_PARAMS.budget!, COMMON_PARAMS.requiredUSDM!],
  definitions: [
    { term: 'Requires non-zero requiredUSDM', definition: 'If Section 1 yields zero required USDM (e.g. TVL=0), incentiveAPY is reported as 0 rather than ∞.' },
    { term: 'Independent of attraction rate', definition: 'This is "yield once you are deposited", not "speed to fill". Attraction rate governs the fill speed and shows up in daysToTarget, not here.' },
    { term: 'Mercenary capital signal', definition: 'A high incentiveAPY relative to netSupplyAPY means most yield comes from rewards — capital here is more likely to exit when rewards end. Section 1\'s withdrawal buffer widens accordingly.' },
  ],
  impact: {
    health: 'Determines how quickly the vault fills and how aggressive the withdrawal buffer must be (mercenary-capital sensitivity in Section 1).',
    sustainability: 'Pure subsidy — not self-funding. Sustained only as long as the budget pays out.',
    profitability: 'The headline number suppliers compare against competing protocols during the campaign window.',
  },
  workedExample: {
    description: 'Defaults: $10,000/mo budget, requiredUSDM ≈ $3.44M (from Section 1 example).',
    steps: [
      { label: 'annualized budget', expression: '$10,000 × 12 = $120,000', usesInputs: ['incentiveBudgetMonthly_USD'] },
      { label: 'per-dollar yield', expression: '$120,000 / $3,437,500 ≈ 3.49%', usesInputs: [] },
    ],
  },
};

const totalSupplyAPY: KpiHelp = {
  title: 'Total supply APY',
  oneLiner:
    'Headline supplier yield during the campaign: net (post-fee) base yield plus the incentive layer. This is what the marketing page shows.',
  formula: {
    plain: 'totalSupplyAPY = netSupplyAPY + incentiveAPY',
    latex: 'totalSupplyAPY = netSupplyAPY + incentiveAPY',
  },
  params: [
    { name: 'netSupplyAPY', source: 'derived' },
    { name: 'incentiveAPY', source: 'derived' },
  ],
  definitions: [
    { term: 'Additive layering', definition: 'Both pieces are in the same APR units (USD yield per USD deposited per year), so they add directly. No compounding adjustment needed for this scale.' },
    { term: 'Campaign-window only', definition: 'Drops to netSupplyAPY when the Merkl campaign ends. The "retention after incentives" KPI estimates how much capital survives that step-down.' },
  ],
  impact: {
    health: 'Must clear competing stablecoin yields (default 5%) to attract capital at all. Below that, the campaign stalls.',
    sustainability: 'Bridges to sustainable yield. The gap between this and netSupplyAPY is the cliff suppliers face at campaign end.',
    profitability: 'Headline lever on supplier acquisition velocity. Higher → faster ramp, more mercenary mix.',
  },
};

const daysToTarget: KpiHelp = {
  title: 'Days to target USDM',
  oneLiner:
    'Linear projection of how many days the Merkl campaign needs to attract enough TVL to reach requiredUSDM, given the configured attraction rate.',
  formula: {
    plain: 'dailyAttract = (incentiveBudgetMonthly_USD × attractionRate) / 30\ndaysToTarget = requiredUSDM / dailyAttract',
    latex: 'daysToTarget = \\frac{requiredUSDM}{(B_{\\text{month}} \\cdot \\text{attractionRate}) / 30}',
  },
  params: [COMMON_PARAMS.requiredUSDM!, COMMON_PARAMS.budget!, COMMON_PARAMS.attract!],
  definitions: [
    { term: 'attractionRate (× multiplier)', definition: '$1 of monthly incentive draws in $attractionRate of TVL/month. Default 5×; values 2–10× span "sticky" to "very mercenary" markets.' },
    { term: 'Linear projection', definition: 'A first-order estimate. Real ramps S-curve (slow start, midpoint inflection, saturation). Use this for ballpark, not precise launch planning.' },
    { term: '∞ result', definition: 'Reported as Infinity when attractionRate or budget is 0 — the vault never fills under those settings.' },
  ],
  impact: {
    health: 'If too long, the market underperforms during the early window: rates spike, borrowers exit, suppliers churn.',
    sustainability: 'Budget × rate combinations that take >6 months are typically not worth running — competitors launch new campaigns faster.',
    profitability: 'Total incentive spend = budget × (daysToTarget / 30). Shorter ramp = lower total spend = better unit economics.',
  },
  workedExample: {
    description: 'Defaults: $10,000/mo budget, attractionRate 5×, requiredUSDM ≈ $3.44M.',
    steps: [
      { label: 'daily attraction', expression: '($10,000 × 5) / 30 ≈ $1,667/day', usesInputs: ['incentiveBudgetMonthly_USD', 'attractionRate'] },
      { label: 'days to fill', expression: '$3,437,500 / $1,667 ≈ 2,063 days', usesInputs: [] },
      { label: 'interpretation', expression: '~5.6 years — under defaults, attraction rate or budget must rise materially to launch on a sensible timeline.', usesInputs: [] },
    ],
  },
};

const retentionAfterIncentives: KpiHelp = {
  title: 'Retention after incentives end',
  oneLiner:
    'Estimated USD that stays in the vault after Merkl rewards end, modeled as the fraction of requiredUSDM whose competing-stablecoin alternative is no better than netSupplyAPY.',
  formula: {
    plain: 'retention = competingAPY > 0\n  ? requiredUSDM × min(1, netSupplyAPY / competingAPY)\n  : requiredUSDM',
    latex: 'retention = requiredUSDM \\cdot \\min\\!\\left(1,\\; \\frac{netSupplyAPY}{competingAPY}\\right)',
  },
  params: [
    COMMON_PARAMS.requiredUSDM!,
    { name: 'netSupplyAPY', source: 'derived' },
    { name: 'competingAPY', source: 'constant', value: '0.05', note: 'Hardcoded as a 5% USDC reference yield in useSimulator.ts (COMPETING_STABLECOIN_APY). Policy dial, not a sidebar input.' },
  ],
  definitions: [
    { term: 'Competing APY', definition: 'A reference yield that mercenary capital would defect to once Brix incentives end. Default 5% APR (typical USDC supply yield). Set as a policy constant; surface as an assumption when comparing scenarios.' },
    { term: 'min(1, ratio)', definition: 'If Brix net yield equals or exceeds the competing yield, retention is 100%. Otherwise, retention scales linearly with the yield ratio — a crude but transparent stickiness proxy.' },
    { term: 'Not a behavioral model', definition: 'Real retention depends on lock period, gas costs, switching frictions, and trust. This metric is a yield-ratio first-cut, not a calibrated exit curve.' },
  ],
  impact: {
    health: 'Sets expectations for the "cliff" the vault sees when rewards end. Low retention = need a follow-up campaign.',
    sustainability: 'A retention near 100% means the protocol is self-sustaining post-launch; below ~50% means the launch is a campaign, not a product.',
    profitability: 'Drives whether the incentive spend was a one-shot user-acquisition cost or a recurring subsidy.',
  },
};

const totalIncentiveSpend: KpiHelp = {
  title: 'Total incentive spend',
  oneLiner:
    'Projected total USD outlay to fill the vault, computed from the monthly budget and the linear daysToTarget. The all-in cost of the Merkl campaign.',
  formula: {
    plain: 'totalIncentiveSpend = incentiveBudgetMonthly_USD × (daysToTarget / 30)',
    latex: 'totalIncentiveSpend = B_{\\text{month}} \\cdot \\frac{daysToTarget}{30}',
  },
  params: [COMMON_PARAMS.budget!, { name: 'daysToTarget', source: 'derived' }],
  definitions: [
    { term: 'Linear-ramp assumption', definition: 'Inherits the linearity of daysToTarget. Real campaigns front-load attraction; this number is an upper-bound on a flat-rate budget.' },
    { term: 'Cost-per-dollar-of-TVL', definition: 'Divide by requiredUSDM to get the bps cost per USD of TVL acquired. Useful for comparing across budget/attraction configurations.' },
  ],
  impact: {
    health: 'A campaign that spends more than ~10% of the borrow base to acquire it likely will not be net-profitable for the protocol.',
    sustainability: 'Bounded by the budget × duration. Watch this against retention: high spend × low retention = capital-inefficient.',
    profitability: 'Direct cost line. Trade off against faster ramp (higher attractionRate) and lower spend (smaller budget).',
  },
  workedExample: {
    description: 'Defaults: $10,000/mo, daysToTarget ≈ 2,063 days (from above).',
    steps: [
      { label: 'months of spend', expression: '2,063 / 30 ≈ 68.8 months', usesInputs: [] },
      { label: 'total spend', expression: '$10,000 × 68.8 ≈ $688,000', usesInputs: ['incentiveBudgetMonthly_USD'] },
      { label: 'cost per $ TVL', expression: '$688k / $3.44M ≈ 20¢ per $ — well outside healthy LM economics; raise attractionRate or budget.', usesInputs: [] },
    ],
  },
};

const leverageLoopAPY: KpiHelp = {
  title: 'Leverage-loop APY',
  oneLiner:
    'Net yield a wiTRY → borrow USDM → buy more wiTRY looper sees, in USD terms. Positive means looping is profitable and borrow demand is structurally supported.',
  formula: {
    plain: 'leverageLoopAPY = witryYieldAnnual − borrowAPY × (1 + expectedTRYDepreciation_annual)',
    latex: 'leverageLoopAPY = y_{\\text{iTRY}} - borrowAPY \\cdot (1 + d_{\\text{TRY}})',
  },
  params: [
    COMMON_PARAMS.iTRY!,
    COMMON_PARAMS.borrowAPY!,
    { name: 'expectedTRYDepreciation_annual', source: 'constant', value: '0.30', note: 'Hardcoded in useSimulator.ts (DEFAULT_TRY_DEPRECIATION_ANNUAL). 30% rough TRY depreciation; policy dial.' },
  ],
  definitions: [
    { term: 'Why (1 + d) and not (1 − d)', definition: 'A USDM debt repaid after TRY weakens by d costs (1 + d) more in TRY terms. The validation report (open question #1, resolved) confirms this sign; the spec §3B text has a typo. Code is canonical.' },
    { term: 'wiTRY yield', definition: 'The TRY-denominated yield wiTRY earns as the Turkish-MMF NAV grows. iTRY is a 1:1 stable peg to TRY; the yield accrues at the wiTRY wrapper level. Default 38%/year — typical Turkish MMF.' },
    { term: 'expectedTRYDepreciation', definition: 'Annualized USD/TRY depreciation expectation. Default 30%/year. A policy dial — surface as an assumption when sharing scenarios.' },
    { term: 'leverageLoopsViable flag', definition: 'The dashboard\'s green/red box flips on leverageLoopAPY > 0. Negative means rational borrowers stay out of loops, and borrow demand has to come from elsewhere (hedging, USDM-for-spending, etc.).' },
  ],
  impact: {
    health: 'A primary source of organic borrow demand. If negative, the strategy depends on non-loop borrowers (often less elastic).',
    sustainability: 'Sensitive to both rate (Brix can influence) and TRY-depreciation expectation (Brix cannot). Stress-test by toggling witryYield ± 5pp.',
    profitability: 'A larger positive loop APY pulls utilization toward target, raising supplier APY across the section.',
  },
  workedExample: {
    description: 'Defaults: witryYield 38%, borrowAPY ≈ 2.1%, expected TRY depreciation 30%.',
    steps: [
      { label: 'real borrow cost', expression: '2.1% × (1 + 0.30) ≈ 2.73%', usesInputs: ['witryYieldAnnual'] },
      { label: 'loop APY', expression: '38% − 2.73% ≈ 35.27%', usesInputs: ['witryYieldAnnual'] },
      { label: 'interpretation', expression: 'Highly viable. The big cushion mostly reflects wiTRY yield > USD-equivalent depreciation; if either flips, viability flips.', usesInputs: [] },
    ],
  },
};

export const STRATEGY_KPIS = {
  borrowAPY,
  grossSupplyAPY,
  netSupplyAPY,
  incentiveAPY,
  totalSupplyAPY,
  daysToTarget,
  retentionAfterIncentives,
  totalIncentiveSpend,
  leverageLoopAPY,
};

// ---------------------------------------------------------------------------
// Chart help (section 3) — none today.
// ---------------------------------------------------------------------------

export const STRATEGY_CHARTS: Partial<Record<string, ChartHelp>> = {};
