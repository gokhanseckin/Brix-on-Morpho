'use client';
import { useUrlState } from '@/lib/useUrlState';
import { GOV_LLTVS, type LLTV } from '@/types/simulator';

export function SwapliquiditySidebar() {
  const [state, setState] = useUrlState();
  return (
    <aside className="sticky top-0 h-screen w-72 border-r border-neutral-200 dark:border-neutral-800 p-4 overflow-y-auto text-sm space-y-4">
      <h2 className="font-semibold text-base">Pool Config</h2>

      <label className="block">
        LLTV
        <select
          className="mt-1 w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900"
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
        Fee tier
        <select
          className="mt-1 w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900"
          value={state.poolFeeTier}
          onChange={(e) => setState({ poolFeeTier: parseInt(e.target.value, 10) })}
        >
          <option value={3000}>0.30%</option>
          <option value={10000}>1.00%</option>
        </select>
      </label>

      <label className="block">
        Total TVL (USD)
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900"
          value={state.poolTVL_USD}
          onChange={(e) => setState({ poolTVL_USD: parseFloat(e.target.value) || 0 })}
        />
      </label>

      <label className="block">
        Core band share (0..1)
        <input
          type="number"
          step="0.05"
          min={0}
          max={1}
          className="mt-1 w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900"
          value={state.bandSplitCore}
          onChange={(e) => setState({ bandSplitCore: parseFloat(e.target.value) || 0 })}
        />
      </label>

      <label className="block">
        Absorb band share (0..1)
        <input
          type="number"
          step="0.05"
          min={0}
          max={1}
          className="mt-1 w-full rounded border px-2 py-1 bg-white dark:bg-neutral-900"
          value={state.bandSplitAbsorb}
          onChange={(e) => setState({ bandSplitAbsorb: parseFloat(e.target.value) || 0 })}
        />
      </label>

      <p className="text-xs text-neutral-500">
        Tail share: {Math.max(0, 1 - state.bandSplitCore - state.bandSplitAbsorb).toFixed(2)}
      </p>

      <a href="/" className="text-blue-600 hover:underline text-xs block pt-4">
        ← Back to homepage
      </a>
    </aside>
  );
}
