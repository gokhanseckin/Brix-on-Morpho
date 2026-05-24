// lib/help/content/liquidityNeed.ts
// Real content for Section 1 (Liquidity Need). PR #3.
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 1)
// ---------------------------------------------------------------------------

export const LIQUIDITY_NEED_PARAMS: Partial<Record<string, ParamHelp>> = {
  witryTVL_USD: {
    oneLiner:
      'Assumed total wiTRY deposited, valued in USD at today\'s rate. Drives every USDM size in the section: bigger TVL → more required USDM.',
  },
  lltv: {
    oneLiner:
      'Loan-to-Value cap chosen from Morpho governance tiers. Higher LLTV lets borrowers borrow more per unit of collateral, raising required USDM and liquidation risk.',
  },
  targetUtilization: {
    oneLiner:
      'Steady-state borrow utilization the vault is sized for. Higher target → less idle USDM, but less headroom for sudden borrow demand or supplier withdrawals.',
  },
  borrowerLTVAlpha: {
    oneLiner:
      'α — pulls borrowers TOWARD the LLTV cap. Raise to model a more aggressive cohort. Mean borrower LTV = α/(α+β) × LLTV. Default α=2, β=1.2 → mean 62.5% of LLTV.',
  },
  borrowerLTVBeta: {
    oneLiner:
      'β — pulls borrowers AWAY from the LLTV cap. Raise to model a more conservative cohort. Mean borrower LTV = α/(α+β) × LLTV. Default α=2, β=1.2 → mean 62.5% of LLTV.',
  },
};

// ---------------------------------------------------------------------------
// KPI help (section 1)
// ---------------------------------------------------------------------------

const COMMON_PARAMS: Record<string, KpiHelp['params'][number]> = {
  TVL: { name: 'witryTVL_USD', source: 'sidebar', ref: 'witryTVL_USD' },
  LLTV: { name: 'lltv', source: 'sidebar', ref: 'lltv' },
  uTarget: { name: 'targetUtilization', source: 'sidebar', ref: 'targetUtilization' },
  alpha: { name: 'borrowerLTVAlpha', source: 'sidebar', ref: 'borrowerLTVAlpha' },
  beta: { name: 'borrowerLTVBeta', source: 'sidebar', ref: 'borrowerLTVBeta' },
};

const maxBorrowable: KpiHelp = {
  title: 'Max borrowable',
  oneLiner: 'The hard ceiling on USDM borrowable against all deposited wiTRY at the chosen LLTV.',
  formula: {
    plain: 'maxBorrowable = TVL × LLTV',
    latex: 'maxBorrowable = TVL \\times LLTV',
  },
  params: [COMMON_PARAMS.TVL!, COMMON_PARAMS.LLTV!],
  definitions: [
    { term: 'TVL', definition: 'Total wiTRY collateral deposited, valued in USD at the current rate.' },
    { term: 'LLTV', definition: 'Liquidation LTV — the maximum LTV before a position is liquidatable.' },
  ],
  impact: {
    health: 'Defines the upper bound of debt the market can carry. Beyond this, no more borrows can open.',
    sustainability: 'A higher ceiling is only useful if there is real borrow demand and enough USDM supply behind it.',
    profitability: 'Higher ceiling → larger potential interest base, but only realized at the configured utilization.',
  },
};

