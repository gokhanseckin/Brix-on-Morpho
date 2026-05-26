// lib/help/content/swapLiquidity.ts
// Help copy for the /swapliquidity page (section 7).
// Audience: regular software engineers. Avoid quant/statistics jargon; prefer
// plain English with a concrete number example whenever possible.
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 7)
// ---------------------------------------------------------------------------

export const SWAP_LIQUIDITY_PARAMS: Partial<Record<string, ParamHelp>> = {
  poolFeeTier: {
    oneLiner:
      'Scenario input: the AMM input fee. 0.30% uses tick spacing 60; 1.00% uses tick spacing 200. Changing it changes both fee charged and snapped band endpoints.',
    details: {
      description:
        'The code accepts fee-tier encodings 3000 and 10000. They become input fees of 0.30% and 1.00%, and tick spacings of 60 and 200. A wider spacing can move the actual tick-snapped endpoints away from the percentage offsets entered in the sidebar.',
      options: [
        { name: '0.30%', description: 'Encodes fee tier 3000 and tick spacing 60.', bestFor: 'compare a lower input fee and finer tick grid' },
        { name: '1.00%', description: 'Encodes fee tier 10000 and tick spacing 200.', bestFor: 'compare a higher input fee and coarser tick grid' },
      ],
    },
  },
  poolTVL_USD: {
    oneLiner:
      'Scenario input: configured launch value allocated across the three positions. Default is $500,000; this is not active liquidity L or measured pool TVL.',
    details: {
      description:
        'The builder divides this configured USD value among Core, Absorb, and Tail. Each allocation is converted into token amounts and Uniswap liquidity at the initial spot. Only positions whose range contains the current spot contribute to active L. The quote then calculates proceeds for the configured probe trade.',
      downstream: [
        { section: 'Pool state', effects: ['active liquidity at spot', 'per-band USD allocations'] },
        { section: 'Liquidator swap', effects: ['effective slip', 'marginal price slip', 'USDM received'] },
        { section: 'Execution shortfall', effects: ['changes shortfall results for the probe scenarios'] },
      ],
    },
  },
  bandSplitCore: {
    oneLiner:
      'Scenario input: share of configured pool capital in the Core range. Its default range is -5% to +5% of initial spot.',
    details: {
      description:
        'A narrow in-range position produces more L per allocated dollar at launch than a wide position. When a wTRY sell moves price below its lower boundary, Core no longer supplies active liquidity for additional downward movement.',
      downstream: [
        { section: 'Pool state', effects: ['active liquidity at spot', 'Core row in band table'] },
        { section: 'Liquidator swap', effects: ['slippage near spot'] },
      ],
    },
  },
  bandSplitAbsorb: {
    oneLiner:
      'Scenario input: share allocated to the default -15% to -5% band below initial spot. It adds bid depth only after price reaches its range.',
    details: {
      description:
        'At the default launch spot, the Absorb range is below spot and its position is funded on the USDM side. A simulated wTRY sell that pushes price into this range can receive USDM from it. Moving allocation here changes the computed quote; it is not a recommendation for deployed liquidity.',
      downstream: [
        { section: 'Execution shortfall', effects: ['changes repayment shortfall for off-center probe trades'] },
      ],
    },
  },
  bandCoreLowerPct: {
    oneLiner:
      'Core band lower edge as a signed fraction of spot (e.g. −0.05 = 5% below). Defines where the tight near-spot liquidity starts.',
  },
  bandCoreUpperPct: {
    oneLiner:
      'Core band upper edge as a signed fraction of spot (e.g. +0.05 = 5% above). Together with the lower edge sets the near-spot trading window.',
  },
  bandAbsorbLowerPct: {
    oneLiner:
      'Absorb band lower edge (e.g. −0.15 = 15% below spot). Push this further down to extend the catch zone for deeper crashes.',
  },
  bandAbsorbUpperPct: {
    oneLiner:
      'Absorb band upper edge (e.g. −0.05). Set equal to Core lower to close the gap, or overlap with Core for compounded depth.',
  },
  bandTailLowerPct: {
    oneLiner:
      'Tail band lower edge (e.g. −0.90 = 90% below spot). Defines how deep into a catastrophic crash the pool keeps offering liquidity.',
  },
  bandTailUpperPct: {
    oneLiner:
      'Tail band upper edge (e.g. +0.30). Sets how high above spot the pool earns fees on upside swings.',
  },
  swapSellUSD: {
    oneLiner:
      'Scenario input: USD-notional seized wTRY probe requested in Section 3 and reused by Section 4A. Default is $1,000,000.',
  },
};

