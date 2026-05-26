// lib/help/registry.ts
// Stub entries for sections still pending; section content overlaid as it ships.
//   ✓ Section 1 (Liquidity Need) — roadmap PR #3
//   ✓ Section 2 (FX Risk)        — roadmap PR #4
//   ✓ Section 3 (Strategy)       — roadmap PR #5
//   ✓ Section 4 (Liquidation)    — roadmap PR #6
//   ✓ Section 5 (Vault)          — roadmap PR #7
//   ✓ Section 6 (Utilization)    — roadmap PR #8
import type { SidebarInputs } from '@/types/simulator';
import { KPI_KEYS, type KpiKey } from './kpiKeys';
import { CHART_KEYS, type ChartKey } from './chartKeys';
import type { ChartHelp, HelpSection, KpiHelp, ParamHelp } from './types';
import {
  LIQUIDITY_NEED_PARAMS,
  LIQUIDITY_NEED_KPIS,
  LIQUIDITY_NEED_CHARTS,
} from './content/liquidityNeed';
import {
  FX_RISK_PARAMS,
  FX_RISK_KPIS,
  FX_RISK_CHARTS,
} from './content/fxRisk';
import {
  STRATEGY_PARAMS,
  STRATEGY_KPIS,
  STRATEGY_CHARTS,
} from './content/strategy';
import {
  LIQUIDATION_PARAMS,
  LIQUIDATION_KPIS,
  LIQUIDATION_CHARTS,
} from './content/liquidation';
import {
  VAULT_PARAMS,
  VAULT_KPIS,
  VAULT_CHARTS,
} from './content/vault';
import {
  SWAP_LIQUIDITY_PARAMS,
  SWAP_LIQUIDITY_KPIS,
  SWAP_LIQUIDITY_CHARTS,
} from './content/swapLiquidity';

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

// All section overlays merge here. Later spreads win (none currently
// conflict). The registry test asserts every keyof SidebarInputs has a
// PARAM_HELP entry and every KPI/CHART key has its registry entry.
const SECTION_PARAMS: Partial<Record<string, ParamHelp>> = {
  ...LIQUIDITY_NEED_PARAMS,
  ...FX_RISK_PARAMS,
  ...STRATEGY_PARAMS,
  ...LIQUIDATION_PARAMS,
  ...VAULT_PARAMS,
  // ── Utilization section ──────────────────────────────────────────────────
  witryYieldUSD_7d:  { oneLiner: 'Trailing-7-day USD APY of holding wiTRY. Used by /utilization as the conservative loop-viability threshold.' },
  witryYieldUSD_30d: { oneLiner: 'Trailing-30-day USD APY of holding wiTRY. Shown as the optimistic reference on /utilization.' },
  hfBuffer:          { oneLiner: 'Looper health-factor safety buffer (≥ 1.0). A buffer of 1.5 means each loop step caps LTV at LLTV/1.5 so the position starts at HF = 1.5× the liquidation threshold. Lower = more leverage, less margin to absorb FX moves.' },
  loopCount:         { oneLiner: 'Number of explicit loop iterations (1–10). Each step: supply wiTRY → borrow USDM at LLTV/hfBuffer → swap to wiTRY. At n=10 the position is ≈99% converged to the closed-form limit; lower values model partial loops with less leverage and a wider FX safety margin.' },
  // ── SwapLiquidity section ────────────────────────────────────────────────
  ...SWAP_LIQUIDITY_PARAMS,
};

