'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const usd = (v: number) => `$${Math.round(v).toLocaleString()}`;

export function RecommendationTable({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  const rec = analysis.recommended.recommended;
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Recommendation Table</h2>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
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
              <tr key={r.uTarget} className={`border-t ${isRec ? 'bg-blue-50 font-medium' : ''}`}>
                <td className="py-1 font-mono">{pct(r.uTarget)}</td>
                <td className="font-mono">{pct(r.borrowAPY)}</td>
                <td className="font-mono">{pct(r.supplierAPY)}</td>
                <td className={`font-mono ${r.loopMargin7d > 0 ? 'text-green-700' : 'text-red-700'}`}>{pct(r.loopMargin7d)}</td>
                <td className={`font-mono ${r.loopMargin30d > 0 ? 'text-green-700' : 'text-red-700'}`}>{pct(r.loopMargin30d)}</td>
                <td className="font-mono">{usd(r.bufferUSD)}</td>
                <td className="font-mono">{usd(r.stressWithdrawalUSD)}</td>
                <td className={r.survives ? 'text-green-700' : 'text-red-700'}>{r.survives ? '✓' : '✗'}</td>
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