// ---------------------------------------------------------------------------
// KPI help (section 7)
// ---------------------------------------------------------------------------

const COMMON: Record<string, KpiHelp['params'][number]> = {
  tvl: { name: 'poolTVL_USD', source: 'sidebar', ref: 'poolTVL_USD' },
  fee: { name: 'poolFeeTier', source: 'sidebar', ref: 'poolFeeTier' },
  core: { name: 'bandSplitCore', source: 'sidebar', ref: 'bandSplitCore' },
  absorb: { name: 'bandSplitAbsorb', source: 'sidebar', ref: 'bandSplitAbsorb' },
  lltv: { name: 'lltv', source: 'sidebar', ref: 'lltv' },
  spot: { name: 'usdtryBaseline', source: 'sidebar', ref: 'usdtryBaseline', note: 'wTRY price = 1 / USDTRY rate.' },
};

const spotWtryUsdm: KpiHelp = {
  title: 'Spot wTRY/USDM',
  oneLiner:
    'Current wTRY price in USDM. Computed as 1 ÷ USD/TRY baseline (sidebar field). Shared with the homepage via URL state — set it in either place and both pages use it.',
  formula: {
    plain: 'spot = 1 / usdtryBaseline\n// default: usdtryBaseline = 45 → spot ≈ 0.0222 USDM per wTRY',
    latex: 'p_{\\text{spot}} = 1 / R_{\\text{USDTRY}}',
  },
  params: [COMMON.spot!],
  definitions: [
    { term: 'Price direction', definition: 'wTRY/USDM = USDM per 1 wTRY. With USDTRY ≈ 45, spot ≈ 0.0222 USDM per wTRY — meaning 45 wTRY to buy 1 USDM.' },
    { term: 'Why not USDTRY directly', definition: 'Uniswap v3 quotes prices as token1/token0 with token0 = wTRY (lower address-sort). Inverting once at the page boundary keeps the rest of the math conventional.' },
    { term: 'Scenario baseline, not live FX', definition: 'This is an input you control, not a live oracle feed. Sections 1 to 3 use it as initial spot. Section 4A uses terminal values from simulated USD/TRY paths for its probe sizes while the modeled pool remains at its initial ticks.' },
    { term: 'Shared state', definition: 'usdtryBaseline is the same URL key the homepage reads. Editing the sidebar field in either page updates both, as long as you navigate with the query string preserved (open in a new tab from the URL bar, or use the back/forward buttons).' },
  ],
  impact: {
    health: 'Anchor for configured bands: at defaults Core is -5% to +5%, Absorb is -15% to -5%, and Tail is -90% to +30%.',
    sustainability: 'The page stores a rebalance-policy field in the generated preset but does not execute or validate rebalancing.',
    profitability: 'Sets the initial price used to size and quote design-point probe trades.',
  },
};

const activeLiquidityScaled: KpiHelp = {
  title: 'Active liquidity (scaled)',
  oneLiner:
    'Calculated Uniswap v3 L at initial spot, summed only across in-range positions and divided by 1e12 for display. It is not configured USD pool capital.',
  formula: {
    plain: 'L_active = sum of L_i for every position whose [tickLower, tickUpper) covers tickAtSpot\nL_i = liquidityForAmounts(sqrtP, sqrtA_i, sqrtB_i, amount0_i, amount1_i)\nDisplayed value = Number(L_active) / 1e12',
    latex: 'L_{\\text{active}} = \\sum_{i \\in \\text{in-range}} L_i,\\quad L_i = f(\\sqrt{P}, \\sqrt{P_a}, \\sqrt{P_b}, x_i, y_i)',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!, COMMON.spot!],
  definitions: [
    { term: 'L (liquidity)', definition: 'The Uniswap v3 parameter relating reserves to a price range. For otherwise equal conditions, higher active L reduces price movement for an input amount.' },
    { term: 'Why scale by 1e12', definition: 'L is computed in raw wei × Q96 units — too big to read. Dividing by 1e12 gives a number between 1 and a few thousand for typical configs.' },
    { term: 'In-range positions only', definition: 'A band whose tickLower/tickUpper bracket the spot tick contributes. With current defaults, Core and Tail include initial spot; Absorb is below initial spot.' },
  ],
  impact: {
    health: 'This quantity enters the swap path at initial spot; it does not itself measure proceeds or repayment shortfall.',
    sustainability: 'As a simulated sell crosses ticks, the active L used by the quote changes according to each position boundary.',
    profitability: 'The received-output and effective-slip metrics show the result of applying this liquidity to a probe.',
  },
};

