'use client';
import type { UtilizationAnalysisOutput } from '@/lib/useUtilizationAnalysis';

export function LooperViabilityCurve({ analysis }: { analysis: UtilizationAnalysisOutput }) {
  void analysis.viabilityCurve.length;
  return <section className="rounded-lg border p-4">LooperViabilityCurve placeholder</section>;
}
