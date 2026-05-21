'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

export function LiquidityStressSection({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-4">
      <h2 className="font-semibold inline-flex items-center gap-1">Liquidity Stress Test<HelpPopover chartKey="liquidityStressTable" /></h2>
      <p className="text-sm text-neutral-400">
        Stress: {pct(analysis.inputs.stressPctOfSupply)} of supply withdrawn in one day.
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th className="py-1">u_target</th>
            <th>Buffer</th>
            <th>Stress withdrawal</th>
            <th>Survives?</th>
            <th>Days to refill</th>
          </tr>
        </thead>
        <tbody>
          {analysis.stressTable.map(r => (
            <tr key={r.uTarget} className="border-t">
              <td className="py-1 font-mono">{pct(r.uTarget)}</td>
              <td className="font-mono">{usd(r.bufferUSD)}</td>
              <td className="font-mono">{usd(r.stressWithdrawalUSD)}</td>
              <td className={r.survives ? 'text-emerald-300' : 'text-red-300'}>{r.survives ? '✓' : '✗'}</td>
              <td className="font-mono text-neutral-400">
                {r.survives ? '—' : (((r.stressWithdrawalUSD - r.bufferUSD) / Math.max(1e-9, r.borrowAPY * r.uTarget * analysis.inputs.tvlUSDM_USD / 365)).toFixed(1))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
