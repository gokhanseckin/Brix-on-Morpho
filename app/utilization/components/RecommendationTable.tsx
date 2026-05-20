'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

export function RecommendationTable({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  void analysis.recommendationTable.length;
  return <section className="rounded-lg border p-4">RecommendationTable placeholder</section>;
}
