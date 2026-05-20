// lib/help/content/fxRisk.ts
// Real content for Section 2 (FX Risk). PR #4 (roadmap).
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 2)
// ---------------------------------------------------------------------------

export const FX_RISK_PARAMS: Partial<Record<string, ParamHelp>> = {
  iTRYYieldAnnual: {
    oneLiner:
      'Annual yield on iTRY (the staked Turkish-MMF asset wiTRY wraps), as a decimal. Drives the "wiTRY appreciates over time in TRY terms" effect that partially offsets TRY depreciation. Default 38% ≈ typical Turkish MMF.',
  },
  usdtryBaseline: {
    oneLiner:
      'USD/TRY rate at t=0 (TRY per 1 USD). All path simulations start from this anchor. Defaults to the latest value in the embedded Yahoo USD/TRY series; override for stress-scenario sensitivity.',
  },
  historicalPeriod: {
    oneLiner:
      'How many years of daily USD/TRY history to draw from when fitting GBM params or resampling for bootstrap. 1Y captures recent regime; 3Y default balances regime + crises; 5Y includes more tails.',
  },
  simulationMode: {
    oneLiner:
      'Path generator: Bootstrap (resample real returns — heavy-tail-preserving, default), GBM (smooth log-normal), GBM+Jumps (Merton jump-diffusion), Scenario (deterministic linear glide to a chosen shock).',
    details: {
      description:
        'The simulation mode determines how Monte-Carlo USD/TRY paths are generated. All four modes drive Sections 2 (FX Risk), 4 (Liquidation), and 5 (Vault Recommendations). Section 1 (Liquidity Need) and Section 3 (Strategy) are pre-FX and do not depend on path generation.',
      options: [
        {
          name: 'Bootstrap (default)',
          description:
            'Resamples real USD/TRY daily returns from the embedded Yahoo history (window length = `historicalPeriod` years). Each path picks a random historical day, applies its return, repeats for `simulationHorizonDays` steps. Preserves heavy tails and skew — what actually happened can happen again. The `blockBootstrap` toggle pulls returns in 5-day blocks to preserve short-run autocorrelation (volatility clustering).',
          bestFor:
            'Realistic stress where you trust the historical window to represent the future. Strongest match to recent crisis regimes.',
        },
        {
          name: 'GBM (Geometric Brownian Motion)',
          description:
            'Fits μ (drift) and σ (vol) from the historical window, then generates each step as S_t · exp((μ − σ²/2)·dt + σ·√dt·Z) with Z ~ N(0, 1). Smooth log-normal walk with no fat tails, no jumps, and no autocorrelation. Tighter P5/P95 bands than Bootstrap.',
          bestFor:
            'Textbook analytic baseline. Useful for comparing against Bootstrap to see how much of the tail risk comes from real history vs. the normal-distribution assumption.',
        },
        {
          name: 'GBM+Jumps (Merton jump-diffusion)',
          description:
            'GBM plus a Poisson jump process (default λ ≈ 4 jumps/year, log-normal jump size). Same drift/vol fit as GBM, with a martingale compensator so the mean still tracks S₀ · exp(μT). Reintroduces fat tails that pure GBM misses — single-day step-changes such as central-bank moves or currency interventions.',
          bestFor:
            'Tail-aware modeling without abandoning the analytic GBM structure. The tail comes from a parameterized jump process, not from historical resampling.',
        },
        {
          name: 'Scenario',
          description:
            'Single deterministic path. Ignores history entirely. Glides linearly from `usdtryBaseline` to `usdtryBaseline × (1 + |tryShockPct|)` over the horizon. The `tryShockPct` slider controls shock magnitude; sign is ignored (always interpreted as TRY weakening).',
          bestFor:
            '"What if TRY drops X% in N days?" stress tests with a single number to point at. Use to validate that the LLTV recommendation withstands a specific scenario the team wants to defend.',
        },
      ],
      downstream: [
        {
          section: 'Section 2 — FX Risk',
          effects: [
            'USD/TRY P5/P50/P95 fan (`fxBands` chart) re-shapes',
            'Net wiTRY USD value paths and positions-underwater chart update',
            '3-day max drawdown P50 and P95 KPIs update',
          ],
        },
        {
          section: 'Section 4 — Liquidation',
          effects: [
            'Bad-debt cascade re-runs against the new paths → P95 bad-debt USD and % TVL move',
            'Bad-debt histogram redistributes',
            'Path-aggregated P95 liquidation volume updates → recommended pool depth shifts',
          ],
        },
        {
          section: 'Section 5 — Vault Recommendations',
          effects: [
            'Recommended LLTV re-derives from the new P95 3-day drawdown',
            'Risk tier may flip if your chosen LLTV crosses the new recommendation',
            'Vault config JSON stays at your chosen LLTV but the recommendation hint changes',
          ],
        },
      ],
      unchanged: [
        'All Section 1 numbers (Liquidity Need is pre-FX)',
        'All Section 3 numbers (Strategy uses static IRM evaluation, not paths)',
        'Borrow APY curve and Beta distribution charts in Section 1',
        'Annualized USD/TRY volatility (realised from history regardless of mode)',
      ],
    },
  },
  simulationHorizonDays: {
    oneLiner:
      'How far forward to simulate per path (in days). Longer horizons let more drawdown accumulate; shorter horizons fit faster but undersample tail events. 30d is the default operational window.',
  },
  pathCount: {
    oneLiner:
      'Number of Monte-Carlo paths to generate. 1000 is the sweet spot for stable percentile estimates inside the perf budget; 5000 tightens tails further at ~5× runtime.',
  },
  tryShockPct: {
    oneLiner:
      'Scenario-mode only. Magnitude of the TRY shock over the horizon. Always interpreted as TRY weakening regardless of sign: the path glides linearly from baseline to baseline × (1 + |shock|).',
  },
  blockBootstrap: {
    oneLiner:
      'Bootstrap-mode toggle. ON: resample in 5-day blocks to preserve short-run autocorrelation (more realistic clustering). OFF: pure i.i.d. resampling, fastest.',
  },
  seed: {
    oneLiner:
      'PRNG seed for path generation. Same seed → identical paths. Change to explore Monte-Carlo variability; share a seed with the team to reproduce a specific scenario.',
  },
};