const expectedBorrow: KpiHelp = {
  title: 'Expected borrow',
  oneLiner: 'The dollar volume of borrows the market would carry in steady state, given the Beta-distributed borrower LTV profile.',
  formula: {
    plain: 'expectedBorrow = TVL × LLTV × E[LTV/LLTV]\n               = TVL × LLTV × α / (α + β)',
    latex: 'expectedBorrow = TVL \\times LLTV \\times \\frac{\\alpha}{\\alpha + \\beta}',
  },
  params: [COMMON_PARAMS.TVL!, COMMON_PARAMS.LLTV!, COMMON_PARAMS.alpha!, COMMON_PARAMS.beta!],
  definitions: [
    { term: 'α (borrowerLTVAlpha)', definition: 'Shape parameter of the Beta distribution. Larger α pulls the average borrower CLOSER to the LLTV cap (more aggressive use of leverage).' },
    { term: 'β (borrowerLTVBeta)', definition: 'Shape parameter of the Beta distribution. Larger β pulls the average borrower AWAY from the LLTV cap (more conservative).' },
    { term: 'Beta(α, β)', definition: 'A probability distribution on the interval [0, 1] controlled by two positive numbers α and β. We use it to model "what fraction of the LLTV cap does a typical borrower actually use?". Its mean is α/(α+β). Examples: Beta(1, 1) is uniform (every fraction equally likely); Beta(2, 1.2) has mean 0.625 → average borrower uses 62.5% of LLTV; Beta(5, 1) puts most mass near the cap → aggressive cohort; Beta(1, 5) puts most mass near 0 → conservative cohort.' },
    { term: 'E[LTV/LLTV]', definition: 'The expected (mean) fraction of LLTV that borrowers use. For Beta(α,β) the mean is α/(α+β). Default Beta(2, 1.2) → 2/3.2 = 0.625, so the average borrower sits at 62.5% of the LLTV cap.' },
  ],
  impact: {
    health: 'Approximates carried debt under typical conditions, used to size required USDM.',
    sustainability: 'If real borrower behavior is more aggressive (higher α/β), expected borrow under-states demand.',
    profitability: 'Drives realized utilization → realized borrow APY → supplier yield.',
  },
  workedExample: {
    description: 'Defaults: $5M TVL, LLTV=77%, borrower LTV distribution Beta(α=2, β=1.2). The "Beta(2, 1.2)" notation just means α=2 and β=1.2.',
    steps: [
      { label: 'mean borrower LTV fraction', expression: 'α / (α + β) = 2 / (2 + 1.2) = 0.625 → 62.5% of LLTV', usesInputs: ['borrowerLTVAlpha', 'borrowerLTVBeta'] },
      { label: 'mean borrower LTV', expression: '0.625 × 77% = 48.1%', usesInputs: ['lltv'] },
      { label: 'expected borrow', expression: '$5,000,000 × 0.77 × 0.625 = $2,406,250', usesInputs: ['witryTVL_USD', 'lltv'] },
    ],
  },
};

