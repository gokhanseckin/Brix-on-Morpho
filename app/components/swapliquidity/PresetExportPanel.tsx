'use client';
import { useMemo } from 'react';
import { useUrlState } from '@/lib/useUrlState';
import { buildLadderFromInputs } from '@/lib/poolPreset';
import { HelpPopover } from '@/app/components/help/HelpPopover';

export function PresetExportPanel() {
  const [state] = useUrlState();
  const spot = 1 / state.usdtryBaseline;
  const preset = useMemo(
    () => buildLadderFromInputs(spot, state),
    [
      spot,
      state.poolTVL_USD,
      state.bandSplitCore,
      state.bandSplitAbsorb,
      state.poolFeeTier,
      state.bandCoreLowerPct,
      state.bandCoreUpperPct,
      state.bandAbsorbLowerPct,
      state.bandAbsorbUpperPct,
      state.bandTailLowerPct,
      state.bandTailUpperPct,
    ],
  );
  const json = JSON.stringify(preset, null, 2);

  return (
    <section id="section-export" className="space-y-3">
      <div className="flex items-center gap-1">
        <h2 className="text-lg font-semibold">5. Preset export</h2>
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