// ---------------------------------------------------------------------------
// KPI help (section 2)
// ---------------------------------------------------------------------------

const threeDayMaxDrawdownP50: KpiHelp = {
  title: '3-day max drawdown — P50',
  oneLiner: 'Median worst 3-day drop in wiTRY USD value across all simulated paths. The "typical" adverse window a liquidator faces if they must hold collateral while waiting for secondary-market exit.',
  formula: {
    plain: 'for each path:\n  perPath = max over t of (max S[t..t+3] − S[t]) / S[t]\nthreeDayDD_P50 = median(perPath across paths)',
    latex: 'P50\\big(\\max_{t} \\tfrac{\\max(S_{t..t+3}) - S_t}{S_t}\\big)',
  },
  params: [
    { name: 'paths', source: 'derived', note: 'Monte-Carlo USD/TRY paths from the selected simulationMode.' },
    { name: 'window', source: 'constant', value: '3 days', note: 'Set by spec §2 to match secondary-market exit risk.' },
  ],
  definitions: [
    { term: 'S', definition: 'USD/TRY rate at a given timestep. Higher S = TRY weaker = wiTRY collateral USD value falling.' },
    { term: 'Drawdown direction', definition: 'Reported as a POSITIVE fraction. We track upward USD/TRY moves (TRY weakening) because that is what hurts the lender — see [validation report #23](/docs/superpowers/specs/2026-05-20-formula-validation-report.md).' },
    { term: 'P50', definition: 'The 50th percentile (median). Half the paths see a worse drawdown, half see a milder one.' },
  ],
  impact: {
    health: 'Anchors expected liquidator hold-loss in the middle of the distribution.',
    sustainability: 'A typical 3-day move that is sizeable means even median liquidations risk slippage losses.',
    profitability: 'Indirectly: higher median drawdowns push the recommended LLTV down, reducing borrow base.',
  },
};

