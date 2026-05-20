// lib/help/registry.ts
// Stub entries for PR #1. Real copy lands in PRs #2-#6.
import type { SidebarInputs } from '@/types/simulator';
import { KPI_KEYS, type KpiKey } from './kpiKeys';
import { CHART_KEYS, type ChartKey } from './chartKeys';
import type { ChartHelp, KpiHelp, ParamHelp } from './types';

const STUB_ONE_LINER = 'Coming soon. See /help for details.';

const STUB_KPI: KpiHelp = {
  title: 'Coming soon',
  oneLiner: STUB_ONE_LINER,
  formula: { plain: '(documentation pending)' },
  params: [],
  definitions: [],
  impact: {
    health: 'Pending.',
    sustainability: 'Pending.',
    profitability: 'Pending.',
  },
};

const STUB_CHART: ChartHelp = {
  title: 'Coming soon',
  oneLiner: STUB_ONE_LINER,
  axes: { x: 'pending', y: 'pending' },
  definitions: [],
  impact: {
    health: 'Pending.',
    sustainability: 'Pending.',
    profitability: 'Pending.',
  },
};

// PARAM_HELP must have an entry for every key of SidebarInputs.
// The registry test asserts this — adding a sidebar input without help breaks CI.
export const PARAM_HELP: Record<keyof SidebarInputs, ParamHelp> = {
  witryTVL_USD: { oneLiner: STUB_ONE_LINER },
  lltv: { oneLiner: STUB_ONE_LINER },
  targetUtilization: { oneLiner: STUB_ONE_LINER },
  borrowerLTVAlpha: { oneLiner: STUB_ONE_LINER },
  borrowerLTVBeta: { oneLiner: STUB_ONE_LINER },
  iTRYYieldAnnual: { oneLiner: STUB_ONE_LINER },
  witryYieldUSD_7d:  { oneLiner: 'Trailing-7-day USD APY of holding wiTRY. Used by /utilization as the conservative loop-viability threshold.' },
  witryYieldUSD_30d: { oneLiner: 'Trailing-30-day USD APY of holding wiTRY. Shown as the optimistic reference on /utilization.' },
  usdtryBaseline: { oneLiner: STUB_ONE_LINER },
  historicalPeriod: { oneLiner: STUB_ONE_LINER },
  simulationMode: { oneLiner: STUB_ONE_LINER },
  simulationHorizonDays: { oneLiner: STUB_ONE_LINER },
  pathCount: { oneLiner: STUB_ONE_LINER },
  tryShockPct: { oneLiner: STUB_ONE_LINER },
  incentiveBudgetMonthly_USD: { oneLiner: STUB_ONE_LINER },
  attractionRate: { oneLiner: STUB_ONE_LINER },
  lockPeriodDays: { oneLiner: STUB_ONE_LINER },
  poolDepth_USD: { oneLiner: STUB_ONE_LINER },
  performanceFee: { oneLiner: STUB_ONE_LINER },
  managementFee: { oneLiner: STUB_ONE_LINER },
  safetyMargin: { oneLiner: STUB_ONE_LINER },
  preLiquidationEnabled: { oneLiner: STUB_ONE_LINER },
  blockBootstrap: { oneLiner: STUB_ONE_LINER },
  seed: { oneLiner: STUB_ONE_LINER },
};

