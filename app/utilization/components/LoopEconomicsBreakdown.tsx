'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

export function LoopEconomicsBreakdown({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  void (analysis.recommendedDetails.economics?.netLoopAPY ?? 'n/a');
  return <section className="rounded-lg border p-4">LoopEconomicsBreakdown placeholder</section>;
}