const poolFeeTierKpi: KpiHelp = {
  title: 'Fee tier (active)',
  oneLiner:
    'Per-swap commission charged to traders, paid to LPs in proportion to in-range liquidity. Same value as the sidebar control — mirrored here for quick reference.',
  formula: {
    plain: 'feeRate = poolFeeTier / 1,000,000\n// 3000 -> 0.003 = 0.30%; 10000 -> 0.01 = 1.00%\nfee_paid = sum of input fee charged at each executed swap step',
    latex: 'r_f = f / 10^6',
  },
  params: [COMMON.fee!],
  definitions: [
    { term: '0.30% (fee tier 3000)', definition: 'Charges 30 basis points of executed input and uses tick spacing 60.' },
    { term: '1.00% (fee tier 10000)', definition: 'Charges 100 basis points of executed input and uses tick spacing 200.' },
  ],
  impact: {
    health: 'A higher fee lowers calculated USDM proceeds for the same executed input.',
    sustainability: 'This page calculates the fee amount for probe trades; it does not estimate LP income or trading activity.',
    profitability: 'For a seized-collateral probe, fees consume part of the LIF buffer before gas; at LLTV 86% that modeled buffer is 4.20%.',
  },
};

const usdmReceived: KpiHelp = {
  title: 'USDM received',
  oneLiner:
    'Calculated USDM output from the requested wTRY probe against the configured pool. If represented liquidity is exhausted, no proceeds are assigned to unfilled input.',
  formula: {
    plain: 'usdmReceived = sum_over_ticks( deltaY_i )  where deltaY_i = L_i × (sqrtP - sqrtP_next_i) / Q96',
    latex: 'y_{\\text{out}} = \\sum_i L_i \\cdot (\\sqrt{P_i} - \\sqrt{P_{i+1}}) / 2^{96}',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!, COMMON.fee!],
  definitions: [
    { term: 'Where the math lives', definition: 'lib/univ3/swap.ts implements swapExactIn — walks ticks, applies per-step constant-product, accumulates output.' },
    { term: 'Fee-on-input', definition: 'The walker charges fee on executed input at each step. If a $25,000 requested sell is fully filled at 0.30%, its input fee is about $75 before spot-marking and integer rounding.' },
    { term: 'Compare to repayment', definition: 'For the Section 4 probe, required repayment is collateral / LIF(lltv). A shortfall means this hypothetical execution would not repay that amount before gas; it does not assert protocol bad debt occurred.' },
  ],
  impact: {
    health: 'Direct input to the probe formula: repaymentShortfall = max(0, debtToRepay - usdmReceived).',
    sustainability: 'The page reports this scenario output without recommending a pool size.',
    profitability: 'Before gas, the hypothetical liquidator spread is usdmReceived - debtToRepay.',
  },
};

const effectiveSlip: KpiHelp = {
  title: 'Effective slip (fee + impact)',
  oneLiner:
    'Calculated proceeds shortfall versus the requested USD-notional probe. It includes the input fee, execution price movement, and any input left without modeled bids.',
  formula: {
    plain: 'effectiveSlip = max(0, 1 - usdmReceived / requestedSellUSD)\n// For a seized-collateral probe, compare with:\nLIF_buffer = 1 - 1 / LIF(lltv)',
    latex: '\\sigma_{\\mathrm{eff}} = \\max(0, 1 - y_{\\mathrm{out}} / C)',
  },
  params: [COMMON.tvl!, COMMON.fee!, COMMON.lltv!],
  definitions: [
    { term: 'Requested sell notional', definition: 'The slider sets a USD value of wTRY collateral. The code converts that value to wTRY at the scenario spot before requesting the swap.' },
    { term: 'Repayment interpretation', definition: 'Only when the requested input represents seized collateral is the LIF buffer a repayment break-even reference. Gas is excluded here.' },
  ],
  impact: {
    health: 'This is an execution-scenario output, not a report of realized protocol loss.',
    sustainability: 'Changing pool capital, ranges, or fee changes this computed curve.',
    profitability: 'A seized-collateral probe covers repayment before gas only while effective slip is no larger than the LIF buffer.',
  },
};

