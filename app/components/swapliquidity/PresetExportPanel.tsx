'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildAsymmetricLadder } from '@/lib/poolPreset';
import { HelpPopover } from '@/app/components/help/HelpPopover';

export function PresetExportPanel() {
  const [state] = useUrlState();
  const spot = 1 / state.usdtryBaseline;
  const preset = useMemo(
    () =>
      buildAsymmetricLadder(
        spot,
        state.poolTVL_USD,
        {
          core: state.bandSplitCore,
          absorb: state.bandSplitAbsorb,
          tail: Math.max(0, 1 - state.bandSplitCore - state.bandSplitAbsorb),
        },
        state.poolFeeTier === 10000 ? 10000 : 3000,
      ),
    [spot, state.poolTVL_USD, state.bandSplitCore, state.bandSplitAbsorb, state.poolFeeTier],
  );
  const json = JSON.stringify(preset, null, 2);

  return (
    <section id="section-export" className="space-y-3">
      <div className="flex items-center gap-1">
        <h2 className="text-lg font-semibold">4. Preset export</h2>
        <HelpPopover chartKey="presetExportSchema" />
      </div>
      <p className="text-sm text-neutral-500">
        Paste into kumbaya.xyz deploy script. Homepage §4 also reads this preset (via URL state).
      </p>
      <pre className="text-xs bg-brix-surface rounded p-3 overflow-x-auto">
{json}
      </pre>
    </section>
  );
}
