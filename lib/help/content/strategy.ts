// lib/help/content/strategy.ts
// Real content for Section 3 (Liquidity Strategy). PR #5 (roadmap).
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 3)
// ---------------------------------------------------------------------------

export const STRATEGY_PARAMS: Partial<Record<string, ParamHelp>> = {
  supplyIncentiveBudgetMonthly_USD: {
    oneLiner:
      'Monthly Merkl incentive budget paid to USDM suppliers, in USD. Annualized as 12× and divided by requiredUSDM to produce supplyIncentiveAPY. Default $0/mo.',
  },
  borrowerIncentiveBudgetMonthly_USD: {
    oneLiner:
      'Monthly Merkl incentive budget paid to borrowers, in USD. Annualized as 12× and divided by expected borrows to produce borrowerIncentiveAPY, which is subtracted from borrowAPY to give the netBorrowAPY a looper actually pays. Default $0/mo.',
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
  supplyBudget: { name: 'supplyIncentiveBudgetMonthly_USD', source: 'sidebar', ref: 'supplyIncentiveBudgetMonthly_USD' },
  borrowerBudget: { name: 'borrowerIncentiveBudgetMonthly_USD', source: 'sidebar', ref: 'borrowerIncentiveBudgetMonthly_USD' },
  iTRY: { name: 'witryYieldAnnual', source: 'sidebar', ref: 'witryYieldAnnual' },
  requiredUSDM: { name: 'requiredUSDM', source: 'derived', note: 'From Section 1 (Liquidity Need).' },
  expectedBorrow: { name: 'expectedBorrow_USD', source: 'derived', note: 'From Section 1: TVL × LLTV × meanLTVFrac.' },
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

const supplyIncentiveAPY: KpiHelp = {
  title: 'Supply incentive APY',
  oneLiner:
    'The annualized USD yield boost paid to USDM suppliers from the Merkl campaign, expressed per dollar of required USDM. Annualizes the monthly supply-side budget against the vault\'s target size.',
  formula: {
    plain: 'supplyIncentiveAPY = (supplyIncentiveBudgetMonthly_USD × 12) / requiredUSDM',
    latex: 'supplyIncentiveAPY = \\frac{12 \\cdot B^{\\text{supply}}_{\\text{month}}}{requiredUSDM}',
  },
  params: [COMMON_PARAMS.supplyBudget!, COMMON_PARAMS.requiredUSDM!],
  definitions: [
    { term: 'Requires non-zero requiredUSDM', definition: 'If Section 1 yields zero required USDM (e.g. TVL=0), supplyIncentiveAPY is reported as 0 rather than ∞.' },
    { term: 'Mercenary capital signal', definition: 'A high supplyIncentiveAPY relative to netSupplyAPY means most yield comes from rewards — capital here is more likely to exit when rewards end. Section 1\'s withdrawal buffer widens accordingly.' },
    { term: 'Compare against borrowerIncentiveAPY', definition: 'Two independent levers. Supply incentives bootstrap USDM supply; borrower incentives bootstrap demand (loopers). Together they determine net spreads each side sees.' },
  ],
  impact: {
    health: 'Determines how aggressive the withdrawal buffer must be (mercenary-capital sensitivity in Section 1).',
    sustainability: 'Pure subsidy — not self-funding. Sustained only as long as the budget pays out.',
    profitability: 'The headline number suppliers compare against competing protocols during the campaign window.',
  },
};

const borrowerIncentiveAPY: KpiHelp = {
  title: 'Borrower incentive APY',
  oneLiner:
    'The annualized USD reward paid to borrowers from the Merkl campaign, expressed per dollar of expected borrows. Subtracts directly from borrowAPY to give the net cost a borrower actually pays.',
  formula: {
    plain: 'borrowerIncentiveAPY = (borrowerIncentiveBudgetMonthly_USD × 12) / expectedBorrow_USD',
    latex: 'borrowerIncentiveAPY = \\frac{12 \\cdot B^{\\text{borrow}}_{\\text{month}}}{expectedBorrow}',
  },
  params: [COMMON_PARAMS.borrowerBudget!, COMMON_PARAMS.expectedBorrow!],
  definitions: [
    { term: 'Negative-net-rate effect', definition: 'When borrowerIncentiveAPY exceeds borrowAPY, the netBorrowAPY goes negative — borrowers are effectively paid to borrow. This is the mechanism behind the USP/USDC market\'s -0.18% net rate.' },
    { term: 'Why divide by expectedBorrow, not requiredUSDM', definition: 'Borrower rewards are sized against the amount actually borrowed at target utilization, not against total USDM supply. expectedBorrow = TVL × LLTV × meanLTVFrac.' },
  ],
  impact: {
    health: 'Reduces effective borrow cost without lowering the IRM — useful when you want to bootstrap utilization without touching Rate at Target.',
    sustainability: 'Pure subsidy. When the budget ends, netBorrowAPY snaps back to gross borrowAPY and demand drops accordingly.',
    profitability: 'Direct lever on loop viability: every 1pp of borrowerIncentiveAPY adds ~1pp × (effectiveLeverage − 1) to netLoopAPYWithIncentives.',
  },
};

const netBorrowAPY: KpiHelp = {
  title: 'Net borrow APY',
  oneLiner:
    'The interest rate a borrower actually pays after borrower-side incentives are netted out. Can go negative — meaning borrowers are paid to borrow — when incentive APY exceeds gross borrow APY.',
  formula: {
    plain: 'netBorrowAPY = borrowAPY − borrowerIncentiveAPY',
    latex: 'netBorrowAPY = borrowAPY - borrowerIncentiveAPY',
  },
  params: [COMMON_PARAMS.borrowAPY!, { name: 'borrowerIncentiveAPY', source: 'derived' }],
  definitions: [
    { term: 'Negative net rate', definition: 'Live example: USP/USDC market on Morpho with PIKU rewards shows net borrow ≈ -0.18% (borrow 8.10% − PIKU 8.28%). Same mechanism — borrowers paid to borrow.' },
    { term: 'Used in carry-only loop APY', definition: 'netLoopAPY depends on borrowAPY through the carry term (effectiveLeverage − 1) × borrowAPY. Borrower incentives lower this effective cost via netLoopAPYWithIncentives; expected TRY depreciation is NOT subtracted (wiTRY yield already compensates it on average).' },
  ],
  impact: {
    health: 'Cheap (or negative) net borrowing pulls in more loopers, which raises utilization — pushing borrowAPY up via the IRM and partially offsetting the subsidy.',
    sustainability: 'Only as durable as the incentive budget. Plan for the cliff when rewards expire.',
    profitability: 'The number every borrower compares against alternatives. Most decisive lever for utilization.',
  },
};

const totalSupplyAPY: KpiHelp = {
  title: 'Total supply APY',
  oneLiner:
    'Headline supplier yield during the campaign: net (post-fee) base yield plus the supply-side incentive layer. This is what the marketing page shows.',
  formula: {
    plain: 'totalSupplyAPY = netSupplyAPY + supplyIncentiveAPY',
    latex: 'totalSupplyAPY = netSupplyAPY + supplyIncentiveAPY',
  },
  params: [
    { name: 'netSupplyAPY', source: 'derived' },
    { name: 'supplyIncentiveAPY', source: 'derived' },
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

const netLoopAPY: KpiHelp = {
  title: 'Net loop APY (carry-only)',
  oneLiner:
    'Annualized USD return for a wiTRY → USDM → wiTRY looper, computed as the carry differential (wiTRY yield − borrow rate − slippage − HF-idle cost) at the deterministic effective leverage. FX risk is NOT subtracted as expected cost; it appears separately as a Monte Carlo P&L distribution.',
  formula: {
    plain:
      'netLoopAPY = effectiveLeverage × y_iTRY − (effectiveLeverage − 1) × (borrowAPY + slippage) − y_iTRY × (1 − 1/hfBuffer) × (effectiveLeverage − 1)',
    latex:
      'netLoopAPY = \\ell \\cdot y_{\\text{iTRY}} - (\\ell - 1)(r + s) - y_{\\text{iTRY}}(1 - 1/H)(\\ell - 1)',
  },
  params: [
    COMMON_PARAMS.iTRY!,
    { name: 'effectiveLeverage', source: 'derived', note: '1 / (1 − LLTV / hfBuffer).' },
    { name: 'borrowAPY', source: 'derived', note: 'IRM at target utilization; the carry borrow cost.' },
    { name: 'perLoopSlippageBps', source: 'constant', value: '30 bps', note: 'Per-loop round-trip swap cost; matches /utilization.' },
    { name: 'hfBuffer', source: 'derived', note: 'Sidebar slider; ≥ 1.0.' },
  ],
  definitions: [
    { term: 'Why no TRY-depreciation surcharge', definition: 'wiTRY is a TRY-denominated MMF; its yield already compensates for the average rate at which TRY depreciates. Charging an extra (1 + d_TRY) factor on the borrow cost double-counts FX risk. Realized FX impact appears in the path-aware P&L below.' },
    { term: 'leverageLoopsViable flag', definition: 'Green when netLoopAPY > witryYieldAnnual — looping beats holding wiTRY. Borrower incentives are NOT used to flip this gate; they enter only as an additive overlay on the next bar.' },
  ],
  impact: {
    health: 'Primary organic borrow demand driver. Negative netLoopAPY means rational borrowers stay out of loops.',
    sustainability: 'Sensitive to wiTRY yield and borrow rate; insensitive to expected TRY depreciation by construction.',
    profitability: 'A larger positive netLoopAPY pulls utilization toward target, raising supplier APY.',
  },
};

const netLoopAPYWithIncentives: KpiHelp = {
  title: 'Loop APY with borrower incentives',
  oneLiner:
    'netLoopAPY plus the looper share of the borrower-incentive budget. This is the headline number a looper sees when comparing to passive hold during an active Merkl campaign.',
  formula: {
    plain: 'netLoopAPY_withIncentives = netLoopAPY + borrowerIncentiveAPY × (effectiveLeverage − 1)',
    latex: 'netLoopAPY_{\\text{wInc}} = netLoopAPY + b \\cdot (\\ell - 1)',
  },
  params: [
    { name: 'netLoopAPY', source: 'derived' },
    { name: 'borrowerIncentiveAPY', source: 'derived' },
    { name: 'effectiveLeverage', source: 'derived' },
  ],
  definitions: [
    { term: 'Why multiply by (effectiveLeverage − 1)', definition: 'Borrower incentives are paid on the looper\'s debt notional, which equals (effectiveLeverage − 1) × equity for a fully-looped position.' },
    { term: 'Campaign-window only', definition: 'Reverts to netLoopAPY when borrower-side rewards stop. The gap between the two bars is the cliff loopers face at campaign end.' },
  ],
  impact: {
    health: 'Acquisition lever during campaign windows; should not gate structural viability.',
    sustainability: 'Mercenary-capital signal — a wide gap between this and netLoopAPY means much of the loop\'s appeal is rented.',
    profitability: 'Direct lever on looper acquisition velocity during a campaign.',
  },
};

const effectiveLeverageStrategy: KpiHelp = {
  title: 'Effective leverage (looper)',
  oneLiner:
    'Geometric-sum cap on how much wiTRY a looper can stack from 1 unit of equity, given an LLTV and a self-imposed HF buffer.',
  formula: {
    plain: 'effectiveLeverage = 1 / (1 − LLTV / hfBuffer)',
    latex: '\\ell = 1 / (1 - L / H)',
  },
  params: [
    { name: 'LLTV', source: 'derived', note: 'Sidebar slider; governance-snapped tier.' },
    { name: 'hfBuffer', source: 'derived', note: 'Sidebar slider; ≥ 1.0.' },
  ],
  definitions: [
    { term: 'Why a buffer', definition: 'Looping to the bare LLTV maximizes leverage but liquidates on the first adverse FX tick. hfBuffer ≥ 1.1 leaves headroom; typical defaults are 1.3–1.7.' },
    { term: 'Numerical cap', definition: 'Capped at 50× internally to keep the geometric series numerically stable. Defaults never come near this.' },
  ],
  impact: {
    health: 'Drives both grossLoopAPY (positive) and FX-risk amplification (negative).',
    sustainability: 'Higher leverage → larger realized P&L distribution width.',
    profitability: 'Direct multiplier on yield in the carry term; always evaluate against the realized P&L tail.',
  },
};

const loopDebtPerCollateral: KpiHelp = {
  title: 'Debt / collateral (looper)',
  oneLiner:
    'Fraction of collateral USD value a looper has borrowed against. Equals LLTV / hfBuffer.',
  formula: {
    plain: 'loopDebtPerCollateral = LLTV / hfBuffer',
    latex: 'L / H',
  },
  params: [
    { name: 'LLTV', source: 'derived' },
    { name: 'hfBuffer', source: 'derived' },
  ],
  definitions: [
    { term: 'Why useful', definition: 'A cleaner intuition than effectiveLeverage when reasoning about how close a position is to its liquidation threshold.' },
  ],
  impact: {
    health: 'Higher → tighter liquidation tolerance per FX move.',
    sustainability: 'A natural cap on aggressive loops.',
    profitability: 'Affects looper risk appetite; high values deter all but mercenary borrowers.',
  },
};

const loopAPYP5: KpiHelp = {
  title: 'P5 realized loop APY',
  oneLiner:
    '5th-percentile annualized return across all Monte Carlo FX paths. The unlucky-tail outcome a looper should expect once in 20 starts.',
  formula: { plain: 'P5(apyByPath)', latex: 'P_{5}(\\text{apyByPath})' },
  params: [
    { name: 'apyByPath', source: 'derived', note: 'Per-path realized loop APY from looperPathPnL.' },
  ],
  definitions: [
    { term: 'Liquidated paths', definition: 'Paths where HF hit 1.0 before horizon are included at their floored −100% APY. They sink the lower tail directly.' },
    { term: 'Difference from carry-only', definition: 'netLoopAPY is the expected value at flat FX; P5 captures the realized downside under simulated TRY moves.' },
  ],
  impact: {
    health: 'Looper risk-budget anchor.',
    sustainability: 'A very deep P5 means the loop is structurally fragile to TRY shocks.',
    profitability: 'Defines the worst-case a rational looper would accept.',
  },
};

const loopAPYP50: KpiHelp = {
  title: 'P50 realized loop APY',
  oneLiner: 'Median annualized return across Monte Carlo FX paths. The typical outcome.',
  formula: { plain: 'P50(apyByPath)', latex: 'P_{50}(\\text{apyByPath})' },
  params: [{ name: 'apyByPath', source: 'derived' }],
  definitions: [
    { term: 'P50 vs netLoopAPY', definition: 'For flat FX paths P50 ≈ netLoopAPY. Gaps reveal asymmetric path dynamics (e.g. heavy left tail from liquidations pulls the median below netLoopAPY).' },
  ],
  impact: {
    health: 'Headline expected-value figure for loopers.',
    sustainability: 'The number that goes in marketing copy.',
    profitability: 'Anchor for looper acquisition pitches.',
  },
};

const loopAPYP95: KpiHelp = {
  title: 'P95 realized loop APY',
  oneLiner:
    '95th-percentile annualized return. The lucky-tail outcome — a strong TRY-stable or TRY-strengthening regime.',
  formula: { plain: 'P95(apyByPath)', latex: 'P_{95}(\\text{apyByPath})' },
  params: [{ name: 'apyByPath', source: 'derived' }],
  definitions: [
    { term: 'Upside symmetry', definition: 'In a balanced FX regime P95 sits roughly symmetrically opposite P5 around P50; persistent skew indicates a one-sided historical window.' },
  ],
  impact: {
    health: 'Marketing upside number.',
    sustainability: 'High P95 with low P5 = high-variance strategy; do not mislead users with P95 alone.',
    profitability: 'Sets the realistic best-case expectation.',
  },
};

const loopLiquidationRate: KpiHelp = {
  title: 'Loop liquidation rate',
  oneLiner:
    'Fraction of Monte Carlo paths where the looper position hit HF = 1.0 before horizon and was forcibly closed.',
  formula: {
    plain: 'liquidationRate = |{ path : HF_t ≤ 1 for some t }| / |paths|',
    latex: 'liquidationRate = |\\{p : HF_t(p) \\le 1 \\text{ for some } t\\}| / |\\text{paths}|',
  },
  params: [
    { name: 'paths', source: 'derived', note: 'Monte Carlo USD/TRY paths from the FX worker.' },
    { name: 'hfBuffer', source: 'derived', note: 'A larger buffer reduces this rate.' },
  ],
  definitions: [
    { term: 'Difference from bad-debt cascade', definition: 'simulateBadDebt (Section 4) models the protocol\'s residual after liquidator action and AMM slippage; this rate models the looper\'s probability of getting wiped. They are disjoint concerns.' },
    { term: 'LIF haircut proxy', definition: 'On liquidation, the looper\'s terminal equity is reduced by (LIF − 1) × debt — a constant proxy for the liquidator-bonus seizure. Slippage at liquidation is omitted by design (covered separately in Section 4).' },
  ],
  impact: {
    health: 'A high liquidation rate (>10%) is a structural warning sign even if P50 looks attractive.',
    sustainability: 'Lowering hfBuffer or raising LLTV pushes this up rapidly.',
    profitability: 'A 0-rate at a productive netLoopAPY is the goal; rates >5% suggest tightening the buffer.',
  },
};

export const STRATEGY_KPIS = {
  borrowAPY,
  grossSupplyAPY,
  netSupplyAPY,
  supplyIncentiveAPY,
  totalSupplyAPY,
  borrowerIncentiveAPY,
  netBorrowAPY,
  netLoopAPY,
  netLoopAPYWithIncentives,
  effectiveLeverageStrategy,
  loopDebtPerCollateral,
  loopAPYP5,
  loopAPYP50,
  loopAPYP95,
  loopLiquidationRate,
};

// ---------------------------------------------------------------------------
// Chart help (section 3)
// ---------------------------------------------------------------------------

const competitiveBenchmark: ChartHelp = {
  title: 'Competitive benchmark (supplier APY vs other USD-stable markets)',
  oneLiner:
    "How Brix's supplier APY stacks up against where the same dollars could go instead (Aave USDC, other Morpho USDC vaults). If Brix is below the competition, suppliers leave — required USDM never gets met, and the market under-funds itself.",
  axes: {
    x: 'Source of yield (one bar per option a supplier could pick today)',
    y: 'Annualized supply APY (%)',
  },
  definitions: [
    {
      term: 'Brix net',
      definition:
        'What a Brix supplier earns after the protocol takes its performance fee and management fee — i.e. the steady-state yield once incentives end. Formula: borrowAPY × targetUtilization × (1 − perfFee) − mgmtFee. This is the number that has to compete on its own merits long-term.',
    },
    {
      term: 'Brix + incentives',
      definition:
        'Brix net plus the supply-side bonus rate paid out of the monthly incentive budget (supplyIncentiveAPY = budget × 12 / requiredUSDM). This is the headline launch rate suppliers actually see, but it expires when the budget runs out — so a market that only wins on this bar is fragile.',
    },
    {
      term: 'Aave USDC',
      definition:
        "Reference yield for USDC supplied to Aave's base markets — roughly 5.5% in this build (hard-coded benchmark, not live). Represents the safest, deepest, most-liquid alternative; if Brix net can't beat it, suppliers parking USDM here are getting paid less for taking more (TRY collateral) risk.",
    },
    {
      term: 'Morpho USDC vaults',
      definition:
        'Yield on curated USDC vaults in the broader Morpho ecosystem — roughly 6.5% in this build (hard-coded benchmark, not live). Closer competitor since suppliers comparing Morpho-on-Morpho assume similar smart-contract risk; if Brix net is below this, the right call is to redeploy into another Morpho vault.',
    },
    {
      term: 'Why competition matters',
      definition:
        'Capital chases yield. If Brix net is below the alternatives, the market either never attracts requiredUSDM, or attracts it temporarily on incentives and then bleeds out when they end. That weakens utilization, borrow APY, and the loop that sustains supplier yield in the first place — a self-reinforcing collapse.',
    },
  ],
  bands: [
    {
      name: 'Brix net ≥ Morpho vaults',
      meaning:
        "Strong position. The market is structurally competitive without subsidies. Incentives just accelerate ramp; they're not load-bearing.",
    },
    {
      name: 'Brix net < Morpho vaults, Brix + incentives ≥ Morpho vaults',
      meaning:
        'Incentive-dependent. Launch works because the bonus carries it, but retention after the budget runs out is a question — see "Retention after incentives end" KPI for the projected drop.',
    },
    {
      name: 'Brix net < Aave USDC',
      meaning:
        "Red flag. Suppliers earn less and take more risk than the safest alternative. Either targetUtilization or the fee schedule needs to change, or the market shouldn't launch.",
    },
  ],
  impact: {
    health:
      'Below-benchmark net APY guarantees TVL outflow once incentives expire. Above-benchmark net APY means the market can run on its own economics.',
    sustainability:
      'The gap between "Brix net" and "Brix + incentives" is the monthly incentive bill in disguise. A small gap = cheap to ramp; a huge gap = expensive subsidy until borrow APY catches up.',
    profitability:
      'Suppliers being underwater vs. alternatives shows up as bad-debt risk too — they leave faster on stress, accelerating cascades.',
  },
};

export const STRATEGY_CHARTS: Partial<Record<string, ChartHelp>> = {
  competitiveBenchmark,
};
