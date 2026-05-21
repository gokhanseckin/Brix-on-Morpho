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
      'Per-swap commission paid to liquidity providers. 0.30% uses tight tick spacing (60) for deeper concentration; 1.00% uses wide spacing (200) for safer LPing on a thin pool.',
    details: {
      description:
        'Uniswap v3 ties fee tier to tick spacing: 0.30% → spacing 60 (fine grid), 1.00% → spacing 200 (coarse grid). Coarser grid means LP positions cover wider price ranges per tick, so your bands are less precise but more robust to small price jitter. For a low-volume launch pool, 1.00% gives LPs a meaningful incentive without needing to actively rebalance.',
      options: [
        { name: '0.30%', description: 'Standard for volatile pairs. Best when you expect frequent trading and active LPs.', bestFor: 'mature pool with arb activity' },
        { name: '1.00%', description: 'Higher fee compensates LPs for sitting on thin volume.', bestFor: 'fresh launch / low-volume pair' },
      ],
    },
  },
  poolTVL_USD: {
    oneLiner:
      'Total USD value seeded across both sides of the AMM. Default $500k matches a realistic launch — bigger pools mean less slippage on every liquidation.',
    details: {
      description:
        'TVL is what an LP would have to commit to the pool. It is split across three bands (Core / Absorb / Tail) per the band-share sliders. Doubling TVL roughly halves slippage for the same swap size, which directly shrinks bad-debt risk. The page treats this as a parameter to size against; for a real launch, the protocol seeds + incentivises this depth.',
      downstream: [
        { section: 'Pool state', effects: ['active liquidity at spot', 'per-band USD allocations'] },
        { section: 'Liquidator swap', effects: ['slippage', 'USDM received'] },
        { section: 'Bad-debt distribution', effects: ['shifts whole histogram left/right'] },
      ],
    },
  },
  bandSplitCore: {
    oneLiner:
      'Share of pool capital in the tight ±5% band around spot. Higher = less slippage on small swaps, less capacity to absorb a wTRY crash.',
    details: {
      description:
        'The Core band catches normal trading. Money parked here is the most capital-efficient (deep liquidity for the smallest price range) but the FIRST to be drained when price moves outside the band — at which point it converts to 100% of the falling asset (wTRY in a crash) and sits idle.',
      downstream: [
        { section: 'Pool state', effects: ['active liquidity at spot', 'Core row in band table'] },
        { section: 'Liquidator swap', effects: ['slippage near spot'] },
      ],
    },
  },
  bandSplitAbsorb: {
    oneLiner:
      'Share allocated to the −25% → −10% band below spot. This is the catch net for forced liquidations during a crash; size it to expected wTRY dumps.',
    details: {
      description:
        'The Absorb band sits below spot in pure USDM (100% one-sided). When wTRY price falls into this range — exactly when liquidators are unwinding seized collateral — the band buys wTRY at a discount and pays out USDM. Its width (15 percentage points) is sized to span the typical crash trajectory. Smaller absorb share → less protection against bad debt; larger → less Core depth for normal flow.',
      downstream: [
        { section: 'Bad-debt distribution', effects: ['governs whether bad debt fires in stressed paths'] },
      ],
    },
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
    { term: 'Static baseline, not live FX', definition: 'This is the modelled baseline you control — NOT a live oracle feed. The §3 bad-debt distribution uses Monte-Carlo terminal spots (which DO vary across FX futures), but §1 and §2 use this static value as the design-point spot.' },
    { term: 'Shared state', definition: 'usdtryBaseline is the same URL key the homepage reads. Editing the sidebar field in either page updates both, as long as you navigate with the query string preserved (open in a new tab from the URL bar, or use the back/forward buttons).' },
  ],
  impact: {
    health: 'Anchor for every band: ±5% around this spot defines the Core band; Absorb is −25% to −10% below.',
    sustainability: 'If FX baseline drifts, every band drifts with it. Rebalance the pool when spot crosses the rebalance threshold (15% by default).',
    profitability: 'Drives the entry price for every liquidator swap on this page.',
  },
};

