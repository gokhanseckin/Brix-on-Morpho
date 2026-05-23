'use client';
import { useMemo } from 'react';
import { TopNav } from '@/app/components/TopNav';
import { dailyLogReturns, windowRows } from '@/lib/fxData';
import raw from '@/lib/usdtryData.json';
import { LIF } from '@/lib/morphoMath';
import { useSimulator } from '@/lib/useSimulator';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';
import { LLTVSidebar } from './LLTVSidebar';

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

function nextLargerTier(tier: LLTV | 0): LLTV | null {
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
  const sim = useSimulator();

  // Historical reference (kept for pedagogical context — drawdowns table,
  // vol/drift summary). The actual recommendation is driven by useSimulator
  // so this page renders identically to the home page's recommendation.
  const historical = useMemo(() => {
    const rows = (raw as { rows: Row[] }).rows;
    const fiveY = windowRows(rows as Row[], 5);
    const first = fiveY[0]!;
    const last = fiveY[fiveY.length - 1]!;
    const rates = fiveY.map((r) => r.rate);
    const wiUSD = rates.map((r) => 1 / r);
    const logR = dailyLogReturns(fiveY as Row[]);
    const mean = logR.reduce((a, b) => a + b, 0) / logR.length;
    const variance = logR.reduce((a, b) => a + (b - mean) ** 2, 0) / (logR.length - 1);
    const annVol = Math.sqrt(variance) * Math.sqrt(252);
    const annDrift = mean * 252;
    return {
      first,
      last,
      days: fiveY.length,
      annVol,
      annDrift,
      dd1: maxKDayDrawdown(wiUSD, 1),
      dd3: maxKDayDrawdown(wiUSD, 3),
      dd7: maxKDayDrawdown(wiUSD, 7),
      dd30: maxKDayDrawdown(wiUSD, 30),
    };
  }, []);

  // Live inputs from useSimulator — same pipeline as the home page. We read
  // p95Drawdown / slippage from lltvDerivation (not recompute) so this page
  // is guaranteed to mirror VaultRecommendations on home, byte-for-byte.
  const p95Drawdown = sim.lltvDerivation.p95Drawdown;
  const slippage = sim.lltvDerivation.slippageEstimate;
  const safetyMargin = sim.inputs.safetyMargin;
  const rawDerived = sim.lltvDerivation.raw;
  const recommended = sim.lltvDerivation.snapped;
  const riskTier = sim.riskTier;
  const lifAtRecommended = recommended > 0 ? LIF(recommended) : 0;
  const oneStepLarger = nextLargerTier(recommended);
  const lifAtOneStep = oneStepLarger ? LIF(oneStepLarger) : null;

  // What it would take for the next-larger tier to be the snap result.
  // raw = (1 − dd) / (LIF(L)·(1+slip)) − safety   ; require raw ≥ oneStepLarger
  const ddCeilingForNext = oneStepLarger
    ? Math.max(0, 1 - (oneStepLarger + safetyMargin) * lifAtOneStep! * (1 + slippage))
    : null;
  const slipCeilingForNext = oneStepLarger
    ? Math.max(0, (1 - p95Drawdown) / ((oneStepLarger + safetyMargin) * lifAtOneStep!) - 1)
    : null;
  const safetyCeilingForNext = oneStepLarger
    ? Math.max(0, (1 - p95Drawdown) / (lifAtOneStep! * (1 + slippage)) - oneStepLarger)
    : null;

  const fxSource = sim.fx?.threeDayDD ? 'Monte Carlo worker' : '5-year empirical fallback';

  return (
    <div className="flex bg-brix-bg min-h-screen text-neutral-200">
      <LLTVSidebar />
      <div className="flex-1 mx-auto max-w-4xl px-6 py-10">
        <TopNav />
        <header className="mb-8 border-b border-brix-border pb-6 mt-6">
          <div className="brix-kicker mb-3">Brix · LLTV calibration</div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Recommended LLTV <span className="text-brix-accent">·</span> live parameters
          </h1>
          <p className="text-sm text-neutral-400 mt-3">
            Uses the same recommendation pipeline as the{' '}
            <a href="/" className="underline">Market Simulator</a> homepage. Edit inputs there or on{' '}
            <a href="/swapliquidity" className="underline">Swap Liquidity</a>; this page mirrors them.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Recommendation</h2>
          <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-4">
            <div className="text-3xl font-bold text-emerald-300">
              LLTV = {recommended > 0 ? pct(recommended, 1) : '—'}
            </div>
            <p className="text-sm mt-1 text-neutral-300">
              Snapped down from raw {rawDerived.toFixed(4)} ({pct(rawDerived, 2)}) to the nearest
              governance tier. Chosen LLTV in sidebar: {pct(sim.inputs.lltv, 1)} → risk tier:{' '}
              <strong>{riskTier}</strong>.
              {!sim.lltvDerivation.converged && (
                <span className="text-amber-400">
                  {' '}Formula did not converge — inputs likely degenerate (very high slippage or
                  drawdown); widen safety margin or deepen pool.
                </span>
              )}
            </p>
          </div>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">Live calculation inputs</h2>
          <p className="text-sm text-neutral-300">
            Inputs feeding the formula right now. Each row links to where the parameter is edited.
          </p>
          <table className="text-sm w-full max-w-2xl border-collapse">
            <thead>
              <tr className="border-b border-brix-border">
                <th className="text-left py-1">Input</th>
                <th className="text-right py-1">Value</th>
                <th className="text-left py-1 pl-4">Source</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-b border-brix-border">
                <td className="py-1 font-sans">p95 3-day drawdown</td>
                <td className="text-right">{pct(p95Drawdown, 3)}</td>
                <td className="font-sans pl-4 text-neutral-400">{fxSource}</td>
              </tr>
              <tr className="border-b border-brix-border">
                <td className="py-1 font-sans">Slippage estimate</td>
                <td className="text-right">{pct(slippage, 3)}</td>
                <td className="font-sans pl-4 text-neutral-400">
                  Pool preset (TVL ${sim.inputs.poolTVL_USD.toLocaleString()}, bands){' '}
                  <a href="/swapliquidity" className="underline">edit</a>
                </td>
              </tr>
              <tr className="border-b border-brix-border">
                <td className="py-1 font-sans">Safety margin</td>
                <td className="text-right">{pct(safetyMargin, 2)}</td>
                <td className="font-sans pl-4 text-neutral-400">
                  Sidebar dial <a href="/" className="underline">edit</a>
                </td>
              </tr>
              <tr className="border-b border-brix-border">
                <td className="py-1 font-sans">LIF(recommended)</td>
                <td className="text-right">{lifAtRecommended.toFixed(4)}</td>
                <td className="font-sans pl-4 text-neutral-400">Morpho canonical (β = 0.3)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">Formula</h2>
          <p className="text-sm text-neutral-300">
            The recommended LLTV is the largest L such that, after a p95 collateral drawdown and
            liquidator-pays-slippage-and-LIF, the liquidator still breaks even with a safety buffer.
            From <code>lib/simulator.ts</code>:
          </p>
          <pre className="rounded bg-brix-surface p-3 text-sm overflow-x-auto">
{`L = (1 − p95Drawdown) / (LIF(L) · (1 + slippage)) − safetyMargin`}
          </pre>
          <p className="text-sm text-neutral-300">
            Solved by fixed-point iteration starting at L = 0.80, then snapped down to the nearest
            governance LLTV in <code>GOV_LLTVS</code>.
          </p>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">Walk-through (live)</h2>
          <pre className="rounded bg-brix-surface p-3 text-sm overflow-x-auto">
{`p95 3-day drawdown    = ${pct(p95Drawdown, 4)}   (${fxSource})
slippage              = ${pct(slippage, 3)}   (pool TVL $${sim.inputs.poolTVL_USD.toLocaleString()} + bands)
safety margin         = ${pct(safetyMargin, 2)}   (sidebar dial)

fixed-point at L ≈ ${rawDerived.toFixed(4)}:
  LIF(L)              = ${lifAtRecommended.toFixed(4)}
  (1 + slippage)      = ${(1 + slippage).toFixed(4)}
  (1 − p95Drawdown)   = ${(1 - p95Drawdown).toFixed(4)}
  L_raw               = (1 − ${p95Drawdown.toFixed(4)}) / (LIF · ${(1 + slippage).toFixed(4)}) − ${safetyMargin.toFixed(2)}
                      = ${rawDerived.toFixed(4)}

snap to GOV_LLTVS     → ${recommended}  (= ${recommended > 0 ? pct(recommended, 1) : '—'})`}
          </pre>
        </section>

        {oneStepLarger !== null && (
          <section className="space-y-3 mt-8">
            <h2 className="text-xl font-semibold">
              Bumping one step to {pct(oneStepLarger, 1)}
            </h2>
            <p className="text-sm text-neutral-300">
              The next governance tier above {recommended > 0 ? pct(recommended, 1) : '0%'} is{' '}
              <strong>{pct(oneStepLarger, 1)}</strong>. The raw derivation currently lands at{' '}
              <code>{rawDerived.toFixed(4)}</code>, which is{' '}
              {rawDerived >= oneStepLarger ? 'above' : 'below'} the bump threshold. For{' '}
              {pct(oneStepLarger, 1)} to be the snap result, any <em>one</em> of the following must
              hold (others held at current values):
            </p>

            <table className="text-sm w-full max-w-3xl border-collapse">
              <thead>
                <tr className="border-b border-brix-border">
                  <th className="text-left py-1">Knob</th>
                  <th className="text-right py-1">Current</th>
                  <th className="text-right py-1">Required to snap to {pct(oneStepLarger, 1)}</th>
                  <th className="text-left py-1 pl-4">Lever</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-b border-brix-border">
                  <td className="py-1 font-sans">p95 3-day drawdown</td>
                  <td className="text-right">{pct(p95Drawdown, 3)}</td>
                  <td className="text-right">≤ {pct(ddCeilingForNext!, 3)}</td>
                  <td className="font-sans pl-4 text-neutral-400">
                    FX-driven (out of our control); pre-liquidation trigger trims operative tail
                  </td>
                </tr>
                <tr className="border-b border-brix-border">
                  <td className="py-1 font-sans">Slippage</td>
                  <td className="text-right">{pct(slippage, 3)}</td>
                  <td className="text-right">
                    {slipCeilingForNext! > 0 ? `≤ ${pct(slipCeilingForNext!, 3)}` : 'infeasible at current dd+safety'}
                  </td>
                  <td className="font-sans pl-4 text-neutral-400">
                    Deepen pool TVL / tighten bands on{' '}
                    <a href="/swapliquidity" className="underline">/swapliquidity</a>
                  </td>
                </tr>
                <tr className="border-b border-brix-border">
                  <td className="py-1 font-sans">Safety margin</td>
                  <td className="text-right">{pct(safetyMargin, 2)}</td>
                  <td className="text-right">
                    {safetyCeilingForNext! > 0 ? `≤ ${pct(safetyCeilingForNext!, 3)}` : 'infeasible'}
                  </td>
                  <td className="font-sans pl-4 text-neutral-400">
                    Sidebar dial <a href="/" className="underline">edit</a>
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 className="text-base font-semibold mt-4">What that means operationally</h3>
            <ul className="text-sm space-y-2 list-disc pl-5 text-neutral-300">
              <li>
                <strong>FX drawdown is fixed by the market</strong> — the only way to reduce the
                <em> operative</em> drawdown the LLTV must cover is to trip pre-liquidation earlier
                (a smaller-loss soft exit), which shortens the tail the formula sees.
              </li>
              <li>
                <strong>Slippage is the primary pool-side lever.</strong> Achieved by deepening the
                USDM↔TRY-stable pool so that the P95 expected liquidation volume costs under{' '}
                {slipCeilingForNext! > 0 ? pct(slipCeilingForNext!, 2) : 'a feasible amount'}{' '}
                round-trip. Edit <code>poolTVL_USD</code> and band splits on{' '}
                <a href="/swapliquidity" className="underline">/swapliquidity</a>.
              </li>
              <li>
                <strong>Safety margin is the cheapest knob but the riskiest.</strong> Tightening it
                eats the buffer for oracle staleness, MEV, and modeling error. Only acceptable once
                the oracle pipeline and liquidator competition are demonstrably tight on mainnet.
              </li>
              <li>
                <strong>Combine, do not stack.</strong> All three knobs move in the same direction;
                a realistic upgrade path is a small move on each rather than betting the whole bump
                on one.
              </li>
              <li>
                <strong>Tail check.</strong> The empirical p99 3-day drawdown is{' '}
                {pct(historical.dd3.p99, 2)} and the worst observed is {pct(historical.dd3.max, 2)}.
                At {pct(oneStepLarger, 1)} a p99 event would still produce bad debt — the bump is
                only defensible if pre-liquidation P95 bad-debt output stays under the vault&apos;s
                tolerance after re-running the simulator with the new LLTV.
              </li>
            </ul>
          </section>
        )}

        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">Historical reference (5-year USD/TRY)</h2>
          <p className="text-sm text-neutral-300">
            Yahoo Finance <code>TRY=X</code> daily close, {historical.first.date} →{' '}
            {historical.last.date} ({historical.days} trading days). These are the raw historical
            drawdowns; the live recommendation above uses the Monte Carlo worker&apos;s p95 when
            available (Bootstrap resamples this series), with the empirical p95 as fallback.
          </p>
          <table className="text-sm w-full max-w-md">
            <tbody>
              <tr>
                <td className="py-1 text-neutral-500">Annualized vol (USDTRY log-returns)</td>
                <td className="text-right font-mono">{pct(historical.annVol, 2)}</td>
              </tr>
              <tr>
                <td className="py-1 text-neutral-500">Annualized drift (TRY depreciation)</td>
                <td className="text-right font-mono">+{pct(historical.annDrift, 2)}</td>
              </tr>
            </tbody>
          </table>
          <table className="text-sm w-full max-w-2xl border-collapse mt-4">
            <thead>
              <tr className="border-b border-brix-border">
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
                { k: '1d', d: historical.dd1 },
                { k: '3d', d: historical.dd3 },
                { k: '7d', d: historical.dd7 },
                { k: '30d', d: historical.dd30 },
              ].map((r) => (
                <tr key={r.k} className="border-b border-brix-border">
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
          <h2 className="text-xl font-semibold">Caveats</h2>
          <ul className="text-sm space-y-2 list-disc pl-5 text-neutral-300">
            <li>
              The recommendation here is identical to the home page&apos;s
              VaultRecommendations section — both consume the same{' '}
              <code>useSimulator()</code> hook. If they disagree, that&apos;s a bug.
            </li>
            <li>
              Out of scope: oracle manipulation, LayerZero outage, MEV-driven liquidation failure,
              and TRY regime breaks beyond what the 5-year window contains. See the README
              &quot;Out of Scope&quot; list.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
