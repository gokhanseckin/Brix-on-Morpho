'use client';
import { useMemo } from 'react';
import { TopNav } from '@/app/components/TopNav';
import { dailyLogReturns, windowRows } from '@/lib/fxData';
import raw from '@/lib/usdtryData.json';
import { LIF } from '@/lib/morphoMath';
import { useSimulator, P95_LIQUIDATION_FRACTION_OF_BORROWS } from '@/lib/useSimulator';
import { useUrlState } from '@/lib/useUrlState';
import {
  betaMean,
  slippageFromPreset,
  deriveRecommendedLLTV,
  snapToGovernanceLLTV,
} from '@/lib/simulator';
import { quantileSorted } from '@/lib/stats';
import { buildLadderFromInputs } from '@/lib/poolPreset';
import { type SidebarInputs } from '@/types/simulator';
import { LLTVSidebar } from './LLTVSidebar';

const TIGHT_SAFETY_MARGIN = 0.01;
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
  const [, setUrlState] = useUrlState();

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
  const lifAtRaw = rawDerived > 0 ? LIF(rawDerived) : 0;
  const ddPctile = sim.lltvDerivation.drawdownPercentile;
  const ddLabel = `p${ddPctile} 1-day drawdown`;
  const binding = sim.lltvDerivation.bindingConstraint;
  const perTier = sim.lltvDerivation.perTier;

  // ----- Sensitivity matrix: (horizon × percentile) -> LLTV ----------------
  // Sub-daily horizons use Brownian √-scaling from the 1-day series:
  //   dd_h = dd_24h × √(h/24)
  // We do not generate intra-day FX paths — the FX history is daily-close
  // Yahoo data; sub-daily Monte Carlo would be fabrication. √-scaling is
  // standard DeFi practice for collateral risk at h < 1d.
  const matrixHorizons: { h: number; label: string }[] = [
    { h: 24, label: '24h' },
    { h: 12, label: '12h' },
    { h: 6, label: '6h' },
  ];
  const matrixPercentiles: { p: number; label: string }[] = [
    { p: 0.95, label: 'p95' },
    { p: 0.99, label: 'p99' },
    { p: 0.999, label: 'p99.9' },
  ];
  const matrix = useMemo(() => {
    const series = sim.fx?.oneDayDD;
    if (!series || series.length === 0) return null;
    const sorted = [...series].sort((a, b) => a - b);
    return matrixHorizons.map(({ h, label: hLabel }) => ({
      h,
      hLabel,
      cells: matrixPercentiles.map(({ p, label: pLabel }) => {
        const dd1d = quantileSorted(sorted, p);
        const ddH = dd1d * Math.sqrt(h / 24);
        const derived = deriveRecommendedLLTV({
          p95Drawdown: ddH,
          slippage,
          safetyMargin,
        });
        const snapped = snapToGovernanceLLTV(derived.raw);
        return {
          p,
          pLabel,
          dd: ddH,
          raw: derived.raw,
          snapped,
          converged: derived.converged,
        };
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.fx?.oneDayDD, slippage, safetyMargin]);

  const fxSource = sim.fx?.oneDayDD
    ? 'Monte Carlo worker'
    : `${sim.inputs.historicalPeriod}-year empirical fallback`;

  // ----- Path to the user's chosen LLTV ------------------------------------
  // For the target tier we (a) look up its feasibility row from the per-tier
  // scan, (b) compute single-knob ceilings under the two-constraint model.
  // Bad-debt and liquidator-profit are independent in each knob: dd only
  // affects bad-debt, slip only affects profit, safety affects both.
  const targetLLTV = sim.inputs.lltv;
  const lifTarget = LIF(targetLLTV);
  const targetRow = perTier.find((t) => t.lltv === targetLLTV);
  const targetIsSupported = targetLLTV > 0 && (targetRow?.feasible ?? false);
  // Bad-debt knob ceiling: targetLLTV × LIF(target) ≤ 1 − dd − safety
  const ddCeilingForTarget = Math.max(0, 1 - safetyMargin - targetLLTV * lifTarget);
  // Profit knob ceiling: LIF(target) × (1 − slip) ≥ 1 + safety
  const slipCeilingForTarget =
    lifTarget > 0 ? Math.max(0, 1 - (1 + safetyMargin) / lifTarget) : 0;
  // Safety knob ceiling: tighter of bad-debt and profit constraints
  const safetyCeilingForTarget = Math.max(
    0,
    Math.min(
      1 - p95Drawdown - targetLLTV * lifTarget, // bad-debt
      lifTarget * (1 - slippage) - 1, // profit
    ),
  );

  // Combined ceiling — relax safety to TIGHT.
  const slipCeilingTightSafety =
    lifTarget > 0 ? Math.max(0, 1 - (1 + TIGHT_SAFETY_MARGIN) / lifTarget) : 0;

  // Bad-debt at target may already fail regardless of slippage — flag it so
  // the recipes (which only deepen pool) don't promise a fix that can't work.
  const badDebtFeasibleAtTarget =
    targetRow !== undefined && targetLLTV <= targetRow.lMaxBadDebt;

  // Numerical pool-TVL recipes. Only worth computing if bad-debt is satisfied
  // at the target — pool deepening only reduces slippage, which fixes the
  // profit constraint, not bad-debt.
  const recipePoolOnly =
    !targetIsSupported && badDebtFeasibleAtTarget && slipCeilingForTarget > 0
      ? findPoolTVLForSlippage({
          targetSlippage: slipCeilingForTarget,
          targetLLTV,
          s: sim.inputs as unknown as SidebarInputs,
          spot: sim.pool.spot,
        })
      : null;
  const recipeTightSafety =
    !targetIsSupported && badDebtFeasibleAtTarget && slipCeilingTightSafety > 0
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
          <div className="brix-kicker mb-3">Brix · market parameter calibration</div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Recommended LLTV <span className="text-brix-accent">·</span> live parameters
          </h1>
          <p className="text-sm text-neutral-400 mt-3">
            Calibrates the <strong>market</strong> LLTV (immutable per Morpho Blue market) and
            the <strong>per-market pre-liquidation contract</strong> parameters — neither
            lives on the MetaMorpho vault. Uses the same recommendation pipeline as the{' '}
            <a href="/" className="underline">Market Simulator</a> homepage. Edit inputs there
            or on <a href="/swapliquidity" className="underline">Swap Liquidity</a>; this page
            mirrors them.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Recommendation</h2>
          <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-4">
            <div className="text-3xl font-bold text-emerald-300">
              LLTV = {recommended > 0 ? pct(recommended, 1) : '—'}
            </div>
            <p className="text-sm mt-1 text-neutral-300">
              Largest governance tier that satisfies both the no-bad-debt and
              liquidator-profitability constraints (raw ceiling{' '}
              {rawDerived.toFixed(4)} / {pct(rawDerived, 2)}). Chosen LLTV in sidebar:{' '}
              {pct(sim.inputs.lltv, 1)} → risk tier: <strong>{riskTier}</strong>.{' '}
              Binding constraint:{' '}
              <strong>
                {binding === 'liquidator-profit'
                  ? 'liquidator profitability (LIF × (1 − slip) ≥ 1 + safety)'
                  : binding === 'bad-debt'
                    ? 'no bad debt (L × LIF(L) ≤ 1 − dd − safety)'
                    : 'none'}
              </strong>
              .
              {recommended === 0 && (
                <span className="text-amber-400">
                  {' '}No governance tier is feasible at current inputs — relax the binding
                  constraint (lower slippage to help profit, or lower dd / safety to help bad
                  debt).
                </span>
              )}
            </p>
          </div>
        </section>

        <section className="space-y-3 mt-6">
          <div className="rounded border border-brix-border bg-brix-surface p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Safety margin (calibration only)</h3>
              <span className="text-[11px] text-neutral-500">not deployed on-chain</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Risk-officer&apos;s discretionary cushion on top of LIF + slippage. Covers oracle
              staleness, MEV, gas, modelling error. Affects which governance LLTV the formula
              recommends — but is never written to any on-chain contract (market, vault, or
              pre-liquidation). Lives here, not on the home sidebar, because it is a
              calibration knob, not a deployed parameter.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-neutral-400">Value</label>
              <input
                type="text"
                inputMode="decimal"
                value={(safetyMargin * 100).toFixed(2)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) {
                    setUrlState({ safetyMargin: Math.max(0, Math.min(0.10, v / 100)) });
                  }
                }}
                className="w-24 rounded border border-brix-border bg-brix-bg px-2 py-1 text-sm font-mono text-right"
                aria-label="Safety margin (percent)"
              />
              <span className="text-sm text-neutral-400">%</span>
            </div>
          </div>
        </section>

        {/* ----- Drawdown percentile (calibration only) ----- */}
        <section className="space-y-3 mt-4">
          <div className="rounded border border-brix-border bg-brix-surface p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Drawdown percentile (calibration only)</h3>
              <span className="text-[11px] text-neutral-500">not deployed on-chain</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Which point in the 1-day drawdown distribution the LLTV formula
              must absorb. <strong>p95</strong> covers normal-stress days (1-in-20).
              <strong> p99</strong> is tail-protective (1-in-100) — produces a more
              conservative LLTV at the cost of capital efficiency. Switch to p99
              if you want the formula to survive rarer USD/TRY shocks without
              relying on safety margin alone.
            </p>
            <div className="mt-3 flex gap-2">
              {[
                { v: 95, label: 'p95 (default · normal stress)' },
                { v: 99, label: 'p99 (tail-protective)' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setUrlState({ lltvDrawdownPercentile: opt.v })}
                  className={`px-3 py-1.5 rounded border text-xs ${
                    sim.lltvDerivation.drawdownPercentile === opt.v
                      ? 'border-brix-accent text-brix-accent'
                      : 'border-brix-border text-neutral-400 hover:border-brix-accent hover:text-brix-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ----- Pre-liquidation parameters (Morpho spec §4D) -------------- */}
        <section className="space-y-3 mt-4">
          <div className="rounded border border-brix-border bg-brix-surface p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Pre-liquidation parameters</h3>
              <span className="text-[11px] text-neutral-500">
                per-market pre-liquidation contract (opt-in)
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              Deployed as a <strong>separate per-market pre-liquidation contract</strong>{' '}
              alongside the Morpho Blue market — not part of the vault. Opt-in per
              borrower, auto-deleverages before the hard LLTV is breached (spec §4D).
              The cascade simulation on the home page uses these to estimate P95 bad
              debt; the LLTV recommendation itself does <strong>not</strong> assume
              pre-liq because it&apos;s borrower-opt-in. <code>preLIF2</code> is
              auto-capped at <code>LIF(LLTV)</code> per Morpho.
            </p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={sim.inputs.preLiquidationEnabled}
                  onChange={(e) =>
                    setUrlState({ preLiquidationEnabled: e.target.checked })
                  }
                  className="rounded border-brix-border"
                />
                <span className="text-neutral-300">Pre-liquidation enabled</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-400 w-32">
                  preLLTV offset
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={(sim.inputs.preLLTVOffset * 100).toFixed(2)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) {
                      setUrlState({
                        preLLTVOffset: Math.max(0, Math.min(0.2, v / 100)),
                      });
                    }
                  }}
                  className="w-20 rounded border border-brix-border bg-brix-bg px-2 py-1 font-mono text-right"
                  aria-label="preLLTV offset (percent)"
                />
                <span className="text-xs text-neutral-500">%</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-400 w-32">preLCF1</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sim.inputs.preLCF1.toFixed(3)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) {
                      setUrlState({ preLCF1: Math.max(0, Math.min(1, v)) });
                    }
                  }}
                  className="w-20 rounded border border-brix-border bg-brix-bg px-2 py-1 font-mono text-right"
                  aria-label="preLCF1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-400 w-32">preLCF2</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sim.inputs.preLCF2.toFixed(3)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) {
                      setUrlState({ preLCF2: Math.max(0, Math.min(1, v)) });
                    }
                  }}
                  className="w-20 rounded border border-brix-border bg-brix-bg px-2 py-1 font-mono text-right"
                  aria-label="preLCF2"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-400 w-32">preLIF1</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={sim.inputs.preLIF1.toFixed(3)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) {
                      setUrlState({ preLIF1: Math.max(1, Math.min(LIF(sim.inputs.lltv), v)) });
                    }
                  }}
                  className="w-20 rounded border border-brix-border bg-brix-bg px-2 py-1 font-mono text-right"
                  aria-label="preLIF1"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-400 w-32">preLIF2 (auto)</label>
                <span className="font-mono text-neutral-300 text-sm">
                  {LIF(sim.inputs.lltv).toFixed(4)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 mt-3">
              Defaults per spec: offset 5pp, LCF range [0.05, 0.5], LIF1 = 1.01. Edit to
              experiment with how pre-liq aggressiveness changes the bad-debt cascade on
              the home page.
            </p>
          </div>
        </section>

        {/* ----- Sensitivity matrix: horizon × percentile ------------------- */}
        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">Sensitivity matrix</h2>
          <p className="text-sm text-neutral-300">
            Recommended (snapped) LLTV for every combination of execution horizon and drawdown
            percentile, holding slippage <code>{pct(slippage, 3)}</code> and safety margin{' '}
            <code>{pct(safetyMargin, 2)}</code> at the current values. Move the safety-margin
            slider above and watch the whole grid update.
          </p>
          <p className="text-xs text-neutral-500 max-w-3xl">
            Sub-daily horizons use Brownian √-scaling from the 1-day series:{' '}
            <code>dd_h = dd_24h × √(h/24)</code>. We do not generate intra-day FX paths — the FX
            history is daily-close Yahoo data, so finer-grained Monte Carlo would be fabrication.
            √-scaling is standard practice for sub-daily collateral risk and is conservative for
            jumpy assets like USD/TRY (real intra-day tails are usually fatter).
          </p>
          {matrix ? (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="border-b border-brix-border">
                    <th className="text-left py-1 pr-4">Horizon \ Percentile</th>
                    {matrixPercentiles.map((c) => (
                      <th key={c.label} className="text-right py-1 px-3">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {matrix.map((row) => (
                    <tr key={row.h} className="border-b border-brix-border">
                      <td className="py-1 pr-4 font-sans text-neutral-300">{row.hLabel}</td>
                      {row.cells.map((c) => {
                        const isCurrent =
                          row.h === 24 && Math.round(c.p * 100) === ddPctile;
                        return (
                          <td
                            key={c.pLabel}
                            className={`text-right py-1 px-3 ${
                              isCurrent
                                ? 'text-emerald-300 font-semibold'
                                : 'text-neutral-200'
                            }`}
                            title={`dd_h = ${pct(c.dd, 3)} · raw L = ${c.raw.toFixed(4)}${
                              c.converged ? '' : ' (did not converge)'
                            }`}
                          >
                            {c.snapped > 0 ? pct(c.snapped, 1) : '—'}
                            <span className="block text-[10px] text-neutral-500 font-sans">
                              dd {pct(c.dd, 2)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-neutral-500 mt-2">
                The cell highlighted in green is the (horizon, percentile) combo currently driving
                the main recommendation above. <em>Hover</em> a cell to see the raw L and the
                horizon-adjusted drawdown.
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Monte Carlo worker has not finished yet — matrix appears once paths are sampled.
            </p>
          )}
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
              <tr className="border-b border-brix-border bg-brix-bg/40">
                <td className="py-1 font-sans font-semibold">{ddLabel}</td>
                <td className="text-right font-semibold">{pct(p95Drawdown, 3)}</td>
                <td className="font-sans pl-4 text-neutral-400">
                  {fxSource} · worst-case (no pre-liq cap)
                </td>
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
                <td className="font-sans pl-4 text-neutral-400">Slider above</td>
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
            The recommended LLTV is the largest governance tier satisfying{' '}
            <strong>both</strong> of these constraints. Either one alone can bind. From{' '}
            <code>lib/simulator.ts</code>:
          </p>
          <pre className="rounded bg-brix-surface p-3 text-sm overflow-x-auto">
{`(1)  L · LIF(L) ≤ 1 − dd − safety       (no bad debt)
(2)  LIF(L) · (1 − slippage) ≥ 1 + safety  (liquidator profitable)

  where dd = p${ddPctile} 1-day collateral drawdown
        LIF(L) = min(LIF_CAP, 1 / (β·L + (1−β))),  β = 0.3, LIF_CAP = 1.15`}
          </pre>
          <p className="text-sm text-neutral-300">
            Both inequalities are upper bounds on L and admit closed-form solutions
            (<code>maxLForBadDebt</code>, <code>maxLForProfit</code>). The tier scan
            evaluates each <code>GOV_LLTVS</code> entry with its own per-tier slippage
            (liquidation size scales with L) and picks the largest tier that passes both.
          </p>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">Walk-through (live)</h2>
          <pre className="rounded bg-brix-surface p-3 text-sm overflow-x-auto">
{`${ddLabel.padEnd(26, ' ')} = ${pct(p95Drawdown, 4)}   (${fxSource}; worst-case, no pre-liq cap)
slippage @ recommended     = ${pct(slippage, 3)}   (pool TVL $${sim.inputs.poolTVL_USD.toLocaleString()} + bands)
safety margin              = ${pct(safetyMargin, 2)}   (slider above)

raw upper bound L = ${rawDerived.toFixed(4)} (binding: ${binding})
  LIF(L_raw)               = ${lifAtRaw.toFixed(4)}
  L_raw · LIF(L_raw)       = ${(rawDerived * lifAtRaw).toFixed(4)}   vs   1 − dd − safety = ${(1 - p95Drawdown - safetyMargin).toFixed(4)}
  LIF(L_raw) · (1 − slip)  = ${(lifAtRaw * (1 - slippage)).toFixed(4)}   vs   1 + safety       = ${(1 + safetyMargin).toFixed(4)}

snap to GOV_LLTVS          → ${recommended}  (= ${recommended > 0 ? pct(recommended, 1) : '—'})
LIF(snapped)               = ${lifAtRecommended.toFixed(4)}`}
          </pre>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="text-xl font-semibold">Per-tier feasibility</h2>
          <p className="text-sm text-neutral-300">
            Every governance LLTV evaluated under both constraints. Slippage is
            recomputed at each tier&apos;s expected liquidation size, so the
            recommendation does not depend on the sidebar&apos;s currently-selected LLTV.
          </p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full max-w-3xl border-collapse">
              <thead>
                <tr className="border-b border-brix-border">
                  <th className="text-left py-1">Tier</th>
                  <th className="text-right py-1">Slippage @ tier</th>
                  <th className="text-right py-1">L_max (bad-debt)</th>
                  <th className="text-right py-1">L_max (profit)</th>
                  <th className="text-right py-1">Feasible?</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {perTier.map((row) => {
                  const isChosen = row.lltv === recommended;
                  return (
                    <tr
                      key={row.lltv}
                      className={`border-b border-brix-border ${
                        isChosen ? 'bg-emerald-950/30 text-emerald-300' : ''
                      }`}
                    >
                      <td className="py-1 font-sans">{pct(row.lltv, 1)}</td>
                      <td className="text-right">{pct(row.slippage, 3)}</td>
                      <td className="text-right">{row.lMaxBadDebt.toFixed(4)}</td>
                      <td className="text-right">{row.lMaxProfit.toFixed(4)}</td>
                      <td className="text-right">{row.feasible ? '✓' : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                To make <strong>{pct(targetLLTV, 1)}</strong> the recommended (snapped) tier, both
                constraints must hold at that L:
              </p>
              <pre className="rounded bg-brix-surface p-3 text-xs overflow-x-auto">
{`(1)  ${targetLLTV} · ${lifTarget.toFixed(4)} ≤ 1 − ${p95Drawdown.toFixed(4)} − safety   (no bad debt)
(2)  ${lifTarget.toFixed(4)} · (1 − slip) ≥ 1 + safety                (liquidator profitable)`}
              </pre>
              {!badDebtFeasibleAtTarget && (
                <div className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-neutral-200">
                  ⚠ Bad-debt constraint already fails at the target (L · LIF(L) ={' '}
                  <code>{(targetLLTV * lifTarget).toFixed(4)}</code> &gt; 1 − dd − safety ={' '}
                  <code>{(1 - p95Drawdown - safetyMargin).toFixed(4)}</code>). Pool deepening only
                  helps slippage / profitability — to fix bad debt you need lower dd (longer
                  pre-liq lead time / oracle improvements), lower safety, or a lower LLTV target.
                </div>
              )}

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
                    <td className="py-1 font-sans">{ddLabel}</td>
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
                  Keep safety margin at <code>{pct(safetyMargin, 2)}</code>.
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
                    {pct(safetyMargin, 2)} and dd {pct(p95Drawdown, 2)}. Use Recipe B below.
                  </p>
                )}
              </div>

              {/* Recipe B — pool + tighter safety */}
              <div className="rounded border border-brix-border bg-brix-surface p-4 mt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">
                    Recipe B · Pool deepening + tighter safety margin
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
                    unsatisfied. The chosen LLTV is incompatible with current FX drawdown — pick a
                    lower LLTV target.
                  </p>
                )}
              </div>

              <h3 className="text-base font-semibold mt-6">Tail check</h3>
              <p className="text-sm text-neutral-300">
                The empirical p99 1-day drawdown is {pct(historical.dd1.p99, 2)} and the worst
                observed is {pct(historical.dd1.max, 2)}. At {pct(targetLLTV, 1)} a p99 event would
                still produce bad debt — any recipe above is only defensible if the Section 4
                bad-debt P95 (with cascade simulation) stays under the vault&apos;s tolerance after
                re-running with the new LLTV.
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
