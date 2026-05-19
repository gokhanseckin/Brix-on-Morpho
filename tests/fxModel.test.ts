import { describe, it, expect } from 'vitest';
import { bootstrapPaths, blockBootstrapPaths, gbmPaths, fitGbmParams } from '@/lib/fxModel';

const returns = Array.from({ length: 500 }, (_, i) => 0.001 * (i % 5 - 2)); // deterministic stand-in

describe('bootstrap', () => {
  it('reproducible under same seed', () => {
    const a = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 100, seed: 42 });
    const b = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 100, seed: 42 });
    expect(a).toEqual(b);
  });
  it('different seed → different paths', () => {
    const a = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 5, seed: 1 });
    const b = bootstrapPaths({ returns, S0: 38, horizonDays: 30, paths: 5, seed: 2 });
    expect(a).not.toEqual(b);
  });
  it('shape is [paths][horizonDays+1] and S[0]=S0', () => {
    const p = bootstrapPaths({ returns, S0: 38, horizonDays: 10, paths: 3, seed: 7 });
    expect(p.length).toBe(3);
    expect(p[0]!.length).toBe(11);
    for (const path of p) expect(path[0]).toBe(38);
  });
  it('block bootstrap shape ok', () => {
    const p = blockBootstrapPaths({ returns, S0: 38, horizonDays: 20, paths: 4, seed: 9, blockLength: 5 });
    expect(p.length).toBe(4);
    expect(p[0]!.length).toBe(21);
  });
});

describe('GBM', () => {
  it('converges to S0·exp(μT) over many paths', () => {
    const paths = gbmPaths({ mu: 0.2, sigma: 0.25, S0: 38, horizonDays: 30, paths: 10_000, seed: 11 });
    const T = 30 / 252; // trading-year convention
    const ST = paths.map((p) => p[p.length - 1]!);
    const mean = ST.reduce((a, b) => a + b, 0) / ST.length;
    expect(mean).toBeCloseTo(38 * Math.exp(0.2 * T), 0); // loose: within ~$1
  });

  it('fitGbmParams returns finite μ, σ', () => {
    const r = Array.from({ length: 500 }, (_, i) => 0.001 * Math.sin(i));
    const { mu, sigma } = fitGbmParams(r);
    expect(Number.isFinite(mu)).toBe(true);
    expect(sigma).toBeGreaterThan(0);
  });
});