export const KPI_HELP: Record<KpiKey, KpiHelp> = {
  ...(Object.fromEntries(KPI_KEYS.map((k) => [k, STUB_KPI])) as Record<KpiKey, KpiHelp>),

  // ── Utilization section (6) ────────────────────────────────────────────────

  recommendedUTarget: {
    title: 'Recommended target utilization',
    oneLiner: 'The largest u_target that simultaneously keeps loop margin positive, survives the stress withdrawal, and stays at least 0.07 below the IRM kink.',
    formula: {
      plain: [
        'recommended = max u ∈ [0.50, 0.90] such that:',
        '  1. loopMargin7d > 0',
        '  2. bufferUSD ≥ stressWithdrawalUSD',
        '  3. (0.9 − u) ≥ 0.07',
      ].join('\n'),
    },
    params: [
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'witryYieldUSD_7d', source: 'sidebar', ref: 'witryYieldUSD_7d' },
      { name: 'witryTVL_USD × targetUtilization (vault size)', source: 'sidebar', ref: 'witryTVL_USD' },
      { name: 'stressPctOfSupply', source: 'derived', note: 'page slider on /utilization' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
      { name: 'rTargetOverride', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'IRM kink', definition: 'The utilization level (0.9) where the AdaptiveCurveIRM switches to the steep high-utilization rate curve, causing borrow costs to jump sharply.' },
      { term: 'loop margin', definition: 'Net looper APY minus the wiTRY USD yield. Positive means looping beats simply holding wiTRY.' },
      { term: 'stress survival', definition: 'The free liquidity buffer (1 − u) × TVL covers the simulated withdrawal event without pausing redemptions.' },
      { term: 'kink clearance', definition: 'Minimum gap of 0.07 between u_target and the IRM kink, preventing accidental rate spikes under mild demand shocks.' },
    ],
    impact: {
      health: 'A lower recommended u_target increases free liquidity, reducing the probability that a TRY shock forces borrowers into undercollateralised positions before liquidators can act.',
      sustainability: 'Sets the baseline buffer ratio that determines whether the vault survives the configured stress withdrawal without pausing redemptions.',
      profitability: 'Higher u_target raises supplier APY and loop margin, directly driving the incentive for loopers to fill capacity and for suppliers to deploy USDM.',
    },
  },

  borrowAPYAtTarget: {
    title: 'Borrow APY at target utilization',
    oneLiner: 'The annualised interest rate borrowers pay when utilization equals the recommended target, derived from the AdaptiveCurveIRM.',
    formula: {
      plain: [
        'For u ≤ 0.9 (below kink):',
        '  borrowAPY = (r_target / 4) × exp(K1 × u)',
        'For u > 0.9 (above kink):',
        '  borrowAPY = r_target × exp(K2 × (u − 0.9))',
        'where K1 and K2 are IRM curve-shape constants.',
      ].join('\n'),
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
      { name: 'rTargetOverride', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'IRM', definition: 'Interest Rate Model — a continuous function mapping utilization to a borrow APY, calibrated so rates hit r_target exactly at the kink (u=0.9).' },
      { term: 'kink', definition: 'The utilization threshold (0.9) at which the IRM switches from a gentle curve to an exponential rate escalation designed to restore liquidity.' },
    ],
    impact: {
      health: 'A borrow APY that is too low relative to collateral yield leaves little incentive for early repayment, increasing positions-at-risk duration during FX drawdowns.',
      sustainability: 'If borrow APY exceeds wiTRY yield, loopers exit, utilization drops, supplier APY falls, and new deposits stall — the virtuous cycle reverses.',
      profitability: 'Directly sets the denominator of loop economics: lower borrowAPY → wider loop margin → more looper demand → higher realized utilization and supplier yield.',
    },
  },

  supplierAPYAtTarget: {
    title: 'Supplier APY at target utilization',
    oneLiner: 'The annualised yield earned by USDM depositors when the vault runs at the recommended target utilization.',
    formula: {
      plain: 'supplierAPY ≈ borrowAPY × u_target',
    },
    params: [
      { name: 'borrowAPYAtTarget', source: 'derived' },
      { name: 'recommendedUTarget', source: 'derived' },
    ],
    definitions: [
      { term: 'utilization', definition: 'Fraction of total USDM supply currently borrowed. Supplier yield scales linearly with utilization because idle capital earns nothing.' },
    ],
    impact: {
      health: 'Higher supplier APY attracts more USDM deposits, which deepens the liquidity buffer and makes the vault more resilient to large-scale redemptions.',
      sustainability: 'Supplier APY must exceed the risk-free USD rate to sustain organic supply growth; falling below it triggers outflows and liquidity stress.',
      profitability: 'The primary return metric for USDM depositors; directly competes against alternative USD yield sources and determines vault TVL growth trajectory.',
    },
  },

  loopMargin7d: {
    title: 'Loop margin (7-day)',
    oneLiner: 'Net looper APY minus the 7-day wiTRY USD yield — the excess return from leveraged looping versus simply holding wiTRY.',
    formula: {
      plain: 'loopMargin7d = looperNetAPY − witryYieldUSD_7d',
    },
    params: [
      { name: 'looperNetAPY', source: 'derived' },
      { name: 'witryYieldUSD_7d', source: 'sidebar', ref: 'witryYieldUSD_7d' },
    ],
    definitions: [
      { term: 'loop margin', definition: 'The alpha a leveraged looper earns above the unlevered wiTRY hold return. When ≤ 0, rational actors prefer holding and stop borrowing.' },
    ],
    impact: {
      health: 'When loop margin falls to zero or below, loopers close positions, utilization drops, and the vault may miss its target — leaving suppliers undercompensated and increasing the probability of underutilization spirals.',
      sustainability: 'Positive loop margin is the primary pull factor that drives organic borrowing demand; without it, the vault cannot sustain its target utilization without incentive subsidies.',
      profitability: 'If margin ≤ 0, no looper will borrow, realized utilization stays below target, and supplier APY collapses — the recommended u_target is invalid and must be lowered.',
    },
  },

  distanceToKink: {
    title: 'Distance to IRM kink',
    oneLiner: 'How far the recommended target utilization sits below the IRM kink at 0.9, expressed as a decimal gap.',
    formula: {
      plain: 'distanceToKink = 0.9 − u_target',
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
    ],
    definitions: [
      { term: 'IRM kink', definition: 'At u=0.9 the AdaptiveCurveIRM transitions to a steep exponential, roughly quadrupling borrow rates within 10 percentage points — a built-in circuit breaker.' },
      { term: 'kink clearance', definition: 'A minimum gap of 0.07 (7pp) is required to prevent normal demand variance from accidentally triggering super-linear rate escalation.' },
    ],
    impact: {
      health: 'A narrow kink gap means small borrower surges push rates into punishing territory, increasing default pressure on marginal positions and forcing liquidations.',
      sustainability: 'Insufficient clearance increases the risk that a liquidity crunch (withdrawal spike) creates a rate shock that accelerates rather than dampens borrowing demand.',
      profitability: 'Operating closer to the kink yields higher supplier APY in calm markets but creates tail risk of abrupt looper exits when rates spike, causing utilization crashes.',
    },
  },

  liquidityBufferUSD: {
    title: 'Liquidity buffer (USD)',
    oneLiner: 'The dollar value of unborrowed USDM available for immediate redemption at the recommended target utilization.',
    formula: {
      plain: 'bufferUSD = (1 − u_target) × TVL_USDM',
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
      { name: 'witryTVL_USD × targetUtilization (vault size)', source: 'sidebar', ref: 'witryTVL_USD' },
    ],
    definitions: [
      { term: 'TVL_USDM', definition: 'Total value locked as USDM supply in the vault, derived from the wiTRY TVL and targetUtilization sidebar inputs.' },
    ],
    impact: {
      health: 'Larger buffer gives liquidators more runway to act before a redemption wave exhausts available liquidity and forces protocol-level interventions.',
      sustainability: 'The buffer is the primary metric determining whether the vault survives the stress test; insufficient buffer fails the survivesStress gate and lowers recommendedUTarget.',
      profitability: 'Buffer increases as u_target decreases, but this comes at the direct cost of supplier yield — the tension between safety and return.',
    },
  },

  stressWithdrawalUSD: {
    title: 'Stress withdrawal (USD)',
    oneLiner: 'The simulated worst-case redemption in one day, equal to the stress percentage of total USDM supply.',
    formula: {
      plain: 'stressWithdrawalUSD = stressPctOfSupply × TVL_USDM',
    },
    params: [
      { name: 'stressPctOfSupply', source: 'derived', note: 'page slider on /utilization' },
      { name: 'witryTVL_USD × targetUtilization (vault size)', source: 'sidebar', ref: 'witryTVL_USD' },
    ],
    definitions: [
      { term: 'stress scenario', definition: 'A single-day withdrawal representing a coordinated redemption event, modelled as a fixed percentage of total supply.' },
    ],
    impact: {
      health: 'Larger stress withdrawal reduces the set of u_targets that pass the survivesStress gate, directly constraining the upper bound of recommendedUTarget.',
      sustainability: 'Setting this too low (< 10%) may underestimate real withdrawal risk during TRY crises; setting it too high (> 40%) unnecessarily compresses supplier yield.',
      profitability: 'Higher stress withdrawal requirements force a lower u_target, reducing supplier APY and loop margin — a direct trade-off between safety and yield.',
    },
  },

  survivesStress: {
    title: 'Survives stress?',
    oneLiner: 'Binary flag: true if the liquidity buffer equals or exceeds the stress withdrawal at the recommended utilization.',
    formula: {
      plain: 'survives = bufferUSD ≥ stressWithdrawalUSD\n  i.e., (1 − u_target) × TVL ≥ stressPctOfSupply × TVL',
    },
    params: [
      { name: 'liquidityBufferUSD', source: 'derived' },
      { name: 'stressWithdrawalUSD', source: 'derived' },
    ],
    definitions: [
      { term: 'stress survival gate', definition: 'One of three hard constraints the solver must satisfy to qualify a u_target as "recommended" rather than "best effort".' },
    ],
    impact: {
      health: 'Failing this gate at a given u_target means that utilization level cannot be safely recommended; the solver steps down to a lower u_target where the condition holds.',
      sustainability: 'A vault that fails stress survival at its target utilization faces potential redemption pauses during market stress — a critical operational risk for lender confidence.',
      profitability: 'Passing stress survival enables higher u_targets to be recommended, directly increasing supplier APY and loop margin.',
    },
  },

  looperNetAPY: {
    title: 'Looper net APY',
    oneLiner: 'The leveraged annual return a looper earns after borrow costs, slippage, and the capital idled for health-factor headroom.',
    formula: {
      plain: [
        'effectiveLeverage  = 1 / (1 − LLTV / hfBuffer)',
        'borrowedShare      = effectiveLeverage − 1',
        'grossLoopAPY       = effectiveLeverage × witryYieldUSD_7d',
        'borrowCost         = borrowedShare × borrowAPY',
        'slippageCost       = borrowedShare × (30 / 10000)',
        'hfIdleCost         = witryYieldUSD_7d × (1 − 1/hfBuffer) × borrowedShare',
        'netLoopAPY         = grossLoopAPY − borrowCost − slippageCost − hfIdleCost',
      ].join('\n'),
    },
    params: [
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'witryYieldUSD_7d', source: 'sidebar', ref: 'witryYieldUSD_7d' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
      { name: 'borrowAPYAtTarget', source: 'derived' },
      { name: 'perLoopSlippageBps', source: 'constant', value: '30 bps' },
    ],
    definitions: [
      { term: 'effective leverage', definition: 'The total wiTRY exposure a looper achieves per unit of equity, given LLTV and health-factor buffer constraints.' },
      { term: 'hfIdleCost', definition: 'The yield foregone on capital that must be left as collateral headroom to maintain HF > hfBuffer; this capital earns wiTRY yield but does not amplify returns.' },
      { term: 'slippage cost', definition: 'Estimated DEX friction per leverage loop iteration, fixed at 30 bps on the borrowed notional.' },
    ],
    impact: {
      health: 'Low netLoopAPY reduces looper willingness to maintain leveraged positions through TRY drawdowns, increasing voluntary deleveraging and cascading selling pressure.',
      sustainability: 'netLoopAPY must exceed witryYieldUSD_7d for loopMargin7d to be positive; when it falls below, borrowing demand evaporates and the vault underutilizes.',
      profitability: 'The primary incentive metric for loopers — the main marginal borrower type; directly governs whether the vault reaches its target utilization organically.',
    },
  },

  effectiveLeverage: {
    title: 'Effective leverage',
    oneLiner: 'The total wiTRY exposure per unit of looper equity, constrained by LLTV and the health-factor buffer.',
    formula: {
      plain: 'effectiveLeverage = 1 / (1 − LLTV / hfBuffer)',
    },
    params: [
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'LLTV', definition: 'Liquidation Loan-to-Value — the collateral ratio at which a position is eligible for liquidation; set by Morpho governance.' },
      { term: 'hfBuffer', definition: 'The safety multiplier loopers apply: they borrow only up to LLTV/hfBuffer of collateral value, maintaining HF = hfBuffer above the liquidation threshold.' },
    ],
    impact: {
      health: 'Higher leverage amplifies looper losses during TRY drawdowns, increasing liquidation probability and the bad-debt tail; lowering hfBuffer to increase leverage worsens the health-factor distribution.',
      sustainability: 'Effective leverage determines how much USDM each looper unit of wiTRY equity demands — directly sizing the borrowing demand that fills vault utilization.',
      profitability: 'Leverage multiplies gross loop APY; reducing hfBuffer raises leverage and profitability in calm markets but narrows the margin-of-safety against rate spikes.',
    },
  },
};