const SECTION_KPIS: Partial<Record<KpiKey, KpiHelp>> = {
  ...LIQUIDITY_NEED_KPIS,
  ...FX_RISK_KPIS,
  ...STRATEGY_KPIS,
  ...LIQUIDATION_KPIS,
  ...VAULT_KPIS,
  // ── Utilization section outputs and controls ─────────────────────────────

  recommendedUTarget: {
    title: 'Recommended target utilization',
    oneLiner: 'The highest candidate utilization that passes all four implemented checks: positive finite-loop carry margin, configured withdrawal coverage, configured distance from the fixed IRM kink at u = 0.90, and the separate FX stress gate. With the current defaults, the withdrawal check caps the result at 80%.',
    formula: {
      plain: [
        'recommended = max u ∈ [0.50, 0.90] such that:',
        '  1. loopMargin7d > 0           (carry: looping beats holding)',
        '  2. bufferUSD ≥ stressWithdrawalUSD  (lender stress: covered)',
        '  3. (0.90 − u) ≥ kinkClearance  (configured IRM-kink gap; default 0)',
        '  4. leveredDrawdown < HF headroom  (FX: survives P95 30d move)',
        '',
        '// Example at defaults (LLTV=0.86, HF=1.5, 10 loops, stress=20%,',
        '//   Rate at Target=4%, kinkClearance=0, z=1.65, TVL=$5M):',
        '//   u=0.90 → stress fails (buffer $0.5M < stress $1M)',
        '//   recommender steps down until stress is covered (≈ u=0.80).',
      ].join('\n'),
    },
    params: [
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'witryYieldUSD_7d', source: 'sidebar', ref: 'witryYieldUSD_7d' },
      { name: 'witryTVL_USD (used as page TVL)', source: 'sidebar', ref: 'witryTVL_USD' },
      { name: 'stressPctOfSupply', source: 'derived', note: 'page slider on /utilization' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
      { name: 'loopCount', source: 'sidebar', ref: 'loopCount' },
      { name: 'rTargetOverride', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'utilization (u)', definition: 'The fraction of total USDM supply that is currently borrowed. u=0.80 means 80% is lent out; 20% sits idle and can be withdrawn immediately.' },
      { term: 'IRM kink', definition: 'At u = 0.90, AdaptiveCurveIRM switches from its lower-utilization expression to its steep upper expression. Rate at Target equals borrow APY at this fixed point.' },
      { term: 'loop margin', definition: 'Finite-loop net APY minus the unlevered 7-day wiTRY APY. It includes borrow cost, fixed 30 bps slippage cost, and HF idle cost.' },
      { term: 'kink clearance', definition: 'The slider-controlled minimum value of 0.90 − u. Its current default is 0, so no extra kink gap is imposed unless the operator sets one.' },
      { term: 'FX gate', definition: 'A separate check: effectiveLeverage × 30-day stress drawdown must be below HF headroom. FX is not subtracted from carry APY.' },
    ],
    impact: {
      health: 'A higher candidate leaves less idle USDM for the modeled withdrawal and moves closer to the fixed 90% kink; the page reports both checks explicitly.',
      sustainability: 'A recommendation exists only when all four implemented checks pass on the 1pp search grid.',
      profitability: 'The displayed gross supplier APY and finite-loop carry margin are recalculated for the selected candidate; no profitability guarantee is implied.',
    },
  },

  borrowAPYAtTarget: {
    title: 'Borrow APY at target utilization',
    oneLiner: 'The AdaptiveCurveIRM borrow rate evaluated at the displayed utilization. Rate at Target is anchored at u = 0.90, so it is not the rate at every chosen u. At u=0.80 and a 4% anchor, borrow APY is approximately 3.43%.',
    formula: {
      plain: [
        'borrowAPY = adaptiveCurveIRM(u_target, rTargetIRM)',
        '',
        'For u ≤ 0.9 (below kink):',
        '  K1 = ln(4) / 0.9',
        '  borrowAPY = (rTargetIRM / 4) × exp(K1 × u)',
        '',
        'For u > 0.9 (above kink):',
        '  K2 = ln(4) / 0.1',
        '  borrowAPY = rTargetIRM × exp(K2 × (u − 0.9))',
        '',
        '// Example at defaults (rTargetIRM=4%, u_target=0.80):',
        '//   K1 = ln(4)/0.9 ≈ 1.5404',
        '//   borrowAPY = (0.04/4) × exp(1.5404 × 0.80) ≈ 3.43%',
        '// At rTargetIRM=8%, u_target=0.80:',
        '//   borrowAPY ≈ 6.86%; the finite-loop margin calculation fails.',
      ].join('\n'),
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
      { name: 'rTargetOverride', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'AdaptiveCurveIRM', definition: 'The two-segment exponential curve implemented by the simulator. It is anchored so the rate equals rTargetIRM exactly at u = 0.90.' },
      { term: 'Rate at Target', definition: 'The value stored as rTargetIRM: borrow APY at the fixed u = 0.90 kink. Changing it scales the whole displayed IRM curve.' },
      { term: 'kink', definition: 'At u = 0.90 the IRM switches formula. Below it, the expression starts at rTargetIRM/4; above it, the rate grows steeply from rTargetIRM.' },
    ],
    impact: {
      health: 'Borrow APY enters the modeled carry calculation; it does not enter the separate FX stress formula.',
      sustainability: 'Higher borrow APY increases one component of finite-loop cost; the margin tile reports the calculated result after the other modeled costs.',
      profitability: 'Changing Rate at Target rescales this borrow-rate curve and therefore changes the modeled loop margin and gross supplier APY.',
    },
  },

  supplierAPYAtTarget: {
    title: 'Gross supplier APY at target utilization',
    oneLiner: 'Gross interest generated per dollar of supplied USDM at the displayed utilization: borrow APY times utilization. This tile does not subtract vault fees or add incentives. At u=0.80 and borrowAPY approximately 3.43%, it is approximately 2.74%.',
    formula: {
      plain: [
        'supplierAPY ≈ borrowAPY × u_target',
        '',
        '// Example at defaults (borrowAPY=3.43%, u_target=0.80):',
        '//   supplierAPY ≈ 3.43% × 0.80 = 2.74%',
        '// If u_target rises to 0.85:',
        '//   supplierAPY ≈ 3.43% × 0.85 ≈ 2.92%  (+18bp vs 80% target)',
      ].join('\n'),
    },
    params: [
      { name: 'borrowAPYAtTarget', source: 'derived' },
      { name: 'recommendedUTarget', source: 'derived' },
    ],
    definitions: [
      { term: 'utilization (u)', definition: 'The fraction of total USDM supply currently lent out. Only this fraction earns interest; the 1−u idle portion earns zero.' },
      { term: 'supplier', definition: 'A USDM depositor who provides the raw liquidity that borrowers (loopers) draw from. Their yield comes entirely from borrow interest on the deployed fraction.' },
    ],
    impact: {
      health: 'This metric does not determine the withdrawal or FX checks; those are shown separately.',
      sustainability: 'It measures modeled gross borrow-interest flow at the target, before any fee or incentive adjustments.',
      profitability: 'For a fixed borrow APY, this gross rate increases with utilization; the IRM also changes borrow APY as utilization changes.',
    },
  },

  loopMargin7d: {
    title: 'Loop margin (7-day)',
    oneLiner: 'Modeled finite-loop net APY minus unlevered 7-day wiTRY APY. Positive is the solver\'s carry gate; it is not a claim about actual trader behavior or future returns.',
    formula: {
      plain: [
        'loopMargin7d = looperNetAPY − witryYieldUSD_7d',
        '',
        '// Example at u=0.80 with default 10 loops and inputs:',
        '//   looperNetAPY≈6.95%, witryYieldUSD_7d=6.31%',
        '//   loopMargin7d≈+0.64%  → passes the modeled carry gate',
      ].join('\n'),
    },
    params: [
      { name: 'looperNetAPY', source: 'derived' },
      { name: 'witryYieldUSD_7d', source: 'sidebar', ref: 'witryYieldUSD_7d' },
    ],
    definitions: [
      { term: 'looper', definition: 'A user who repeatedly deposits wiTRY, borrows USDM, swaps USDM back into wiTRY, and re-deposits — building up leveraged exposure to the wiTRY yield. They are the vault\'s primary borrowers.' },
      { term: 'loop margin', definition: 'The modeled APY difference above holding wiTRY unlevered. When it is not positive, that candidate fails this solver gate.' },
      { term: 'witryYieldUSD_7d', definition: 'The 7-day trailing USD-equivalent APY from holding wiTRY (iTRY staking yield converted to USD terms). This is the opportunity cost a looper compares against looperNetAPY.' },
    ],
    impact: {
      health: 'This metric is the carry eligibility check only; withdrawal and FX stress are tested in separate gates.',
      sustainability: 'The solver rejects a candidate when this margin is not strictly positive.',
      profitability: 'This is the calculated advantage over the modeled hold benchmark after the costs included by carryLoopAPY.',
    },
  },

  distanceToKink: {
    title: 'Distance to IRM kink',
    oneLiner: 'The difference between the fixed IRM kink at u = 0.90 and the displayed target. A candidate passes when this value is at least the configured kink clearance, whose default is 0.',
    formula: {
      plain: [
        'distanceToKink = 0.9 − u_target',
        '',
        '// At u_target=0.80: distanceToKink = 0.10 (10pp)',
        '// With default kinkClearance=0, u_target=0.90 passes this gate exactly.',
        '// With kinkClearance=0.07, candidates must be at or below u_target=0.83.',
      ].join('\n'),
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
    ],
    definitions: [
      { term: 'IRM kink', definition: 'At u=0.9 the AdaptiveCurveIRM switches to a steep exponential segment. Going from u=0.90 to u=1.0 causes borrow rates to rise by 4× — this is intentional, to aggressively deter over-utilization.' },
      { term: 'kink clearance', definition: 'A configurable minimum gap from the kink. Default 0; an operator can choose a positive gap such as 0.07 through the page control.' },
    ],
    impact: {
      health: 'If distanceToKink is below the configured clearance, that candidate is excluded by the solver.',
      sustainability: 'The control lets the operator explicitly require an additional gap below the fixed 90% kink.',
      profitability: 'Increasing clearance can lower the maximum candidate that can be recommended and changes the displayed APY results.',
    },
  },

  liquidityBufferUSD: {
    title: 'Liquidity buffer (USD)',
    oneLiner: 'The amount of USDM not borrowed at the displayed target, available to cover the deterministic withdrawal scenario in this page. At u=0.80 with the $5M default TVL, this is $1M.',
    formula: {
      plain: [
        'liquidityBufferUSD = (1 − u_target) × TVL_USDM',
        '',
        '// Example at defaults (u_target=0.80, TVL=$5M):',
        '//   liquidityBufferUSD = (1 − 0.80) × $5M = $1,000,000',
        '// At u_target=0.85:',
        '//   liquidityBufferUSD = 0.15 × $5M = $750,000',
      ].join('\n'),
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
      { name: 'witryTVL_USD (used as page TVL)', source: 'sidebar', ref: 'witryTVL_USD' },
    ],
    definitions: [
      { term: 'TVL_USDM', definition: 'The page passes the shared `witryTVL_USD` value directly as the USDM TVL input for this buffer calculation.' },
      { term: 'idle capital', definition: 'The (1 − u) fraction of USDM that has not been borrowed. It earns zero interest but can be redeemed by any supplier at any time without waiting for borrowers to repay.' },
    ],
    impact: {
      health: 'This is the idle USDM available against the configured withdrawal scenario before borrower repayments are considered.',
      sustainability: 'liquidityBufferUSD must be at least stressWithdrawalUSD for this candidate to pass the withdrawal gate.',
      profitability: 'At a given candidate and rate, the unborrowed amount does not contribute to gross supplier interest.',
    },
  },

  stressWithdrawalUSD: {
    title: 'Stress withdrawal (USD)',
    oneLiner: 'The modeled withdrawal amount: a selected percentage of USDM supply. At the page defaults of 20% stress and $5M TVL, this is $1M.',
    formula: {
      plain: [
        'stressWithdrawalUSD = stressPctOfSupply × TVL_USDM',
        '',
        '// Example at defaults (stressPct=20%, TVL=$5M):',
        '//   stressWithdrawalUSD = 0.20 × $5M = $1,000,000',
        '// Raising stress to 30% (same TVL):',
        '//   stressWithdrawalUSD = $1,500,000  →  buffer at u=0.80 ($1M) fails,',
        '//   withdrawal coverage requires u_target ≤ 0.70.',
      ].join('\n'),
    },
    params: [
      { name: 'stressPctOfSupply', source: 'derived', note: 'page slider on /utilization' },
      { name: 'witryTVL_USD (used as page TVL)', source: 'sidebar', ref: 'witryTVL_USD' },
    ],
    definitions: [
      { term: 'stress scenario', definition: 'A deterministic assumption about withdrawals. The page checks available idle USDM against this amount; it does not estimate its likelihood.' },
      { term: 'stressPctOfSupply', definition: 'The slider-controlled fraction of total USDM supply included in the withdrawal scenario.' },
    ],
    impact: {
      health: 'Each 5pp added to stressPct raises stressWithdrawalUSD by 5% of TVL; once it exceeds liquidityBufferUSD, that candidate fails this gate.',
      sustainability: 'The chosen stress percentage directly limits candidates: a higher percentage requires more idle USDM in this model.',
      profitability: 'This gate bounds eligible utilization by u ≤ 1 − stressPct; the displayed APYs are recalculated at any resulting recommendation.',
    },
  },

  survivesStress: {
    title: 'Survives stress?',
    oneLiner: 'A simple pass/fail check: does idle USDM cover the configured withdrawal amount? At defaults (u=0.80, stress=20%, $5M TVL), both values equal $1M.',
    formula: {
      plain: [
        'survivesStress = (liquidityBufferUSD ≥ stressWithdrawalUSD)',
        '               = ((1 − u_target) × TVL ≥ stressPctOfSupply × TVL)',
        '               = (1 − u_target ≥ stressPctOfSupply)',
        '',
        '// Example at defaults (u_target=0.80, stressPct=0.20):',
        '//   1 − 0.80 = 0.20 ≥ 0.20  →  survivesStress = ✓ (exactly passes)',
        '// At u_target=0.85, stressPct=0.20:',
        '//   1 − 0.85 = 0.15 < 0.20  →  survivesStress = ✗ (fails)',
      ].join('\n'),
    },
    params: [
      { name: 'liquidityBufferUSD', source: 'derived' },
      { name: 'stressWithdrawalUSD', source: 'derived' },
    ],
    definitions: [
      { term: 'stress survival gate', definition: 'One of four checks a candidate u_target must pass to be recommended. It tests only whether idle USDM covers the configured withdrawal amount.' },
      { term: 'pass condition', definition: 'The buffer fraction (1 − u_target) must be ≥ the stress fraction. This simplifies to: u_target ≤ 1 − stressPct. At 20% stress, the ceiling is u=0.80.' },
    ],
    impact: {
      health: 'When this is false, the solver excludes that candidate because idle cash is below the modeled withdrawal amount.',
      sustainability: 'This check does not model borrower repayments, withdrawal timing, or the likelihood of the scenario.',
      profitability: 'This gate does not calculate APY; it only includes or excludes candidates from the recommendation.',
    },
  },

  looperNetAPY: {
    title: 'Looper net APY (TRY-native carry)',
    oneLiner: 'Modeled carry APY for the configured finite number of loops after borrow cost, fixed swap slippage, and HF idle cost. FX is checked separately as a stress gate and is not subtracted here. At u=0.80 with current defaults this is approximately 6.95%.',
    formula: {
      plain: [
        'b                  = LLTV / hfBuffer',
        'effectiveLeverage  = 1 + b + ... + b^loopCount  (finite loops)',
        '                   = (1 − b^(loopCount + 1)) / (1 − b)',
        'borrowedShare      = effectiveLeverage − 1',
        'grossLoopAPY       = effectiveLeverage × witryYieldUSD_7d',
        'borrowCost         = borrowedShare × borrowAPY',
        'slippageCost       = borrowedShare × (30 / 10_000)',
        'hfIdleCost         = witryYieldUSD_7d × (1 − 1/hfBuffer) × borrowedShare',
        'looperNetAPY       = grossLoopAPY − borrowCost − slippageCost − hfIdleCost',
        '',
        '// Example at u=0.80 with defaults (LLTV=0.86, HF=1.5, loopCount=10, borrowAPY=3.43%,',
        '//   witryYieldUSD_7d=6.31%):',
        '//   effectiveLeverage ≈ 2.339×; borrowedShare ≈ 1.339',
        '//   grossLoopAPY ≈ 14.76%; borrowCost ≈ 4.59%',
        '//   slippageCost ≈ 0.40%; hfIdleCost ≈ 2.82%',
        '//   looperNetAPY ≈ 6.95%',
      ].join('\n'),
    },
    params: [
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'witryYieldUSD_7d', source: 'sidebar', ref: 'witryYieldUSD_7d' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
      { name: 'loopCount', source: 'sidebar', ref: 'loopCount' },
      { name: 'borrowAPYAtTarget', source: 'derived' },
      { name: 'perLoopSlippageBps', source: 'constant', value: '30 bps' },
    ],
    definitions: [
      { term: 'effective leverage', definition: 'How much wiTRY exposure is modeled per dollar of starting equity after the configured finite loop count. At LLTV=0.86, HF=1.5, and 10 loops, this is approximately 2.339×.' },
      { term: 'borrowedShare', definition: 'The fraction of total exposure that was borrowed rather than owned: effectiveLeverage − 1. At 2.34×, borrowedShare ≈ 1.34 — meaning $1.34 borrowed for every $1 of equity.' },
      { term: 'hfIdleCost', definition: 'The opportunity cost of the collateral headroom. To keep HF = hfBuffer, the looper cannot use all their wiTRY as productive leverage — some must sit as uncollateralized reserve. That capital earns wiTRY yield but does not amplify returns.' },
      { term: 'slippage cost', definition: 'Each "loop" (borrow USDM → swap → re-deposit) incurs DEX friction. Fixed at 30 bps of the borrowed notional per full loop cycle.' },
    ],
    impact: {
      health: 'Higher leverage also increases the levered drawdown tested in the separate FX gate.',
      sustainability: 'The recommendation requires this APY to exceed the 7-day unlevered wiTRY benchmark in the modeled carry calculation.',
      profitability: 'The tile shows the result of the implemented carry formula, not realized or forecast return.',
    },
  },

  effectiveLeverage: {
    title: 'Effective leverage',
    oneLiner: 'Modeled wiTRY exposure per dollar of starting equity after the configured finite number of borrow-and-redeposit loops. At LLTV=0.86, HF=1.5, and 10 loops, it is approximately 2.339×.',
    formula: {
      plain: [
        'b = LLTV / hfBuffer',
        'effectiveLeverage = 1 + b + b² + ... + b^loopCount',
        '                  = (1 − b^(loopCount + 1)) / (1 − b)',
        '',
        '// Example at defaults (LLTV=0.86, hfBuffer=1.5):',
        '//   debtFraction      = 0.86 / 1.5 ≈ 0.573',
        '//   effectiveLeverage at loopCount=10 ≈ 2.339×',
        '// With hfBuffer=1.2 and loopCount=10:',
        '//   debtFraction      = 0.86 / 1.2 ≈ 0.717',
        '//   effectiveLeverage = 1 + b + ... + b^10 ≈ 3.44×',
      ].join('\n'),
    },
    params: [
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
      { name: 'loopCount', source: 'sidebar', ref: 'loopCount' },
    ],
    definitions: [
      { term: 'LLTV (Liquidation LTV)', definition: 'The maximum loan-to-value ratio before Morpho flags a position for liquidation. Set by Morpho governance per market. At LLTV=0.86, a position with $100 of collateral can borrow up to $86 before liquidation.' },
      { term: 'hfBuffer', definition: 'The health-factor input used to set each loop step\'s borrowed fraction, LLTV/hfBuffer. HF=1 is the modeled liquidation threshold.' },
      { term: 'debt fraction', definition: 'LLTV / hfBuffer, the fraction borrowed again at each loop step. The finite geometric sum uses this value repeatedly for loopCount steps.' },
    ],
    impact: {
      health: 'This value multiplies the 30-day FX stress drawdown in the separate eligibility gate.',
      sustainability: 'Borrowed share equals effective leverage minus one and feeds each modeled carry-cost component.',
      profitability: 'Leverage multiplies both modeled wiTRY yield and modeled costs; net margin is shown separately.',
    },
  },

  // ── Utilization page slider inputs ────────────────────────────────────────

  tvlUSDMInput: {
    title: 'Vault TVL — total USDM supply (shared context)',
    oneLiner: 'The USDM supply size used for dollar buffer and withdrawal amounts. This page reads it from shared simulator state; the default is $5M and it is edited on the Market Simulator.',
    formula: {
      plain: [
        'Shared simulator input (read-only here). Default: $5,000,000.',
        '',
        'Downstream (all values scale proportionally with TVL):',
        '  liquidityBufferUSD     = (1 − u_target) × TVL',
        '  stressWithdrawalUSD    = stressPctOfSupply × TVL',
        '  survivesStress         = (liquidityBufferUSD ≥ stressWithdrawalUSD)',
        '',
        '// Example: TVL = $5M, u_target = 0.80, stress = 20%',
        '//   buffer = $1,000,000, stress = $1,000,000  → survives ✓',
        '//   (ratio unchanged — survivesStress depends on fractions, not absolute $)',
        '',
        '// TVL matters for absolute dollar outputs (liquidityBufferUSD, stressWithdrawalUSD)',
        '// but does NOT change the recommended u_target (which is a fraction).',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'TVL (Total Value Locked)', definition: 'The sum of all USDM deposited by lenders. If Alice deposits $6M and Bob deposits $4M, TVL = $10M. This is the denominator of utilization: u = total borrowed / TVL.' },
      { term: 'utilization (u)', definition: 'The fraction of TVL that is currently lent out to borrowers. At u=0.80, 80% of TVL is earning interest; 20% is idle cash that can be withdrawn any time.' },
      { term: 'idle USDM (liquidity buffer)', definition: 'The (1 − u) × TVL portion that nobody borrowed yet. It is the vault\'s "cash register" — the only capital that can honor a withdrawal without forcing a borrower to repay early.' },
    ],
    impact: {
      health: 'A larger TVL means more absolute liquidity buffer even at the same utilization — e.g. $2M idle at $10M TVL vs $1M idle at $5M. The stress-test fraction is unchanged, but the actual dollar cushion is larger.',
      sustainability: 'Changing TVL does not affect the recommended u_target or any percentage-based KPI. It only changes the dollar amounts shown for buffer and stress. If in doubt, match this to your projected launch TVL.',
      profitability: 'TVL scales borrower demand and supplier income proportionally. The per-dollar APY (borrowAPYAtTarget, supplierAPYAtTarget) is independent of TVL — only the absolute dollar profits change.',
    },
  },

  stressPctOfSupplyInput: {
    title: 'Stress withdrawal % (slider)',
    oneLiner: 'The assumed withdrawal fraction used by this deterministic coverage check. At the 20% default and $5M default TVL, the modeled withdrawal is $1M.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 5%–50%, default: 20%, step: 1%.',
        '',
        'Downstream: stressWithdrawalUSD = stressPctOfSupply × TVL_USDM',
        '            survivesStress      = (liquidityBufferUSD ≥ stressWithdrawalUSD)',
        '            recommendedUTarget  ≤ 1 − stressPctOfSupply',
        '',
        '// Example at defaults (stressPct=20%, TVL=$5M):',
        '//   stressWithdrawalUSD = $1,000,000',
        '//   max feasible u_target = 1 − 0.20 = 0.80  →  recommendedUTarget = 0.80',
        '// Raise to 30%:',
        '//   stressWithdrawalUSD = $3,000,000',
        '//   u=0.80 now fails (buffer=$2M < stress=$3M)',
        '//   recommendedUTarget steps down to ≈ 0.70',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'stress scenario', definition: 'A selected withdrawal amount, not a forecast or historical probability.' },
      { term: 'liquidityBufferUSD', definition: 'The idle USDM at a candidate utilization: (1 − u) × TVL. The coverage flag is true only when this is at least the configured stress amount.' },
    ],
    impact: {
      health: 'Each 5pp increase raises stressWithdrawalUSD by 5% of TVL; once it exceeds liquidityBufferUSD, survivesStress flips to ✗ and recommendedUTarget steps down to restore the buffer.',
      sustainability: 'A 20% setting bounds candidates at u=0.80 through this gate; the other three gates still also apply.',
      profitability: 'Changing this percentage changes which targets can pass and therefore can change the displayed APYs.',
    },
  },

  hfBufferInput: {
    title: 'Looper HF buffer (slider)',
    oneLiner: 'The modeled health-factor target for loop leverage. HF=1.5 means each step borrows LLTV/1.5 of collateral. It changes finite leverage, HF idle cost, and the separate FX-stress result.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 1.1×–2.5×, default: 1.5×, step: 0.05×.',
        '',
        'Downstream: b = LLTV / hfBuffer',
        '            effectiveLeverage = 1 + b + ... + b^loopCount',
        '            looperNetAPY       = f(effectiveLeverage, borrowAPY, witryYield)',
        '            loopMargin7d       = looperNetAPY − witryYieldUSD_7d',
        '',
        '// Example at defaults (LLTV=0.86, hfBuffer=1.5, loopCount=10):',
        '//   effectiveLeverage ≈ 2.339×',
        '//   looperNetAPY at u=0.80 ≈ 6.95%',
        '// Lower hfBuffer increases finite leverage:',
        '//   grossLoopAPY rises but borrow/slippage costs also rise proportionally',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'HF / health factor', definition: 'The ratio of a position\'s collateral value to its debt, normalized by LLTV. HF = (collateral × LLTV) / debt. HF=1.0 means the position is exactly at the liquidation boundary. HF=1.5 means the borrower could absorb a 33% collateral drop before forced liquidation.' },
      { term: 'hfBuffer', definition: 'The HF loopers target voluntarily. By borrowing only LLTV/hfBuffer of their collateral, they keep HF = hfBuffer. Higher buffer = less leverage = more safety margin.' },
      { term: 'effective leverage', definition: 'Finite-loop exposure computed as 1 + b + ... + b^loopCount, where b = LLTV/hfBuffer.' },
    ],
    impact: {
      health: 'Lower hfBuffer increases modeled leverage and makes the FX drawdown check harder to pass.',
      sustainability: 'The selected buffer affects finite-loop carry and the independent FX check; the result is shown rather than inferred.',
      profitability: 'Changing hfBuffer recalculates gross yield, borrow cost, slippage cost, and HF idle cost; the resulting margin can rise or fall.',
    },
  },

  rTargetOverrideInput: {
    title: 'Rate anchor at 90% kink (slider)',
    oneLiner: 'The `rTargetIRM` anchor: AdaptiveCurveIRM returns this borrow APY exactly at its fixed kink, u = 0.90. The application default is 4%, and changing it scales the displayed IRM curve.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 1%–10%, default: 4%, step: 0.05 percentage points.',
        '',
        'Rate at Target (`rTargetIRM`) is the anchor point of the',
        'AdaptiveCurveIRM. It is the borrow APY a borrower pays exactly when',
        'market utilization equals 90% — the kink. It is not the rate at the',
        'operator-selected target unless that target is exactly 90%.',
        '',
        'Downstream: borrowAPYAtTarget = adaptiveCurveIRM(u_target, rTargetIRM)',
        '            looperNetAPY       depends on borrowAPYAtTarget',
        '            irmHeatmap         redraws entirely when rTargetIRM changes',
        '            recommendedUTarget may change if loopMargin7d crosses zero',
        '',
        'The calculation in this page treats the anchor as a static input.',
        '',
        '// Example at rTargetIRM=4%, u_target=0.80:',
        '//   K1 = ln(4)/0.9 ≈ 1.5404',
        '//   borrowAPYAtTarget = (0.04/4) × exp(1.5404 × 0.80) ≈ 3.43%',
        '//   with 10 loops, loopMargin7d ≈ +0.64%  (passes carry gate)',
        '// Raise rTargetIRM to 8%:',
        '//   borrowAPYAtTarget ≈ 6.86%  >  witryYieldUSD_7d=6.31%',
        '//   loopMargin7d < 0  →  candidate fails the carry gate',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'Rate at Target', definition: 'The IRM anchor stored as rTargetIRM. Borrow APY equals this value at u = 0.90. Below the kink, the rate starts at one quarter of the anchor.' },
      { term: 'AdaptiveCurveIRM', definition: 'The two-segment exponential function implemented in lib/morphoMath.ts that maps utilization and this rate anchor to borrow APY.' },
      { term: 'kink (u = 0.9)', definition: 'The utilization level where the IRM switches from a gentle to a steep exponential. At the kink, borrow APY = Rate at Target. The two segments are calibrated so the curve is continuous at u = 0.9.' },
      { term: 'static input', definition: 'This page evaluates the curve using the selected anchor value; it does not simulate any movement of that anchor over time.' },
    ],
    impact: {
      health: 'This control changes the modeled borrow rate and carry-margin gate; it does not change the separate withdrawal or FX formulas directly.',
      sustainability: 'The heatmap shows how the modeled carry gate responds to candidate target and this rate anchor.',
      profitability: 'Each change to the anchor changes modeled borrow cost; the page recalculates the resulting finite-loop margin.',
    },
  },

  kinkClearanceInput: {
    title: 'Kink clearance (slider)',
    oneLiner: 'The minimum gap the solver requires below the fixed AdaptiveCurveIRM kink at u = 0.90. The current default is 0 percentage points; increasing it caps the highest eligible utilization target.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 0–15 percentage points, default: 0, step: 0.05pp.',
        '',
        'distanceToKink = 0.90 − u_target',
        'gate passes when distanceToKink ≥ kinkClearance',
        '',
        '// kinkClearance = 0.00 → this gate allows u_target up to 0.90',
        '// kinkClearance = 0.07 → this gate allows u_target up to 0.83',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'fixed kink', definition: 'The IRM expression changes at u = 0.90; this location does not move when Rate at Target changes.' },
      { term: 'clearance', definition: 'A user-selected policy gap, separate from the IRM formula itself.' },
    ],
    impact: {
      health: 'A larger setting excludes targets closer to the fixed kink.',
      sustainability: 'This check is one of four recommendation gates and applies exactly as configured.',
      profitability: 'A larger setting can cap utilization below candidates with higher displayed gross supplier APY.',
    },
  },

  // ── FX risk overlay (vol-based) ──────────────────────────────────────────
  // The looper is a TRY-native carry trader. wiTRY yield IS the compensation
  // for FX risk; expected TRY depreciation is NOT subtracted from the carry.
  // FX vol enters only as a stress check on whether levered exposure
  // survives a typical bad month.

  fxAnnualVol: {
    title: 'USD/TRY annual vol (σ)',
    oneLiner: 'Annualized standard deviation of daily USD/TRY log-returns, computed from the embedded TRY=X history. A measurement, not a policy knob; the tile displays the value from the currently bundled data.',
    formula: {
      plain: [
        'σ_annual = stdev(daily log-returns) × √252',
        '',
        '// Read from lib/usdtryData.json once at mount and shown as a chip',
        '// next to the FX stress z-slider. The value moves only when the',
        '// embedded data is refreshed (npm run fx:build).',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'daily log-return', definition: 'log(rate_t / rate_{t−1}). Symmetric around zero for a stationary process; standard deviation measures dispersion regardless of drift direction.' },
      { term: 'annualization', definition: '√252 ≈ 15.87. Converts daily σ to a yearly-equivalent magnitude, assuming roughly independent daily moves. The home page Monte Carlo uses the same formula.' },
    ],
    impact: {
      health: 'Higher σ widens the modeled FX drawdown and can make the FX badge fail for fixed leverage and z.',
      sustainability: 'If the embedded history is refreshed and σ rises enough to fail this independent gate, the solver returns no recommendation for the current leverage inputs.',
      profitability: 'No direct effect on modeled carry APY. Only the separate FX gate uses this input.',
    },
  },

  fxStressDrawdown30d: {
    title: '30-day FX stress drawdown',
    oneLiner: 'The modeled 30-day USD/TRY move at the chosen z (`z × σ × √t`). At σ=16.8% and z=1.65 under the normal-volatility approximation, this is approximately 7.9%. It feeds the separate FX gate.',
    formula: {
      plain: [
        'fxStressDrawdown_30d = fxAnnualVol × √(30/365) × fxStressZ',
        '',
        '// Example at σ=16.8%, z=1.65:',
        '//   = 0.168 × 0.2867 × 1.65 ≈ 0.0795  →  7.95% 30-day P95 move',
        '// Example at σ=16.8%, z=2.33 (99th pct):',
        '//   = 0.168 × 0.2867 × 2.33 ≈ 0.1123  →  11.23%',
        '',
        '// Levered drawdown = effectiveLeverage × fxStressDrawdown_30d',
        '// Must stay below HF headroom = (1 − LLTV/hfBuffer).',
      ].join('\n'),
    },
    params: [
      { name: 'fxAnnualVol', source: 'derived', note: 'measured from usdtryData.json' },
      { name: 'fxStressZ', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'z-score', definition: 'How many standard deviations into the tail to stress. Under a normal-vol assumption: z=1.65 ≈ 95th percentile (single tail), z=2.33 ≈ 99th. Higher z = more conservative.' },
      { term: '√(30/365)', definition: 'Time-scaling factor that converts annualized σ to a 30-day-horizon σ. Brownian-motion approximation; assumes daily moves are roughly independent.' },
    ],
    impact: {
      health: 'Drives the FX badge. Once levered drawdown is not below HF headroom, the gate fails.',
      sustainability: 'This gate is independent of u_target in the current formula; a failure requires an FX or leverage input change to produce a recommendation.',
      profitability: 'The modeled carry margin is unaffected; this metric is used only as an eligibility check.',
    },
  },

  loopSurvivesStress: {
    title: 'Loop survives FX stress?',
    oneLiner: 'Whether modeled levered drawdown stays below modeled HF headroom for the selected 30-day FX stress move. It is a separate pass/fail gate; it does not alter carry APY.',
    formula: {
      plain: [
        'leveredDrawdown = effectiveLeverage × fxStressDrawdown_30d',
        'hfHeadroom      = 1 − LLTV / hfBuffer',
        'loopSurvivesStress = leveredDrawdown < hfHeadroom',
        '',
        '// Example at lev=2.34×, dd=7.95%, headroom=42.67%:',
        '//   leveredDrawdown ≈ 18.6%  <  42.7%  →  survives ✓',
        '// Example at lev=4× (lower hfBuffer), dd=7.95%, headroom=21%:',
        '//   leveredDrawdown ≈ 31.8%  >  21%   →  fails ✗',
      ].join('\n'),
    },
    params: [
      { name: 'effectiveLeverage', source: 'derived' },
      { name: 'fxStressDrawdown_30d', source: 'derived' },
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'HF headroom', definition: '1 − LLTV/hfBuffer. The fractional collateral cushion between the looper\'s borrowed share and the liquidation boundary. At LLTV=0.86 and HF=1.5, headroom = 1 − 0.573 ≈ 42.7%.' },
      { term: 'levered drawdown', definition: 'effectiveLeverage × fxStressDrawdown_30d. The actual collateral hit at full leverage from the stress move. If this exceeds headroom, the position would breach LLTV.' },
    ],
    impact: {
      health: 'When this is false, no candidate can pass while leverage and the chosen FX scenario remain unchanged, because this gate does not depend on u_target.',
      sustainability: 'Changing hfBuffer, LLTV, loop count, annual volatility data, or stress z can change this gate.',
      profitability: 'The FX gate does not enter the carry APY formula; it only determines eligibility for a recommendation.',
    },
  },

  fxStressZInput: {
    title: 'FX stress z-score (slider)',
    oneLiner: 'How large a standardized 30-day FX move to test. Under the normal-volatility approximation, 1.65σ is approximately a one-tail 95th percentile and 2.33σ approximately 99th. Higher z makes the independent FX gate harder to pass.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 1.0σ–3.0σ, default: 1.65σ, step: 0.05σ.',
        '',
        'Downstream: fxStressDrawdown_30d = fxAnnualVol × √(30/365) × fxStressZ',
        '            loopSurvivesStress    = leveredDrawdown < HF headroom',
        '            recommendedUTarget    is unavailable if the gate flips ✗',
        '',
        '// At σ=16.8% and lev=2.34×:',
        '//   z=1.00 → dd=4.8%,  levered=11.3%, headroom=42.7% → safe',
        '//   z=1.65 → dd=7.9%,  levered=18.6%, headroom=42.7% → safe',
        '//   z=2.33 → dd=11.2%, levered=26.3%, headroom=42.7% → safe',
        '//   z=3.00 → dd=14.5%, levered=33.8%, headroom=42.7% → safe',
        '// (Tighter when hfBuffer is lower — headroom shrinks fast.)',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'stress quantile', definition: 'A normal-volatility approximation used to choose a larger or smaller modeled drawdown; it is not a guarantee about realized months.' },
      { term: 'single-tail z', definition: 'Under a normal distribution, z=1.65 cuts off the worst 5% of moves, z=2.33 cuts off the worst 1%. We only stress the depreciation direction (the direction that hurts loopers), hence single-tail.' },
    ],
    impact: {
      health: 'Higher z tests a larger FX move and can cause the FX eligibility check to fail.',
      sustainability: 'Because the FX gate is independent of u_target in this solver, a failed gate blocks a recommendation until an FX/leverage input changes.',
      profitability: 'No effect on the carry calculation. It only determines whether any candidate can pass the FX gate with the current leverage.',
    },
  },

  // ── SwapLiquidity section ────────────────────────────────────────────────
  ...SWAP_LIQUIDITY_KPIS,
};