const activeLiquidityScaled: KpiHelp = {
  title: 'Active liquidity (scaled)',
  oneLiner:
    'Uniswap v3 "L" parameter at the current spot — total depth available before crossing into the next tick range. Scaled by 1e12 just for readability.',
  formula: {
    plain: 'L_active = sum of L_i for every position whose [tickLower, tickUpper) covers tickAtSpot\nL_i = liquidityForAmounts(sqrtP, sqrtA_i, sqrtB_i, amount0_i, amount1_i)\nDisplayed value = Number(L_active) / 1e12',
    latex: 'L_{\\text{active}} = \\sum_{i \\in \\text{in-range}} L_i,\\quad L_i = f(\\sqrt{P}, \\sqrt{P_a}, \\sqrt{P_b}, x_i, y_i)',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!, COMMON.spot!],
  definitions: [
    { term: 'L (liquidity)', definition: 'A constant in Uniswap v3 that ties a position\'s reserves to its price range. Higher L = thicker book = less slippage. The math is `liquidityForAmounts` in lib/univ3/liquidityMath.ts.' },
    { term: 'Why scale by 1e12', definition: 'L is computed in raw wei × Q96 units — too big to read. Dividing by 1e12 gives a number between 1 and a few thousand for typical configs.' },
    { term: 'In-range positions only', definition: 'A band whose tickLower/tickUpper bracket the spot tick contributes. At launch with default settings, only the Core band is in-range; Absorb and Tail wait below spot.' },
  ],
  impact: {
    health: 'Higher active L = smaller price impact for the same trade size = less bad-debt risk.',
    sustainability: 'Falls as price drifts outside the Core band; that\'s when the Absorb band starts carrying the swap.',
    profitability: 'For LPs: fees accrue only when their position is in-range. Active L is the fee-earning slice.',
  },
};

const poolFeeTierKpi: KpiHelp = {
  title: 'Fee tier (active)',
  oneLiner:
    'Per-swap commission charged to traders, paid to LPs in proportion to in-range liquidity. Same value as the sidebar control — mirrored here for quick reference.',
  formula: {
    plain: 'fee_paid = amount_in × (feeTier_bps / 10000)',
    latex: 'F = x_{\\text{in}} \\cdot (f / 10000)',
  },
  params: [COMMON.fee!],
  definitions: [
    { term: '0.30% (3000 bps)', definition: 'Standard volatile-pair fee. Uses tick spacing 60. Recommended once the pool has steady arb flow.' },
    { term: '1.00% (10000 bps)', definition: 'Higher fee, wider tick spacing (200). Default for fresh launches — pays LPs enough to bother with a thin book.' },
  ],
  impact: {
    health: 'Higher fee → less arb activity → wider spread → modestly worse liquidator recovery on stressed paths.',
    sustainability: 'Drives the LP yield that bootstraps and retains liquidity.',
    profitability: 'For liquidators: a 1% fee directly cuts into the LIF buffer — at 86% LLTV (4.4% buffer), a 1% AMM fee leaves ~3.4% of cushion.',
  },
};

const usdmReceived: KpiHelp = {
  title: 'USDM received',
  oneLiner:
    'What the liquidator nets from selling the seized wTRY into the AMM, after slippage and fee. Drives whether bad debt is born.',
  formula: {
    plain: 'usdmReceived = sum_over_ticks( deltaY_i )  where deltaY_i = L_i × (sqrtP - sqrtP_next_i) / Q96',
    latex: 'y_{\\text{out}} = \\sum_i L_i \\cdot (\\sqrt{P_i} - \\sqrt{P_{i+1}}) / 2^{96}',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!, COMMON.fee!],
  definitions: [
    { term: 'Where the math lives', definition: 'lib/univ3/swap.ts implements swapExactIn — walks ticks, applies per-step constant-product, accumulates output.' },
    { term: 'Fee-on-input', definition: 'Uniswap v3 charges the fee on the INPUT amount before computing the swap. So a $25k notional sell at 0.30% has $24,925 effectively swapped.' },
    { term: 'Compare to debt', definition: 'For bad-debt math, what matters is usdmReceived vs debt-at-trigger. Debt = collateral / LIF(lltv); see §4 of /help/liquidation.' },
  ],
  impact: {
    health: 'Direct input to bad-debt = max(0, debt − usdmReceived).',
    sustainability: 'A pool design that consistently delivers usdmReceived ≥ debt is the goal.',
    profitability: 'Liquidator profit = usdmReceived + collateral-bonus − debt − gas.',
  },
};

