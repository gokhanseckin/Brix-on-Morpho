'use client';
import { useUrlState } from '@/lib/useUrlState';
import { CrossPageLink } from '@/app/components/CrossPageLink';

function ReadOnlyRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono text-neutral-300">{value}</span>
    </div>
  );
}

function pct(x: number, d = 2): string {
  return `${(x * 100).toFixed(d)}%`;
}

function formatRange(lower: number, upper: number): string {
  return `${(lower * 100).toFixed(1)}% to ${(upper * 100).toFixed(1)}%`;
}

export function LLTVSidebar() {
  const [s] = useUrlState();
  const tailShare = Math.max(0, 1 - s.bandSplitCore - s.bandSplitAbsorb);
  return (
    <aside className="sticky top-0 h-screen w-72 border-r border-neutral-200 dark:border-neutral-800 p-4 overflow-y-auto text-sm space-y-4">
      <div className="space-y-2 pb-3 border-b border-neutral-800">
        <h2 className="font-semibold text-base">Market &amp; Simulation</h2>
        <p className="text-[11px] text-neutral-500 leading-snug">
          Read-only. Edit on the{' '}
          <CrossPageLink href="/" className="text-brix-accent underline">
            Market Simulator
          </CrossPageLink>.
        </p>
        <div className="space-y-1.5">
          <ReadOnlyRow label="USD/TRY baseline" value={s.usdtryBaseline} />
          <ReadOnlyRow label="Chosen LLTV" value={pct(s.lltv, 1)} />
          <ReadOnlyRow label="wiTRY TVL" value={`$${s.witryTVL_USD.toLocaleString()}`} />
          <ReadOnlyRow label="Target utilization" value={pct(s.targetUtilization, 1)} />
          <ReadOnlyRow label="Borrower LTV α / β" value={`${s.borrowerLTVAlpha} / ${s.borrowerLTVBeta}`} />
        </div>
      </div>

      <div className="space-y-2 pb-3 border-b border-neutral-800">
        <h2 className="font-semibold text-base">FX Simulation</h2>
        <p className="text-[11px] text-neutral-500 leading-snug">
          Read-only. Edit on the{' '}
          <CrossPageLink href="/" className="text-brix-accent underline">
            Market Simulator
          </CrossPageLink>. Drives the selected 1-day drawdown percentile that feeds the LLTV formula.
        </p>
        <div className="space-y-1.5">
          <ReadOnlyRow label="Mode" value={s.simulationMode} />
          <ReadOnlyRow label="Horizon (days)" value={s.simulationHorizonDays} />
          <ReadOnlyRow label="Path count" value={s.pathCount.toLocaleString()} />
          <ReadOnlyRow label="Historical window (yr)" value={s.historicalPeriod} />
          <ReadOnlyRow label="Block bootstrap" value={s.blockBootstrap ? 'on' : 'off'} />
          <ReadOnlyRow label="Seed" value={s.seed} />
        </div>
      </div>

      <div className="space-y-2 pb-3 border-b border-neutral-800">
        <h2 className="font-semibold text-base">Pool Config</h2>
        <p className="text-[11px] text-neutral-500 leading-snug">
          Read-only. Edit on the{' '}
          <CrossPageLink href="/swapliquidity" className="text-brix-accent underline">
            Swap Liquidity Lab
          </CrossPageLink>. Drives the slippage that feeds the LLTV formula.
        </p>
        <div className="space-y-1.5">
          <ReadOnlyRow label="Single-side AMM TVL" value={`$${s.poolTVL_USD.toLocaleString()}`} />
          <ReadOnlyRow label="Fee tier" value={`${(s.poolFeeTier / 10000).toFixed(2)}%`} />
          <ReadOnlyRow label="Core / Absorb / Tail" value={`${s.bandSplitCore.toFixed(2)} / ${s.bandSplitAbsorb.toFixed(2)} / ${tailShare.toFixed(2)}`} />
          <ReadOnlyRow label="Core range" value={formatRange(s.bandCoreLowerPct, s.bandCoreUpperPct)} />
          <ReadOnlyRow label="Absorb range" value={formatRange(s.bandAbsorbLowerPct, s.bandAbsorbUpperPct)} />
          <ReadOnlyRow label="Tail range" value={formatRange(s.bandTailLowerPct, s.bandTailUpperPct)} />
        </div>
      </div>

      <CrossPageLink href="/" className="text-brix-accent hover:underline text-xs block">
        ← Back to Market Simulator
      </CrossPageLink>
      <CrossPageLink href="/swapliquidity" className="text-brix-accent hover:underline text-xs block">
        → Swap Liquidity Lab
      </CrossPageLink>
    </aside>
  );
}