const slippagePctKpi: KpiHelp = {
  title: 'Marginal price slip',
  oneLiner:
    '(entry price - exit price) / entry price for this sell. This is final-price movement, not total proceeds shortfall.',
  formula: {
    plain: 'slippage = (entryPrice - exitPrice) / entryPrice    // for sells (zeroForOne)\nentryPrice = sqrtPriceX96ToPrice(pool.sqrtPriceX96)\nexitPrice  = sqrtPriceX96ToPrice(swap.finalSqrtPriceX96)',
    latex: '\\sigma = (p_0 - p_1) / p_0',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!],
  definitions: [
    { term: 'Not effective slip', definition: 'This metric measures the final marginal pool price. Effective slip instead compares all USDM proceeds with the requested collateral notional and includes fee.' },
    { term: 'Why it grows with size', definition: 'A larger executable sell moves farther along the active liquidity ranges and can cross initialized ticks.' },
  ],
  impact: {
    health: 'Use effective slip and repayment shortfall, rather than this endpoint metric alone, for the liquidation probe interpretation.',
    sustainability: 'Pool allocation and band widths determine how quickly the modeled marginal price moves.',
    profitability: 'This is context for execution quality; total modeled proceeds are shown separately.',
  },
};

const effectivePrice: KpiHelp = {
  title: 'Average fill price',
  oneLiner:
    'Calculated USDM received per wTRY input consumed by the swap. If a requested probe cannot be fully filled, this average covers the filled input only.',
  formula: {
    plain: 'effectivePrice = amountOut / amountIn',
    latex: 'p_{\\text{eff}} = y_{\\text{out}} / x_{\\text{in}}',
  },
  params: [COMMON.tvl!, COMMON.fee!],
  definitions: [
    { term: 'Why it differs from entry', definition: 'A single tick has constant L, so within it the price moves continuously along the constant-product curve. The average across the swept range is closer to entry than to exit (concentrated at the start).' },
    { term: 'No execution assertion', definition: 'The number is an AMM quote result for this scenario. The page does not assert that a liquidator executes it or reports it elsewhere.' },
  ],
  impact: {
    health: 'Lower effective price (further from entry) = bigger loss to slippage.',
    sustainability: 'Reflects the realized economics, not an idealised quote.',
    profitability: 'Determines USDM received per wTRY sold.',
  },
};

const feePaidUSD: KpiHelp = {
  title: 'Fee paid',
  oneLiner:
    'Calculated fee on the wTRY input consumed by the modeled swap, marked in USD at initial spot.',
  formula: {
    plain: 'feePaid_USD = (feePaid_token0 / 1e6) × spot',
    latex: 'F_{\\text{USD}} = (F_{x_0} / 10^6) \\cdot p_{\\text{spot}}',
  },
  params: [COMMON.fee!, COMMON.spot!],
  definitions: [
    { term: 'Why USD', definition: 'The swap walker accounts fees in token0 (wTRY) wei. Multiplying by spot gives a stable USD number to compare across pool configs.' },
    { term: 'Filled input only', definition: 'Fee accrues per executed step. If modeled liquidity is exhausted before the requested wTRY amount is consumed, unfilled input is not charged a fee.' },
  ],
  impact: {
    health: 'For a seized-collateral probe, this fee contributes to effective slip before any gas cost.',
    sustainability: 'This is calculated trade fee, not an estimate of recurring LP revenue.',
    profitability: 'The page folds the fee into USDM output and effective slip.',
  },
};

const ticksCrossed: KpiHelp = {
  title: 'Ticks crossed',
  oneLiner:
    'Number of initialized price boundaries traversed by the executed portion of the modeled swap.',
  formula: {
    plain: 'ticksCrossed = count of tick boundaries where liquidityNet was applied during the swap',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!],
  definitions: [
    { term: 'Initialized tick', definition: 'A tick where at least one LP position begins or ends. The default asymmetric ladder has 6 initialized ticks (2 per band).' },
    { term: 'Why care', definition: 'A count of zero means execution remained in the starting active-liquidity interval. A positive count means a band boundary changed active L during the quote.' },
  ],
  impact: {
    health: 'This reports the quote route through configured ranges; it is not a shortfall threshold.',
    sustainability: 'It helps inspect which configured ranges were reached in the scenario.',
    profitability: 'The output and effective-slip KPIs contain the corresponding proceeds effect.',
  },
};