const slippagePctKpi: KpiHelp = {
  title: 'Slippage',
  oneLiner:
    '(entry price − exit price) ÷ entry price. Pure price impact from this swap, before any LIF buffer is applied.',
  formula: {
    plain: 'slippage = (entryPrice - exitPrice) / entryPrice    // for sells (zeroForOne)\nentryPrice = sqrtPriceX96ToPrice(pool.sqrtPriceX96)\nexitPrice  = sqrtPriceX96ToPrice(swap.finalSqrtPriceX96)',
    latex: '\\sigma = (p_0 - p_1) / p_0',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!],
  definitions: [
    { term: 'Not the same as bad debt', definition: 'A 3% slippage is benign at LLTV 86% (4.4% LIF buffer absorbs it). Slippage > LIF buffer is the actual bad-debt threshold.' },
    { term: 'Why slippage grows with size', definition: 'Larger sells push price further along the LP curve, sweeping deeper ticks where positions are thinner. Slippage is monotonic in swap size — see the property test in tests/univ3/swap.test.ts.' },
  ],
  impact: {
    health: 'Slippage > LIF buffer = bad debt. For LLTV 86% the threshold is ~4.4%.',
    sustainability: 'Pool depth and Absorb-band sizing are the levers to keep slippage low.',
    profitability: 'Direct cost to the liquidator on every sell.',
  },
};