const SECTION_CHARTS: Partial<Record<ChartKey, ChartHelp>> = {
  ...LIQUIDITY_NEED_CHARTS,
  ...FX_RISK_CHARTS,
  ...STRATEGY_CHARTS,
  ...LIQUIDATION_CHARTS,
  ...VAULT_CHARTS,
  // ── Utilization charts (section 6) ────────────────────────────────────────

  looperViabilityCurve: {
    title: 'Looper Viability Curve',
    oneLiner: 'The blue line is borrow APY across candidate utilization targets. The wiTRY yield lines are references only: the actual carry gate is finite-loop net APY after borrow cost, 30 bps slippage, and HF idle cost, minus the 7-day hold benchmark. The red line is the fixed IRM kink at u = 0.90.',
    axes: { x: 'u_target — candidate utilization (50%–90%)', y: 'APY (%) — borrow rate or wiTRY yield' },
    definitions: [
      { term: 'blue borrowAPY curve', definition: 'The AdaptiveCurveIRM output at each u_target. With Rate at Target = 4%, it reaches 4% exactly at the fixed u = 0.90 kink.' },
      { term: 'green dashed line (7d yield)', definition: 'The unlevered 7-day wiTRY benchmark used after finite-loop costs are calculated; it is not by itself the pass/fail boundary for the blue borrow-rate line.' },
      { term: 'orange dashed line (30d yield)', definition: 'The 30-day wiTRY benchmark displayed for comparison in the recommendation table.' },
      { term: 'red vertical kink marker', definition: 'Marks u = 0.90, where the IRM changes expression. Required gap from this line is controlled by kinkClearance, whose default is 0.' },
    ],
    impact: {
      health: 'This chart shows the rate curve and kink; withdrawal and FX eligibility are reported elsewhere on the page.',
      sustainability: 'The carry badge and recommendation table use full finite-loop margin rather than the visual distance between lines alone.',
      profitability: 'Moving Rate at Target changes borrow APY and therefore changes the calculated margin shown in the other outputs.',
    },
  },

  fxRiskCard: {
    title: 'FX Risk Overlay',
    oneLiner: 'A separate pass/fail view of the 30-day USD/TRY stress drawdown at the chosen z and the finite-loop leverage. It is an eligibility gate, not a cost in carry APY.',
    axes: { x: 'KPI tiles', y: 'percent or pass/fail' },
    definitions: [
      { term: 'σ annual (data)', definition: 'Measured annualized USD/TRY vol from embedded TRY=X history. Read-only — refresh with npm run fx:build.' },
      { term: 'Stress z', definition: 'How far into the tail to stress: 1.65σ ≈ 95th-pct 30-day move, 2.33σ ≈ 99th. Slider on /utilization (default 1.65).' },
      { term: '30-day stress drawdown', definition: 'σ_annual × √(30/365) × z. The USD/TRY move the loop is being stress-tested against. At σ=16.8% and z=1.65 this is ≈ 7.9%.' },
      { term: 'HF headroom', definition: '1 − LLTV/hfBuffer. The collateral cushion between the looper\'s borrowed share and the liquidation boundary at the chosen HF buffer.' },
      { term: 'Levered drawdown', definition: 'effectiveLeverage × stress drawdown. The actual hit to collateral value at full leverage in the stress scenario.' },
      { term: 'FX safe', definition: 'Pass/fail: levered drawdown < HF headroom. This calculation is independent of u_target under the current solver.' },
    ],
    impact: {
      health: 'A failed FX badge blocks the recommendation for all candidate targets until an input to this gate changes.',
      sustainability: 'This card separates the modeled carry gate from the modeled FX-stress gate.',
      profitability: 'Stress z does not change carry APY. HF buffer changes both leverage costs and the FX-gate result.',
    },
  },

  irmHeatmap: {
    title: 'IRM Sensitivity Heatmap',
    oneLiner: 'A 10×10 sensitivity grid of (u_target, Rate at Target) combinations, extending to 95% utilization to show the rate response above the fixed 90% kink. Green cells satisfy loopMargin7d > 0 using finite leverage, borrow cost, 30 bps slippage, and HF idle cost. FX and withdrawal coverage are separate gates.',
    axes: { x: 'u_target sensitivity point (50%–95%)', y: 'Rate at Target / rTargetIRM (1%–10%)' },
    definitions: [
      { term: 'green cell', definition: 'loopMargin7d > 0 after the costs included by the finite-loop carry formula.' },
      { term: 'red cell', definition: 'loopMargin7d ≤ 0 under the same finite-loop carry formula.' },
      { term: 'black outline', definition: 'Marks the cell closest to the current recommendation and selected Rate at Target anchor.' },
      { term: 'shading scope', definition: 'Color represents carry margin only. It does not show withdrawal, kink-clearance, or FX-gate results.' },
    ],
    impact: {
      health: 'The heatmap visualizes only carry-margin sign; inspect the stress and FX outputs for the other gates.',
      sustainability: 'It shows where the configured carry calculation changes from positive to non-positive as the two rate inputs move.',
      profitability: 'The grid shows how the modeled carry-margin sign responds to utilization and the IRM rate anchor.',
    },
  },

  recommendationTable: {
    title: 'Recommendation Table',
    oneLiner: 'A scorecard of displayed candidate targets (60%, 70%, 75%, 80%, 83%, 85%, 88%, and 90%) with gross supplier APY, finite-loop margins, withdrawal coverage, distance to the fixed kink, FX gate, and solver verdict.',
    axes: { x: 'displayed u_target candidates (60%–90%)', y: 'metric column' },
    definitions: [
      { term: 'Feasible verdict', definition: 'All four checks pass: loopMargin7d > 0, withdrawal coverage, configured kink clearance, and FX survival. The solver selects the highest feasible target on its 1pp sweep.' },
      { term: 'Tight verdict', definition: 'Carry margin and configured kink clearance pass, but at least one of withdrawal coverage or FX survival does not. It is not recommendation-eligible.' },
      { term: 'Infeasible verdict', definition: 'At least carry margin or configured kink clearance fails; it is not recommendation-eligible.' },
      { term: 'recommended row (highlighted)', definition: 'The highest Feasible u_target — the page\'s primary output. Highlighted so you can immediately see where the optimizer landed and compare it against adjacent rows.' },
    ],
    impact: {
      health: 'The table exposes which of the displayed candidate rows pass all four implemented checks.',
      sustainability: 'The Survives column exposes withdrawal coverage for each displayed candidate; the verdict also incorporates carry, kink, and FX checks.',
      profitability: 'The margin and gross supplier APY columns show the calculated values for each displayed candidate without forecasting realized returns.',
    },
  },
  // ── SwapLiquidity section ────────────────────────────────────────────────
  ...SWAP_LIQUIDITY_CHARTS,
};

