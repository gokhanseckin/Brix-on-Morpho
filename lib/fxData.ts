import raw from './usdtryData.json';

export type FxRow = { date: string; rate: number };

export function loadFxRows(): FxRow[] {
  return (raw as { rows: FxRow[] }).rows;
}

export function dailyLogReturns(rows: FxRow[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    out.push(Math.log(rows[i]!.rate / rows[i - 1]!.rate));
  }
  return out;
}

export function windowRows(rows: FxRow[], years: 1 | 3 | 5): FxRow[] {
  const last = rows[rows.length - 1]!.date;
  const cutoff = new Date(last);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const iso = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= iso);
}

// Annualized σ of daily log-returns. Mirrors the σ already shown on the
// home page's FX section. Used by /utilization as the FX-risk overlay
// magnitude. No drift adjustment — vol only.
export function historicalAnnualizedVol(rows: FxRow[]): number {
  const r = dailyLogReturns(rows);
  if (r.length < 2) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const variance = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
  return Math.sqrt(variance * 252);
}