const pathsWithNoShortfall: KpiHelp = {
  title: 'Paths with no repayment shortfall',
  oneLiner:
    'Share of sampled terminal-FX probe scenarios whose AMM proceeds cover repayment before gas. This is not protocol bad debt.',
  formula: {
    plain: 'shortfall_i = max(0, debtToRepay - ammSale_i) / debtToRepay\npathsWithNoShortfall = count(shortfall_i = 0) / sampledPathCount',
    latex: '\\zeta = |\\{i : s_i = 0\\}| / n',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!, COMMON.lltv!],
  definitions: [
    { term: 'Sampled scenario', definition: 'The panel takes up to 200 terminal spots from the selected FX simulation, holds pool ticks at their initial positions, and requests the slider-sized collateral sale at each terminal value.' },
    { term: 'Execution shortfall', definition: 'A non-zero value means the hypothetical liquidator receives less USDM than the repayment amount before gas. A real protocol outcome also depends on whether and how liquidation occurs.' },
  ],
  impact: {
    health: 'This is a calculated probe summary, not a safety classification.',
    sustainability: 'Changing the pool inputs or selected FX simulation changes this percentage.',
    profitability: 'A no-shortfall probe covers repayment before gas under the modeled execution only.',
  },
};

const medianRepaymentShortfallRate: KpiHelp = {
  title: 'Median repayment-shortfall rate',
  oneLiner:
    'Middle sampled repayment-shortfall rate for the slider-sized hypothetical liquidator sale.',
  formula: {
    plain: 'shortfallRate_i = max(0, debtToRepay - ammSale_i) / debtToRepay\nmedian = sort(shortfallRate).at(floor(n / 2))',
    latex: '\\operatorname{median}(s_i)',
  },
  params: [COMMON.tvl!, COMMON.lltv!],
  definitions: [
    { term: 'Zero median', definition: 'If at least half of sampled probe scenarios cover repayment before gas, the displayed median is zero even when other samples show shortfall.' },
    { term: 'Denominator', definition: 'The rate divides shortfall by required debt repayment, not by configured pool capital or collateral value.' },
  ],
  impact: {
    health: 'Reports a scenario median only; the home cascade is the protocol-debt calculation.',
    sustainability: 'Provides a central summary for comparing different configured ladders.',
    profitability: 'A non-zero median means the modeled sale fails to cover repayment before gas in the middle sampled scenario.',
  },
};

const p95RepaymentShortfallRate: KpiHelp = {
  title: '95th-percentile repayment-shortfall rate',
  oneLiner:
    '95th percentile of sampled liquidator repayment-shortfall rates for the selected probe trade and FX simulation.',
  formula: {
    plain: 'p95 = sort(shortfallRate).at(floor(0.95 * n))',
    latex: 's_{95} = s_{(\\lfloor 0.95 n \\rfloor)}',
  },
  params: [COMMON.tvl!, COMMON.lltv!, COMMON.absorb!],
  definitions: [
    { term: 'Percentile meaning', definition: 'After sorting sampled shortfall rates, the panel selects the item at floor(0.95 * n). It is a statistic of the selected simulation sample, not a probability guarantee.' },
    { term: 'What changes it', definition: 'Terminal FX spots, slider probe size, LLTV, configured capital, band allocation, ranges, and fee tier all affect the quote or repayment reference.' },
  ],
  impact: {
    health: 'Use it to compare modeled probe stress; use the home cascade for estimated unresolved Morpho debt.',
    sustainability: 'The page does not turn this statistic into a policy recommendation.',
    profitability: 'It reports the modeled before-gas repayment gap at a high sampled quantile.',
  },
};

export const SWAP_LIQUIDITY_KPIS: Partial<Record<string, KpiHelp>> = {
  spotWtryUsdm,
  activeLiquidityScaled,
  poolFeeTierKpi,
  usdmReceived,
  effectiveSlip,
  slippagePctKpi,
  effectivePrice,
  feePaidUSD,
  ticksCrossed,
  pathsWithNoShortfall,
  medianRepaymentShortfallRate,
  p95RepaymentShortfallRate,
};

