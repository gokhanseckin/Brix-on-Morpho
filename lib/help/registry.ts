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
};

const SECTION_KPIS: Partial<Record<KpiKey, KpiHelp>> = {
  ...LIQUIDITY_NEED_KPIS,
  ...FX_RISK_KPIS,
  ...STRATEGY_KPIS,
  ...LIQUIDATION_KPIS,
  ...VAULT_KPIS,
  // ── Utilization section (10 outputs + 3 slider inputs) ───────────────────

  recommendedUTarget: {
    title: 'Recommended target utilization',
    oneLiner: 'The highest utilization the vault can target without breaking three rules: loopers still earn more than just holding wiTRY, lenders can still withdraw under stress, and borrow rates are safely below the IRM kink at u=0.9. At default settings this lands at 80%.',
    formula: {
      plain: [
        'recommended = max u ∈ [0.50, 0.90] such that:',
        '  1. loopMargin7d > 0         (looping beats holding)',
        '  2. bufferUSD ≥ stressWithdrawalUSD  (survives stress)',
        '  3. (0.9 − u) ≥ 0.07        (7pp kink clearance)',
        '',
        '// Example at defaults (LLTV=0.86, HF=1.5, stress=20%, r_target=4%,',
        '//   wiTRY 7d yield=6.31%, TVL=$10M):',
        '//   u=0.80 → loopMargin7d ≈ +2.1% ✓, buffer=$2M ≥ stress=$2M ✓,',
        '//   distance=0.10 ≥ 0.07 ✓  →  recommended = 0.80',
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
      { term: 'utilization (u)', definition: 'The fraction of total USDM supply that is currently borrowed. u=0.80 means 80% is lent out; 20% sits idle and can be withdrawn immediately.' },
      { term: 'IRM kink', definition: 'At u=0.9 the AdaptiveCurveIRM switches from a gentle curve to a steep exponential — borrow rates roughly quadruple in the next 10pp. The kink acts as a built-in circuit breaker that discourages over-utilization.' },
      { term: 'loop margin', definition: 'Net looper APY minus the simple wiTRY hold APY. When this is positive, leveraged looping beats holding; when it goes negative, loopers exit and borrowing demand collapses.' },
      { term: 'kink clearance', definition: 'The minimum gap (0.07 = 7pp) kept between u_target and the kink. Without this buffer, a small borrowing surge would push the vault into punishing rate territory.' },
      { term: 'stress survival', definition: 'The condition that idle USDM (the 1 − u_target fraction) is large enough to honor the simulated single-day mass withdrawal without pausing redemptions.' },
    ],
    impact: {
      health: 'Raising u_target shrinks the idle buffer, so a TRY shock that forces liquidations has less free liquidity to absorb panic withdrawals — directly raising the probability that redemptions pause.',
      sustainability: 'This is the single number that gates all three safety constraints simultaneously; lowering stress % or raising HF buffer both allow a higher recommended value here.',
      profitability: 'Each 5pp increase in recommendedUTarget raises supplierAPYAtTarget proportionally (e.g. from 2.74% at u=0.80 to 3.09% at u=0.85 at defaults) and widens loopMargin7d.',
    },
  },

  borrowAPYAtTarget: {
    title: 'Borrow APY at target utilization',
    oneLiner: 'The interest rate a borrower pays when the vault runs at the recommended utilization. Think of it as the cost of the USDM a loopers borrow to amplify their wiTRY position. At defaults (u=0.80, r_target=4%) this is ≈3.43%.',
    formula: {
      plain: [
        'borrowAPY = adaptiveCurveIRM(u_target, r_target)',
        '',
        'For u ≤ 0.9 (below kink):',
        '  K1 = ln(4) / 0.9',
        '  borrowAPY = (r_target / 4) × exp(K1 × u)',
        '',
        'For u > 0.9 (above kink):',
        '  K2 = ln(4) / 0.1',
        '  borrowAPY = r_target × exp(K2 × (u − 0.9))',
        '',
        '// Example at defaults (r_target=4%, u_target=0.80):',
        '//   K1 = ln(4)/0.9 ≈ 1.5404',
        '//   borrowAPY = (0.04/4) × exp(1.5404 × 0.80) ≈ 3.43%',
        '// At r_target=8%, u_target=0.80:',
        '//   borrowAPY ≈ 6.86% — already above wiTRY 7d yield of 6.31%,',
        '//   so looping is unprofitable.',
      ].join('\n'),
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
      { name: 'rTargetOverride', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'AdaptiveCurveIRM', definition: 'Morpho Blue\'s interest rate model. It\'s a two-segment exponential curve anchored so the rate equals r_target exactly at u=0.9. Below the kink rates are gentle; above the kink they escalate rapidly to push utilization back down.' },
      { term: 'r_target', definition: 'The IRM\'s anchor rate: the borrow APY the model is calibrated to produce at u=0.9. Changing it scales the entire curve up or down proportionally.' },
      { term: 'kink', definition: 'At u=0.9 the IRM switches formula. Below it: a mild exponential starting at r_target/4. Above it: a steep exponential starting at r_target. The effect is that rates roughly quadruple between u=0.9 and u=1.0.' },
    ],
    impact: {
      health: 'A borrow APY that is far below wiTRY yield keeps loopers in their positions even during small TRY dips, sustaining utilization but also maintaining leveraged exposure during drawdowns.',
      sustainability: 'If borrowAPYAtTarget creeps above witryYieldUSD_7d, looperNetAPY goes negative, loopMargin7d turns red, and organic borrowing demand disappears — supplierAPYAtTarget then collapses too.',
      profitability: 'Lowering r_target by 1pp lowers borrowAPYAtTarget and directly widens loopMargin7d by roughly the same amount, improving looperNetAPY and driving higher realized utilization.',
    },
  },

  supplierAPYAtTarget: {
    title: 'Supplier APY at target utilization',
    oneLiner: 'What a USDM depositor earns annually when the vault runs at the recommended utilization. It\'s simply the borrow rate times the fraction that\'s lent out — idle capital earns nothing. At defaults (u=0.80, borrowAPY≈3.43%) this is ≈2.74%.',
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
      health: 'Higher supplierAPYAtTarget attracts larger USDM deposits, which grows TVL, increases liquidityBufferUSD in absolute terms, and makes the vault more resilient to large redemptions.',
      sustainability: 'If supplierAPYAtTarget falls below prevailing USD risk-free rates, depositors will withdraw to seek better yield elsewhere, shrinking TVL and eventually breaking the stress test.',
      profitability: 'This is the headline return for USDM lenders. It rises when either borrowAPYAtTarget goes up or recommendedUTarget goes up — both increase supplier income proportionally.',
    },
  },

  loopMargin7d: {
    title: 'Loop margin (7-day)',
    oneLiner: 'The extra return a looper earns versus simply holding wiTRY without any leverage. Positive means looping is worth the effort and borrow cost; zero or negative means no rational looper will borrow.',
    formula: {
      plain: [
        'loopMargin7d = looperNetAPY − witryYieldUSD_7d',
        '',
        '// Example at defaults (looperNetAPY≈8.40%, witryYieldUSD_7d=6.31%):',
        '//   loopMargin7d ≈ 8.40% − 6.31% = +2.09%',
        '// If borrowAPY rises to 6.5% (e.g. r_target raised to ~7.5%):',
        '//   looperNetAPY ≈ 6.28%  →  loopMargin7d ≈ −0.03%  (looping unviable)',
      ].join('\n'),
    },
    params: [
      { name: 'looperNetAPY', source: 'derived' },
      { name: 'witryYieldUSD_7d', source: 'sidebar', ref: 'witryYieldUSD_7d' },
    ],
    definitions: [
      { term: 'looper', definition: 'A user who repeatedly deposits wiTRY, borrows USDM, swaps USDM back into wiTRY, and re-deposits — building up leveraged exposure to the wiTRY yield. They are the vault\'s primary borrowers.' },
      { term: 'loop margin', definition: 'The alpha a looper earns above holding wiTRY unlevered. When ≤ 0, no rational looper borrows, and the vault misses its utilization target.' },
      { term: 'witryYieldUSD_7d', definition: 'The 7-day trailing USD-equivalent APY from holding wiTRY (iTRY staking yield converted to USD terms). This is the opportunity cost a looper compares against looperNetAPY.' },
    ],
    impact: {
      health: 'When loopMargin7d turns negative, loopers close positions, utilization drops below target, and the vault accumulates more idle buffer — actually improving short-term stress survival but at the cost of underutilization.',
      sustainability: 'Positive loopMargin7d is the organic pull that keeps the vault at its target utilization without incentive subsidies; it must stay above zero for any given recommendedUTarget to be self-sustaining.',
      profitability: 'loopMargin7d directly sets how attractive the vault is relative to simply holding. If it falls below 1%, looper interest wanes; below 0%, borrowing demand collapses and supplierAPYAtTarget drops proportionally.',
    },
  },

  distanceToKink: {
    title: 'Distance to IRM kink',
    oneLiner: 'How much headroom exists between the target utilization and the IRM\'s danger zone at u=0.9. At u=0.80 this is 0.10 (10pp) — the minimum required is 0.07.',
    formula: {
      plain: [
        'distanceToKink = 0.9 − u_target',
        '',
        '// Example at defaults (u_target=0.80):',
        '//   distanceToKink = 0.9 − 0.80 = 0.10  (10pp headroom, passes ≥ 0.07 gate)',
        '// At u_target=0.85:',
        '//   distanceToKink = 0.05  (fails the 0.07 minimum — not recommended)',
      ].join('\n'),
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
    ],
    definitions: [
      { term: 'IRM kink', definition: 'At u=0.9 the AdaptiveCurveIRM switches to a steep exponential segment. Going from u=0.90 to u=1.0 causes borrow rates to rise by 4× — this is intentional, to aggressively deter over-utilization.' },
      { term: 'kink clearance (0.07)', definition: 'A hard minimum gap between u_target and the kink. It provides a 7pp buffer so that normal day-to-day demand variance — borrowers slightly over-shooting target — does not accidentally trigger the super-linear rate escalation.' },
    ],
    impact: {
      health: 'If distanceToKink shrinks below 0.07, the recommended target is disqualified and recommendedUTarget steps down to 0.83 (= 0.9 − 0.07), regardless of what loop economics say.',
      sustainability: 'A wider kink gap means withdrawal spikes or borrow surges have more room to be absorbed by rate increases rather than by rate shocks that panic loopers into exiting all at once.',
      profitability: 'Forcing a larger kink gap (e.g. 0.10 instead of 0.07) directly caps recommendedUTarget and therefore supplierAPYAtTarget — a deliberate trade-off of yield for rate stability.',
    },
  },

  liquidityBufferUSD: {
    title: 'Liquidity buffer (USD)',
    oneLiner: 'The dollar amount of USDM sitting idle (not lent out) at the recommended utilization — cash that can be withdrawn immediately without touching any borrower positions. At u=0.80 with $10M TVL, this is $2M.',
    formula: {
      plain: [
        'liquidityBufferUSD = (1 − u_target) × TVL_USDM',
        '',
        '// Example at defaults (u_target=0.80, TVL=$10M):',
        '//   liquidityBufferUSD = (1 − 0.80) × $10M = $2,000,000',
        '// At u_target=0.85:',
        '//   liquidityBufferUSD = 0.15 × $10M = $1,500,000  (−$500k)',
      ].join('\n'),
    },
    params: [
      { name: 'recommendedUTarget', source: 'derived' },
      { name: 'witryTVL_USD × targetUtilization (vault size)', source: 'sidebar', ref: 'witryTVL_USD' },
    ],
    definitions: [
      { term: 'TVL_USDM', definition: 'Total USDM supply deposited in the vault. It is inferred from the wiTRY TVL and targetUtilization sidebar inputs.' },
      { term: 'idle capital', definition: 'The (1 − u) fraction of USDM that has not been borrowed. It earns zero interest but can be redeemed by any supplier at any time without waiting for borrowers to repay.' },
    ],
    impact: {
      health: 'Larger liquidityBufferUSD gives liquidators and redemption requesters more time before a TRY-shock-driven withdrawal wave exhausts available capital — reducing the risk of a redemption pause.',
      sustainability: 'liquidityBufferUSD must be ≥ stressWithdrawalUSD for survivesStress to pass; if it falls below, recommendedUTarget is stepped down until the buffer recovers.',
      profitability: 'Every $1M of extra buffer means $1M less earning borrowAPY, so supplierAPYAtTarget falls proportionally — the direct trade-off between safety and yield.',
    },
  },

  stressWithdrawalUSD: {
    title: 'Stress withdrawal (USD)',
    oneLiner: 'The worst-case single-day redemption the vault is designed to survive — set as a percentage of total USDM supply. At 20% stress with $10M TVL, this is $2M.',
    formula: {
      plain: [
        'stressWithdrawalUSD = stressPctOfSupply × TVL_USDM',
        '',
        '// Example at defaults (stressPct=20%, TVL=$10M):',
        '//   stressWithdrawalUSD = 0.20 × $10M = $2,000,000',
        '// Raising stress to 30% (same TVL):',
        '//   stressWithdrawalUSD = $3,000,000  →  buffer at u=0.80 ($2M) fails,',
        '//   recommendedUTarget steps down to ≈ 0.70.',
      ].join('\n'),
    },
    params: [
      { name: 'stressPctOfSupply', source: 'derived', note: 'page slider on /utilization' },
      { name: 'witryTVL_USD × targetUtilization (vault size)', source: 'sidebar', ref: 'witryTVL_USD' },
    ],
    definitions: [
      { term: 'stress scenario', definition: 'A model of coordinated single-day withdrawals — e.g., during a TRY crisis when many lenders simultaneously want out. The vault must honor this without forcing borrowers to repay or pausing redemptions.' },
      { term: 'stressPctOfSupply', definition: 'The slider-controlled fraction of total USDM supply assumed to withdraw in one day. Historical Morpho market data suggests 10–25% covers most stress events; 30–40% is extreme-tail sizing.' },
    ],
    impact: {
      health: 'Each 5pp added to stressPct raises stressWithdrawalUSD by 5% of TVL; once it exceeds liquidityBufferUSD, survivesStress flips to ✗ and the page lowers recommendedUTarget until the buffer catches up.',
      sustainability: 'Setting stress too low (< 10%) understates real TRY-crisis withdrawal risk; too high (> 40%) forces unnecessarily low utilization and compresses supplier yield without commensurate safety gain.',
      profitability: 'Directly bounds the maximum feasible recommendedUTarget: max feasible u = 1 − stressPct. At 20% stress the ceiling is 0.80; at 30% it is 0.70 — costing ≈ 0.34pp of supplierAPYAtTarget per 10pp of extra stress.',
    },
  },

  survivesStress: {
    title: 'Survives stress?',
    oneLiner: 'A simple pass/fail check: does the idle USDM buffer cover the simulated withdrawal? At defaults (u=0.80, stress=20%, $10M TVL) the buffer exactly equals the stress amount — it passes.',
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
      { term: 'stress survival gate', definition: 'One of the three hard constraints a candidate u_target must pass to be "recommended". Failing it means that utilization level is unsafe under the configured stress scenario.' },
      { term: 'pass condition', definition: 'The buffer fraction (1 − u_target) must be ≥ the stress fraction. This simplifies to: u_target ≤ 1 − stressPct. At 20% stress, the ceiling is u=0.80.' },
    ],
    impact: {
      health: 'When this flips to ✗, the solver immediately steps recommendedUTarget down to the nearest u where it passes — the vault is not allowed to operate at an unsafe utilization target.',
      sustainability: 'A vault with survivesStress=✗ at its actual operating utilization would need to call borrowers to repay during a withdrawal event, which is an operational failure and damages lender trust.',
      profitability: 'Passing this gate is what allows higher u_targets to be recommended at all. Each percentage point of lower stress widens the feasible u_target range by the same amount, improving supplierAPYAtTarget.',
    },
  },

  looperNetAPY: {
    title: 'Looper net APY',
    oneLiner: 'The actual annual return a looper earns after paying borrow costs, DEX slippage, and accounting for the capital that must be kept idle as a health-factor cushion. At defaults this is ≈8.40%.',
    formula: {
      plain: [
        'effectiveLeverage  = 1 / (1 − LLTV / hfBuffer)',
        'borrowedShare      = effectiveLeverage − 1',
        'grossLoopAPY       = effectiveLeverage × witryYieldUSD_7d',
        'borrowCost         = borrowedShare × borrowAPY',
        'slippageCost       = borrowedShare × (30 / 10_000)',
        'hfIdleCost         = witryYieldUSD_7d × (1 − 1/hfBuffer) × borrowedShare',
        'looperNetAPY       = grossLoopAPY − borrowCost − slippageCost − hfIdleCost',
        '',
        '// Example at defaults (LLTV=0.86, HF=1.5, borrowAPY=3.43%,',
        '//   witryYieldUSD_7d=6.31%):',
        '//   effectiveLeverage = 1/(1 − 0.86/1.5) = 1/0.4267 ≈ 2.344×',
        '//   borrowedShare     = 1.344',
        '//   grossLoopAPY      = 2.344 × 6.31% ≈ 14.79%',
        '//   borrowCost        = 1.344 × 3.43% ≈ 4.61%',
        '//   slippageCost      = 1.344 × 0.30% ≈ 0.40%',
        '//   hfIdleCost        = 6.31% × (1 − 1/1.5) × 1.344 ≈ 1.38%',
        '//   looperNetAPY      ≈ 14.79 − 4.61 − 0.40 − 1.38 ≈ 8.40%',
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
      { term: 'effective leverage', definition: 'How many dollars of wiTRY exposure the looper ends up with per dollar of their own equity. At LLTV=0.86 and HF=1.5, this is ≈2.34×: put in $1k, end up controlling $2.34k of wiTRY.' },
      { term: 'borrowedShare', definition: 'The fraction of total exposure that was borrowed rather than owned: effectiveLeverage − 1. At 2.34×, borrowedShare ≈ 1.34 — meaning $1.34 borrowed for every $1 of equity.' },
      { term: 'hfIdleCost', definition: 'The opportunity cost of the collateral headroom. To keep HF = hfBuffer, the looper cannot use all their wiTRY as productive leverage — some must sit as uncollateralized reserve. That capital earns wiTRY yield but does not amplify returns.' },
      { term: 'slippage cost', definition: 'Each "loop" (borrow USDM → swap → re-deposit) incurs DEX friction. Fixed at 30 bps of the borrowed notional per full loop cycle.' },
    ],
    impact: {
      health: 'Low looperNetAPY reduces the incentive for loopers to maintain leveraged positions through TRY drawdowns; they voluntarily deleverage earlier, creating cascading sell pressure on wiTRY.',
      sustainability: 'looperNetAPY must exceed witryYieldUSD_7d for loopMargin7d to stay positive — if it does not, borrowing demand evaporates and the vault drifts below its recommendedUTarget.',
      profitability: 'This is the single most important number for borrower-side demand. Improving it 1pp (e.g. by lowering r_target 0.5pp) translates into higher realized utilization and higher supplierAPYAtTarget.',
    },
  },

  effectiveLeverage: {
    title: 'Effective leverage',
    oneLiner: 'How many times a looper multiplies their wiTRY exposure through repeated borrow-and-redeposit. Limited by LLTV and the health-factor buffer they maintain. At LLTV=0.86 and HF=1.5, this is ≈2.34×.',
    formula: {
      plain: [
        'effectiveLeverage = 1 / (1 − LLTV / hfBuffer)',
        '',
        '// Example at defaults (LLTV=0.86, hfBuffer=1.5):',
        '//   debtFraction      = 0.86 / 1.5 ≈ 0.573',
        '//   effectiveLeverage = 1 / (1 − 0.573) ≈ 2.34×',
        '// With hfBuffer=1.2 (more aggressive):',
        '//   debtFraction      = 0.86 / 1.2 ≈ 0.717',
        '//   effectiveLeverage = 1 / (1 − 0.717) ≈ 3.53×  (+1.19× more exposure)',
      ].join('\n'),
    },
    params: [
      { name: 'lltv', source: 'sidebar', ref: 'lltv' },
      { name: 'hfBuffer', source: 'derived', note: 'page slider on /utilization' },
    ],
    definitions: [
      { term: 'LLTV (Liquidation LTV)', definition: 'The maximum loan-to-value ratio before Morpho flags a position for liquidation. Set by Morpho governance per market. At LLTV=0.86, a position with $100 of collateral can borrow up to $86 before liquidation.' },
      { term: 'hfBuffer', definition: 'The safety multiplier the looper keeps voluntarily: they borrow only LLTV/hfBuffer of their collateral value. hfBuffer=1.5 means they stay at 67% of their LLTV limit (HF = 1.5, where HF=1.0 means liquidation threshold). This leaves 33% headroom before forced liquidation.' },
      { term: 'debt fraction', definition: 'LLTV / hfBuffer — the share of collateral value the looper actually borrows. The rest (1 − debtFraction) is equity. Effective leverage is the reciprocal of the equity share.' },
    ],
    impact: {
      health: 'Higher effectiveLeverage amplifies looper losses during TRY price drops — a 10% TRY decline hits 2.34× harder at 2.34× leverage, increasing the likelihood that loopers breach their actual LLTV and face forced liquidation.',
      sustainability: 'effectiveLeverage directly sets how much USDM each unit of looper equity demands (borrowedShare = leverage − 1), sizing the borrowing demand that fills vault utilization toward recommendedUTarget.',
      profitability: 'Leverage is the multiplier on gross loop APY: at 2.34× and 6.31% wiTRY yield, gross is 14.79%; at 3.53× it would be 22.27% — but borrow and slippage costs scale too, so net improvement is smaller.',
    },
  },

  // ── Utilization page slider inputs ────────────────────────────────────────

  stressPctOfSupplyInput: {
    title: 'Stress withdrawal % (slider)',
    oneLiner: 'What fraction of USDM supply you assume could be withdrawn in a single day. The vault must keep that much idle at all times. At 20% with $10M TVL, $2M must sit unborrowed.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 5%–50%, default: 20%, step: 1%.',
        '',
        'Downstream: stressWithdrawalUSD = stressPctOfSupply × TVL_USDM',
        '            survivesStress      = (liquidityBufferUSD ≥ stressWithdrawalUSD)',
        '            recommendedUTarget  ≤ 1 − stressPctOfSupply',
        '',
        '// Example at defaults (stressPct=20%, TVL=$10M):',
        '//   stressWithdrawalUSD = $2,000,000',
        '//   max feasible u_target = 1 − 0.20 = 0.80  →  recommendedUTarget = 0.80',
        '// Raise to 30%:',
        '//   stressWithdrawalUSD = $3,000,000',
        '//   u=0.80 now fails (buffer=$2M < stress=$3M)',
        '//   recommendedUTarget steps down to ≈ 0.70',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'stress scenario', definition: 'A model of coordinated lender withdrawals in one day — for example, during a TRY devaluation when many depositors want out at once. The vault must be able to honor this without asking borrowers to repay early.' },
      { term: 'liquidityBufferUSD', definition: 'The idle USDM at a given utilization: (1 − u) × TVL. This is what pays withdrawals. If the buffer is smaller than the stress amount, the vault cannot survive the stress event at that utilization.' },
    ],
    impact: {
      health: 'Each 5pp increase raises stressWithdrawalUSD by 5% of TVL; once it exceeds liquidityBufferUSD, survivesStress flips to ✗ and recommendedUTarget steps down to restore the buffer.',
      sustainability: 'A 20% setting means u_target is bounded at 0.80. Lowering it to 10% unlocks u_target up to 0.90 (less conservative); raising it to 40% caps u_target at 0.60 (very conservative).',
      profitability: 'Higher stress % directly lowers the maximum achievable recommendedUTarget, suppressing both supplierAPYAtTarget and loopMargin7d — a deliberate yield-for-safety trade-off.',
    },
  },

  hfBufferInput: {
    title: 'Looper HF buffer (slider)',
    oneLiner: 'How conservatively loopers manage their leverage. HF=1.5 means they borrow only 67% of their max capacity, keeping 33% headroom before forced liquidation. Lower buffer = more leverage = higher looperNetAPY but closer to the liquidation threshold.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 1.1×–2.5×, default: 1.5×, step: 0.05×.',
        '',
        'Downstream: effectiveLeverage = 1 / (1 − LLTV / hfBuffer)',
        '            looperNetAPY       = f(effectiveLeverage, borrowAPY, witryYield)',
        '            loopMargin7d       = looperNetAPY − witryYieldUSD_7d',
        '',
        '// Example at defaults (LLTV=0.86, hfBuffer=1.5):',
        '//   effectiveLeverage = 1 / (1 − 0.86/1.5) ≈ 2.34×',
        '//   looperNetAPY      ≈ 8.40%',
        '// Lower to hfBuffer=1.2 (more aggressive):',
        '//   effectiveLeverage = 1 / (1 − 0.86/1.2) ≈ 3.53×',
        '//   grossLoopAPY rises but borrow/slippage costs also rise proportionally',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'HF / health factor', definition: 'The ratio of a position\'s collateral value to its debt, normalized by LLTV. HF = (collateral × LLTV) / debt. HF=1.0 means the position is exactly at the liquidation boundary. HF=1.5 means the borrower could absorb a 33% collateral drop before forced liquidation.' },
      { term: 'hfBuffer', definition: 'The HF loopers target voluntarily. By borrowing only LLTV/hfBuffer of their collateral, they keep HF = hfBuffer. Higher buffer = less leverage = more safety margin.' },
      { term: 'effective leverage', definition: 'Total wiTRY exposure per unit of equity, derived as 1/(1 − LLTV/hfBuffer). Lower hfBuffer → higher leverage → higher gross APY but also higher borrow/slippage cost and narrower safety margin.' },
    ],
    impact: {
      health: 'Lower hfBuffer increases effectiveLeverage and the probability that a TRY drawdown breaches the LLTV threshold, raising badDebtP95USD in the main simulator — the two tools are complementary.',
      sustainability: 'hfBuffer controls how much USDM each unit of looper equity demands. Lower buffer → more borrowing demand → higher realized utilization → higher supplierAPYAtTarget, but thinner safety margins.',
      profitability: 'Lowering hfBuffer from 1.5× to 1.2× increases effectiveLeverage from 2.34× to 3.53×, raising looperNetAPY and loopMargin7d — but the irmHeatmap may show the new setting is closer to the unprofitable red zone.',
    },
  },

  rTargetOverrideInput: {
    title: 'r_target override (slider)',
    oneLiner: 'The anchor interest rate for the AdaptiveCurveIRM — the borrow APY the model is calibrated to hit when utilization is at 90%. Lower r_target makes borrowing cheaper, which helps loopers. Higher r_target generates more revenue for suppliers but can make looping unprofitable. Default 4%.',
    formula: {
      plain: [
        'Adjustable input (slider). Range: 1%–10%, default: 4%, step: 0.5%.',
        '',
        'Downstream: borrowAPYAtTarget = adaptiveCurveIRM(u_target, r_target)',
        '            looperNetAPY       depends on borrowAPYAtTarget',
        '            irmHeatmap         redraws entirely when r_target changes',
        '            recommendedUTarget may change if loopMargin7d crosses zero',
        '',
        '// Example at r_target=4%, u_target=0.80:',
        '//   K1 = ln(4)/0.9 ≈ 1.5404',
        '//   borrowAPYAtTarget = (0.04/4) × exp(1.5404 × 0.80) ≈ 3.43%',
        '//   loopMargin7d ≈ +2.09%  (profitable)',
        '// Raise r_target to 8%:',
        '//   borrowAPYAtTarget ≈ 6.86%  >  witryYieldUSD_7d=6.31%',
        '//   loopMargin7d < 0  →  looping unprofitable, recommendedUTarget drops',
      ].join('\n'),
    },
    params: [],
    definitions: [
      { term: 'AdaptiveCurveIRM', definition: 'Morpho Blue\'s interest rate model — a two-segment exponential curve that maps utilization to a borrow APY. The entire curve scales proportionally with r_target.' },
      { term: 'r_target', definition: 'The IRM anchor: borrow APY exactly equals r_target when u=0.9 (the kink). Below the kink, the rate starts at r_target/4 at u=0 and rises smoothly. Above the kink it escalates steeply. Scaling r_target scales the whole curve.' },
      { term: 'kink (u=0.9)', definition: 'The utilization level where the IRM switches from a gentle to a steep exponential. At the kink, borrow APY = r_target. The two segments are calibrated so the curve is continuous at u=0.9.' },
    ],
    impact: {
      health: 'Higher r_target raises borrowAPYAtTarget, which squeezes looperNetAPY and may tip loopMargin7d negative — loopers exit, utilization falls, and the vault accumulates more idle buffer (ironically improving stress survival).',
      sustainability: 'r_target is the primary dial for balancing supply yield vs. looper viability. The irmHeatmap shows the full (u_target, r_target) grid — the recommended point should stay in the green zone with margin.',
      profitability: 'Each 1pp increase in r_target raises borrowAPYAtTarget by roughly 0.86pp at u=0.80 and lowers looperNetAPY by the same amount × borrowedShare — directly compressing loopMargin7d and threatening recommendedUTarget.',
    },
  },
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
    oneLiner: 'A line chart showing borrow APY (blue) across the 50%–90% utilization range, with two horizontal reference lines for wiTRY 7d yield (green dashed) and 30d yield (orange dashed), and a vertical red marker at the IRM kink (u=0.9). Where the blue line is below the green dashed line, looping is profitable. Where it crosses above, looping loses money.',
    axes: { x: 'u_target — candidate utilization (50%–90%)', y: 'APY (%) — borrow rate or wiTRY yield' },
    definitions: [
      { term: 'blue borrowAPY curve', definition: 'The AdaptiveCurveIRM output at each u_target. It rises gently left of the kink and sharply right of it. At defaults (r_target=4%) it starts near 1.5% at u=0.5 and reaches 4% exactly at u=0.9.' },
      { term: 'green dashed line (7d yield)', definition: 'The 7-day trailing wiTRY USD yield from the sidebar — the conservative opportunity cost of not looping. The blue curve must stay below this line for looping to be rational.' },
      { term: 'orange dashed line (30d yield)', definition: 'The 30-day trailing wiTRY yield — a more stable (but typically higher) reference. It shows the wider range of looper expectations.' },
      { term: 'red vertical kink marker', definition: 'Marks u=0.9, where the IRM switches to exponential escalation. The recommended u_target must stay at least 7pp to the left of this line.' },
    ],
    impact: {
      health: 'If the blue curve crosses the green line at u≈0.82, that is the maximum utilization where loopers still make money — any target above that will underutilize. A narrow gap between the lines signals fragility to small r_target increases.',
      sustainability: 'If the green dashed line sits above the blue curve even at u=0.5, the IRM is too expensive relative to wiTRY yield and no utilization target is organically viable with the current r_target.',
      profitability: 'Moving the r_target slider down shifts the blue curve downward, widening the profitable zone to the right and enabling higher u_targets — directly visible as more green area on this chart.',
    },
  },

  liquidityStressTable: {
    title: 'Liquidity Stress Test Table',
    oneLiner: 'A table with one row per candidate u_target (50%, 55%, …, 90%) showing: the idle USDM buffer, the stress withdrawal amount, whether the buffer covers it (✓/✗), and if it fails, how many days of borrow interest it would take to refill the shortfall. Rows that fail are highlighted — this is where the vault cannot safely operate.',
    axes: { x: 'u_target candidate (50%–90%)', y: 'USD amounts and flags' },
    definitions: [
      { term: 'buffer (liquidityBufferUSD)', definition: 'Idle USDM at a given u: (1 − u) × TVL. This is the instantly-redeemable cash. At u=0.80 with $10M TVL, buffer = $2M.' },
      { term: 'stress (stressWithdrawalUSD)', definition: 'The configured single-day withdrawal to survive: stressPct × TVL. At 20% and $10M, this is $2M. Constant across all rows since TVL does not change.' },
      { term: 'survives (✓/✗)', definition: 'Whether buffer ≥ stress. Rows with ✗ cannot be recommended — the solver skips them when computing recommendedUTarget.' },
      { term: 'days to refill', definition: 'If the buffer fails, this estimates how many days of borrow interest income at that utilization it would take to close the gap. A proxy for how long the vault would be stressed if it somehow ran at that utilization.' },
    ],
    impact: {
      health: 'Rows that show ✗ indicate the vault would face a redemption shortfall during the stress event; the recommended u_target is always one of the ✓ rows, giving operators a clear cut-off.',
      sustainability: 'Raising the stress slider causes more rows to flip from ✓ to ✗, narrowing the feasible utilization range. Lowering TVL has the same effect (buffer shrinks proportionally while stress shrinks too, but the feasibility boundary is purely on the fraction, not the absolute).',
      profitability: 'The last ✓ row before the first ✗ row is the practical ceiling for recommendedUTarget — the table makes this boundary explicit rather than just showing the final answer.',
    },
  },

  loopEconomicsWaterfall: {
    title: 'Loop Economics Waterfall',
    oneLiner: 'A bar chart that breaks the looper\'s return into components, stacked left to right: Gross loop APY (tall positive bar), minus Borrow cost (negative), minus Slippage (negative), minus HF idle cost (negative), equals Net loop APY (result bar). A separate "wiTRY hold" bar shows the unlevered benchmark. If Net > Hold, the loop is worth it.',
    axes: { x: 'PnL component (gross → deductions → net → benchmark)', y: 'APY (%)' },
    definitions: [
      { term: 'Gross loop APY', definition: 'effectiveLeverage × witryYieldUSD_7d. At 2.34× leverage and 6.31% yield, this is ≈14.79% — the raw amplified return before any costs.' },
      { term: 'Borrow cost', definition: 'borrowedShare × borrowAPYAtTarget. The interest paid on USDM borrowed to create the leverage. At defaults: 1.344 × 3.43% ≈ 4.61% — the largest deduction.' },
      { term: 'Slippage', definition: 'DEX friction of 30 bps per borrowed unit per loop cycle. At defaults: 1.344 × 0.30% ≈ 0.40%.' },
      { term: 'HF idle cost', definition: 'The opportunity cost of collateral kept as health-factor headroom. That capital earns wiTRY yield but cannot be leveraged further. At defaults ≈ 1.38%.' },
      { term: 'Net loop APY', definition: 'Gross − borrow − slippage − HF idle. At defaults ≈ 8.40%.' },
      { term: 'wiTRY hold', definition: 'The unlevered 7-day wiTRY yield (6.31% at defaults). The loop is only rational if Net loop APY > this bar.' },
    ],
    impact: {
      health: 'If the Borrow cost bar is close in height to the Gross bar, the loop has thin margin; any rise in borrowAPYAtTarget (e.g., utilization briefly spiking above target) immediately flips the loop unprofitable.',
      sustainability: 'When the Net bar shrinks below the wiTRY hold bar, loopMargin7d turns negative, loopers exit, and the vault loses its organic borrowing demand — supplierAPYAtTarget collapses accordingly.',
      profitability: 'Lowering r_target shrinks the Borrow cost bar; raising LLTV or lowering hfBuffer grows the Gross bar (and Borrow/Slippage proportionally) — the waterfall shows which lever has the bigger payoff.',
    },
  },

  irmHeatmap: {
    title: 'IRM Sensitivity Heatmap',
    oneLiner: 'A 10×10 grid where each cell is a (u_target, r_target) combination. Green cells are ones where borrowAPY < wiTRY 7d yield — looping is profitable there. Red cells are unprofitable. The black outline marks the current recommended point. You want your recommended point deep in the green zone, not teetering on the edge.',
    axes: { x: 'u_target (utilization, 50%–90%)', y: 'r_target (IRM anchor rate, 1%–10%)' },
    definitions: [
      { term: 'green cell', definition: 'borrowAPY(u, r_target) < witryYieldUSD_7d — looping earns more than holding, so organic borrowing demand exists at this combination.' },
      { term: 'red cell', definition: 'borrowAPY(u, r_target) ≥ witryYieldUSD_7d — borrowing is too expensive relative to wiTRY yield; the vault would underutilize here.' },
      { term: 'black outline', definition: 'Marks the cell for the current (recommendedUTarget, rTargetOverride) — the operating point. If this outline is on the green/red boundary, you have thin margin; if it is deep green, you have headroom.' },
      { term: 'feasibility shading', definition: 'Cells that fail the stress or kink-clearance constraints (even if green for loop economics) may be additionally dimmed, indicating they fail a different gate.' },
    ],
    impact: {
      health: 'An outlined cell near the green→red boundary means a small r_target increase (e.g. governance adjusting the IRM) or a small utilization overshoot would flip the vault into unprofitable territory, causing looper exits and a liquidity stress event.',
      sustainability: 'The heatmap shows how much r_target headroom exists before organic demand disappears. If there are only 2–3 green columns at your target u, the vault is fragile to IRM parameter changes.',
      profitability: 'The lower-right corner of the grid (high u, low r_target) is maximum profitability. The heatmap lets you see at a glance how far the current operating point is from that optimum and what parameter changes would get you there.',
    },
  },

  recommendationTable: {
    title: 'Recommendation Table',
    oneLiner: 'A full side-by-side scorecard of every candidate u_target (50% to 90% in 5pp steps): borrow APY, supplier APY, loop margin (7d and 30d), liquidity buffer, stress withdrawal, survives flag, kink distance, and a final Feasible/Tight/Infeasible verdict. The recommended row is highlighted.',
    axes: { x: 'u_target candidate (50%–90%)', y: 'metric column' },
    definitions: [
      { term: 'Feasible verdict', definition: 'All three hard constraints pass: loopMargin7d > 0, survivesStress = ✓, and distanceToKink ≥ 0.07. This row is eligible to be the recommended target.' },
      { term: 'Tight verdict', definition: 'Two of three constraints pass. Typically: loopMargin and stress survival pass but distanceToKink is marginally below 0.07. This row is borderline — usable with caution, not recommended.' },
      { term: 'Infeasible verdict', definition: 'One or more hard constraints fail. A red loop margin, a failed stress test, or a kink distance below the minimum all disqualify the row.' },
      { term: 'recommended row (highlighted)', definition: 'The highest Feasible u_target — the page\'s primary output. Highlighted so you can immediately see where the optimizer landed and compare it against adjacent rows.' },
    ],
    impact: {
      health: 'If the feasible range is only one or two rows wide (e.g. only u=0.75 and u=0.80 are Feasible), the vault has little operating flexibility — tightening LLTV or lowering r_target can widen it.',
      sustainability: 'The Survives column makes visible exactly which u_targets maintain adequate liquidity under stress; operators can use this to set hard floor rules without relying on the optimizer alone.',
      profitability: 'Comparing the loop margin 7d column across Feasible rows shows the profitability cost of choosing a lower (more conservative) target — typically 0.3–0.5pp of loopMargin7d per 5pp step down in u_target.',
    },
  },
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
  usdtryBaseline: sectionParam('usdtryBaseline'),
  historicalPeriod: sectionParam('historicalPeriod'),
  simulationMode: sectionParam('simulationMode'),
  simulationHorizonDays: sectionParam('simulationHorizonDays'),
  pathCount: sectionParam('pathCount'),
  tryShockPct: sectionParam('tryShockPct'),
  incentiveBudgetMonthly_USD: sectionParam('incentiveBudgetMonthly_USD'),
  attractionRate: sectionParam('attractionRate'),
  lockPeriodDays: sectionParam('lockPeriodDays'),
  poolDepth_USD: sectionParam('poolDepth_USD'),
  performanceFee: sectionParam('performanceFee'),
  managementFee: sectionParam('managementFee'),
  safetyMargin: sectionParam('safetyMargin'),
  preLiquidationEnabled: sectionParam('preLiquidationEnabled'),
  blockBootstrap: sectionParam('blockBootstrap'),
  seed: sectionParam('seed'),
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
  usdtryBaseline: 'fx-risk',
  historicalPeriod: 'fx-risk',
  simulationMode: 'fx-risk',
  simulationHorizonDays: 'fx-risk',
  pathCount: 'fx-risk',
  tryShockPct: 'fx-risk',
  blockBootstrap: 'fx-risk',
  seed: 'fx-risk',
  incentiveBudgetMonthly_USD: 'strategy',
  attractionRate: 'strategy',
  lockPeriodDays: 'strategy',
  performanceFee: 'strategy',
  managementFee: 'strategy',
  poolDepth_USD: 'liquidation',
  safetyMargin: 'liquidation',
  preLiquidationEnabled: 'liquidation',
};
