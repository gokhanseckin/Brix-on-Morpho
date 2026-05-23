'use client';
import { useMemo } from 'react';
import { TopNav } from '@/app/components/TopNav';
import { dailyLogReturns, windowRows } from '@/lib/fxData';
import raw from '@/lib/usdtryData.json';
import { LIF } from '@/lib/morphoMath';
import { useSimulator, P95_LIQUIDATION_FRACTION_OF_BORROWS } from '@/lib/useSimulator';
import { betaMean, slippageFromPreset } from '@/lib/simulator';
import { buildLadderFromInputs } from '@/lib/poolPreset';
import { type SidebarInputs } from '@/types/simulator';
import { LLTVSidebar } from './LLTVSidebar';

const TIGHT_SAFETY_MARGIN = 0.01;
const PRELIQ_OPERATIVE_DRAWDOWN = 0.02;
const MAX_POOL_TVL_SEARCH = 100_000_000;

function findPoolTVLForSlippage(args: {
  targetSlippage: number;
  targetLLTV: number;
  s: SidebarInputs;
  spot: number;
}): { tvl: number; achieved: number } | null {
  if (args.targetSlippage <= 0) return null;
  const meanLTVFrac = betaMean(args.s.borrowerLTVAlpha, args.s.borrowerLTVBeta);
  const p95LiqSize =
    args.s.witryTVL_USD *
    args.targetLLTV *
    meanLTVFrac *
    P95_LIQUIDATION_FRACTION_OF_BORROWS *
    LIF(args.targetLLTV);
  const bandInputs = {
    bandSplitCore: args.s.bandSplitCore,
    bandSplitAbsorb: args.s.bandSplitAbsorb,
    poolFeeTier: args.s.poolFeeTier,
    bandCoreLowerPct: args.s.bandCoreLowerPct,
    bandCoreUpperPct: args.s.bandCoreUpperPct,
    bandAbsorbLowerPct: args.s.bandAbsorbLowerPct,
    bandAbsorbUpperPct: args.s.bandAbsorbUpperPct,
    bandTailLowerPct: args.s.bandTailLowerPct,
    bandTailUpperPct: args.s.bandTailUpperPct,
  };
  // Feasibility: even at MAX_POOL_TVL_SEARCH, slippage may exceed target.
  const presetMax = buildLadderFromInputs(args.spot, { ...bandInputs, poolTVL_USD: MAX_POOL_TVL_SEARCH });
  const slipMax = slippageFromPreset(presetMax, args.spot, p95LiqSize);
  if (slipMax > args.targetSlippage) return null;
  // Binary search the smallest pool TVL that hits the target slippage.
  let lo = 10_000;
  let hi = MAX_POOL_TVL_SEARCH;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const preset = buildLadderFromInputs(args.spot, { ...bandInputs, poolTVL_USD: mid });
    const slip = slippageFromPreset(preset, args.spot, p95LiqSize);
    if (slip > args.targetSlippage) lo = mid;
    else hi = mid;
  }
  const finalPreset = buildLadderFromInputs(args.spot, { ...bandInputs, poolTVL_USD: hi });
  return { tvl: Math.round(hi), achieved: slippageFromPreset(finalPreset, args.spot, p95LiqSize) };
}

