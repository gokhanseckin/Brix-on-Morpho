'use client';
import { useSimulator } from '@/lib/useSimulator';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { useMemo } from 'react';
import { sampleBetaLtvFractions } from '@/lib/simulator';
import { LIF } from '@/lib/morphoMath';
import { quantile } from '@/lib/stats';
import { GOV_LLTVS } from '@/types/simulator';
import { Kpi, formatPct, formatUSD } from '../Kpi';
import { HelpPopover } from '../help/HelpPopover';
import Link from 'next/link';

// Concurrent stress: assume arbitrage refills the AMM ladder back toward oracle
// on a ~30-min cycle, giving 48 cycles/day × 3 days = 144 single-swap clears
// over the 3-day stress window. Conservative — real refill cadence depends on
// MEV competition and the gap between AMM mid and oracle.
const ARB_REFILL_PER_3_DAYS = 144;

export function LiquidationDesign() {
  const { fx, inputs, lltvDerivation, pool } = useSimulator();
  const { effectiveDepth_USD } = pool;

  // Bad debt histogram
  const badDebtBins = useMemo(() => {
    const data = fx?.badDebt?.badDebtByPath ?? [];
    if (data.length === 0) return [];
    const max = Math.max(...data, 1);
    const bins = 10;
    const width = max / bins;
    const out: Array<{ range: string; count: number; lo: number }> = [];
    for (let i = 0; i < bins; i++) {
      out.push({
        range: `${formatUSD(i * width)}–${formatUSD((i + 1) * width)}`,
        count: 0,
        lo: i * width,
      });
    }
    for (const v of data) {
      const idx = Math.min(bins - 1, Math.floor(v / Math.max(width, 1e-9)));
      const target = out[idx];
      if (target) target.count++;
    }
    return out;
  }, [fx]);

  // Concurrent stress at the P95 3-day FX move.
  //
  // A borrower with utilization fraction f has effective LTV = f × LLTV and
  // buffer = (1 − f). They liquidate within a 3-day window iff drawdown ≥
  // buffer, i.e. f ≥ 1 − dd_p95. We resample the same Beta(α, β) borrower
  // population the worker uses (deterministic on inputs.seed), filter to the
  // tail above that threshold, and sum their debt × LIF. That's the aggregate
  // collateral seized over the worst 3 days — what could pressure the AMM if
  // arrivals cluster.
  //
  // Capacity: between liquidations, arbitrage restores depth to ~oracle.
  // Assume a conservative 30-min refill cycle → 144 arb cycles per 3 days.
  // Each cycle can clear up to the AMM single-swap breakeven (largest swap
  // with effective slip ≤ LIF − 1).
  const concurrentStress = useMemo(() => {
    const dd_p95 =
      fx?.threeDayDD && fx.threeDayDD.length > 0 ? quantile(fx.threeDayDD, 0.95) : 0.15;
    const fMin = Math.max(0, 1 - dd_p95);

    const N = 1000;
    const ltvFractions = sampleBetaLtvFractions({
      alpha: inputs.borrowerLTVAlpha,
      beta: inputs.borrowerLTVBeta,
      n: N,
      seed: inputs.seed,
    });
    const collateralEach = inputs.witryTVL_USD / N;

    const atRisk = ltvFractions.filter((f) => f >= fMin);
    const positionsAtRisk = atRisk.length;
    const debtAtRisk_USD = atRisk.reduce(
      (sum, f) => sum + f * inputs.lltv * collateralEach,
      0,
    );
    const seizedConcurrent_USD = debtAtRisk_USD * LIF(inputs.lltv);

    const breakevenPerSwap_USD = isFinite(lltvDerivation.minMax.max_USD)
      ? lltvDerivation.minMax.max_USD
      : 0;
    const ammCapacity_3d_USD = breakevenPerSwap_USD * ARB_REFILL_PER_3_DAYS;

    const viable = seizedConcurrent_USD <= ammCapacity_3d_USD;
    const headroom_USD = ammCapacity_3d_USD - seizedConcurrent_USD;

    return {
      dd_p95,
      fMin,
      positionsAtRisk,
      population: N,
      debtAtRisk_USD,
      seizedConcurrent_USD,
      breakevenPerSwap_USD,
      ammCapacity_3d_USD,
      viable,
      headroom_USD,
    };
  }, [
    fx,
    inputs.borrowerLTVAlpha,
    inputs.borrowerLTVBeta,
    inputs.seed,
    inputs.witryTVL_USD,
    inputs.lltv,
    lltvDerivation.minMax.max_USD,
  ]);

  return (
    <section id="section-liquidation-design" className="space-y-6">
      <div>
        <div className="brix-kicker mb-2">04 · Liquidation</div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Liquidation Design</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Whether liquidations will actually fire given pool depth and gas, expected bad-debt
          distribution, and the value of pre-liquidation.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi
          label="P95 Morpho debt — single (USD)"
          value={fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'}
          hint="Cascade with each liquidation priced as its own swap. Lower bound — assumes liquidators clear positions one at a time."
          helpKey="badDebtP95USD"
        />
        <Kpi
          label="P95 Morpho debt — single (% TVL)"
          value={fx?.badDebt ? formatPct(fx.badDebt.badDebtP95Pct, 2) : '—'}
          tone={
            fx?.badDebt && fx.badDebt.badDebtP95Pct > 0.05
              ? 'bad'
              : fx?.badDebt && fx.badDebt.badDebtP95Pct > 0.01
                ? 'warn'
                : 'good'
          }
          helpKey="badDebtP95Pct"
        />
        <Kpi
          label="Concurrent stress @ P95 3-day move"
          value={
            concurrentStress.viable
              ? `VIABLE · ${formatUSD(concurrentStress.seizedConcurrent_USD)}`
              : `STRESSED · ${formatUSD(concurrentStress.seizedConcurrent_USD)}`
          }
          hint={`At ${formatPct(concurrentStress.dd_p95, 1)} 3-day drawdown, ${concurrentStress.positionsAtRisk}/${concurrentStress.population} borrowers (Beta tail with f ≥ ${concurrentStress.fMin.toFixed(2)}) cross LLTV. Aggregate seized ${formatUSD(concurrentStress.seizedConcurrent_USD)}. With ~30-min arb refill cycle, AMM clears ~${formatUSD(concurrentStress.ammCapacity_3d_USD)} per 3 days (single-swap max ${formatUSD(concurrentStress.breakevenPerSwap_USD)} × 144). ${concurrentStress.viable ? 'Liquidators fire freely.' : 'Cluster risk: arrivals may outpace arb refill.'}`}
          tone={concurrentStress.viable ? 'good' : 'bad'}
        />
        <Kpi
          label="Profitable debt range (gas-aware)"
          value={
            isFinite(lltvDerivation.minMax.min_USD) && isFinite(lltvDerivation.minMax.max_USD)
              ? `${formatUSD(lltvDerivation.minMax.min_USD)} – ${formatUSD(lltvDerivation.minMax.max_USD)}`
              : 'unprofitable at any size'
          }
          hint={`Liquidator P&L ≥ 0: lower bound is gas-floor ($${5} gas eats small debt), upper bound is slippage-ceiling (AMM proceeds eaten by price impact). The swap-page "max liquidator dump at break-even" KPI uses a stricter LIF-buffer cutoff (gas-blind) — see /swapliquidity.`}
          helpKey="minProfitableLiquidation"
        />
      </div>

      <PoolSnapshot
        poolTVL_USD={inputs.poolTVL_USD}
        feeTier={inputs.poolFeeTier}
        coreSplit={inputs.bandSplitCore}
        absorbSplit={inputs.bandSplitAbsorb}
        concurrentStress_USD={concurrentStress.seizedConcurrent_USD}
      />

      <div>
        <div className="flex items-center gap-1 mb-2">
          <h3 className="text-sm font-semibold">
            Bad-debt distribution across simulated paths
            <span className="ml-2 text-xs font-normal text-neutral-500">
              (aggregate Morpho debt per path — full borrower-population cascade)
            </span>
          </h3>
          <HelpPopover chartKey="badDebtHistogram" />
        </div>
        <p className="text-xs text-neutral-500 mb-2 max-w-3xl">
          Each bar counts simulated FX paths whose total leftover Morpho debt
          (summed across the Beta-distributed borrower population, with sequential
          AMM liquidations and pre-liquidation cascade) lands in that USD bucket.
          For the single-probe complement — &ldquo;if a $X seized-collateral dump lands
          at this path&apos;s terminal spot, what&apos;s the bad-debt rate?&rdquo; — see{' '}
          <Link
            href="/swapliquidity#section-recovery"
            className="text-brix-accent hover:text-brix-accentHover"
          >
            Bad-debt distribution at slider size → /swapliquidity
          </Link>
          .
        </p>
        <div className="border border-brix-border rounded p-2 bg-brix-card">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={badDebtBins} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="range" tick={{ fontSize: 9 }} interval={0} angle={-20} height={50} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        className={`p-4 rounded border ${
          inputs.preLiquidationEnabled
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
            : 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
        }`}
      >
        <div className="text-sm font-semibold">
          Pre-liquidation: {inputs.preLiquidationEnabled ? 'enabled' : 'disabled'}
        </div>
        <div className="text-xs mt-1">
          {inputs.preLiquidationEnabled
            ? 'Positions can be partially closed before the hard LLTV, reducing tail bad debt at the cost of borrower friction. Toggle off in the sidebar to see the contrast.'
            : 'Liquidations only trigger at the hard LLTV. Toggle on in the sidebar to reduce tail bad debt.'}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          (Worker recomputes bad-debt for the active toggle setting only; for an exact A/B
          comparison toggle in the sidebar and observe the headline P95 KPI change.)
        </div>
      </div>

      <div className="p-4 rounded border border-brix-accent/40 bg-brix-accent/10">
        <div className="text-xs uppercase tracking-wide text-brix-accent mb-1">
          Recommendation
        </div>
        <div className="text-sm">
          At LLTV={(inputs.lltv * 100).toFixed(1)}%, P95 Morpho debt (single) ={' '}
          {fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'} (
          {fx?.badDebt ? formatPct(fx.badDebt.badDebtP95Pct, 2) : '—'} of TVL).
          Concurrent stress at P95 3-day move ({formatPct(concurrentStress.dd_p95, 1)}):{' '}
          {concurrentStress.positionsAtRisk}/{concurrentStress.population} borrowers in Beta tail,{' '}
          {formatUSD(concurrentStress.seizedConcurrent_USD)} aggregate seized →{' '}
          <strong>{concurrentStress.viable ? 'VIABLE' : 'STRESSED'}</strong>
          {!concurrentStress.viable && ' if liquidations cluster faster than arb-refill'} against
          ~{formatUSD(concurrentStress.ammCapacity_3d_USD)} of 3-day AMM clearing capacity
          (single-swap max × 144 refills). Note: 90-day cumulative liquidation volume (
          {fx?.badDebt ? formatUSD(fx.badDebt.expectedLiquidationVolumeP95_USD) : '—'}) is LP-LVR
          burden, not liquidator-skip risk. Recommended wiTRY/USDM pool depth ≥{' '}
          {formatUSD(
            Math.max(concurrentStress.seizedConcurrent_USD / 0.0438, effectiveDepth_USD, 250_000),
          )}{' '}
          (concurrent seized ÷ LIF cliff; $250k floor). Keep pre-liquidation enabled (preLLTV ={' '}
          {(Math.max(0, inputs.lltv - 0.05) * 100).toFixed(1)}%); governance-snapped LLTV from FX
          P95 drawdown is{' '}
          {lltvDerivation.snapped ? `${(lltvDerivation.snapped * 100).toFixed(1)}%` : '—'}.
        </div>
        <div className="text-xs text-neutral-500 mt-2">
          Governance list: {GOV_LLTVS.map((v) => `${(v * 100).toFixed(1)}%`).join(', ')}.
        </div>
      </div>
    </section>
  );
}

interface PoolSnapshotProps {
  poolTVL_USD: number;
  feeTier: number;
  coreSplit: number;
  absorbSplit: number;
  concurrentStress_USD: number;
}

function PoolSnapshot(p: PoolSnapshotProps) {
  const tailSplit = Math.max(0, 1 - p.coreSplit - p.absorbSplit);
  const feeLabel = p.feeTier === 10000 ? '1.00%' : `${(p.feeTier / 10000).toFixed(2)}%`;
  return (
    <div className="p-3 rounded border border-brix-border bg-brix-card flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
      <div className="font-semibold text-neutral-300">Pool snapshot</div>
      <div>
        TVL <span className="text-neutral-100">{formatUSD(p.poolTVL_USD)}</span>
      </div>
      <div>
        Fee <span className="text-neutral-100">{feeLabel}</span>
      </div>
      <div>
        Splits{' '}
        <span className="text-neutral-100">
          core {(p.coreSplit * 100).toFixed(0)}% · absorb {(p.absorbSplit * 100).toFixed(0)}% ·
          tail {(tailSplit * 100).toFixed(0)}%
        </span>
      </div>
      <div>
        P95 3-day stress{' '}
        <span className="text-neutral-100">{formatUSD(p.concurrentStress_USD)}</span>
      </div>
      <Link
        href="/swapliquidity"
        className="ml-auto text-brix-accent hover:text-brix-accentHover"
      >
        Edit on /swapliquidity →
      </Link>
    </div>
  );
}
