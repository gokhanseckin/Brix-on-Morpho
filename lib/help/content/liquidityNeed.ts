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
      'Beta(α,β) shape parameter for the fraction of LLTV a borrower uses. Larger α pushes the mean borrower toward the LLTV cap (more aggressive).',
  },
  borrowerLTVBeta: {
    oneLiner:
      'Beta(α,β) shape parameter for the fraction of LLTV a borrower uses. Larger β pushes the mean borrower away from the LLTV cap (more conservative).',
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
    { term: 'E[LTV/LLTV]', definition: 'Mean fraction of LLTV used across borrowers. For Beta(α,β) this is α/(α+β). Default Beta(2, 1.2) → 0.625, i.e. average borrower at 62.5% of LLTV.' },
  ],
  impact: {
    health: 'Approximates carried debt under typical conditions, used to size required USDM.',
    sustainability: 'If real borrower behavior is more aggressive (higher α/β), expected borrow under-states demand.',
    profitability: 'Drives realized utilization → realized borrow APY → supplier yield.',
  },
  workedExample: {
    description: '$5M TVL, LLTV=77%, Beta(2, 1.2) ⇒ mean LTV fraction 0.625.',
    steps: [
      { label: 'mean LTV fraction', expression: '2 / (2 + 1.2) = 0.625', usesInputs: ['borrowerLTVAlpha', 'borrowerLTVBeta'] },
      { label: 'expected borrow', expression: '5,000,000 × 0.77 × 0.625 = $2,406,250', usesInputs: ['witryTVL_USD', 'lltv'] },
    ],
  },
};

const requiredUSDM: KpiHelp = {
  title: 'Required USDM (steady-state)',
  oneLiner: 'How much USDM must sit in the vault so that expectedBorrow exactly produces the configured target utilization.',
  formula: {
    plain: 'requiredUSDM = expectedBorrow / targetUtilization\n             = (TVL × LLTV × E[LTV/LLTV]) / targetUtilization',
    latex: 'requiredUSDM = \\frac{TVL \\times LLTV \\times \\frac{\\alpha}{\\alpha+\\beta}}{u_{\\text{target}}}',
  },
  params: [COMMON_PARAMS.TVL!, COMMON_PARAMS.LLTV!, COMMON_PARAMS.alpha!, COMMON_PARAMS.beta!, COMMON_PARAMS.uTarget!],
  definitions: [
    { term: 'u_target', definition: 'Target borrow utilization (e.g. 70%). The IRM curve is anchored so that u_target produces the target borrow APY (r_target = 4% APR).' },
  ],
  impact: {
    health: 'Headline sizing number. Falls if borrow demand or LLTV falls; rises if target utilization is set lower.',
    sustainability: 'If suppliers cannot be attracted to this level, the market underperforms (excess utilization → rates spike → borrower exodus).',
    profitability: 'Drives the denominator of incentiveAPY in Section 3, so directly affects supplier yield economics.',
  },
  workedExample: {
    description: '$5M TVL, LLTV=77%, Beta(2, 1.2) borrowers, target utilization 70%.',
    steps: [
      { label: 'expected borrow', expression: '5,000,000 × 0.77 × 0.625 = $2,406,250', usesInputs: ['witryTVL_USD', 'lltv', 'borrowerLTVAlpha', 'borrowerLTVBeta'] },
      { label: 'required USDM', expression: '2,406,250 / 0.70 ≈ $3,437,500', usesInputs: ['targetUtilization'] },
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

const lltvSensitivity: KpiHelp = {
  title: 'LLTV sensitivity',
  oneLiner: 'How requiredUSDM scales as the LLTV tier is changed. Linear in LLTV with all else held equal: doubling LLTV doubles required USDM.',
  formula: {
    plain: 'requiredUSDM(LLTV) = TVL × LLTV × E[LTV/LLTV] / targetUtilization',
    latex: 'requiredUSDM(LLTV) = \\frac{TVL \\times LLTV \\times \\frac{\\alpha}{\\alpha+\\beta}}{u_{\\text{target}}}',
  },
  params: [COMMON_PARAMS.TVL!, COMMON_PARAMS.alpha!, COMMON_PARAMS.beta!, COMMON_PARAMS.uTarget!],
  definitions: [
    { term: 'Governance LLTV tiers', definition: 'Morpho governance ratifies a fixed set of LLTV values: 38.5%, 62.5%, 77%, 86%, 91.5%, 94.5%, 96.5%, 98%. The recommended LLTV (Section 5) is always snapped down to one of these.' },
  ],
  impact: {
    health: 'Quickly sanity-checks how a governance vote on LLTV would shift sizing without re-running the full simulator.',
    sustainability: 'A higher LLTV requires more USDM AND tolerates less drawdown before liquidations fire. Trade-off is non-trivial — Section 5 derives the optimal LLTV.',
    profitability: 'Higher LLTV → larger borrow base → more interest, but liquidators face higher bad-debt risk (Section 4).',
  },
};

export const LIQUIDITY_NEED_KPIS = {
  maxBorrowable,
  expectedBorrow,
  requiredUSDM,
  withdrawalBuffer,
  requiredPlusBuffer,
  liquidityFloor,
  lltvSensitivity,
};

// ---------------------------------------------------------------------------
// Chart help (section 1)
// ---------------------------------------------------------------------------

const irmCurve: ChartHelp = {
  title: 'Borrow APY curve (AdaptiveCurveIRM)',
  oneLiner: 'The static interest-rate curve the vault uses. Anchored at three points: r/4 at u=0, r at u=90% (target), 4r at u=100%. Two exponential segments interpolate between.',
  axes: { x: 'Borrow utilization (0–100%)', y: 'Borrow APY' },
  definitions: [
    { term: 'r_target', definition: 'Target borrow APY at u = 90%. Currently fixed at 4% APR (Morpho IRM governance default).' },
    { term: 'AdaptiveCurveIRM', definition: 'Morpho\'s only governance-approved IRM. The "adaptive" part — slow drift of r_target — is ignored here because it converges much slower than the parameters we are tuning.' },
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

export const LIQUIDITY_NEED_CHARTS = { irmCurve };