const threeDayMaxDrawdownP95: KpiHelp = {
  title: '3-day max drawdown — P95',
  oneLiner: 'The tail (95th-percentile) worst 3-day drop. This is the number that drives the recommended LLTV in Section 5: the vault is sized to survive this event.',
  formula: {
    plain: 'threeDayDD_P95 = P95(perPath worst-3d drawdown across paths)',
    latex: 'P95\\big(\\max_{t} \\tfrac{\\max(S_{t..t+3}) - S_t}{S_t}\\big)',
  },
  params: [
    { name: 'paths', source: 'derived', note: 'Same Monte-Carlo paths as the P50.' },
  ],
  definitions: [
    { term: 'P95', definition: 'The 95th percentile. 5% of paths see a worse drawdown. Industry-standard tail metric for sizing collateral haircuts.' },
    { term: 'Use in LLTV derivation', definition: 'Section 5 solves for the largest LLTV such that even after a P95 3-day drawdown, plus the configured liquidator slippage and safety margin, the position is still liquidatable without bad debt.' },
  ],
  impact: {
    health: 'The single biggest input to the LLTV recommendation. If P95 widens, recommended LLTV drops.',
    sustainability: 'Stress-tests the vault against a realistic-but-not-worst-case FX event. Combine with Scenario mode for explicit black-swan tests.',
    profitability: 'A more conservative LLTV (driven by a wider P95) caps borrow demand and supplier yield.',
  },
};

const expectedLiquidationVolumeP95: KpiHelp = {
  title: 'Expected liquidation volume — P95',
  oneLiner: 'The P95 dollar volume of liquidations triggered across a single simulated horizon. Sizes the wiTRY/USDM secondary-pool depth recommendation in Section 4.',
  formula: {
    plain: 'for each path:\n  perPath = Σ liquidatedSeizedUSD across all triggered liquidations\nP95 = 95th-percentile of perPath',
    latex: 'P95\\big(\\sum_{\\text{triggered liqs}} \\text{seized USD}\\big)',
  },
  params: [
    { name: 'simulateBadDebt result', source: 'derived', note: 'Per-path total seized collateral, in USD.' },
  ],
  definitions: [
    { term: 'Per-path total', definition: 'Sum of seized collateral USD across every triggered (profitable) liquidation in that single path.' },
    { term: 'Section 4 dependency', definition: 'Recommended pool depth: ≥ this P95 volume / 2% slippage cap. Sizes the AMM so even a tail liquidation can clear without hurting the liquidator.' },
  ],
  impact: {
    health: 'Tail event sizing for the AMM that liquidators dump into. Underestimating leaves liquidators upside-down and grows bad debt.',
    sustainability: 'Determines minimum DEX TVL Brix needs to bootstrap alongside the lending market.',
    profitability: 'Pool depth is supplier capital. Bigger pool ⇒ more capital locked at AMM yield instead of Morpho yield.',
  },
  // NOTE: type field exists but worker does not yet populate it; see GH issue #4.
};

const annualizedVol: KpiHelp = {
  title: 'Annualized USD/TRY volatility',
  oneLiner: 'The realized standard deviation of daily USD/TRY log-returns over the selected historical window, scaled to a 1-year horizon. Cross-check anchor — should land in the 15–35% range (NYU V-Lab GARCH estimates).',
  formula: {
    plain: 'σ_ann = stdev(daily log returns) × √252',
    latex: '\\sigma_{\\text{ann}} = \\sigma_{\\text{daily}} \\cdot \\sqrt{252}',
  },
  params: [
    { name: 'returnsWindow', source: 'derived', note: 'Sliced from embedded Yahoo USD/TRY series by historicalPeriod.' },
    { name: '252', source: 'constant', note: 'Trading days per year (Yahoo TRY=X is weekday-only).' },
  ],
  definitions: [
    { term: 'Realized vs. implied', definition: 'This is REALIZED vol (backward-looking). Implied vol from options would be forward-looking and is not available for USD/TRY in our data source.' },
    { term: '√252 scaling', definition: 'Standard finance convention for converting daily vol to annual under the i.i.d. assumption.' },
    { term: 'GBM connection', definition: 'In GBM mode this same σ feeds the Monte-Carlo generator (along with mean log-return drift correction).' },
  ],
  impact: {
    health: 'Sanity check. A wildly different σ vs. published estimates means the historical window contains a regime shift.',
    sustainability: 'Higher σ propagates into wider P5/P95 bands → wider drawdowns → more conservative LLTV.',
    profitability: 'Indirectly via LLTV; not a direct lever.',
  },
};

export const FX_RISK_KPIS = {
  threeDayMaxDrawdownP50,
  threeDayMaxDrawdownP95,
  expectedLiquidationVolumeP95,
  annualizedVol,
};

// ---------------------------------------------------------------------------
// Chart help (section 2)
// ---------------------------------------------------------------------------