// ---------------------------------------------------------------------------
// Chart help (section 7)
// ---------------------------------------------------------------------------

const liquidityByTick: ChartHelp = {
  title: 'Net liquidity changes by tick',
  oneLiner:
    'Boundary map of configured Uniswap liquidity. Bars show changes in L at initialized ticks, not USD capital available at each price.',
  axes: {
    x: 'price (USDM per wTRY) — each bar sits at the price where a band opens or closes',
    y: 'net liquidity at that tick (raw L ÷ 1e12 for readability)',
  },
  bands: [
    { name: 'Positive bars', meaning: 'In the upward-price crossing convention stored by Uniswap, a position begins contributing L at its lower boundary.' },
    { name: 'Negative bars', meaning: 'In the upward-price crossing convention, a position stops contributing L at its upper boundary.' },
    { name: 'Reading a wTRY sell', meaning: 'A wTRY sell moves price downward, so boundaries are crossed from right to left and active-liquidity changes apply in the reverse direction.' },
  ],
  definitions: [
    { term: 'What a tick is', definition: 'Uniswap v3 divides the price axis into thousands of discrete slots called ticks. Each tick maps to a specific price. Liquidity providers deposit capital between two ticks, not across the whole range.' },
    { term: 'Why bars appear in pairs', definition: 'Each LP band opens at a lower tick (positive bar) and closes at an upper tick (negative bar). With 3 bands — Core, Absorb, Tail — you see up to 6 bars total, matching the band-allocation table below.' },
    { term: 'How a swap uses the map', definition: 'When a modeled wTRY sell crosses a boundary, the walker updates active L from liquidityNet and continues until the input is processed or represented active liquidity is exhausted.' },
    { term: 'Yellow line', definition: 'Initial spot price used to materialize the configured positions and start design-point quotes.' },
  ],
  impact: {
    health: 'This chart explains where active L changes; calculated proceeds and shortfall are reported in later sections.',
    sustainability: 'It shows the configured position layout after percentage endpoints have been snapped to usable ticks.',
    profitability: 'A quote follows these ranges to calculate output; the chart alone is not a fill-price calculation.',
  },
};

const bandAllocationTable: ChartHelp = {
  title: 'Band allocation table',
  oneLiner:
    'Per-band breakdown of where the pool\'s USD value is placed: which price range each band covers and how much capital sits in it.',
  axes: {
    x: '(not a chart — tabular)',
    y: '(not a chart — tabular)',
  },
  bands: [
    { name: 'Core (-5% to +5%)', meaning: 'Default 30% allocation in a narrow initial-spot range.' },
    { name: 'Absorb (-15% to -5%)', meaning: 'Default 50% allocation below initial spot; it is one-sided in USDM at launch with the default endpoints.' },
    { name: 'Tail (-90% to +30%)', meaning: 'Default 20% allocation in a broad range that includes initial spot.' },
  ],
  definitions: [
    { term: 'Range column', definition: 'Lower → upper price boundary of the band, expressed in USDM per wTRY. Computed from band-percentage offsets relative to current spot.' },
    { term: 'USD column', definition: 'How much capital the band holds at deploy. Sums to poolTVL_USD (with sub-cent rounding).' },
    { term: 'Configured capital vs active L', definition: 'The USD column is launch marked allocation. A row contributes to active L only when the modeled spot lies inside its snapped tick range.' },
  ],
  impact: {
    health: 'Changing allocations changes the execution scenarios; this table does not label a configuration safe or unsafe.',
    sustainability: 'The builder emits a rebalance policy, but this page does not model future rebalance execution.',
    profitability: 'The quote panels compute output after applying the selected allocation and range inputs.',
  },
};