const requiredUSDM: KpiHelp = {
  title: 'Required USDM (steady-state)',
  oneLiner: 'How much USDM must sit in the vault so that expectedBorrow exactly produces the configured target utilization.',
  formula: {
    plain: 'requiredUSDM = expectedBorrow / targetUtilization\n             = (TVL × LLTV × α / (α + β)) / targetUtilization',
    latex: 'requiredUSDM = \\frac{TVL \\times LLTV \\times \\frac{\\alpha}{\\alpha+\\beta}}{u_{\\text{target}}}',
  },
  params: [COMMON_PARAMS.TVL!, COMMON_PARAMS.LLTV!, COMMON_PARAMS.alpha!, COMMON_PARAMS.beta!, COMMON_PARAMS.uTarget!],
  definitions: [
    { term: 'α (borrowerLTVAlpha)', definition: 'Shape parameter that pulls the borrower distribution TOWARD the LLTV cap. Raise α to model more aggressive borrowers.' },
    { term: 'β (borrowerLTVBeta)', definition: 'Shape parameter that pulls the borrower distribution AWAY from the LLTV cap. Raise β to model more conservative borrowers.' },
    { term: 'Beta(α, β)', definition: 'A probability distribution on [0, 1] controlled by two positive shape parameters. Mean = α/(α+β); spread shrinks as α+β grows. Useful presets — Beta(1,1): uniform; Beta(2, 1.2): mean 62.5% (default, mildly aggressive); Beta(5, 1): mean 83% (aggressive, most near cap); Beta(1, 5): mean 17% (conservative); Beta(10, 10): mean 50% with a tight cluster.' },
    { term: 'u_target', definition: 'Target borrow utilization (e.g. 70%). The IRM curve is anchored so that u_target produces the target borrow APY (r_target = 4% APR).' },
  ],
  impact: {
    health: 'Headline sizing number. Falls if borrow demand or LLTV falls; rises if target utilization is set lower.',
    sustainability: 'If suppliers cannot be attracted to this level, the market underperforms (excess utilization → rates spike → borrower exodus).',
    profitability: 'Drives the denominator of incentiveAPY in Section 3, so directly affects supplier yield economics.',
  },
  workedExample: {
    description: 'Defaults: $5M TVL, LLTV=77%, borrowers ~ Beta(α=2, β=1.2) (average uses 62.5% of LLTV), target utilization 70%.',
    steps: [
      { label: 'mean borrower LTV fraction', expression: 'α / (α + β) = 2 / 3.2 = 0.625', usesInputs: ['borrowerLTVAlpha', 'borrowerLTVBeta'] },
      { label: 'expected borrow', expression: '$5,000,000 × 0.77 × 0.625 = $2,406,250', usesInputs: ['witryTVL_USD', 'lltv'] },
      { label: 'required USDM', expression: '$2,406,250 / 0.70 ≈ $3,437,500', usesInputs: ['targetUtilization'] },
    ],
  },
};

const withdrawalBuffer: KpiHelp = {
  title: 'Withdrawal buffer',
  oneLiner: 'Extra USDM beyond requiredUSDM to absorb supplier exits without forcing borrow rates to spike. Sized as a percentage of required, scaled by how aggressive incentives are.',
  formula: {
    plain: 'withdrawalBuffer = requiredUSDM × bufferPct\n  bufferPct = BUFFER_PCT_BASE + BUFFER_PCT_INCENTIVE_SLOPE × (incentiveAPY / baseSupplyAPY)\n            = 0.15 + 0.10 × (incentiveAPY / baseSupplyAPY)',
    latex: 'withdrawalBuffer = requiredUSDM \\times \\left(0.15 + 0.10 \\cdot \\frac{incentiveAPY}{baseSupplyAPY}\\right)',
  },
  params: [
    { name: 'requiredUSDM', source: 'derived', note: 'Section 1 output above.' },
    { name: 'incentiveAPY', source: 'derived', note: 'From Section 3 (Strategy).' },
    { name: 'baseSupplyAPY', source: 'derived', note: 'From Section 3 (Strategy) — netSupplyAPY.' },
    { name: 'BUFFER_PCT_BASE', source: 'constant', value: '0.15', note: 'Baseline buffer with no incentives.' },
    { name: 'BUFFER_PCT_INCENTIVE_SLOPE', source: 'constant', value: '0.10', note: 'Mercenary-capital sensitivity.' },
  ],
  definitions: [
    { term: 'Mercenary capital', definition: 'Supplier capital chasing the highest yield. Higher incentive APY attracts more of it, which is also more likely to exit quickly when incentives end or a better opportunity appears — hence a larger buffer is required.' },
  ],
  impact: {
    health: 'A bigger buffer means lower realized utilization under normal load, dampening rate spikes from cascading withdrawals.',
    sustainability: 'Buffer is a governance dial — too small risks sudden rate spikes; too large wastes supplier capital.',
    profitability: 'Reduces supplier APY proportionally (idle USDM earns nothing). Trade-off: stability vs yield.',
  },
};

