'use client';
import { useUrlState } from '@/lib/useUrlState';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';
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

export function SwapliquiditySidebar() {
  const [state, setState] = useUrlState();
  const tailShare = Math.max(0, 1 - state.bandSplitCore - state.bandSplitAbsorb);
  return (
    <aside className="sticky top-0 h-screen w-72 border-r border-neutral-200 dark:border-neutral-800 p-4 overflow-y-auto text-sm space-y-4">
      <h2 className="font-semibold text-base">Pool Config</h2>

      <label className="block">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          USD/TRY baseline{paramTooltip('usdtryBaseline')}
        </span>
        <input
          type="number"
          step="0.5"
          min={1}
          className="mt-1 w-full rounded border px-2 py-1 bg-brix-card"
          value={state.usdtryBaseline}
          onChange={(e) => setState({ usdtryBaseline: parseFloat(e.target.value) || 0 })}
        />
        <span className="block text-[10px] text-neutral-500 mt-1">
          Spot wTRY/USDM = 1 / this. Shared with homepage via URL.
        </span>
      </label>

      <label className="block">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          LLTV{paramTooltip('lltv')}
        </span>
        <select
          className="mt-1 w-full rounded border px-2 py-1 bg-brix-card"
          value={String(state.lltv)}
          onChange={(e) => setState({ lltv: parseFloat(e.target.value) as LLTV })}
        >
          {GOV_LLTVS.map((lv) => (
            <option key={lv} value={String(lv)}>
              {lv === 0.86 ? `${(lv * 100).toFixed(1)}% (recommended)` : `${(lv * 100).toFixed(1)}%`}
            </option>
          ))}
        </select>
      </label>

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

      <a href="/help/swap-liquidity" className="text-brix-accent hover:underline text-xs block pt-2">
        Help · Read the swap-liquidity guide →
      </a>
      <a href="/" className="text-brix-accent hover:underline text-xs block">
        ← Back to homepage
      </a>
    </aside>
  );
}