const effectivePrice: KpiHelp = {
  title: 'Effective price',
  oneLiner:
    'Volume-weighted average price across every tick the swap traversed. Usually between entry and exit price.',
  formula: {
    plain: 'effectivePrice = amountOut / amountIn',
    latex: 'p_{\\text{eff}} = y_{\\text{out}} / x_{\\text{in}}',
  },
  params: [COMMON.tvl!, COMMON.fee!],
  definitions: [
    { term: 'Why it differs from entry', definition: 'A single tick has constant L, so within it the price moves continuously along the constant-product curve. The average across the swept range is closer to entry than to exit (concentrated at the start).' },
    { term: 'Use case', definition: 'A liquidator reports effectivePrice to the protocol when claiming the bonus. The number on /swapliquidity is what they would actually quote.' },
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
    'Total LP fees from this swap, in USD-equivalent. A direct cost to the liquidator (and revenue to LPs).',
  formula: {
    plain: 'feePaid_USD = (feePaid_token0 / 1e6) × spot',
    latex: 'F_{\\text{USD}} = (F_{x_0} / 10^6) \\cdot p_{\\text{spot}}',
  },
  params: [COMMON.fee!, COMMON.spot!],
  definitions: [
    { term: 'Why USD', definition: 'The swap walker accounts fees in token0 (wTRY) wei. Multiplying by spot gives a stable USD number to compare across pool configs.' },
    { term: 'feePaid token granularity', definition: 'Fee accrues per-step on the gross input; the sum is exact in wei. The 1e6 factor is the page\'s arbitrary "wei-per-dollar" scale.' },
  ],
  impact: {
    health: 'Eats directly into the LIF buffer — same threshold logic as slippage.',
    sustainability: 'Drives the per-block fee tape that bootstraps LP yield.',
    profitability: 'Total cost to liquidator = slippage_USD + feePaid_USD + gas.',
  },
};

const ticksCrossed: KpiHelp = {
  title: 'Ticks crossed',
  oneLiner:
    'How many initialized ticks the swap walker traversed. Higher = the swap moved through more LP positions = deeper price impact.',
  formula: {
    plain: 'ticksCrossed = count of tick boundaries where liquidityNet was applied during the swap',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!],
  definitions: [
    { term: 'Initialized tick', definition: 'A tick where at least one LP position begins or ends. The default asymmetric ladder has 6 initialized ticks (2 per band).' },
    { term: 'Why care', definition: 'Most swaps stay within the Core band (0 ticks crossed). When the count jumps to 1+, the swap has drained Core and is now consuming Absorb-band depth — a signal that the pool is being stressed.' },
  ],
  impact: {
    health: 'A liquidator swap crossing ticks means price moved across the Core/Absorb boundary — Absorb band is doing its job.',
    sustainability: 'A high tick count signals you should rebalance the pool back to centre on spot.',
    profitability: 'More ticks = more slippage = less USDM out.',
  },
};

const zeroBadDebtPct: KpiHelp = {
  title: 'Paths with zero bad debt',
  oneLiner:
    'Share of Monte-Carlo futures where the AMM proceeds fully covered the debt — the LIF buffer absorbed all slippage.',
  formula: {
    plain: 'zeroBadDebtPct = count(paths with badDebt = 0) / count(paths)',
    latex: '\\zeta = | \\{ p : \\text{badDebt}(p) = 0 \\} | / | \\{ p \\} |',
  },
  params: [COMMON.tvl!, COMMON.core!, COMMON.absorb!, COMMON.lltv!],
  definitions: [
    { term: 'Healthy target', definition: 'A safe pool design has ζ ≥ 95% — even the worst 5% of paths only book a tiny amount of bad debt.' },
    { term: 'Why it can be 100%', definition: 'For an LLTV with a generous LIF buffer (e.g. 0.86 → 4.4%) and a deep pool, ALL paths recover fully. The histogram becomes a single bar at 0%.' },
  ],
  impact: {
    health: 'Higher is better. <90% means the pool design is undersized for the chosen LLTV.',
    sustainability: 'The lever to push this up is either Absorb-band share or total TVL.',
    profitability: 'Indirect: paths that book bad debt also dilute supplier APY.',
  },
};

const medianBadDebtRate: KpiHelp = {
  title: 'Median bad-debt rate',
  oneLiner:
    'Typical bad-debt rate across simulated futures. Equals zero when more than half of paths recover fully.',
  formula: {
    plain: 'badDebtRate(p) = badDebt(p) / debtAtTrigger\nmedian = sort(badDebtRate).at(n/2)',
    latex: '\\text{med}(b) = b_{(\\lceil n/2 \\rceil)}',
  },
  params: [COMMON.tvl!, COMMON.lltv!],
  definitions: [
    { term: 'Why often 0%', definition: 'Most MC paths land inside the LIF buffer, so half the distribution sits at exactly zero. The 95th-percentile KPI is the more interesting number for safe designs.' },
    { term: 'How to read it with the histogram', definition: 'If the bar at 0% covers >50% of paths, median = 0% even though the distribution has a tail. Always pair it with the p95 KPI.' },
  ],
  impact: {
    health: 'Non-zero median means the AVERAGE liquidation books bad debt — the pool is structurally under-sized.',
    sustainability: 'A non-zero median is the loudest "fix this before launch" signal.',
    profitability: 'Median bad debt is what suppliers eat on a typical bad day.',
  },
};

const p95BadDebtRate: KpiHelp = {
  title: '95th-percentile bad-debt rate',
  oneLiner:
    'Bad case: the worst 1-in-20 future. This is the number the protocol\'s insurance buffer or supplier-loss tolerance must cover.',
  formula: {
    plain: 'p95 = sort(badDebtRate).at(0.95 × n)',
    latex: 'b_{(95)} = b_{(\\lceil 0.95 n \\rceil)}',
  },
  params: [COMMON.tvl!, COMMON.lltv!, COMMON.absorb!],
  definitions: [
    { term: 'Acceptance target', definition: 'A typical risk target is p95 < 1% — even in 95% of futures, less than 1% of seized debt becomes a loss.' },
    { term: 'What pushes p95 up', definition: 'Either FX scenarios so extreme that price falls past the Absorb band entirely, or under-sized Absorb-band capital relative to expected dump size.' },
  ],
  impact: {
    health: 'The single most important risk number on the page.',
    sustainability: 'Sized to absorb the 1-in-20 stressed future, not just the average.',
    profitability: 'A high p95 forces a wider safety margin on the recommended LLTV.',
  },
};

export const SWAP_LIQUIDITY_KPIS: Partial<Record<string, KpiHelp>> = {
  spotWtryUsdm,
  activeLiquidityScaled,
  poolFeeTierKpi,
  usdmReceived,
  slippagePctKpi,
  effectivePrice,
  feePaidUSD,
  ticksCrossed,
  zeroBadDebtPct,
  medianBadDebtRate,
  p95BadDebtRate,
};

// ---------------------------------------------------------------------------
// Chart help (section 7)
// ---------------------------------------------------------------------------

const liquidityByTick: ChartHelp = {
  title: 'Liquidity by tick',
  oneLiner:
    'Net liquidity contributed at each initialized tick across all three LP bands. Positive bars = liquidity entering at that tick; negative = exiting.',
  axes: {
    x: 'price (USDM per wTRY) at each initialized tick',
    y: 'net liquidity at tick (raw L ÷ 1e12 for readability)',
  },
  bands: [
    { name: 'Bars below current spot', meaning: 'These mark where the Core/Absorb/Tail bands open and close on the downside — the depth the AMM offers when wTRY price falls.' },
    { name: 'Bar at the Core lower edge', meaning: 'Where the Core position closes and Absorb begins. A liquidator selling enough to push price below this tick "crosses" into Absorb-band liquidity.' },
    { name: 'Negative bars', meaning: 'The upper edge of a band — liquidity is removed when price crosses these going up. Negative magnitude equals the positive opening of that same band.' },
  ],
  definitions: [
    { term: 'liquidityNet vs liquidityGross', definition: 'liquidityNet is the SIGNED change at a tick (positive on band open, negative on close). It is what the walker uses to track active L. Gross is the sum of |net|.' },
    { term: 'How a swap consumes it', definition: 'As a sell walks the price down, the swap walker subtracts liquidityNet at each crossed tick from the active L. When L = 0, no further depth exists at that price.' },
    { term: 'Why bars at exactly two prices per band', definition: 'Each LP position is bounded by two ticks (lower, upper). With 3 bands, the chart has up to 6 bars — same number you see in the band-allocation table.' },
  ],
  impact: {
    health: 'Big positive bars below spot = deep crash protection.',
    sustainability: 'If all positive mass is at spot, the pool is symmetric and wastes capital on the upside.',
    profitability: 'Drives the liquidator\'s realized fill price across the price range.',
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
    { name: 'Core (±5% around spot)', meaning: 'The tight band that catches normal trading. Default 30% of TVL. Converts 100% to wTRY if price falls outside.' },
    { name: 'Absorb (−25% → −10%)', meaning: 'The catch net for liquidations. Default 50% of TVL, parked entirely in USDM at deploy — ready to buy wTRY when it crashes into this range.' },
    { name: 'Tail (−50% → +15%)', meaning: 'Backstop for extreme moves. Default 20% of TVL. Wide range, lower depth per tick — provides a continuous bid even in catastrophic scenarios.' },
  ],
  definitions: [
    { term: 'Range column', definition: 'Lower → upper price boundary of the band, expressed in USDM per wTRY. Computed from band-percentage offsets relative to current spot.' },
    { term: 'USD column', definition: 'How much capital the band holds at deploy. Sums to poolTVL_USD (with sub-cent rounding).' },
    { term: 'Why asymmetric', definition: 'Liquidations only happen on the downside (wTRY falls vs USDM). Symmetric LP positions waste 50% of capital on the upside. The asymmetric ladder concentrates depth where it actually gets used.' },
  ],
  impact: {
    health: 'The Absorb band is where bad-debt risk is killed or born.',
    sustainability: 'Bands need rebalancing once spot drifts outside the Core range (default trigger: 15% drift).',
    profitability: 'For LPs: each band has different fee-earning characteristics. Core earns most fees; Absorb earns one big payday during a crash.',
  },
};

const swapBadDebtHistogram: ChartHelp = {
  title: 'Bad-debt distribution',
  oneLiner:
    'Histogram of bad-debt rate across simulated FX futures. Each bar is the count of Monte-Carlo paths landing in a bad-debt bucket.',
  axes: {
    x: 'bad-debt rate (badDebt ÷ debt-at-trigger), 0% on the left',
    y: 'number of Monte-Carlo paths in that bucket',
  },
  bands: [
    { name: 'Tall bar at 0% (left edge)', meaning: 'Healthy: most paths recover fully because the LIF buffer + Absorb band soaked up all slippage.' },
    { name: 'Long right tail', meaning: 'Tail risk: a few stressed paths push past the LIF buffer. These are the paths the p95 KPI is showing you.' },
    { name: 'Bimodal (two humps)', meaning: 'A liquidity cliff: paths split into "below threshold = fine" and "above threshold = ugly." Usually means the Absorb band is undersized for typical dump amounts.' },
    { name: 'Roughly uniform / flat', meaning: 'No clear safety zone. Treat as alarm: the pool design has no buffer; redesign before launch.' },
  ],
  definitions: [
    { term: 'How a single path is scored', definition: 'For each MC path: take the terminal spot price, build the pool at that spot, sell $25k of seized wTRY through it, compute badDebt = max(0, debt − usdmReceived).' },
    { term: 'Sampling', definition: 'Up to 200 paths are sampled from the Monte-Carlo set (stride = floor(n / 200)). 20 histogram bins span [0, max bad-debt rate].' },
    { term: 'Probe size', definition: 'Fixed at $25k of collateral notional — calibrated to a realistic per-liquidation event at small-vault scale.' },
  ],
  impact: {
    health: 'The right tail length is the protocol\'s tail-risk signal.',
    sustainability: 'A bar at 0% containing ≥95% of paths means the design is sized correctly.',
    profitability: 'Each non-zero bar represents future paths where suppliers eat a loss.',
  },
};

const presetExportSchema: ChartHelp = {
  title: 'Preset export schema',
  oneLiner:
    'JSON the kumbaya.xyz deploy script (or any external tool) reads to spin up the same pool design on-chain. Round-trippable through URL state.',
  axes: {
    x: '(not a chart — JSON payload)',
    y: '(not a chart — JSON payload)',
  },
  bands: [
    { name: 'feeTier', meaning: 'Basis points: 3000 = 0.30%, 10000 = 1.00%. Maps to Uniswap v3 fee-tier address.' },
    { name: 'tickSpacing', meaning: 'Tick grid step. Locked to feeTier — 60 for 0.30%, 200 for 1.00%.' },
    { name: 'positions[]', meaning: 'Array of LP positions to mint. Each entry has tickLower/tickUpper (integer ticks), liquidityUSD (USD value at deploy), and a label (\'core\' | \'absorb\' | \'tail\').' },
    { name: 'rebalancePolicy', meaning: 'When to rotate positions back to center: triggerPct = drift threshold (15% default), intervalDays = minimum gap between rebalances.' },
  ],
  definitions: [
    { term: 'Roundtrip', definition: 'The page reads the same URL state to derive these fields. Sharing the URL = sharing the preset.' },
    { term: 'Tick math', definition: 'tickLower/Upper are derived from band-percentage offsets via priceToTick(spot × (1 + offset)), then snapped to tickSpacing. See lib/poolPreset.ts.' },
    { term: 'liquidityUSD vs L', definition: 'liquidityUSD is the human-friendly capital amount. The deploy script converts it to token amounts at spot, then to Uniswap\'s L via liquidityForAmounts.' },
  ],
  impact: {
    health: 'Sharing this JSON makes a pool design auditable and reproducible.',
    sustainability: 'Rebalance policy is what keeps the live pool aligned with the simulation.',
    profitability: 'A misconfigured preset is the gap between "the lab says safe" and "the live pool ate bad debt."',
  },
};

export const SWAP_LIQUIDITY_CHARTS: Partial<Record<string, ChartHelp>> = {
  liquidityByTick,
  bandAllocationTable,
  swapBadDebtHistogram,
  presetExportSchema,
};
