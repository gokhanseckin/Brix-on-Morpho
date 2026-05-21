'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';
import { HelpPopover } from '@/app/components/help/HelpPopover';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

export function RecommendationTable({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const rec = analysis.recommended.recommended;
  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-4">
      <h2 className="font-semibold inline-flex items-center gap-1">Recommendation Table<HelpPopover chartKey="recommendationTable" /></h2>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1">u_target</th>
            <th>Borrow APY</th>
            <th>Supplier APY</th>
            <th>Margin 7d</th>
            <th>Margin 30d</th>
            <th>Buffer</th>
            <th>Stress</th>
            <th>Survives</th>
            <th>Δ kink</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {analysis.recommendationTable.map(r => {
            const isRec = rec !== null && Math.abs(r.uTarget - rec) < 1e-6;
            return (
              <tr key={r.uTarget} className={`border-t border-brix-border ${isRec ? 'bg-brix-accent/10 font-medium text-brix-accent' : ''}`}>
                <td className="py-1 font-mono">{pct(r.uTarget)}</td>
                <td className="font-mono">{pct(r.borrowAPY)}</td>
                <td className="font-mono">{pct(r.supplierAPY)}</td>
                <td className={`font-mono ${r.loopMargin7d > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{pct(r.loopMargin7d)}</td>
                <td className={`font-mono ${r.loopMargin30d > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{pct(r.loopMargin30d)}</td>
                <td className="font-mono">{usd(r.bufferUSD)}</td>
                <td className="font-mono">{usd(r.stressWithdrawalUSD)}</td>
                <td className={r.survives ? 'text-emerald-300' : 'text-red-300'}>{r.survives ? '✓' : '✗'}</td>
                <td className="font-mono">{r.distanceToKink.toFixed(3)}</td>
                <td>{r.verdict === 'feasible' ? '✓ feasible' : r.verdict === 'tight' ? '⚠ tight' : '✗ infeasible'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
