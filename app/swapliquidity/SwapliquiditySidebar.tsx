'use client';
import { useUrlState } from '@/lib/useUrlState';
import { normalizeLadderInputs } from '@/lib/poolPreset';
import { InfoTooltip } from '@/app/components/help/InfoTooltip';
import { PARAM_HELP, PARAM_SECTION } from '@/lib/help/registry';

function paramTooltip(helpKey: keyof typeof PARAM_HELP) {
  const help = PARAM_HELP[helpKey];
  if (help.details) {
    return (
      <InfoTooltip
        text={help.oneLiner}
        moreInfo={{ section: PARAM_SECTION[helpKey], anchor: helpKey }}
      />
    );
  }
  return <InfoTooltip text={help.oneLiner} />;
}

function BandRangeFields(props: {
  label: string;
  lower: number;
  upper: number;
  onLower: (v: number) => void;
  onUpper: (v: number) => void;
}) {
  const toPct = (v: number) => (v * 100).toFixed(1);
  const fromPct = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n / 100 : 0;
  };
  return (
    <label className="block">
      <span className="text-xs text-neutral-600 dark:text-neutral-400">{props.label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          step="0.5"
          className="w-full rounded border px-2 py-1 bg-brix-card"
          value={toPct(props.lower)}
          onChange={(e) => props.onLower(fromPct(e.target.value))}
        />
        <span className="text-xs text-neutral-500">to</span>
        <input
          type="number"
          step="0.5"
          className="w-full rounded border px-2 py-1 bg-brix-card"
          value={toPct(props.upper)}
          onChange={(e) => props.onUpper(fromPct(e.target.value))}
        />
        <span className="text-xs text-neutral-500">%</span>
      </div>
    </label>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="font-mono text-neutral-300">{value}</span>
    </div>
  );
}

export function SwapliquiditySidebar() {
  const [state, setState] = useUrlState();
  const spot = state.usdtryBaseline > 0 ? 1 / state.usdtryBaseline : 1 / 45;
  const normalized = normalizeLadderInputs(spot, state);
  const tailShare = normalized.split.tail;
  return (
    <aside className="sticky top-0 h-screen w-72 border-r border-neutral-200 dark:border-neutral-800 p-4 overflow-y-auto text-sm space-y-4">
      <div className="space-y-2 pb-3 border-b border-neutral-800">
        <h2 className="font-semibold text-base">Market &amp; Simulation</h2>
        <p className="text-[11px] text-neutral-500 leading-snug">
          Read-only. Edit on the{' '}
          <a href="/" className="text-brix-accent underline">
            Market Simulator
          </a>.
        </p>
        <div className="space-y-1.5">
          <ReadOnlyRow label="USD/TRY baseline" value={state.usdtryBaseline} />
          <ReadOnlyRow label="LLTV" value={`${(state.lltv * 100).toFixed(1)}%`} />
          <ReadOnlyRow label="Simulation mode" value={state.simulationMode} />
          <ReadOnlyRow label="Horizon (days)" value={state.simulationHorizonDays} />
          <ReadOnlyRow label="Path count" value={state.pathCount.toLocaleString()} />
        </div>
      </div>

      <h2 className="font-semibold text-base">Pool Config</h2>

      <label className="block">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          Fee tier{paramTooltip('poolFeeTier')}
        </span>
        <select
          className="mt-1 w-full rounded border px-2 py-1 bg-brix-card"
          value={state.poolFeeTier}
          onChange={(e) => setState({ poolFeeTier: parseInt(e.target.value, 10) })}
        >
          <option value={3000}>0.30%</option>
          <option value={10000}>1.00%</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          Single-side AMM TVL{paramTooltip('poolTVL_USD')}
        </span>
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1 bg-brix-card"
          value={state.poolTVL_USD}
          onChange={(e) => setState({ poolTVL_USD: parseFloat(e.target.value) || 0 })}
        />
      </label>

      <label className="block">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          Core band share (0..1){paramTooltip('bandSplitCore')}
        </span>
        <input
          type="number"
          step="0.05"
          min={0}
          max={1}
          className="mt-1 w-full rounded border px-2 py-1 bg-brix-card"
          value={state.bandSplitCore}
          onChange={(e) => setState({ bandSplitCore: parseFloat(e.target.value) || 0 })}
        />
      </label>

      <label className="block">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          Absorb band share (0..1){paramTooltip('bandSplitAbsorb')}
        </span>
        <input
          type="number"
          step="0.05"
          min={0}
          max={1}
          className="mt-1 w-full rounded border px-2 py-1 bg-brix-card"
          value={state.bandSplitAbsorb}
          onChange={(e) => setState({ bandSplitAbsorb: parseFloat(e.target.value) || 0 })}
        />
      </label>

      <p className="text-xs text-neutral-500">
        Tail share: {tailShare.toFixed(2)}
        <span title="Derived: 1 − Core − Absorb. Cannot exceed 1.">{' '}
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-neutral-400 text-[10px] text-neutral-400 ml-1 align-text-bottom">?</span>
        </span>
      </p>
      {normalized.adjustments.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-950/20 p-2 text-xs text-amber-200">
          The calculations use corrected pool inputs:
          <ul className="mt-1 list-disc pl-4">
            {normalized.adjustments.map((adjustment) => (
              <li key={adjustment}>{adjustment}</li>
            ))}
          </ul>
        </div>
      )}

      <BandRangeFields
        label="Core band range (% of spot)"
        lower={state.bandCoreLowerPct}
        upper={state.bandCoreUpperPct}
        onLower={(v) => setState({ bandCoreLowerPct: v })}
        onUpper={(v) => setState({ bandCoreUpperPct: v })}
      />
      <BandRangeFields
        label="Absorb band range (% of spot)"
        lower={state.bandAbsorbLowerPct}
        upper={state.bandAbsorbUpperPct}
        onLower={(v) => setState({ bandAbsorbLowerPct: v })}
        onUpper={(v) => setState({ bandAbsorbUpperPct: v })}
      />
      <BandRangeFields
        label="Tail band range (% of spot)"
        lower={state.bandTailLowerPct}
        upper={state.bandTailUpperPct}
        onLower={(v) => setState({ bandTailLowerPct: v })}
        onUpper={(v) => setState({ bandTailUpperPct: v })}
      />

      <a href="/help/swap-liquidity" className="text-brix-accent hover:underline text-xs block pt-2">
        Help · Read the swap-liquidity guide →
      </a>
      <a href="/" className="text-brix-accent hover:underline text-xs block">
        ← Back to homepage
      </a>
    </aside>
  );
}
