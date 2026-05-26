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
      'Vault management fee, as a decimal annual APR. Subtracted additively from netSupplyAPY, not multiplied. The current default is 0%.',
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
    plain: 'borrowAPY = adaptiveCurveIRM(targetUtilization, rTargetIRM)\n(default rTargetIRM = 4%; editable on /utilization)',
    latex: 'borrowAPY = \\text{adaptiveCurveIRM}(u_{\\text{target}},\\; r_{\\text{TargetIRM}})',
  },
  params: [
    COMMON_PARAMS.uTarget!,
    { name: 'rTargetIRM', source: 'derived', note: 'Shared setting edited on /utilization; default 4% APR at the fixed 90% kink.' },
  ],
  definitions: [
    { term: 'AdaptiveCurveIRM', definition: 'The interest-rate curve evaluated here: r/4 at u=0, r at the fixed 90% kink, and 4r at u=100%, with exponential interpolation between.' },
    { term: 'Rate at Target', definition: 'The borrow-rate anchor at the fixed 90% IRM kink. The simulator keeps it static during one run, but the shared rTargetIRM setting is editable on /utilization and defaults to 4% APR.' },
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
    { term: 'Pre-incentive', definition: 'This is the sustainable yield once Merkl rewards end. Compare it directly with the benchmark bars on the page.' },
  ],
  impact: {
    health: 'The yield suppliers can rely on once the campaign ends. If this is below competing stablecoin rates, capital leaves.',
    sustainability: 'The only yield that is self-funding from real borrow demand. Incentives must bridge until netSupplyAPY alone is competitive.',
    profitability: 'Direct lever on supplier economics. Lower fees = stickier capital but lower vault take.',
  },
  workedExample: {
    description: 'Current defaults: targetUtilization 80%, rTargetIRM 4%, borrowAPY about 3.43%, performanceFee 10%, managementFee 0%.',
    steps: [
      { label: 'gross supply APY', expression: '3.43% x 0.80 = 2.74%', usesInputs: ['targetUtilization'] },
      { label: 'after performance fee', expression: '2.74% x (1 - 0.10) = 2.47%', usesInputs: ['performanceFee'] },
      { label: 'after management fee', expression: '2.47% - 0.00% = 2.47%', usesInputs: ['managementFee'] },
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
    { term: 'Negative net rate', definition: 'If borrower rewards exceed borrow interest, the computed net rate is negative: the incentive more than reimburses the interest paid.' },
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
    { term: 'Campaign-window only', definition: 'Drops to netSupplyAPY when the Merkl campaign ends. The gap between the two supplier bars shows dependence on rewards.' },
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
    'Annualized return for a wiTRY -> USDM -> wiTRY loop, using yield, borrow cost, slippage and health-factor idle cost. FX is not charged as an extra expected cost here; FX outcomes are analyzed in the FX and liquidation sections.',
  formula: {
    plain:
      'b = LLTV / hfBuffer\neffectiveLeverage = 1 + b + ... + b^loopCount\nborrowedShare = effectiveLeverage - 1\nnetLoopAPY = effectiveLeverage x witryYieldAnnual\n  - borrowedShare x (borrowAPY + 0.003)\n  - witryYieldAnnual x (1 - 1/hfBuffer) x borrowedShare',
    latex:
      'netLoopAPY = \\ell \\cdot y_{\\text{iTRY}} - (\\ell - 1)(r + s) - y_{\\text{iTRY}}(1 - 1/H)(\\ell - 1)',
  },
  params: [
    COMMON_PARAMS.iTRY!,
    { name: 'effectiveLeverage', source: 'derived', note: 'Finite geometric sum controlled by the Number of loops sidebar input.' },
    { name: 'borrowAPY', source: 'derived', note: 'IRM at target utilization; the carry borrow cost.' },
    { name: 'perLoopSlippageBps', source: 'constant', value: '30 bps', note: 'Per-loop round-trip swap cost; matches /utilization.' },
    { name: 'hfBuffer', source: 'derived', note: 'Sidebar slider; ≥ 1.0.' },
    { name: 'loopCount', source: 'derived', note: 'Sidebar slider; explicit iterations from 1 to 10.' },
  ],
  definitions: [
    { term: 'Why no TRY-depreciation surcharge', definition: 'This card is a carry calculation. Adding an assumed TRY depreciation multiplier to the USD borrowing cost would mix expected carry with FX stress. FX loss risk is examined in Sections 2 and 4.' },
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
    { term: 'Why multiply by (effectiveLeverage - 1)', definition: 'Borrower incentives are paid on debt notional. Under the selected finite-loop model, debt per unit of starting equity is effectiveLeverage - 1.' },
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
    'How much wiTRY exposure is built from 1 unit of equity after the selected finite number of borrow-and-redeposit loops.',
  formula: {
    plain: 'b = LLTV / hfBuffer\neffectiveLeverage = 1 + b + b^2 + ... + b^loopCount\n                  = (1 - b^(loopCount + 1)) / (1 - b), when b != 1',
    latex: '\\ell_n = \\sum_{k=0}^{n} b^k,\\quad b = LLTV/H',
  },
  params: [
    { name: 'LLTV', source: 'derived', note: 'Sidebar slider; governance-snapped tier.' },
    { name: 'hfBuffer', source: 'derived', note: 'Sidebar slider; ≥ 1.0.' },
    { name: 'loopCount', source: 'derived', note: 'Explicit number of loop iterations selected in the sidebar.' },
  ],
  definitions: [
    { term: 'Why a buffer', definition: 'Looping to the bare LLTV maximizes leverage but liquidates on the first adverse FX tick. hfBuffer ≥ 1.1 leaves headroom; typical defaults are 1.3–1.7.' },
    { term: 'Finite versus converged', definition: 'The homepage uses the selected finite loop count. With enough loops the series approaches 1 / (1 - b), but it does not assume infinite looping.' },
    { term: 'Numerical cap', definition: 'The implementation caps leverage at 50x for numerical safety. Normal inputs remain far below that limit.' },
  ],
  impact: {
    health: 'Drives both grossLoopAPY (positive) and FX-risk amplification (negative).',
    sustainability: 'Higher leverage increases sensitivity to the FX stress outcomes described in the liquidation section.',
    profitability: 'Direct multiplier on yield in the carry term, while also multiplying borrow and idle-capital costs.',
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
        'Incentive-dependent. Launch works because the bonus carries it, but the drop from the incentive bar to the net bar shows the post-campaign retention risk.',
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