const requiredPlusBuffer: KpiHelp = {
  title: 'Required + buffer',
  oneLiner: 'The total USDM the vault should target for healthy operation: enough to satisfy expected demand AND absorb supplier churn.',
  formula: {
    plain: 'requiredPlusBuffer = requiredUSDM × (1 + bufferPct)',
    latex: 'requiredPlusBuffer = requiredUSDM \\times (1 + bufferPct)',
  },
  params: [
    { name: 'requiredUSDM', source: 'derived' },
    { name: 'bufferPct', source: 'derived', note: '0.15–0.35 depending on incentive level.' },
  ],
  definitions: [
    { term: 'Vault cap', definition: 'This value is also used as the Morpho Vault `absoluteCap` recommendation in Section 5 — deposits above this level are unproductive at the configured target utilization.' },
  ],
  impact: {
    health: 'This is what suppliers need to fund. Used as the absolute deposit cap in the vault config.',
    sustainability: 'If incentive budget cannot attract this much within Section 3\'s `daysToTarget`, the launch ramp is too slow.',
    profitability: 'Sets the effective incentive-APY denominator (Section 3): bigger buffer → lower incentive APY per dollar of budget.',
  },
};

const liquidityFloor: KpiHelp = {
  title: 'Liquidity floor',
  oneLiner: 'Minimum USDM the vault should always keep parked. Protects against the bootstrap edge case where requiredUSDM is itself tiny (small TVL or low LLTV).',
  formula: {
    plain: 'liquidityFloor = max(\n  deadDepositCost × DEAD_DEPOSIT_MULTIPLIER,\n  requiredUSDM × LIQUIDITY_FLOOR_FRACTION\n)\n             = max(1 × 100, requiredUSDM × 0.20)',
    latex: 'liquidityFloor = \\max(100 \\cdot \\text{deadDepositCost},\\; 0.20 \\cdot requiredUSDM)',
  },
  params: [
    { name: 'requiredUSDM', source: 'derived' },
    { name: 'deadDepositCost', source: 'constant', value: '$1', note: 'Gas/operational cost of one Morpho dead-deposit.' },
    { name: 'LIQUIDITY_FLOOR_FRACTION', source: 'constant', value: '0.20', note: 'P95 cascading-withdrawal coverage.' },
    { name: 'DEAD_DEPOSIT_MULTIPLIER', source: 'constant', value: '100', note: 'Hard-floor multiplier for very small markets.' },
  ],
  definitions: [
    { term: 'Dead deposit', definition: 'Per Morpho docs, a small permanent deposit (`1e9` shares burnt to `0xdead`) seeded at market creation to prevent share-price manipulation.' },
    { term: 'P95 cascading withdrawal', definition: '20% is sized to absorb the 95th-percentile supplier-exit event without dropping below productive utilization.' },
  ],
  impact: {
    health: 'Prevents the vault from being drained to zero during stress; provides the cushion liquidators need to repay debt.',
    sustainability: 'Both constants are governance-tunable policy dials, not derived. Surface as assumptions in vault docs.',
    profitability: 'Constrains how lean the vault can run — floor capital earns nothing.',
  },
};

export const LIQUIDITY_NEED_KPIS = {
  maxBorrowable,
  expectedBorrow,
  requiredUSDM,
  withdrawalBuffer,
  requiredPlusBuffer,
  liquidityFloor,
};

// ---------------------------------------------------------------------------
// Chart help (section 1)
// ---------------------------------------------------------------------------

