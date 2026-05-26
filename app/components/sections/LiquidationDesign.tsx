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
import { GOV_LLTVS } from '@/types/simulator';
import { Kpi, formatPct, formatUSD } from '../Kpi';
import { HelpPopover } from '../help/HelpPopover';
import Link from 'next/link';

export function LiquidationDesign() {
  const { fx, inputs, lltvDerivation } = useSimulator();

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

      <div className="grid grid-cols-2 gap-4">
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
      </div>

      <PoolSnapshot
        poolTVL_USD={inputs.poolTVL_USD}
        feeTier={inputs.poolFeeTier}
        coreSplit={inputs.bandSplitCore}
        absorbSplit={inputs.bandSplitAbsorb}
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
          Pre-liquidation scenario: {inputs.preLiquidationEnabled ? 'all borrowers authorized' : 'no borrowers authorized'}
        </div>
        <div className="text-xs mt-1">
          {inputs.preLiquidationEnabled
            ? 'All simulated borrowers are assumed to have authorized optional pre-liquidation. This is a scenario, not the launch baseline.'
            : 'Launch baseline: no borrower authorization is assumed, so only hard-LLTV liquidations can execute.'}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          (Configure this binary scenario on the LLTV page. The worker recomputes bad debt
          for the active assumption only.)
        </div>
      </div>

      <div className="p-4 rounded border border-brix-accent/40 bg-brix-accent/10">
        <div className="text-xs uppercase tracking-wide text-brix-accent mb-1">
          Recommendation
        </div>
        <div className="text-sm">
          At LLTV={(inputs.lltv * 100).toFixed(1)}%, P95 Morpho debt (single) ={' '}
          {fx?.badDebt ? formatUSD(fx.badDebt.badDebtP95_USD) : '—'} (
          {fx?.badDebt ? formatPct(fx.badDebt.badDebtP95Pct, 2) : '—'} of TVL). Full-horizon
          cumulative liquidation volume (
          {fx?.badDebt ? formatUSD(fx.badDebt.expectedLiquidationVolumeP95_USD) : '—'}) is
          LP-LVR burden, not liquidator-skip risk. Pre-liquidation scenario:{' '}
          <strong>
            {inputs.preLiquidationEnabled ? 'all borrowers authorized' : 'no borrowers authorized'}
          </strong>{' '}
          (preLLTV = {(Math.max(0, inputs.lltv - inputs.preLLTVOffset) * 100).toFixed(1)}%);
          governance-snapped LLTV from FX P95 drawdown is{' '}
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
      <Link
        href="/swapliquidity"
        className="ml-auto text-brix-accent hover:text-brix-accentHover"
      >
        Edit on /swapliquidity →
      </Link>
    </div>
  );
}
