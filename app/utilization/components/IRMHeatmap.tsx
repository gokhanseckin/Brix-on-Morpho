'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const HEATMAP_U = Array.from({ length: 10 }, (_, k) => 0.5 + k * 0.05);
const HEATMAP_R = Array.from({ length: 10 }, (_, k) => 0.01 + k * 0.01);

function colorFor(feasible: boolean, borrowAPY: number, witryY: number): string {
  // Magnitude (ratio of borrow to hold yield) drives the shade; sign of
  // the proper loopMargin>0 test (passed via `feasible`) decides green vs red.
  const ratio = Math.min(2, borrowAPY / Math.max(1e-6, witryY));
  if (feasible) {
    const t = Math.min(1, ratio);
    const r = Math.round(16 + t * (245 - 16));
    const g = Math.round(185 + t * (158 - 185));
    return `rgb(${r}, ${g}, 129)`;
  }
  const t = Math.min(1, Math.max(0, ratio - 1));
  const r = Math.round(245 + t * (239 - 245));
  const g = Math.round(158 + t * (68 - 158));
  return `rgb(${r}, ${g}, 68)`;
}

export function IRMHeatmap({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const w7 = analysis.inputs.witryYield7d;
  const currentU = analysis.recommended.recommended ?? analysis.recommended.bestEffort;
  const currentR = analysis.inputs.rTarget;

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-4">
      <h2 className="font-semibold inline-flex items-center gap-1">IRM Sensitivity Heatmap<HelpPopover chartKey="irmHeatmap" /></h2>
      <p className="text-sm text-neutral-400">
        Borrow APY across (u_target, Rate at Target). Green means the finite-loop
        7d carry margin is positive after borrow cost, slippage, and HF idle cost;
        red means it is not. FX stress is a separate gate. wiTRY 7d = {(w7*100).toFixed(2)}%.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr><th></th>{HEATMAP_U.map(u => <th key={u} className="px-2 py-1 font-mono">{(u*100).toFixed(0)}%</th>)}</tr>
          </thead>
          <tbody>
            {HEATMAP_R.slice().reverse().map(rT => (
              <tr key={rT}>
                <th className="pr-2 py-1 font-mono text-right">{(rT*100).toFixed(1)}%</th>
                {HEATMAP_U.map(u => {
                  const cell = analysis.heatmap.find(c => Math.abs(c.u - u) < 1e-6 && Math.abs(c.r - rT) < 1e-6);
                  if (!cell) return <td key={u}/>;
                  const isCurrent = Math.abs(u - currentU) < 0.025 && Math.abs(rT - currentR) < 0.0051;
                  return (
                    <td key={u} className={`h-8 w-12 border text-center font-mono ${isCurrent ? 'outline outline-2 outline-black' : ''}`}
                        style={{ background: colorFor(cell.feasible, cell.borrowAPY, w7) }}
                        title={`u=${(u*100).toFixed(0)}%, r=${(rT*100).toFixed(1)}%, borrow=${(cell.borrowAPY*100).toFixed(2)}%`}>
                      {(cell.borrowAPY*100).toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500">x: u_target · y: Rate at Target (anchored at u=90%) · cell: borrowAPY% · outline: recommendation</p>
    </section>
  );
}