const fxBands: ChartHelp = {
  title: 'USD/TRY paths (P5 / P50 / P95)',
  oneLiner: 'The fan of simulated USD/TRY paths summarized as the 5th / 50th / 95th percentile at each day. Visualizes the range of FX outcomes the vault must withstand.',
  axes: { x: 'Day (0 = today)', y: 'USD/TRY rate (TRY per 1 USD)' },
  definitions: [
    { term: 'P5 (green)', definition: 'Optimistic — only 5% of paths are BELOW this line (TRY stronger than this).' },
    { term: 'P50 (blue)', definition: 'Median path. Equally likely to be above or below.' },
    { term: 'P95 (red)', definition: 'Pessimistic — only 5% of paths are ABOVE this line (TRY weaker than this).' },
    { term: 'Spread interpretation', definition: 'The P95–P5 gap grows over time roughly as √t under GBM. A widening gap means tail risk is accumulating.' },
  ],
  bands: [
    { name: 'Below P5 (≤ 5% of paths)', meaning: 'Best-case TRY strengthening. Collateral USD value rises; no liquidation pressure.' },
    { name: 'P5–P95 (90% of paths)', meaning: 'Typical outcome zone. The bands give the operating range.' },
    { name: 'Above P95 (≤ 5% of paths)', meaning: 'Tail TRY weakening events — what the LLTV recommendation must withstand.' },
  ],
  impact: {
    health: 'Lets you eyeball whether the chosen LLTV is robust to the P95 band, not just the median.',
    sustainability: 'A consistently rising P50 across the horizon hints at structural depreciation; collateral economics deteriorate even without volatility spikes.',
    profitability: 'Wider bands → more conservative LLTV recommended → smaller borrow base.',
  },
};

const netWitryUsdPaths: ChartHelp = {
  title: 'Net wiTRY USD value paths',
  oneLiner: 'The same Monte-Carlo paths, but expressed as wiTRY USD value: (1 + iTRYYield)^(t/365) / S(t). Shows the partial offset of iTRY yield against TRY depreciation.',
  axes: { x: 'Day (0 = today)', y: 'wiTRY USD value per 1 iTRY' },
  definitions: [
    { term: 'iTRY yield offset', definition: 'wiTRY appreciates in TRY terms at the iTRY yield rate. Even when TRY depreciates, the USD value of wiTRY falls less than 1/S would suggest.' },
    { term: 'Break-even', definition: 'wiTRY USD value stays flat when TRY depreciates exactly at the iTRY yield rate (e.g. 38%/yr). Above that, USD value falls; below, USD value rises.' },
    { term: 'Color flip vs fxBands', definition: 'Because wiTRY USD = ~1/S, the P5 of S corresponds to the P95 of wiTRY USD value and vice versa. Colors are remapped so green = good (high wiTRY USD), red = bad.' },
  ],
  impact: {
    health: 'This is what the LIQUIDATOR is actually seizing, not raw S. The yield offset is real protection.',
    sustainability: 'If iTRYYield is overstated vs. actual MMF yields, this chart over-promises the offset and the vault is undersized.',
    profitability: 'Borrow demand from leverage-loopers depends on this curve being positive over their hold horizon.',
  },
};

const positionsUnderwater: ChartHelp = {
  title: '% positions underwater by day (P50 path)',
  oneLiner: 'Along the P50 USD/TRY path, the fraction of synthetic borrowers (drawn from the Beta(α,β) LTV distribution) whose LTV exceeds LLTV at each day.',
  axes: { x: 'Day (0 = today)', y: '% of borrower population at LTV > LLTV' },
  definitions: [
    { term: 'Synthetic borrowers', definition: 'A sample of 500 LTV fractions drawn from Beta(α, β); each represents a hypothetical borrower position.' },
    { term: 'Underwater condition', definition: 'A position is underwater (liquidatable) when ltvFraction > collateralRelChange, where collateralRelChange = wiTRY USD value at t / wiTRY USD value at 0.' },
    { term: 'P50 path only', definition: 'This chart uses only the median FX path for clarity. The tail distribution drives Section 4 bad debt — not visualized here.' },
  ],
  impact: {
    health: 'Quick visual answer to "if FX moves as expected, how many positions get liquidated and when?".',
    sustainability: 'A steady rise → orderly liquidations. A cliff → systemic cascade risk; the bad-debt cascade (§4) is where the dollar consequence shows up.',
    profitability: 'High underwater fraction = high realized liquidation activity = high liquidator demand for the wiTRY/USDM AMM.',
  },
};

export const FX_RISK_CHARTS = { fxBands, netWitryUsdPaths, positionsUnderwater };