const sectionParam = (k: keyof SidebarInputs): ParamHelp =>
  SECTION_PARAMS[k] ?? { oneLiner: STUB_ONE_LINER };

// Hand-listing every SidebarInputs key both pins the contract and lets
// TS catch typos against the type.
export const PARAM_HELP: Record<keyof SidebarInputs, ParamHelp> = {
  witryTVL_USD: sectionParam('witryTVL_USD'),
  lltv: sectionParam('lltv'),
  targetUtilization: sectionParam('targetUtilization'),
  borrowerLTVAlpha: sectionParam('borrowerLTVAlpha'),
  borrowerLTVBeta: sectionParam('borrowerLTVBeta'),
  witryYieldAnnual: sectionParam('witryYieldAnnual'),
  witryYieldUSD_7d: sectionParam('witryYieldUSD_7d'),
  witryYieldUSD_30d: sectionParam('witryYieldUSD_30d'),
  hfBuffer: sectionParam('hfBuffer'),
  loopCount: sectionParam('loopCount'),
  usdtryBaseline: sectionParam('usdtryBaseline'),
  historicalPeriod: sectionParam('historicalPeriod'),
  simulationMode: sectionParam('simulationMode'),
  simulationHorizonDays: sectionParam('simulationHorizonDays'),
  pathCount: sectionParam('pathCount'),
  tryShockPct: sectionParam('tryShockPct'),
  supplyIncentiveBudgetMonthly_USD: sectionParam('supplyIncentiveBudgetMonthly_USD'),
  borrowerIncentiveBudgetMonthly_USD: sectionParam('borrowerIncentiveBudgetMonthly_USD'),
  performanceFee: sectionParam('performanceFee'),
  managementFee: sectionParam('managementFee'),
  safetyMargin: sectionParam('safetyMargin'),
  preLiquidationEnabled: sectionParam('preLiquidationEnabled'),
  preLLTVOffset: sectionParam('preLiquidationEnabled'),
  preLCF1: sectionParam('preLiquidationEnabled'),
  preLCF2: sectionParam('preLiquidationEnabled'),
  preLIF1: sectionParam('preLiquidationEnabled'),
  lltvDrawdownPercentile: sectionParam('safetyMargin'),
  blockBootstrap: sectionParam('blockBootstrap'),
  seed: sectionParam('seed'),
  poolFeeTier: sectionParam('poolFeeTier'),
  poolTVL_USD: sectionParam('poolTVL_USD'),
  bandSplitCore: sectionParam('bandSplitCore'),
  bandSplitAbsorb: sectionParam('bandSplitAbsorb'),
  bandCoreLowerPct: sectionParam('bandCoreLowerPct'),
  bandCoreUpperPct: sectionParam('bandCoreUpperPct'),
  bandAbsorbLowerPct: sectionParam('bandAbsorbLowerPct'),
  bandAbsorbUpperPct: sectionParam('bandAbsorbUpperPct'),
  bandTailLowerPct: sectionParam('bandTailLowerPct'),
  bandTailUpperPct: sectionParam('bandTailUpperPct'),
  swapSellUSD: sectionParam('swapSellUSD'),
};