const slippageCurve: ChartHelp = {
  title: 'Effective slip and marginal-price curve',
  oneLiner:
    'Deterministic sweep of requested wTRY sell notional against the initial-spot pool. Effective slip includes fees and unfilled notional; marginal slip is endpoint price movement.',
  axes: {
    x: 'requested wTRY sell notional in USD, log scale',
    y: 'calculated slip rate, displayed from 0% to 10%',
  },
  bands: [
    { name: 'Purple line', meaning: 'effectiveSlip = max(0, 1 - USDM received / requested sell notional).' },
    { name: 'Blue dashed line', meaning: 'Marginal price slip = (entry price - final price) / entry price.' },
    { name: 'Green reference', meaning: 'A visible 1% comparison line; the code does not treat it as a requirement.' },
    { name: 'Orange reference', meaning: 'The LLTV-dependent LIF buffer. It is a before-gas repayment reference only when the probe represents seized collateral.' },
  ],
  definitions: [
    { term: 'Sweep', definition: 'The chart requests 70 log-spaced sells from $1,000 through max($5,000,000, five times configured capital).' },
    { term: 'Initial-spot quote', definition: 'Every point builds and quotes the configured ladder at spot = 1 / usdtryBaseline; no Monte Carlo path enters this chart.' },
  ],
  impact: {
    health: 'Displays calculated trade-response curves rather than a protocol-debt forecast.',
    sustainability: 'Useful for comparing configured capital and ranges against identical requested probes.',
    profitability: 'The orange crossing is a gas-blind repayment break-even reference for seized-collateral interpretation.',
  },
};

const repaymentShortfallHistogram: ChartHelp = {
  title: 'Repayment-shortfall distribution',
  oneLiner:
    'Distribution of a hypothetical liquidator repayment shortfall across sampled terminal FX spots. It is not protocol bad debt.',
  axes: {
    x: 'repayment shortfall / debt to repay',
    y: 'count of sampled terminal-FX probe scenarios',
  },
  bands: [
    { name: 'Zero-shortfall mass', meaning: 'Sampled probe scenarios whose calculated AMM proceeds cover repayment before gas.' },
    { name: 'Positive-shortfall mass', meaning: 'Sampled probe scenarios where the requested sale output is less than repayment.' },
  ],
  definitions: [
    { term: 'Fixed pool', definition: 'The ladder is materialized once at the initial spot. It is not rebuilt at each simulated terminal spot.' },
    { term: 'Probe sizing', definition: 'At each terminal spot, the same slider USD collateral value is converted into a wTRY amount and requested against the fixed pool.' },
    { term: 'Sampling', definition: 'The chart uses up to 200 terminal spots from the selected simulation and bins the resulting shortfall rates into 20 buckets.' },
  ],
  impact: {
    health: 'The home simulator separately estimates unresolved Morpho debt after modeled liquidation behavior.',
    sustainability: 'Changing scenarios or pool configuration changes this comparison distribution.',
    profitability: 'Shortfall means this single hypothetical sale does not cover repayment before gas.',
  },
};

const repaymentShortfallSweep: ChartHelp = {
  title: 'Repayment shortfall versus probe size',
  oneLiner:
    'Deterministic initial-spot sweep showing when requested seized-collateral sales stop covering repayment before gas.',
  axes: {
    x: 'requested collateral sale notional in USD, log scale',
    y: 'effective slip and repayment-shortfall rate',
  },
  bands: [
    { name: 'Effective slip line', meaning: 'Proceeds shortfall relative to requested collateral value.' },
    { name: 'Repayment shortfall line', meaning: 'Only the portion of loss beyond the LIF bonus, divided by debt to repay.' },
    { name: 'Break-even marker', meaning: 'Interpolated probe size where effective slip reaches 1 - 1 / LIF(lltv); gas is excluded.' },
  ],
  definitions: [
    { term: 'Debt to repay', definition: 'For each requested collateral notional C, debtToRepay = C / LIF(lltv).' },
    { term: 'Shortfall', definition: 'repaymentShortfall = max(0, debtToRepay - AMM proceeds).' },
    { term: 'No Monte Carlo', definition: 'This sweep quotes the pool at initial spot and does not use simulated terminal FX values or the Section 3 slider position.' },
  ],
  impact: {
    health: 'It describes a hypothetical execution cutoff, not realized protocol loss.',
    sustainability: 'Use identical probe assumptions when comparing configured ladders.',
    profitability: 'Positive repayment shortfall means before-gas AMM proceeds do not cover the hypothetical repayment.',
  },
};

export const SWAP_LIQUIDITY_CHARTS: Partial<Record<string, ChartHelp>> = {
  liquidityByTick,
  bandAllocationTable,
  slippageCurve,
  repaymentShortfallHistogram,
  repaymentShortfallSweep,
};
