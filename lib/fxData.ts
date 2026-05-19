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
