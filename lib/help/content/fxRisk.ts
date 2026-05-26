// lib/help/content/fxRisk.ts
// Real content for Section 2 (FX Risk). PR #4 (roadmap).
import type { ChartHelp, KpiHelp, ParamHelp } from '../types';

// ---------------------------------------------------------------------------
// Sidebar parameter tooltips (section 2)
// ---------------------------------------------------------------------------

export const FX_RISK_PARAMS: Partial<Record<string, ParamHelp>> = {
  witryYieldAnnual: {
    oneLiner:
      'Annual yield wiTRY earns by holding iTRY as the Turkish-MMF NAV grows, as a decimal. iTRY itself is a 1:1 stable peg to TRY; the yield accrues at the wiTRY (wrapper) level. Drives the "wiTRY appreciates over time in TRY terms" effect that partially offsets TRY depreciation. Default 38% ≈ typical Turkish MMF.',
    details: {
      description:
        'The wiTRY annual yield drives how fast the wrapper appreciates in TRY terms via MMF NAV growth. Anywhere collateral is valued over time, this yield compounds against TRY depreciation. Note the raw USD/TRY paths themselves are independent of yield — only the yield-adjusted collateral views move when you change this slider.',
      downstream: [
        {
          section: 'Section 2 — FX Risk',
          effects: [
            '"Net wiTRY USD value paths" chart (P1/P5/P50/P95 curves) re-shapes — wiTRY appreciates as (1 + yield)^(t/365)',
          ],
        },
        {
          section: 'Section 3 — Strategy',
          effects: [
            'Carry-only loop card: wiTRY yield is one input to deterministic loop APY. The badge compares Loop wiTRY against Hold wiTRY; it does not subtract an assumed FX depreciation surcharge.',
          ],
        },
        {
          section: 'Section 4 — Liquidation',
          effects: [
            'Bad-debt cascade re-runs with the new yield-adjusted collateral → P95 bad-debt USD and % TVL move',
            'Bad-debt histogram redistributes',
            'Full-horizon cumulative executed liquidation volume updates; the homepage labels it as LP/LVR burden rather than the 1-day liquidity gate',
          ],
        },
      ],
      unchanged: [
        '1-day max drawdown KPIs (P50 + P95) — measured on raw USD/TRY, no yield',
        'USD/TRY paths chart (the raw FX fan)',
        'Drawdown histogram — derived from raw FX paths',
        'Annualized USD/TRY volatility — realised from history',
        'Recommended LLTV (Section 5) — driven by P95 of the raw-FX drawdown, not yield-adjusted',
        'All Section 1 numbers (Liquidity Need is pre-FX)',
      ],
    },
  },
  usdtryBaseline: {
    oneLiner:
      'USD/TRY rate at t=0 (TRY per 1 USD). All path simulations start from this anchor. Defaults to the latest value in the embedded Yahoo USD/TRY series; override for stress-scenario sensitivity.',
  },
  historicalPeriod: {
    oneLiner:
      'How many years of daily USD/TRY history to use for Bootstrap or to fit GBM drift and volatility. 1Y emphasizes the recent regime; 5Y is the current default and includes more tail events. GBM+Jumps adds fixed jump assumptions after fitting the selected window.',
  },
  simulationMode: {
    oneLiner:
      'How the simulator generates TRY futures. Bootstrap resamples real history; GBM uses a fitted diffusion; GBM+Jumps adds fixed crisis-jump assumptions; Scenario runs one deterministic TRY-weakening path.',
    details: {
      description:
        'The simulator runs the chosen number of "what if" USD/TRY futures, except Scenario mode which creates one deterministic path. Paths feed FX Risk, Liquidation, and Deployment Recommendations. Liquidity Need and the deterministic Strategy cards do not use these paths.',
      options: [
        {
          name: 'Bootstrap (default)',
          description:
            'Takes the actual historical daily TRY moves from the embedded dataset, shuffles them randomly, and strings them together to build each fake future path. Day 1: pick a random real historical day\'s move. Day 2: pick another. Repeat for the full horizon. Because you\'re resampling real moves, crashes like −15% in a day (Aug 2018, Nov 2021) can and do appear. The `blockBootstrap` toggle pulls 5-day blocks instead of single days to preserve crisis sequences (see below).',
          bestFor:
            'Default choice. The real distribution of TRY moves — including past crises — is already in the data. What actually happened can happen again.',
        },
        {
          name: 'Block Bootstrap',
          description:
            'Same as Bootstrap, but instead of picking one day at a time, the simulator picks consecutive 5-day blocks of history and inserts them together. This preserves the fact that TRY crises don\'t last one day — they persist for weeks. Plain Bootstrap breaks up real crisis sequences into scattered noise; Block Bootstrap keeps them intact. Enable via the `blockBootstrap` toggle when in Bootstrap mode.',
          bestFor:
            'When you want Bootstrap realism but also want to model realistic crisis durations (volatility clustering).',
        },
        {
          name: 'GBM (Geometric Brownian Motion)',
          description:
            'Forgets history entirely and models TRY as a math formula. Each day\'s move is drawn from a bell curve (normal distribution) using drift μ and volatility σ fitted from the historical window. Produces smooth random walks with no sudden jumps. Because TRY moves are not bell-curve shaped in reality (they have fat tails), GBM will rarely simulate a 20%+ single-day crash even if that\'s happened historically — it systematically underestimates extreme events.',
          bestFor:
            'Textbook baseline. Compare against Bootstrap to see how much of the tail risk comes from real history vs. the normal-distribution assumption. If even GBM shows bad debt risk, you\'re definitely in trouble.',
        },
        {
          name: 'GBM+Jumps (Merton jump-diffusion)',
          description:
            'GBM with occasional upward USD/TRY jumps added on top. The implementation uses fixed assumptions of about four jumps per year with mean log jump 5% and standard deviation 4%; an upward USD/TRY jump means TRY weakened and collateral lost USD value.',
          bestFor:
            'Captures fat tails (sudden currency crises, central bank moves) without relying purely on resampling history. Good complement to Bootstrap.',
        },
        {
          name: 'Scenario',
          description:
            'Not random at all. You define one specific future: TRY weakens linearly by `tryShockPct` over the simulation horizon. The worker returns one deterministic glide, regardless of the path-count setting, and ignores historical data for that path.',
          bestFor:
            '"What if the 2018 crisis happens again?" stress tests. Answers "would we survive X?" with certainty under that assumption, rather than giving a probability. Use to validate the LLTV against a specific scenario the team wants to defend.',
        },
      ],
      downstream: [
        {
          section: 'Section 2 — FX Risk',
          effects: [
            'USD/TRY P5/P50/P95/P99 fan (`fxBands` chart) re-shapes',
            'Net wiTRY USD value P1/P5/P50/P95 paths update',
            '1-day max drawdown P50 and P95 KPIs update',
          ],
        },
        {
          section: 'Section 4 — Liquidation',
          effects: [
            'Bad-debt cascade re-runs against the new paths → P95 bad-debt USD and % TVL move',
            'Bad-debt histogram redistributes',
            'Cumulative executed liquidation volume across a path updates; it is reported as AMM burden, while the 1-day concurrent-stress card checks clustered capacity',
          ],
        },
        {
          section: 'Section 5 — Deployment Recommendations',
          effects: [
            'Recommended LLTV re-derives from the new P95 1-day drawdown',
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
      'How many days forward each simulated path runs. Day 0 = today; Day N = N days from now. The x-axis on all FX Risk charts goes from 0 to this number. Longer horizons let more drawdown accumulate; shorter horizons model a tighter liquidation window. 30 days is the default.',
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
      'Bootstrap-mode toggle. ON: resample history in consecutive 5-day blocks instead of one day at a time. This preserves real crisis sequences — TRY crises last weeks, not single days, so block sampling keeps them intact rather than scattering them as noise. OFF: pure day-by-day resampling, fastest.',
  },
  seed: {
    oneLiner:
      'PRNG seed for path generation. Same seed → identical paths. Change to explore Monte-Carlo variability; share a seed with the team to reproduce a specific scenario.',
  },
};

// ---------------------------------------------------------------------------
// KPI help (section 2)
// ---------------------------------------------------------------------------

const oneDayMaxDrawdownP50: KpiHelp = {
  title: '1-day max drawdown — P50',
  oneLiner: 'In each generated FX path, find the single worst 1-day TRY weakening. This is the median of those per-path worst moves: half the paths are milder and half are worse.',
  formula: {
    plain: 'for each path:\n  perPath = max over t of (S[t+1] − S[t]) / S[t]\noneDayDD_P50 = median(perPath across paths)',
    latex: 'P50\\big(\\max_{t} \\tfrac{S_{t+1} - S_t}{S_t}\\big)',
  },
  params: [
    { name: 'paths', source: 'derived', note: 'Monte-Carlo USD/TRY paths from the selected simulationMode.' },
    { name: 'window', source: 'constant', value: '1 day', note: 'Matches the /lltv execution horizon — the time a liquidator realistically has to act before further FX move accumulates.' },
  ],
  definitions: [
    { term: 'S', definition: 'USD/TRY rate at a given timestep. Higher S = TRY weaker = wiTRY collateral USD value falling.' },
    { term: 'Drawdown direction', definition: 'Reported as a POSITIVE fraction. We track upward USD/TRY moves (TRY weakening) because that is what hurts the lender.' },
    { term: 'P50', definition: 'The 50th percentile (median). Half the paths see a worse drawdown, half see a milder one.' },
  ],
  impact: {
    health: 'Anchors expected liquidator hold-loss in the middle of the distribution.',
    sustainability: 'A typical 1-day move that is sizeable means even median liquidations risk slippage losses.',
    profitability: 'Indirectly: higher median drawdowns push the recommended LLTV down, reducing borrow base.',
  },
};

const oneDayMaxDrawdownP95: KpiHelp = {
  title: '1-day max drawdown — P95',
  oneLiner: 'The worst 1-day TRY crash at the 95th percentile — only 5% of simulated futures had a more severe single-day drop. This is the tail event the LLTV is sized to survive: the vault must still be able to liquidate without bad debt even if TRY crashes this hard inside one day.',
  formula: {
    plain: 'oneDayDD_P95 = P95(perPath worst-1d drawdown across paths)',
    latex: 'P95\\big(\\max_{t} \\tfrac{S_{t+1} - S_t}{S_t}\\big)',
  },
  params: [
    { name: 'paths', source: 'derived', note: 'Same Monte-Carlo paths as the P50.' },
  ],
  definitions: [
    { term: 'P95', definition: 'The 95th percentile. 5% of paths see a worse drawdown. Industry-standard tail metric for sizing collateral haircuts. /lltv exposes a P95/P99/P99.9 selector to dial tail protectiveness.' },
    { term: 'Use in LLTV derivation', definition: '/lltv solves for the largest LLTV such that even after a P95 1-day drawdown, plus the configured liquidator slippage and safety margin, the position is still liquidatable without bad debt.' },
  ],
  impact: {
    health: 'The single biggest input to the LLTV recommendation. If P95 widens, recommended LLTV drops.',
    sustainability: 'Stress-tests the vault against a realistic-but-not-worst-case 1-day FX event. Toggle /lltv to P99/P99.9 for tail-protective sizing.',
    profitability: 'A more conservative LLTV (driven by a wider P95) caps borrow demand and supplier yield.',
  },
};

const expectedLiquidationVolumeP95: KpiHelp = {
  title: 'Cumulative executed liquidation volume — P95',
  oneLiner: 'The 95th-percentile total AMM proceeds from profitable pre-liquidations and hard liquidations executed over one full simulated path. It describes AMM turnover and LP/LVR burden, not a single-day capacity requirement.',
  formula: {
    plain: 'for each path:\n  volume = sum(executed pre-liq seized USD + executed hard-liq AMM revenue)\nP95 = 95th percentile of volume across paths',
    latex: 'P95\\big(\\sum_{\\text{executed liquidations}} \\text{AMM volume USD}\\big)',
  },
  params: [
    { name: 'simulateBadDebt result', source: 'derived', note: 'Per-path executed liquidation AMM volume in USD; unprofitable attempts are not counted.' },
  ],
  definitions: [
    { term: 'Per-path total', definition: 'The worker adds profitable pre-liquidation seized amounts and profitable hard-liquidation AMM revenue during the whole simulated horizon. An unprofitable attempted liquidation contributes no executed volume.' },
    { term: 'Different from concurrent stress', definition: 'A pool can process volume over many rebalanced swaps. The homepage concurrent-stress tile instead compares one day of clustered seized collateral with an assumed refill capacity.' },
  ],
  impact: {
    health: 'High cumulative volume signals that many positions require intervention, even if each individual liquidation clears.',
    sustainability: 'Useful for assessing whether LPs face repeated adverse-flow exposure through the simulation horizon.',
    profitability: 'Executed liquidation flow creates fees but also potential loss-versus-rebalancing exposure for LPs.',
  },
  // NOTE: type field exists but worker does not yet populate it; see GH issue #4.
};

const annualizedVol: KpiHelp = {
  title: 'Annualized USD/TRY volatility',
  oneLiner: 'The realized standard deviation of daily USD/TRY log-returns over the selected historical window, scaled to a one-year trading horizon.',
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
  oneDayMaxDrawdownP50,
  oneDayMaxDrawdownP95,
  expectedLiquidationVolumeP95,
  annualizedVol,
};

// ---------------------------------------------------------------------------
// Chart help (section 2)
// ---------------------------------------------------------------------------

const fxBands: ChartHelp = {
  title: 'USD/TRY paths (P5 / P50 / P95 / P99)',
  oneLiner: 'The generated TRY futures summarized as four lines at each day: median (P50), optimistic and pessimistic tails (P5 / P95), and deep tail (P99). When more than one path exists, the fan generally widens over time as uncertainty accumulates.',
  axes: { x: 'Day (0 = today, Day N = N calendar days from now)', y: 'USD/TRY rate (TRY per 1 USD — higher = TRY weaker)' },
  definitions: [
    { term: 'P50 (blue) — median', definition: 'Half of the generated paths are worse than this and half are better. In Scenario mode, all percentile lines come from the same one path.' },
    { term: 'P5 (green) — optimistic tail', definition: 'Only 5% of simulations had TRY stronger than this. TRY held up well.' },
    { term: 'P95 (red) — pessimistic tail', definition: 'Only 5% of simulations had TRY weaker than this. The "things got really bad" tail — the number that drives the default LLTV recommendation on /lltv.' },
    { term: 'P99 (purple, dashed) — deep tail', definition: 'Only 1% of simulations had TRY weaker than this. Use /lltv\'s P99 selector to size LLTV against this tighter tail when you want extra margin for rare events.' },
    { term: 'Widening fan', definition: 'The gap between P5 and P95/P99 grows as you move right on the x-axis. This is normal: small daily uncertainties stack up, so a 30-day forecast is much wider than a 1-day forecast. It is NOT growing because TRY is getting more volatile — it reflects compounding uncertainty.' },
  ],
  bands: [
    { name: 'Below P5 (≤ 5% of paths)', meaning: 'Best-case TRY strengthening. Collateral USD value rises; no liquidation pressure.' },
    { name: 'P5–P95 (90% of paths)', meaning: 'Typical outcome zone. The bands give the operating range.' },
    { name: 'P95–P99 (≈ 4% of paths)', meaning: 'Standard tail. P95 anchors the default LLTV; the gap to P99 quantifies how much extra you give up by sizing tail-protective.' },
    { name: 'Above P99 (≤ 1% of paths)', meaning: 'Deep tail TRY weakening — what the P99 LLTV recommendation must withstand.' },
  ],
  impact: {
    health: 'Lets you eyeball whether the chosen LLTV is robust to the P95 band, not just the median.',
    sustainability: 'A consistently rising P50 across the horizon hints at structural depreciation; collateral economics deteriorate even without volatility spikes.',
    profitability: 'Wider bands → more conservative LLTV recommended → smaller borrow base.',
  },
};

const netWitryUsdPaths: ChartHelp = {
  title: 'Net wiTRY USD value paths',
  oneLiner: 'The USD value of wiTRY collateral over time — two forces fighting each other: wiTRY accrual pushes it up (yield compounds daily), TRY depreciation pushes it down. Shown as P1 / P5 / P50 / P95 percentiles OF NET VALUE (P1 dashed purple is the deepest adverse tail).',
  axes: { x: 'Day (0 = today, Day N = N calendar days from now)', y: 'wiTRY value proxy = accrual / USDTRY; starts at 1 / baseline, not 1.0' },
  definitions: [
    { term: 'Two competing forces', definition: 'wiTRY earns yield every day (the Turkish MMF NAV grows, giving you more TRY per wiTRY). At the same time TRY itself loses value against USD. The net USD value = (TRY per wiTRY) × (USD per TRY). If yield > depreciation rate, the value drifts up. If depreciation > yield, it drifts down. On the median path, TRY historically depreciates faster than the yield compensates, so the P50 line drifts downward.' },
    { term: 'Break-even rate', definition: 'wiTRY USD value stays flat when TRY depreciates exactly at the annualized wiTRY yield rate (e.g. 38%/yr). This is the threshold — above that depreciation rate, USD value falls; below it, USD value rises.' },
    { term: 'Reading the chart', definition: 'The chart plots (1 + wiTRY yield)^(days/365) / USDTRY, so at a baseline of 45 its day-zero level is 1/45. To read a percentage gain or loss, compare a later point with its day-zero point.' },
    { term: 'Color flip vs fxBands', definition: 'Because wiTRY USD ≈ 1/S, percentiles of USD/TRY invert when mapped to net wiTRY USD value: the P95 USD/TRY (TRY weak, bad for the lender) becomes the P5 of net wiTRY value, and the P99 USD/TRY tail (worst FX) becomes the P1 of net wiTRY value. Colors are remapped so green = good (high wiTRY USD value), red = bad. The P1 net-value line — the deepest adverse tail — is drawn dashed purple.' },
  ],
  impact: {
    health: 'This is what the liquidator actually seizes. The yield offset is real protection — it partially compensates for TRY depreciation before a liquidation is triggered.',
    sustainability: 'If witryYield is overstated vs. actual MMF yields, this chart over-promises the offset and the vault is undersized.',
    profitability: 'Borrow demand from leverage-loopers depends on this curve staying positive over their hold horizon.',
  },
};

const drawdownDistribution: ChartHelp = {
  title: '1-day max drawdown distribution',
  oneLiner: 'A histogram of the worst one-day TRY weakening in each generated path. Each bar counts how many paths have their worst daily move in that range.',
  axes: {
    x: 'Crash size bucket — how much TRY dropped in its single worst 1-day window within that path (0–2%, 2–5%, … 30%+)',
    y: 'Count — number of generated paths whose worst 1-day crash landed in that bucket',
  },
  definitions: [
    {
      term: 'What one bar means',
      definition:
        'A bar of height 32 in the "5-10%" bucket means 32 generated paths had their worst one-day TRY crash somewhere between 5% and 10%.',
    },
    {
      term: 'How to read the shape',
      definition:
        'Bars clustered on the left = most futures have small crashes, tail risk is low. Bars spread or piled on the right = many futures contain severe crashes, tail risk is high. A long right tail (big bars at 20–30%+) is the danger zone for the vault.',
    },
    {
      term: 'Connection to P95 / P99 KPIs',
      definition:
        'The P95 drawdown is the x-value where about 95% of the path count lies to the left. /lltv exposes P95/P99/P99.9 selectors that calibrate LLTV against this same distribution at successively deeper tails.',
    },
    {
      term: 'Why 1 day specifically',
      definition:
        'The realistic execution window: liquidators can act within minutes-to-hours via the wiTRY/USDM secondary market, so the relevant FX shock is what TRY does inside one day. Longer windows (3-day, 7-day) blur in slower secondary-market exit risk, which is no longer the binding constraint after the AMM ladder design on /swapliquidity.',
    },
  ],
  impact: {
    health:
      'Bars shifting right (larger crashes becoming common) means the P95 drawdown widens → recommended LLTV drops → the vault becomes more conservative to stay solvent.',
    sustainability:
      'A fat right tail means even at P95 sizing there are occasional paths that blow past the threshold. Combine with Scenario mode to stress-test specific historical crisis magnitudes.',
    profitability:
      'A wider distribution forces a lower LLTV recommendation → smaller borrow base → less yield for suppliers. Tighter crash distributions allow more aggressive LLTVs and higher capital efficiency.',
  },
};

export const FX_RISK_CHARTS = { fxBands, netWitryUsdPaths, drawdownDistribution };