export const CHART_HELP: Record<ChartKey, ChartHelp> = {
  ...(Object.fromEntries(CHART_KEYS.map((k) => [k, STUB_CHART])) as Record<ChartKey, ChartHelp>),

  // ── Utilization charts (section 6) ────────────────────────────────────────

  looperViabilityCurve: {
    title: 'Looper Viability Curve',
    oneLiner: 'Borrow APY plotted across the full u_target sweep, with wiTRY 7d and 30d yield reference lines and a vertical IRM kink marker — shows where looping becomes uneconomical.',
    axes: { x: 'u_target (utilization)', y: 'APY (%)' },
    definitions: [
      { term: 'IRM kink', definition: 'Vertical marker at u=0.9 where borrow rate escalates steeply; any recommended target should stay well left of this line.' },
      { term: 'viability gate', definition: 'The region where the borrowAPY curve lies below the wiTRY 7d reference line — only in this region is looping profitable.' },
    ],
    impact: {
      health: 'A narrow feasibility window (borrowAPY nearly equal to wiTRY yield) signals high sensitivity to rate changes; small shocks can collapse looper demand.',
      sustainability: 'If the wiTRY 7d line crosses above the borrowAPY curve at low u_targets, no safe utilization level is viable and the vault cannot self-sustain.',
      profitability: 'The chart directly visualises the loop margin at every u_target, guiding parameter selection to maximise surplus while satisfying safety constraints.',
    },
  },

  liquidityStressTable: {
    title: 'Liquidity Stress Test Table',
    oneLiner: 'Per-u_target breakdown of liquidity buffer vs. stress withdrawal, with a survives flag and estimated days to refill — exposes where the buffer constraint binds.',
    axes: { x: 'u_target candidate', y: 'USD (buffer / stress)' },
    definitions: [
      { term: 'days to refill', definition: 'Estimated time to recover the buffer shortfall via new borrow interest accrual at the current borrowAPY and utilization; only shown when the buffer fails.' },
    ],
    impact: {
      health: 'Rows that fail stress at a given u_target indicate that value of utilization cannot be recommended without increasing the liquidity floor.',
      sustainability: 'Shows directly which u_targets provide a sustainable redemption buffer and which would force a redemption pause under the modelled stress event.',
      profitability: 'Highlights the u_target band where both survival and acceptable supplier yield coexist — the feasible operating zone.',
    },
  },

  loopEconomicsWaterfall: {
    title: 'Loop Economics Waterfall',
    oneLiner: 'Bar decomposition of the looper PnL into gross loop APY, borrow cost, slippage, HF idle cost, and net APY, with the wiTRY hold return as a reference bar.',
    axes: { x: 'PnL component', y: 'APY (%)' },
    bands: [
      { name: 'Gross loop APY', meaning: 'Total wiTRY yield amplified by effective leverage (positive bar).' },
      { name: 'Borrow cost', meaning: 'Interest paid on borrowed USDM at borrowAPY (negative bar).' },
      { name: 'Slippage', meaning: 'DEX friction on each loop iteration at 30 bps per borrowed unit (negative bar).' },
      { name: 'HF idle cost', meaning: 'Yield foregone on collateral reserved for health-factor headroom (negative bar).' },
      { name: 'Net loop APY', meaning: 'Sum of all components — the looper\'s actual return.' },
      { name: 'wiTRY (hold)', meaning: 'Unlevered hold benchmark; net loop APY must exceed this for looping to be rational.' },
    ],
    definitions: [
      { term: 'waterfall chart', definition: 'Each bar represents an additive or subtractive component; reading left to right shows how gross return is eroded to arrive at net return.' },
    ],
    impact: {
      health: 'Large borrow cost or HF idle bars reveal which cost driver most constrains loop profitability; reducing those parameters improves margin and position stability.',
      sustainability: 'Net loop APY below the wiTRY hold bar means the loop is uneconomical — the vault will underutilize, impairing lender yield and vault sustainability.',
      profitability: 'Shows the direct path to improving looper returns: lower borrowAPY (via lower r_target), higher LLTV, or lower hfBuffer all shift specific bars.',
    },
  },

  irmHeatmap: {
    title: 'IRM Sensitivity Heatmap',
    oneLiner: '10×10 grid of borrowAPY colored green→red vs. wiTRY 7d yield across all combinations of u_target and r_target, with an outline marking the current recommended point.',
    axes: { x: 'u_target (utilization)', y: 'r_target (IRM parameter)' },
    definitions: [
      { term: 'green cell', definition: 'borrowAPY < wiTRY 7d yield — looping is profitable at this (u, r_target) combination.' },
      { term: 'red cell', definition: 'borrowAPY ≥ wiTRY 7d yield — looping is uneconomical; this combination would underutilize the vault.' },
      { term: 'current outline', definition: 'The black outline marks the cell corresponding to the recommended u_target and the current rTargetOverride slider value.' },
    ],
    impact: {
      health: 'A recommended point near the green→red boundary has thin loop margin; small r_target increases could tip the vault into underutilization and stressed liquidity.',
      sustainability: 'The heatmap reveals how much r_target headroom exists before the vault loses organic borrow demand at its target utilization.',
      profitability: 'Identifies the parameter region that maximises supplier yield (high u, low r_target) while keeping the recommended point firmly in the green zone.',
    },
  },

  recommendationTable: {
    title: 'Recommendation Table',
    oneLiner: 'Side-by-side comparison of every candidate u_target across all feasibility metrics — borrow APY, supplier APY, loop margin 7d/30d, buffer, stress, survives, kink distance, and verdict.',
    axes: { x: 'u_target candidate', y: 'metric' },
    definitions: [
      { term: 'feasible', definition: 'All three constraints satisfied: loopMargin7d > 0, survives stress, and distanceToKink ≥ 0.07.' },
      { term: 'tight', definition: 'Two of three constraints pass; distanceToKink is the most commonly marginally-failing constraint in tight configurations.' },
      { term: 'infeasible', definition: 'One or more hard constraints fail; this u_target cannot be safely recommended.' },
    ],
    impact: {
      health: 'The verdict column shows exactly which u_targets fail health constraints, guiding the analyst to tighten lltv or hfBuffer if the feasible range is too narrow.',
      sustainability: 'Survives column directly shows which candidate utilization levels maintain adequate liquidity buffers under the stress scenario.',
      profitability: 'Comparing loop margin and supplier APY columns reveals the profitability cost of choosing a more conservative (lower) u_target from the feasible set.',
    },
  },
};
