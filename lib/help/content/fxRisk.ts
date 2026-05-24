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
            '"Net wiTRY USD value paths" chart (P5/P50/P95 curves) re-shapes — wiTRY appreciates as (1 + yield)^(t/365)',
            '"% positions underwater by day" chart shifts — higher yield inflates collateral faster, so fewer positions cross LLTV',
          ],
        },
        {
          section: 'Section 3 — Strategy',
          effects: [
            'Leverage-loop card: Loop APY = wiTRY yield − borrow × (1 + TRY depreciation). The green "Viable" / red "Not viable" badge flips if Loop APY crosses zero',
          ],
        },
        {
          section: 'Section 4 — Liquidation',
          effects: [
            'Bad-debt cascade re-runs with the new yield-adjusted collateral → P95 bad-debt USD and % TVL move',
            'Bad-debt histogram redistributes',
            'Path-aggregated P95 liquidation volume updates → recommended pool depth hint shifts',
          ],
        },
      ],
      unchanged: [
        '3-day max drawdown KPIs (P50 + P95) — measured on raw USD/TRY, no yield',
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
      'How many years of daily USD/TRY history to draw from when resampling for Bootstrap or fitting GBM drift/vol. 1Y captures the recent regime; 3Y (default) balances recent behavior with past crises; 5Y includes more tail events. Note: GBM+Jumps jump parameters (frequency, size) are calibrated from the full 2015–2025 decade and do NOT change when you switch this window.',
  },
  simulationMode: {
    oneLiner:
      'How the simulator generates 1000 imaginary TRY futures. Bootstrap (default) shuffles real history; GBM uses a math model; GBM+Jumps adds sudden crisis shocks on top; Scenario lets you hardcode a specific crash.',
    details: {
      description:
        'The simulator runs 1000 parallel "what if" futures for USD/TRY to answer: how often do positions go underwater, how fast, and how much bad debt accumulates? All four modes feed Sections 2 (FX Risk), 4 (Liquidation), and 5 (Deployment Recommendations). Section 1 (Liquidity Need) and Section 3 (Strategy) are pre-FX and do not depend on the simulation.',
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
            'GBM with random disasters added on top. Same smooth daily noise as GBM, but roughly 4 times per year (≈1.1% chance each day) a sudden extra "jump" hits — an additional TRY drop of about −5% on average (drawn from a normal distribution with mean −5%, std 4%). So a mild jump is −1% to −3%, a typical one −5%, and a severe one −9% to −13%. The jump parameters are calibrated from a decade of TRY history (2015–2025) and are fixed constants — they do NOT change when you adjust the historicalPeriod window.',
          bestFor:
            'Captures fat tails (sudden currency crises, central bank moves) without relying purely on resampling history. Good complement to Bootstrap.',
        },
        {
          name: 'Scenario',
          description:
            'Not random at all. You define one specific future: TRY weakens linearly by `tryShockPct` over the simulation horizon. All 1000 "paths" follow the same deterministic glide. Ignores all historical data and volatility estimates.',
          bestFor:
            '"What if the 2018 crisis happens again?" stress tests. Answers "would we survive X?" with certainty under that assumption, rather than giving a probability. Use to validate the LLTV against a specific scenario the team wants to defend.',
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
          section: 'Section 5 — Deployment Recommendations',
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

const threeDayMaxDrawdownP50: KpiHelp = {
  title: '3-day max drawdown — P50',
  oneLiner: 'In each of the 1000 simulated futures, find the single worst 3-day TRY crash. This is the median of those worst crashes — the "typical" hit a liquidator faces if they receive wiTRY collateral and need a few days to sell it. Half of simulated futures had a worse 3-day crash, half had a milder one.',
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
  oneLiner: 'The worst 3-day TRY crash at the 95th percentile — only 5% of simulated futures had a more severe 3-day drop. This is the tail event the LLTV is sized to survive: the vault must still be able to liquidate without bad debt even if TRY crashes this hard over any 3-day window.',
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
  oneLiner: 'The 1000 simulated TRY futures summarized as three lines at each day: the median outcome (P50) and the two tails (P5 = optimistic, P95 = pessimistic). The fan shape widens over time because uncertainty compounds — the further into the future, the more the paths diverge.',
  axes: { x: 'Day (0 = today, Day N = N calendar days from now)', y: 'USD/TRY rate (TRY per 1 USD — higher = TRY weaker)' },
  definitions: [
    { term: 'P50 (blue) — median', definition: 'Half of the 1000 simulations were worse than this, half better. The "most likely" scenario.' },
    { term: 'P5 (green) — optimistic tail', definition: 'Only 5% of simulations had TRY stronger than this. TRY held up well.' },
    { term: 'P95 (red) — pessimistic tail', definition: 'Only 5% of simulations had TRY weaker than this. This is the "things got really bad" tail — the number that drives the LLTV recommendation.' },
    { term: 'Widening fan', definition: 'The gap between P5 and P95 grows as you move right on the x-axis. This is normal: small daily uncertainties stack up, so a 30-day forecast is much wider than a 1-day forecast. It is NOT growing because TRY is getting more volatile — it reflects compounding uncertainty.' },
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
  oneLiner: 'The USD value of wiTRY collateral over time — two forces fighting each other: wiTRY accrual pushes it up (yield compounds daily), TRY depreciation pushes it down. This chart shows which one wins across the 1000 simulated futures.',
  axes: { x: 'Day (0 = today, Day N = N calendar days from now)', y: 'wiTRY USD value, normalized to 1.0 at Day 0' },
  definitions: [
    { term: 'Two competing forces', definition: 'wiTRY earns yield every day (the Turkish MMF NAV grows, giving you more TRY per wiTRY). At the same time TRY itself loses value against USD. The net USD value = (TRY per wiTRY) × (USD per TRY). If yield > depreciation rate, the value drifts up. If depreciation > yield, it drifts down. On the median path, TRY historically depreciates faster than the yield compensates, so the P50 line drifts downward.' },
    { term: 'Break-even rate', definition: 'wiTRY USD value stays flat when TRY depreciates exactly at the annualized wiTRY yield rate (e.g. 38%/yr). This is the threshold — above that depreciation rate, USD value falls; below it, USD value rises.' },
    { term: 'Reading the chart', definition: 'A value of 0.85 at Day 30 on the P95 line means: in the worst 5% of futures, the collateral is worth 85% of its original USD value after 30 days. If the loan was sized at 75% LLTV and collateral drops to 75% of original value, that position is exactly at the liquidation threshold.' },
    { term: 'Color flip vs fxBands', definition: 'Because wiTRY USD ≈ 1/S, the P5 of USD/TRY corresponds to the P95 of wiTRY USD value and vice versa. Colors are remapped so green = good (high wiTRY USD value), red = bad.' },
  ],
  impact: {
    health: 'This is what the liquidator actually seizes. The yield offset is real protection — it partially compensates for TRY depreciation before a liquidation is triggered.',
    sustainability: 'If witryYield is overstated vs. actual MMF yields, this chart over-promises the offset and the vault is undersized.',
    profitability: 'Borrow demand from leverage-loopers depends on this curve staying positive over their hold horizon.',
  },
};

const positionsUnderwater: ChartHelp = {
  title: '% positions underwater by day (P50 path)',
  oneLiner: 'Imagine 500 borrowers who all opened loans today at various collateral ratios. On the median TRY path (P50), this chart shows what percentage of those positions have collateral value drop below their loan value — i.e., become liquidatable — by each day.',
  axes: { x: 'Day (0 = today)', y: '% of borrower population whose collateral is worth less than their loan' },
  definitions: [
    { term: 'The 500 synthetic borrowers', definition: 'Not real users — 500 hypothetical positions with loan-to-value ratios spread across a realistic distribution (Beta(α, β)). Each represents one point in the plausible borrower population.' },
    { term: 'Underwater condition', definition: 'A position flips underwater when the wiTRY collateral USD value drops enough that the loan-to-value ratio exceeds the LLTV threshold. At that point the protocol can liquidate it.' },
    { term: 'Why the curve rises over time', definition: 'On the median path, TRY slowly depreciates. Collateral USD value erodes day by day. Positions opened at riskier LTVs (close to LLTV) cross the threshold first; safer positions may never cross within the horizon.' },
    { term: 'P50 path only', definition: 'This uses only the median FX future for clarity — it answers "how many positions get hit if things go as expected?" The tail scenarios (how bad it gets in the worst 5%) drive Section 4 bad debt instead.' },
  ],
  impact: {
    health: 'Quick visual answer to "if FX moves as expected, how many positions get liquidated and how quickly?".',
    sustainability: 'A gradual rise → orderly liquidations, liquidators have time to act. A sudden cliff → systemic cascade risk; the dollar consequence is in Section 4.',
    profitability: 'High underwater fraction = high liquidation activity = high demand for the wiTRY/USDM AMM.',
  },
};

const drawdownDistribution: ChartHelp = {
  title: '3-day max drawdown distribution',
  oneLiner: 'A histogram showing how often each crash size appeared across all 1000 simulated futures. Each bar answers: "in how many of our simulated futures did the worst 3-day TRY crash fall in this range?"',
  axes: {
    x: 'Crash size bucket — how much TRY dropped in its single worst 3-day window within that path (0–2%, 2–5%, … 30%+)',
    y: 'Count — number of simulated paths (out of 1000) whose worst 3-day crash landed in that bucket',
  },
  definitions: [
    {
      term: 'What one bar means',
      definition:
        'A bar of height 320 in the "5–10%" bucket means 320 of the 1000 simulated futures had their single worst 3-day TRY crash somewhere between 5% and 10%. The other 680 paths had a worst crash either smaller or larger.',
    },
    {
      term: 'How to read the shape',
      definition:
        'Bars clustered on the left = most futures have small crashes, tail risk is low. Bars spread or piled on the right = many futures contain severe crashes, tail risk is high. A long right tail (big bars at 20–30%+) is the danger zone for the vault.',
    },
    {
      term: 'Connection to P95 KPI',
      definition:
        'The P95 drawdown KPI shown above is the x-value where 95% of the histogram area sits to the LEFT. Visually: find the bar where the running total of counts hits 950 out of 1000 — that bucket\'s right edge is roughly the P95. The LLTV recommendation is calibrated to survive that number.',
    },
    {
      term: 'Why 3 days specifically',
      definition:
        'Liquidators receive seized wiTRY and need time to sell it on secondary markets. 3 days is the assumed exit window. A crash that happens faster than liquidators can act means they absorb a loss — which is the bad debt the vault must budget for.',
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

export const FX_RISK_CHARTS = { fxBands, netWitryUsdPaths, positionsUnderwater, drawdownDistribution };