export const KPI_HELP: Record<KpiKey, KpiHelp> = Object.fromEntries(
  KPI_KEYS.map((k) => [k, SECTION_KPIS[k] ?? STUB_KPI]),
) as Record<KpiKey, KpiHelp>;

export const CHART_HELP: Record<ChartKey, ChartHelp> = Object.fromEntries(
  CHART_KEYS.map((k) => [k, SECTION_CHARTS[k] ?? STUB_CHART]),
) as Record<ChartKey, ChartHelp>;

/**
 * Which /help/<section> page a sidebar param's "More info" link points at.
 * Mirrors the section grouping in the Sidebar component.
 */
export const PARAM_SECTION: Record<keyof SidebarInputs, HelpSection> = {
  witryTVL_USD: 'liquidity-need',
  lltv: 'liquidity-need',
  targetUtilization: 'liquidity-need',
  borrowerLTVAlpha: 'liquidity-need',
  borrowerLTVBeta: 'liquidity-need',
  witryYieldAnnual: 'fx-risk',
  witryYieldUSD_7d: 'utilization',
  witryYieldUSD_30d: 'utilization',
  hfBuffer: 'utilization',
  loopCount: 'utilization',
  usdtryBaseline: 'fx-risk',
  historicalPeriod: 'fx-risk',
  simulationMode: 'fx-risk',
  simulationHorizonDays: 'fx-risk',
  pathCount: 'fx-risk',
  tryShockPct: 'fx-risk',
  blockBootstrap: 'fx-risk',
  seed: 'fx-risk',
  supplyIncentiveBudgetMonthly_USD: 'strategy',
  borrowerIncentiveBudgetMonthly_USD: 'strategy',
  performanceFee: 'strategy',
  managementFee: 'strategy',
  safetyMargin: 'liquidation',
  preLiquidationEnabled: 'liquidation',
  preLLTVOffset: 'liquidation',
  preLCF1: 'liquidation',
  preLCF2: 'liquidation',
  preLIF1: 'liquidation',
  lltvDrawdownPercentile: 'liquidation',
  poolFeeTier: 'swap-liquidity',
  poolTVL_USD: 'swap-liquidity',
  bandSplitCore: 'swap-liquidity',
  bandSplitAbsorb: 'swap-liquidity',
  bandCoreLowerPct: 'swap-liquidity',
  bandCoreUpperPct: 'swap-liquidity',
  bandAbsorbLowerPct: 'swap-liquidity',
  bandAbsorbUpperPct: 'swap-liquidity',
  bandTailLowerPct: 'swap-liquidity',
  bandTailUpperPct: 'swap-liquidity',
  swapSellUSD: 'swap-liquidity',
};
