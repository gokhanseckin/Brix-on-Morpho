import Link from 'next/link';
import { dailyLogReturns, windowRows } from '@/lib/fxData';
import raw from '@/lib/usdtryData.json';
import { LIF } from '@/lib/morphoMath';
import { deriveRecommendedLLTV, snapToGovernanceLLTV } from '@/lib/simulator';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';

type Row = { date: string; rate: number };

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx] ?? 0;
}

function maxKDayDrawdown(wiUSD: number[], k: number): { p50: number; p90: number; p95: number; p99: number; max: number } {
  const out: number[] = [];
  for (let i = k; i < wiUSD.length; i++) {
    let peak = wiUSD[i - k]!;
    for (let j = 1; j <= k; j++) {
      const v = wiUSD[i - j]!;
      if (v > peak) peak = v;
    }
    const cur = wiUSD[i]!;
    out.push(-(cur - peak) / peak);
  }
  out.sort((a, b) => a - b);
  return {
    p50: quantile(out, 0.5),
    p90: quantile(out, 0.9),
    p95: quantile(out, 0.95),
    p99: quantile(out, 0.99),
    max: out[out.length - 1] ?? 0,
  };
}

function nextLargerTier(tier: LLTV): LLTV | null {
  const sorted = [...GOV_LLTVS].sort((a, b) => a - b);
  for (const t of sorted) {
    if (t > tier) return t;
  }
  return null;
}

function pct(x: number, d = 2): string {
  return `${(x * 100).toFixed(d)}%`;
}