function formatUSDshort(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}k`;
  return `$${Math.round(usd)}`;
}

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

  const fxSource = sim.fx?.threeDayDD ? 'Monte Carlo worker' : '5-year empirical fallback';

  // ----- Path to the user's chosen LLTV ------------------------------------
  // The "Bumping one step" view was hardcoded to oneStepLarger; here we target
  // sim.inputs.lltv (what the operator actually wants to ship at). For each
  // path we (a) check single-knob feasibility, (b) when slippage is the lever
  // we numerically solve for the pool TVL that hits the slip ceiling.
  const targetLLTV = sim.inputs.lltv;
  const lifTarget = LIF(targetLLTV);
  const targetIsSupported = targetLLTV > 0 && rawDerived >= targetLLTV;

  // Single-knob ceilings (each holds the other two at current).
  const ddCeilingForTarget = Math.max(0, 1 - (targetLLTV + safetyMargin) * lifTarget * (1 + slippage));
  const slipCeilingForTarget = (1 - p95Drawdown) / ((targetLLTV + safetyMargin) * lifTarget) - 1;
  const safetyCeilingForTarget = (1 - p95Drawdown) / (lifTarget * (1 + slippage)) - targetLLTV;

  // Combined ceilings — relax safety to TIGHT, or use pre-liq operative dd.
  const slipCeilingTightSafety =
    (1 - p95Drawdown) / ((targetLLTV + TIGHT_SAFETY_MARGIN) * lifTarget) - 1;
  const slipCeilingPreLiq =
    (1 - PRELIQ_OPERATIVE_DRAWDOWN) / ((targetLLTV + safetyMargin) * lifTarget) - 1;

  // Numerical pool-TVL recipes.
  const recipePoolOnly = !targetIsSupported && slipCeilingForTarget > 0
    ? findPoolTVLForSlippage({
        targetSlippage: slipCeilingForTarget,
        targetLLTV,
        s: sim.inputs as unknown as SidebarInputs,
        spot: sim.pool.spot,
      })
    : null;
  const recipePreLiq = !targetIsSupported && !sim.inputs.preLiquidationEnabled && slipCeilingPreLiq > 0
    ? findPoolTVLForSlippage({
        targetSlippage: slipCeilingPreLiq,
        targetLLTV,
        s: sim.inputs as unknown as SidebarInputs,
        spot: sim.pool.spot,
      })
    : null;
  const recipeTightSafety = !targetIsSupported && slipCeilingTightSafety > 0
    ? findPoolTVLForSlippage({
        targetSlippage: slipCeilingTightSafety,
        targetLLTV,
        s: sim.inputs as unknown as SidebarInputs,
        spot: sim.pool.spot,
      })
    : null;

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

        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">
            Path to your chosen LLTV ({pct(targetLLTV, 1)})
          </h2>
          {targetIsSupported ? (
            <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-4 text-sm text-neutral-200">
              Your chosen LLTV <strong>{pct(targetLLTV, 1)}</strong> is already supported by the
              current parameters (raw {rawDerived.toFixed(4)} ≥ {targetLLTV}). No changes needed.
              {targetLLTV < recommended && (
                <>
                  {' '}You have headroom — recommended is{' '}
                  <strong>{pct(recommended, 1)}</strong>.
                </>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-neutral-300">
                To make <strong>{pct(targetLLTV, 1)}</strong> the recommended (snapped) tier, raw L
                must reach <code>{targetLLTV}</code>. The constraint at that target:
              </p>
              <pre className="rounded bg-brix-surface p-3 text-xs overflow-x-auto">
{`(1 − p95dd) ≥ (${targetLLTV} + safety) · LIF(${targetLLTV}) · (1 + slip)
(1 − ${p95Drawdown.toFixed(4)}) ≥ (${targetLLTV} + safety) · ${lifTarget.toFixed(4)} · (1 + slip)`}
              </pre>

              <h3 className="text-base font-semibold mt-4">Single-knob ceilings</h3>
              <p className="text-sm text-neutral-400">
                What each input would need to be on its own (others held at current values).
              </p>
              <table className="text-sm w-full max-w-3xl border-collapse">
                <thead>
                  <tr className="border-b border-brix-border">
                    <th className="text-left py-1">Input</th>
                    <th className="text-right py-1">Current</th>
                    <th className="text-right py-1">Required (single-knob)</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-brix-border">
                    <td className="py-1 font-sans">p95 3-day drawdown</td>
                    <td className="text-right">{pct(p95Drawdown, 3)}</td>
                    <td className="text-right">
                      {ddCeilingForTarget > 0
                        ? `≤ ${pct(ddCeilingForTarget, 3)}`
                        : 'infeasible (LLTV exceeds 1-LIF capacity)'}
                    </td>
                  </tr>
                  <tr className="border-b border-brix-border">
                    <td className="py-1 font-sans">Slippage</td>
                    <td className="text-right">{pct(slippage, 3)}</td>
                    <td className="text-right">
                      {slipCeilingForTarget > 0
                        ? `≤ ${pct(slipCeilingForTarget, 3)}`
                        : 'infeasible at current dd + safety'}
                    </td>
                  </tr>
                  <tr className="border-b border-brix-border">
                    <td className="py-1 font-sans">Safety margin</td>
                    <td className="text-right">{pct(safetyMargin, 2)}</td>
                    <td className="text-right">
                      {safetyCeilingForTarget > 0
                        ? `≤ ${pct(safetyCeilingForTarget, 3)}`
                        : 'infeasible at current dd + slip'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3 className="text-base font-semibold mt-6">Concrete recipes</h3>
              <p className="text-sm text-neutral-400">
                Pool-TVL targets below are computed by binary-searching{' '}
                <code>slippageFromPreset</code> at the expected P95 liquidation size, holding band
                splits/ranges and fee tier at the values you set on{' '}
                <a href="/swapliquidity" className="underline">/swapliquidity</a>.
              </p>

              {/* Recipe A — pool only */}
              <div className="rounded border border-brix-border bg-brix-surface p-4 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Recipe A · Pool deepening only</h4>
                  <span className={`text-xs font-mono ${recipePoolOnly ? 'text-emerald-300' : 'text-amber-400'}`}>
                    {recipePoolOnly ? 'feasible' : 'infeasible'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Keep safety margin at <code>{pct(safetyMargin, 2)}</code>; keep pre-liquidation
                  setting as-is.
                </p>
                {recipePoolOnly ? (
                  <ul className="text-sm mt-2 space-y-1 list-disc pl-5 text-neutral-200">
                    <li>
                      Increase pool TVL from{' '}
                      <code>{formatUSDshort(sim.inputs.poolTVL_USD)}</code> to{' '}
                      <code className="text-emerald-300">{formatUSDshort(recipePoolOnly.tvl)}</code>{' '}
                      (≈ {(recipePoolOnly.tvl / Math.max(1, sim.inputs.poolTVL_USD)).toFixed(1)}×
                      current).
                    </li>
                    <li>
                      This brings slippage from <code>{pct(slippage, 2)}</code> down to{' '}
                      <code>{pct(recipePoolOnly.achieved, 2)}</code> (≤ target{' '}
                      <code>{pct(slipCeilingForTarget, 2)}</code>).
                    </li>
                    <li>
                      Edit <code>poolTVL_USD</code> on{' '}
                      <a href="/swapliquidity" className="underline">/swapliquidity</a>.
                    </li>
                  </ul>
                ) : (
                  <p className="text-sm mt-2 text-neutral-300">
                    Even at the search ceiling of{' '}
                    <code>${(MAX_POOL_TVL_SEARCH / 1_000_000).toFixed(0)}M</code> pool TVL, slippage
                    cannot fall low enough to satisfy the constraint at safety{' '}
                    {pct(safetyMargin, 2)} and dd {pct(p95Drawdown, 2)}. Use Recipe B or C below.
                  </p>
                )}
              </div>

              {/* Recipe B — pool + pre-liquidation */}
              <div className="rounded border border-brix-border bg-brix-surface p-4 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">
                    Recipe B · Pool deepening + pre-liquidation
                    {sim.inputs.preLiquidationEnabled && (
                      <span className="text-xs ml-2 text-neutral-500">(pre-liq already on)</span>
                    )}
                  </h4>
                  <span className={`text-xs font-mono ${recipePreLiq ? 'text-emerald-300' : 'text-amber-400'}`}>
                    {sim.inputs.preLiquidationEnabled
                      ? 'pre-liq already on — see Recipe A'
                      : recipePreLiq
                        ? 'feasible'
                        : 'infeasible'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Enable pre-liquidation so positions auto-deleverage at a ~
                  <code>{pct(PRELIQ_OPERATIVE_DRAWDOWN, 0)}</code> loss, effectively capping the
                  operative drawdown the LLTV must cover at <code>{pct(PRELIQ_OPERATIVE_DRAWDOWN, 0)}</code>{' '}
                  instead of the full p95 <code>{pct(p95Drawdown, 1)}</code>.
                </p>
                {!sim.inputs.preLiquidationEnabled && recipePreLiq ? (
                  <ul className="text-sm mt-2 space-y-1 list-disc pl-5 text-neutral-200">
                    <li>
                      Enable <code>preLiquidationEnabled</code> on the sidebar (Section 4 ·
                      Liquidation).
                    </li>
                    <li>
                      Pool TVL needed: from{' '}
                      <code>{formatUSDshort(sim.inputs.poolTVL_USD)}</code> to{' '}
                      <code className="text-emerald-300">{formatUSDshort(recipePreLiq.tvl)}</code>{' '}
                      (≈ {(recipePreLiq.tvl / Math.max(1, sim.inputs.poolTVL_USD)).toFixed(1)}×
                      current — usually smaller than Recipe A).
                    </li>
                    <li>
                      Slippage falls to <code>{pct(recipePreLiq.achieved, 2)}</code> (≤ target{' '}
                      <code>{pct(slipCeilingPreLiq, 2)}</code> with the reduced operative dd).
                    </li>
                    <li>
                      <strong>Trade-off:</strong> borrowers get auto-closed on smaller losses
                      (~2%) — softer than full liquidation but still an unwanted exit. This is a
                      product decision, not a formula tweak.
                    </li>
                  </ul>
                ) : sim.inputs.preLiquidationEnabled ? (
                  <p className="text-sm mt-2 text-neutral-300">
                    Pre-liquidation is already enabled. The recommendation pipeline currently uses
                    raw p95 drawdown regardless — to actually benefit from pre-liq in the formula,
                    the simulator would need to expose the pre-liq trigger as the operative dd. For
                    now, use Recipe A or C.
                  </p>
                ) : (
                  <p className="text-sm mt-2 text-neutral-300">
                    Even with pre-liquidation enabled and pool deepened to{' '}
                    <code>${(MAX_POOL_TVL_SEARCH / 1_000_000).toFixed(0)}M</code>, constraint cannot
                    be met — try Recipe C.
                  </p>
                )}
              </div>

              {/* Recipe C — pool + tighter safety */}
              <div className="rounded border border-brix-border bg-brix-surface p-4 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">
                    Recipe C · Pool deepening + tighter safety margin
                  </h4>
                  <span className={`text-xs font-mono ${recipeTightSafety ? 'text-emerald-300' : 'text-amber-400'}`}>
                    {recipeTightSafety ? 'feasible' : 'infeasible'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Reduce safety margin from <code>{pct(safetyMargin, 2)}</code> to{' '}
                  <code>{pct(TIGHT_SAFETY_MARGIN, 0)}</code>. Riskiest knob — eats the cushion for
                  oracle staleness, MEV, gas, modelling error.
                </p>
                {recipeTightSafety ? (
                  <ul className="text-sm mt-2 space-y-1 list-disc pl-5 text-neutral-200">
                    <li>
                      Set <code>safetyMargin</code> to <code>{pct(TIGHT_SAFETY_MARGIN, 0)}</code>{' '}
                      on the sidebar (Section 5 · Vault Params).
                    </li>
                    <li>
                      Pool TVL needed: from{' '}
                      <code>{formatUSDshort(sim.inputs.poolTVL_USD)}</code> to{' '}
                      <code className="text-emerald-300">{formatUSDshort(recipeTightSafety.tvl)}</code>.
                    </li>
                    <li>
                      Slippage falls to <code>{pct(recipeTightSafety.achieved, 2)}</code>.
                    </li>
                    <li>
                      <strong>Trade-off:</strong> only acceptable once the oracle pipeline and
                      liquidator competition are demonstrably tight on mainnet. Don&apos;t ship
                      this at launch.
                    </li>
                  </ul>
                ) : (
                  <p className="text-sm mt-2 text-neutral-300">
                    Even with safety at <code>{pct(TIGHT_SAFETY_MARGIN, 0)}</code> and pool deepened
                    to <code>${(MAX_POOL_TVL_SEARCH / 1_000_000).toFixed(0)}M</code>, constraint is
                    unsatisfied. The chosen LLTV is incompatible with current FX drawdown — only
                    pre-liquidation (Recipe B) or a lower LLTV target can resolve it.
                  </p>
                )}
              </div>

              <h3 className="text-base font-semibold mt-6">Tail check</h3>
              <p className="text-sm text-neutral-300">
                The empirical p99 3-day drawdown is {pct(historical.dd3.p99, 2)} and the worst
                observed is {pct(historical.dd3.max, 2)}. At {pct(targetLLTV, 1)} a p99 event would
                still produce bad debt — any recipe above is only defensible if pre-liquidation
                P95 bad-debt output stays under the vault&apos;s tolerance after re-running the
                simulator with the new LLTV.
              </p>
            </>
          )}
        </section>

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
