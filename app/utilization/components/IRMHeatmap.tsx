'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

export function IRMHeatmap({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  void analysis.heatmap.length;
  return <section className="rounded-lg border p-4">IRMHeatmap placeholder</section>;
}
