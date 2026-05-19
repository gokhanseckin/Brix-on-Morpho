import { describe, it, expect } from 'vitest';
import { loadFxRows, dailyLogReturns, windowRows } from '@/lib/fxData';

describe('fxData', () => {
  it('loads at least 1500 rows post-2015', () => {
    const rows = loadFxRows();
    expect(rows.length).toBeGreaterThan(1500);
    expect(rows[0]!.date >= '2015-01-01').toBe(true);
  });

  it('computes daily log-returns of length N-1', () => {
    const rows = loadFxRows().slice(0, 10);
    const r = dailyLogReturns(rows);
    expect(r.length).toBe(9);
    for (const x of r) expect(Number.isFinite(x)).toBe(true);
  });

  it('windowRows returns trailing N years', () => {
    const all = loadFxRows();
    const y1 = windowRows(all, 1);
    expect(y1.length).toBeGreaterThan(200);
    expect(y1.length).toBeLessThan(280);
  });
});
