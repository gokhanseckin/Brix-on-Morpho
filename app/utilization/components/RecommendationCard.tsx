'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

export function RecommendationCard({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  void analysis.recommended.recommended;
  return <section className="rounded-lg border p-4">RecommendationCard placeholder</section>;
}
