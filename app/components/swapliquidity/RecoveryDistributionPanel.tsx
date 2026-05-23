'use client';
import { useCallback, useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { useSimulator } from '@/lib/useSimulator';
import { buildLadderFromInputs } from '@/lib/poolPreset';
import { materializePool } from '@/lib/univ3/quoteLiquidatorSell';
import { swapExactIn } from '@/lib/univ3/swap';
import { badDebtFromAMMSale } from '@/lib/badDebtMath';
import { LIF } from '@/lib/morphoMath';
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Kpi } from '@/app/components/Kpi';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const MAX_PATHS = 200;
const HIST_BINS = 20;
const fmtUSD = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${Math.round(n)}`;
const fmtPct = (n: number, d = 2) => `${(n * 100).toFixed(d)}%`;

// Deterministic sweep across log-spaced probe sizes from $1k to 3× pool TVL.
const SWEEP_STEPS = 60;
const SWEEP_MIN_USD = 1_000;

export function RecoveryDistributionPanel() {
  const [state] = useUrlState();
  const { fx } = useSimulator();
  const {
    lltv,
    usdtryBaseline,
    poolTVL_USD,
    bandSplitCore,
    bandSplitAbsorb,
    poolFeeTier,
    bandCoreLowerPct,
    bandCoreUpperPct,
    bandAbsorbLowerPct,
    bandAbsorbUpperPct,
    bandTailLowerPct,
    bandTailUpperPct,
    swapSellUSD: probeCollateral_USD,
    pathCount,
    simulationMode,
    simulationHorizonDays,
  } = state;
  const lif = LIF(lltv);
  const bufferPct = 1 - 1 / lif;
  const debtUSD = probeCollateral_USD / lif;

  // CRITICAL: pool stays where it was deployed (initial spot). FX moves around
  // it — that's the whole point of the off-center stress test.
  const initialSpot = useMemo(
    () => (usdtryBaseline > 0 ? 1 / usdtryBaseline : 0),
    [usdtryBaseline],
  );
  const fixedPreset = useMemo(
    () => buildLadderFromInputs(initialSpot, {
      poolTVL_USD,
      bandSplitCore,
      bandSplitAbsorb,
      poolFeeTier,
      bandCoreLowerPct,
      bandCoreUpperPct,
      bandAbsorbLowerPct,
      bandAbsorbUpperPct,
      bandTailLowerPct,
      bandTailUpperPct,
    }),
    [
      initialSpot,
      poolTVL_USD,
      bandSplitCore,
      bandSplitAbsorb,
      poolFeeTier,
      bandCoreLowerPct,
      bandCoreUpperPct,
      bandAbsorbLowerPct,
      bandAbsorbUpperPct,
      bandTailLowerPct,
      bandTailUpperPct,
    ],
  );
  // Materialize once per preset; swapExactIn clones internally so this is reused.
  const fixedPool = useMemo(() => materializePool(fixedPreset, initialSpot), [fixedPreset, initialSpot]);

  // Quote a wTRY → USDM sell against the fixed (initial-spot) pool, regardless
  // of what spot the dump "really" happens at. The pool is denominated in
  // absolute tick prices, so this naturally models off-center dumps.
  const quoteFixed = useCallback((sellUSD: number): number => {
    if (sellUSD <= 0 || initialSpot <= 0) return 0;
    const wTRYwei = BigInt(Math.floor((sellUSD / initialSpot) * 1e6));
    try {
      const { quote } = swapExactIn(fixedPool, wTRYwei, true);
      return Number(quote.amountOut) / 1e6;
    } catch {
      return 0;
    }
  }, [fixedPool, initialSpot]);

  // ─── Chart A: Deterministic bad-debt vs probe size ──────────────────────
  // No Monte Carlo. Sweep probe size against the deployed pool at initial
  // spot. Answers: "as the single-trade liquidation grows, when does the AMM
  // slip eat through the LIF buffer?"
  const { deterministicSweep, breakevenLIFbuffer } = useMemo<{
    deterministicSweep: Array<{ probe_USD: number; badDebtPct: number; effectiveSlip: number }>;
    breakevenLIFbuffer: number | null;
  }>(() => {
    if (poolTVL_USD <= 0) return { deterministicSweep: [], breakevenLIFbuffer: null };
    const hi = Math.log10(Math.max(poolTVL_USD * 3, 5_000_000));
    const lo = Math.log10(SWEEP_MIN_USD);
    const raw: Array<{ probe_USD: number; badDebtPct: number; effectiveSlip: number }> = [];
    let breakeven: number | null = null;
    let prev: { probe_USD: number; effectiveSlip: number } | null = null;
    for (let i = 0; i < SWEEP_STEPS; i++) {
      const probeUSD = Math.pow(10, lo + ((hi - lo) * i) / (SWEEP_STEPS - 1));
      const ammSale = quoteFixed(probeUSD);
      const bd = badDebtFromAMMSale({ collateral_USD: probeUSD, lltv, ammSale_USDM: ammSale });
      const effectiveSlip = probeUSD > 0 ? Math.max(0, 1 - ammSale / probeUSD) : 0;
      raw.push({ probe_USD: probeUSD, badDebtPct: bd.badDebtPct, effectiveSlip });
      if (
        breakeven == null &&
        prev != null &&
        prev.effectiveSlip < bufferPct &&
        effectiveSlip >= bufferPct
      ) {
        // Log-x linear interp between bracketing samples — sweep is coarse so
        // the raw bucket overshoots; interpolate to the actual crossing.
        const t = (bufferPct - prev.effectiveSlip) / (effectiveSlip - prev.effectiveSlip);
        breakeven = Math.exp(Math.log(prev.probe_USD) + t * (Math.log(probeUSD) - Math.log(prev.probe_USD)));
      }
      prev = { probe_USD: probeUSD, effectiveSlip };
    }
    return { deterministicSweep: raw, breakevenLIFbuffer: breakeven };
  }, [poolTVL_USD, lltv, quoteFixed, bufferPct]);

  // ─── Chart B: MC distribution at the slider's probe size ────────────────
  // FX shifts spot away from the pool center. The pool stays put. Dump the
  // slider amount at the shifted price → see how bad debt distributes.
  const terminalSpots = useMemo<number[]>(() => {
    const paths = fx?.paths;
    if (!paths || paths.length === 0) return [];
    const step = Math.max(1, Math.floor(paths.length / MAX_PATHS));
    const out: number[] = [];
    for (let i = 0; i < paths.length; i += step) {
      const p = paths[i];
      if (!p || p.length === 0) continue;
      const last = p[p.length - 1];
      if (typeof last === 'number' && last > 0) out.push(1 / last);
    }
    return out;
  }, [fx]);

  const mcResults = useMemo<number[]>(() => {
    if (terminalSpots.length === 0 || probeCollateral_USD <= 0) return [];
    const out: number[] = [];
    for (const terminalSpot of terminalSpots) {
      // wTRY amount sized at the TERMINAL spot (that's where the dump originates
      // in collateral terms — the seized wTRY is worth `probeCollateral_USD` at
      // terminal price). But the swap hits the FIXED pool.
      if (terminalSpot <= 0) continue;
      const wTRYwei = BigInt(Math.floor((probeCollateral_USD / terminalSpot) * 1e6));
      try {
        const { quote } = swapExactIn(fixedPool, wTRYwei, true);
        const ammSale = Number(quote.amountOut) / 1e6;
        const bd = badDebtFromAMMSale({
          collateral_USD: probeCollateral_USD,
          lltv,
          ammSale_USDM: ammSale,
        });
        out.push(bd.badDebtPct);
      } catch {
        // skip
      }
    }
    return out;
  }, [fixedPool, terminalSpots, probeCollateral_USD, lltv]);

  const { histogram, p95BadDebt, medianBadDebt, zeroBadDebtPct } = useMemo<{
    histogram: Array<{ bin: number; count: number }>;
    p95BadDebt: number | null;
    medianBadDebt: number | null;
    zeroBadDebtPct: number;
  }>(() => {
    if (mcResults.length === 0) {
      return { histogram: [], p95BadDebt: null, medianBadDebt: null, zeroBadDebtPct: 0 };
    }
    const sorted = [...mcResults].sort((a, b) => a - b);
    const idx95 = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const idx50 = Math.floor(sorted.length * 0.5);
    const zeroCount = mcResults.filter((b) => b === 0).length;
    const max = sorted[sorted.length - 1]!;
    const upper = Math.max(0.001, max);
    const width = upper / HIST_BINS;
    const bins = Array.from({ length: HIST_BINS }, (_, i) => ({
      bin: (i + 0.5) * width,
      count: 0,
    }));
    for (const b of mcResults) {
      const idx = Math.min(HIST_BINS - 1, Math.floor(b / width));
      bins[idx]!.count += 1;
    }
    return {
      histogram: bins,
      p95BadDebt: sorted[idx95] ?? null,
      medianBadDebt: sorted[idx50] ?? null,
      zeroBadDebtPct: zeroCount / mcResults.length,
    };
  }, [mcResults]);

  return (
    <section id="section-recovery" className="space-y-6">
      <h2 className="text-lg font-semibold">4. Bad-debt distribution</h2>

      {/* ─── Chart A: MC histogram at slider size — slider-driven, sits closest to Section 3 ─ */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          A. Bad-debt distribution at slider size{' '}
          <span className="text-xs text-neutral-500 font-normal">
            (Monte Carlo on terminal FX, pool stays at initial spot)
          </span>
        </h3>
        <div className="text-xs text-neutral-500 max-w-3xl">
          Sampled n={mcResults.length} of {pathCount} paths from main-page sim (mode{' '}
          <span className="text-neutral-300">{simulationMode}</span>, horizon{' '}
          <span className="text-neutral-300">{simulationHorizonDays}d</span>). The pool stays
          at initial spot ({initialSpot.toFixed(6)}); each path&apos;s terminal spot is where the dump
          originates. The bigger FX moves away from initial, the further the dump lands from the
          core band — which is where bad debt is born. At LLTV {fmtPct(lltv, 1)} probe debt is{' '}
          ${debtUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Bad debt = max(0, debt − AMM proceeds).
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Paths with zero bad debt" value={fmtPct(zeroBadDebtPct)} helpKey="zeroBadDebtPct" />
          <Kpi
            label="Median bad-debt rate"
            value={medianBadDebt !== null ? fmtPct(medianBadDebt) : '—'}
            helpKey="medianBadDebtRate"
          />
          <Kpi
            label="95th-percentile bad-debt rate"
            value={p95BadDebt !== null ? fmtPct(p95BadDebt) : '—'}
            helpKey="p95BadDebtRate"
          />
        </div>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
          <div className="flex items-center text-xs text-neutral-500 px-2 pt-1">
            <span>Bad-debt rate distribution across MC terminal spots</span>
            <HelpPopover chartKey="swapBadDebtHistogram" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={histogram}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="bin"
                tickFormatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(v) => `Bad debt ${(Number(v) * 100).toFixed(2)}%`}
                formatter={(v) => [`${v} paths`, 'count']}
                contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: '#a3a3a3' }}
                itemStyle={{ color: '#e5e5e5' }}
              />
              <Bar dataKey="count">
                {histogram.map((h, i) => (
                  <Cell key={i} fill={h.bin < 0.001 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Chart B: deterministic sweep — independent of slider ─────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          B. Bad-debt vs probe size{' '}
          <span className="text-xs text-neutral-500 font-normal">
            (deterministic, pool at initial spot — no slider dependency)
          </span>
        </h3>
        <p className="text-xs text-neutral-500 max-w-3xl">
          As a single liquidator dump grows, slippage in the AMM eats into the LIF buffer ({fmtPct(bufferPct, 2)}).
          When effective slip exceeds the buffer, bad debt accrues. Pool is built at the current
          spot ({initialSpot.toFixed(6)}); this chart has no Monte Carlo and does not depend on the
          Section 3 slider — it&apos;s the pool&apos;s deterministic stress profile vs trade size.
        </p>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={deterministicSweep} margin={{ top: 8, right: 40, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="probe_USD"
                type="number"
                scale="log"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtUSD}
              />
              <YAxis tickFormatter={(v: number) => fmtPct(v, 1)} domain={[0, 'auto']} />
              <Tooltip
                labelFormatter={(v) => `Probe ${fmtUSD(Number(v))}`}
                formatter={(v, name) => [fmtPct(Number(v), 2), name]}
                contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: 4, fontSize: 12 }}
                labelStyle={{ color: '#a3a3a3' }}
                itemStyle={{ color: '#e5e5e5' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
              <ReferenceLine
                y={bufferPct}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                label={{ value: `${fmtPct(bufferPct, 2)} LIF buffer`, position: 'right', fill: '#f59e0b', fontSize: 10 }}
              />
              <ReferenceLine
                x={probeCollateral_USD}
                stroke="#facc15"
                strokeWidth={1.5}
                label={{ value: `slider ${fmtUSD(probeCollateral_USD)}`, position: 'top', fill: '#facc15', fontSize: 10 }}
              />
              {breakevenLIFbuffer != null && (
                <ReferenceLine
                  x={breakevenLIFbuffer}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={{ value: `break-even ${fmtUSD(breakevenLIFbuffer)}`, position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }}
                />
              )}
              <Line type="monotone" dataKey="effectiveSlip" name="Effective slip" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="badDebtPct" name="Bad debt %" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </section>
  );
}