const irmCurve: ChartHelp = {
  title: 'Borrow APY curve (AdaptiveCurveIRM)',
  oneLiner: 'The static interest-rate curve the vault uses. Anchored at three points: r/4 at u=0, r at u=90% (target), 4r at u=100%. Two exponential segments interpolate between.',
  axes: { x: 'Borrow utilization (0–100%)', y: 'Borrow APY' },
  definitions: [
    { term: 'Rate at Target', definition: 'Morpho\'s official name (code: rateAtTarget; written as r_target in formulas) for the target borrow APY at u = 90%. Currently fixed at 4% APR (Morpho IRM governance default).' },
    { term: 'AdaptiveCurveIRM', definition: 'Morpho\'s only governance-approved IRM. The "adaptive" part — slow drift of Rate at Target — is ignored here because it converges much slower than the parameters we are tuning.' },
    { term: 'Target utilization marker', definition: 'The vertical red line shows where the configured `targetUtilization` lands on the curve, and therefore the borrow APY the strategy section assumes.' },
  ],
  bands: [
    { name: 'u ∈ [0, 90%]', meaning: 'Gentle exponential: rate climbs from r/4 = 1% to r = 4%. Borrowers see stable rates here.' },
    { name: 'u ∈ [90%, 100%]', meaning: 'Steep exponential: rate climbs from r = 4% to 4r = 16%. Designed to push utilization back to target.' },
  ],
  impact: {
    health: 'Steep tail above target utilization is what protects suppliers from being trapped — high rates incentivize repayment, freeing USDM.',
    sustainability: 'Borrowers see r ≈ r_target only at the configured target. Misaligned utilization → either too-cheap (under) or too-expensive (over) credit.',
    profitability: 'grossSupplyAPY = borrowAPY × utilization. The shape of this curve directly drives the realized supplier yield.',
  },
};

const betaDistribution: ChartHelp = {
  title: 'Borrower LTV distribution — Beta(α, β)',
  oneLiner:
    'Probability density of the LTV-fraction-of-cap across the borrower population. Re-renders live as α and β change in the sidebar. The red dashed line marks the mean = α / (α + β).',
  axes: { x: 'LTV fraction of cap (0 = no borrow, 1 = at LLTV)', y: 'Probability density' },
  definitions: [
    { term: 'LTV fraction of cap', definition: 'A borrower\'s actual LTV divided by the LLTV. A value of 0.625 with LLTV = 77% means the borrower sits at 0.625 × 77% ≈ 48% LTV.' },
    { term: 'Why Beta?', definition: 'Beta is the simplest continuous distribution supported on [0, 1]. Two shape parameters give every realistic borrower mix — uniform, skewed-aggressive, skewed-cautious, or bell-shaped — by varying just α and β.' },
    { term: 'α (alpha)', definition: 'Pulls mass TOWARD the cap. Bigger α = more aggressive cohort. Defaults to 2.' },
    { term: 'β (beta)', definition: 'Pulls mass AWAY from the cap. Bigger β = more conservative cohort. Defaults to 1.2.' },
    { term: 'Mean vs spread', definition: 'α / (α + β) sets the mean (where the cluster sits). α + β sets the tightness (how clustered around the mean). Same mean with bigger α + β = tighter bell, less tail risk.' },
    { term: 'Useful presets', definition: 'Beta(1, 1) = uniform; Beta(2, 1.2) = default, mildly aggressive (mean 62.5%); Beta(5, 1) = aggressive (mean 83%, most near cap); Beta(1, 5) = conservative (mean 17%); Beta(10, 10) = tight bell at 50%.' },
  ],
  bands: [
    { name: 'Near x = 0', meaning: 'Borrowers barely using their position. Low default risk, low utilization, low supplier yield contribution.' },
    { name: 'Near the mean (red line)', meaning: 'The typical borrower. Drives the headline "expected borrow" and required USDM.' },
    { name: 'Near x = 1', meaning: 'Borrowers maxing out the cap. First to be liquidated when FX moves against the collateral; the right tail is where bad-debt risk concentrates.' },
  ],
  impact: {
    health: 'A heavy right tail means many borrowers liquidate together in a crash. A tight bell at the mean means liquidations are spread out and orderly.',
    sustainability: 'If your real borrower base is more aggressive than the chosen Beta, you under-size USDM and over-estimate retention. Re-fit when you have real data.',
    profitability: 'Mean position drives utilization, which drives borrow APY, which drives supplier yield. Doubling the mean fraction roughly doubles the carried debt.',
  },
};

export const LIQUIDITY_NEED_CHARTS = { irmCurve, betaDistribution };
