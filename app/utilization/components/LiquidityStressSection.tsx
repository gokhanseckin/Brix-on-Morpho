'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

export function LiquidityStressSection({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  void analysis.stressTable.length;
  return <section className="rounded-lg border p-4">LiquidityStressSection placeholder</section>;
}