export default function LLTVPage() {
  const rows = (raw as { rows: Row[] }).rows;
  const fiveY = windowRows(rows as Row[], 5);
  const first = fiveY[0]!;
  const last = fiveY[fiveY.length - 1]!;

  const rates = fiveY.map((r) => r.rate);
  const wiUSD = rates.map((r) => 1 / r); // wiTRY value in USD ∝ 1/USDTRY
  const logR = dailyLogReturns(fiveY as Row[]);
  const mean = logR.reduce((a, b) => a + b, 0) / logR.length;
  const variance = logR.reduce((a, b) => a + (b - mean) ** 2, 0) / (logR.length - 1);
  const annVol = Math.sqrt(variance) * Math.sqrt(252);
  const annDrift = mean * 252;

  const dd1 = maxKDayDrawdown(wiUSD, 1);
  const dd3 = maxKDayDrawdown(wiUSD, 3);
  const dd7 = maxKDayDrawdown(wiUSD, 7);
  const dd30 = maxKDayDrawdown(wiUSD, 30);

  // Calibration assumptions
  const slippage = 0.01;
  const safetyMargin = 0.03;
  const p95Drawdown = dd3.p95;

  const derived = deriveRecommendedLLTV({ p95Drawdown, slippage, safetyMargin });
  const recommended = snapToGovernanceLLTV(derived.raw);
  const lifAtRecommended = LIF(recommended);
  const oneStepLarger = nextLargerTier(recommended);
  const lifAtOneStep = oneStepLarger ? LIF(oneStepLarger) : null;

  // What it would take for the next-larger tier to be the snap result.
  // Solve for max p95dd such that derived raw >= oneStepLarger:
  //   raw = (1 - dd) / (LIF(L) (1+slip)) - safety   (fixed-point ~ L = raw)
  //   require raw >= oneStepLarger  =>  dd <= 1 - (oneStepLarger + safety) * LIF(oneStepLarger) * (1+slip)
  const ddCeilingForNext = oneStepLarger
    ? Math.max(0, 1 - (oneStepLarger + safetyMargin) * lifAtOneStep! * (1 + slippage))
    : null;
  // Slippage that would push raw up to oneStepLarger, holding dd & safety fixed:
  //   (1+slip) <= (1-dd) / ((oneStepLarger+safety) * LIF(oneStepLarger))
  const slipCeilingForNext = oneStepLarger
    ? Math.max(0, (1 - p95Drawdown) / ((oneStepLarger + safetyMargin) * lifAtOneStep!) - 1)
    : null;
  // Safety margin that would push raw up to oneStepLarger:
  const safetyCeilingForNext = oneStepLarger
    ? Math.max(0, (1 - p95Drawdown) / (lifAtOneStep! * (1 + slippage)) - oneStepLarger)
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <h1 className="text-lg font-semibold">LLTV calibration — 5-year USDTRY</h1>
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to dashboard
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recommendation</h2>
        <div className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4">
          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
            LLTV = {pct(recommended, 1)}
          </div>
          <p className="text-sm mt-1 text-neutral-700 dark:text-neutral-300">
            Snapped down from raw {derived.raw.toFixed(4)} ({pct(derived.raw, 2)}) to the nearest
            governance tier. Risk tier: <strong>Moderate</strong>.
          </p>
        </div>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">Data window</h2>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Yahoo Finance <code>TRY=X</code> daily close, {first.date} → {last.date} ({fiveY.length}{' '}
          trading days). Source: <code>lib/usdtryData.json</code>.
        </p>
        <table className="text-sm w-full max-w-md">
          <tbody>
            <tr>
              <td className="py-1 text-neutral-500">Annualized vol (USDTRY log-returns)</td>
              <td className="text-right font-mono">{pct(annVol, 2)}</td>
            </tr>
            <tr>
              <td className="py-1 text-neutral-500">Annualized drift (TRY depreciation)</td>
              <td className="text-right font-mono">+{pct(annDrift, 2)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">wiTRY-in-USD drawdowns</h2>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          wiTRY is iTRY held as collateral; its USD value moves with <code>1 / USDTRY</code>. The
          k-day drawdown at day <em>t</em> is the worst loss from the peak of the prior k days. This
          is what a liquidator faces if oracle and on-chain price diverge during a window of length
          k.
        </p>
        <table className="text-sm w-full max-w-2xl border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <th className="text-left py-1">Window</th>
              <th className="text-right py-1">p50</th>
              <th className="text-right py-1">p90</th>
              <th className="text-right py-1">p95</th>
              <th className="text-right py-1">p99</th>
              <th className="text-right py-1">max</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {[
              { k: '1d', d: dd1 },
              { k: '3d', d: dd3 },
              { k: '7d', d: dd7 },
              { k: '30d', d: dd30 },
            ].map((r) => (
              <tr key={r.k} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="py-1 font-sans">{r.k}</td>
                <td className="text-right">{pct(r.d.p50)}</td>
                <td className="text-right">{pct(r.d.p90)}</td>
                <td className="text-right">{pct(r.d.p95)}</td>
                <td className="text-right">{pct(r.d.p99)}</td>
                <td className="text-right">{pct(r.d.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">Formula</h2>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          The recommended LLTV is the largest L such that, after a p95 collateral drawdown and
          liquidator-pays-slippage-and-LIF, the liquidator still breaks even with a safety buffer.
          From <code>lib/simulator.ts</code>:
        </p>
        <pre className="rounded bg-neutral-100 dark:bg-neutral-900 p-3 text-sm overflow-x-auto">
{`L = (1 − p95Drawdown) / (LIF(L) · (1 + slippage)) − safetyMargin`}
        </pre>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Solved by fixed-point iteration starting at L = 0.80, then snapped down to the nearest
          governance LLTV in <code>GOV_LLTVS</code>.
        </p>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">Assumptions</h2>
        <ul className="text-sm space-y-2 list-disc pl-5 text-neutral-700 dark:text-neutral-300">
          <li>
            <strong>Drawdown horizon = 3 days.</strong> Matches the worker&apos;s
            <code> threeDayMaxDrawdown</code> output and is a realistic upper bound on the time
            between oracle update / liquidation eligibility and execution under sustained TRY shock.
          </li>
          <li>
            <strong>Drawdown percentile = p95.</strong> The liquidator must remain profitable in
            1-in-20 stress days; deeper tail (p99) is intentionally absorbed by pre-liquidation +
            safety margin, not by lowering LLTV.
          </li>
          <li>
            <strong>USDM/TRY-stable pool slippage = {pct(slippage)}.</strong> Liquidators acquire
            USDM (or sell seized wiTRY into a TRY-stable pool) and lose ~1% to AMM depth at expected
            P95 liquidation volume. Driven by the <code>poolDepth_USD</code> sidebar input.
          </li>
          <li>
            <strong>Safety margin = {pct(safetyMargin)}.</strong> Explicit cushion on top of LIF +
            slippage to cover oracle staleness, gas, MEV competition for the liquidation, and
            modeling error.
          </li>
          <li>
            <strong>5-year history is representative.</strong> Covers two major TRY regimes (2021
            crisis + 2023–24 stabilization), so the p95 3-day drawdown of {pct(p95Drawdown)} is
            treated as a stable input to calibration. Bootstrap re-sampling of these returns is
            what feeds the worker&apos;s Monte Carlo.
          </li>
          <li>
            <strong>LIF(L) is Morpho-canonical:</strong>{' '}
            <code>LIF(L) = min(1.15, 1 / (β·L + (1−β)))</code> with β = 0.3, locked by tests in{' '}
            <code>tests/morphoMath.test.ts</code>.
          </li>
        </ul>
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">Walk-through</h2>
        <pre className="rounded bg-neutral-100 dark:bg-neutral-900 p-3 text-sm overflow-x-auto">
{`p95 3-day drawdown    = ${pct(p95Drawdown, 4)}
slippage              = ${pct(slippage, 2)}
safety margin         = ${pct(safetyMargin, 2)}

fixed-point at L ≈ ${derived.raw.toFixed(4)}:
  LIF(L)              = ${lifAtRecommended.toFixed(4)} (recompute below with snap)
  (1 + slippage)      = ${(1 + slippage).toFixed(4)}
  (1 − p95Drawdown)   = ${(1 - p95Drawdown).toFixed(4)}
  L_raw               = (1 − ${p95Drawdown.toFixed(4)}) / (LIF · ${(1 + slippage).toFixed(4)}) − ${safetyMargin.toFixed(2)}
                      = ${derived.raw.toFixed(4)}

snap to GOV_LLTVS     → ${recommended}  (= ${pct(recommended, 1)})
LIF(${recommended})              = ${lifAtRecommended.toFixed(4)}`}
        </pre>
      </section>

      {oneStepLarger !== null && (
        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">
            Bumping one step to {pct(oneStepLarger, 1)}
          </h2>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            The next governance tier above {pct(recommended, 1)} is{' '}
            <strong>{pct(oneStepLarger, 1)}</strong>. The raw derivation currently lands at{' '}
            <code>{derived.raw.toFixed(4)}</code>, which is{' '}
            {derived.raw >= oneStepLarger ? 'above' : 'below'} the bump threshold. For{' '}
            {pct(oneStepLarger, 1)} to be the snap result, any <em>one</em> of the following must
            hold (others held at current values):
          </p>

          <table className="text-sm w-full max-w-3xl border-collapse">
            <thead>
              <tr className="border-b border-neutral-300 dark:border-neutral-700">
                <th className="text-left py-1">Knob</th>
                <th className="text-right py-1">Current</th>
                <th className="text-right py-1">Required to snap to {pct(oneStepLarger, 1)}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="py-1 font-sans">p95 3-day drawdown</td>
                <td className="text-right">{pct(p95Drawdown, 3)}</td>
                <td className="text-right">≤ {pct(ddCeilingForNext!, 3)}</td>
              </tr>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="py-1 font-sans">Slippage</td>
                <td className="text-right">{pct(slippage, 2)}</td>
                <td className="text-right">
                  {slipCeilingForNext! > 0 ? `≤ ${pct(slipCeilingForNext!, 3)}` : 'infeasible at current dd+safety'}
                </td>
              </tr>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="py-1 font-sans">Safety margin</td>
                <td className="text-right">{pct(safetyMargin, 2)}</td>
                <td className="text-right">
                  {safetyCeilingForNext! > 0 ? `≤ ${pct(safetyCeilingForNext!, 3)}` : 'infeasible'}
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-base font-semibold mt-4">What that means operationally</h3>
          <ul className="text-sm space-y-2 list-disc pl-5 text-neutral-700 dark:text-neutral-300">
            <li>
              <strong>Drawdown ceiling ({pct(ddCeilingForNext!, 2)}).</strong> The current 5-year
              p95 is {pct(p95Drawdown, 2)} — a soft pre-liquidation that cuts positions on a smaller
              loss (e.g., 2% trigger) would effectively shorten the tail the LLTV needs to cover,
              moving the operative drawdown below this ceiling.
            </li>
            <li>
              <strong>Slippage ceiling ({pct(slipCeilingForNext!, 2)}).</strong> Achieved by
              deepening the USDM↔TRY-stable pool so that the P95 expected liquidation volume costs
              under {pct(slipCeilingForNext!, 2)} round-trip. The sidebar&apos;s{' '}
              <code>poolDepth_USD</code> input drives this directly.
            </li>
            <li>
              <strong>Safety margin ({pct(safetyCeilingForNext!, 2)}).</strong> Tightening this is
              the cheapest knob but the riskiest — it eats the buffer for oracle staleness, MEV, and
              modeling error. Only acceptable once the oracle pipeline and liquidator competition
              are demonstrably tight on mainnet.
            </li>
            <li>
              <strong>Combine, do not stack.</strong> All three knobs move in the same direction; a
              realistic upgrade path is a small move on each (e.g., pre-liq trigger trims dd to
              ~2%, pool depth trims slip to 0.5%) rather than betting the whole bump on one.
            </li>
            <li>
              <strong>Tail check.</strong> The p99 3-day drawdown is {pct(dd3.p99, 2)} and the
              worst observed is {pct(dd3.max, 2)}. At {pct(oneStepLarger, 1)} a p99 event would
              still produce bad debt — the bump is only defensible if pre-liquidation P95 bad-debt
              output (see the Liquidation section of the dashboard) stays under the vault&apos;s
              tolerance after re-running the simulator with the new LLTV.
            </li>
          </ul>
        </section>
      )}

      <section className="space-y-3 mt-8">
        <h2 className="text-xl font-semibold">Caveats</h2>
        <ul className="text-sm space-y-2 list-disc pl-5 text-neutral-700 dark:text-neutral-300">
          <li>
            This page is a <strong>point estimate</strong> using the historical 5-year window
            directly. The full simulator runs bootstrap / GBM / Scenario paths and may produce a
            slightly different recommended LLTV when the user changes mode or pathCount.
          </li>
          <li>
            Out of scope: oracle manipulation, LayerZero outage, MEV-driven liquidation failure,
            and TRY regime breaks beyond what the 5-year window contains. See the README
            &quot;Out of Scope&quot; list.
          </li>
        </ul>
      </section>
    </div>
  );
}
