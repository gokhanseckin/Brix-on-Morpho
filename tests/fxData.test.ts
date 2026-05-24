import { describe, it, expect } from 'vitest';
import { loadFxRows, dailyLogReturns, windowRows, historicalAnnualizedVol } from '@/lib/fxData';

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

  it('historicalAnnualizedVol returns a positive finite number', () => {
    const σ = historicalAnnualizedVol(loadFxRows());
    expect(Number.isFinite(σ)).toBe(true);
    expect(σ).toBeGreaterThan(0);
    // USD/TRY annualized vol is empirically in a 10–40% range; the
    // home-page Monte Carlo quotes ≈16.8% on this dataset. Pin a wide
    // band so dataset refreshes don't break the test, but catch grossly
    // wrong values.
    expect(σ).toBeGreaterThan(0.05);
    expect(σ).toBeLessThan(0.6);
  });

  it('historicalAnnualizedVol matches manual formula on a sliced window', () => {
    const rows = loadFxRows().slice(0, 252);
    const logRets = dailyLogReturns(rows);
    const mean = logRets.reduce((a, b) => a + b, 0) / logRets.length;
    const variance = logRets.reduce((a, b) => a + (b - mean) ** 2, 0) / (logRets.length - 1);
    const expected = Math.sqrt(variance * 252);
    const got = historicalAnnualizedVol(rows);
    expect(got).toBeCloseTo(expected, 10);
  });
});
