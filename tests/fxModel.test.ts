import { describe, it, expect } from 'vitest';
import { bootstrapPaths, blockBootstrapPaths, gbmPaths, fitGbmParams, jumpDiffusionPaths, percentilesAtEachStep, rolling3DayMaxDrawdown } from '@/lib/fxModel';

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

describe('jump diffusion', () => {
  it('reproducible & shape', () => {
    const a = jumpDiffusionPaths({ mu: 0.2, sigma: 0.25, lambda: 4, muJ: 0.05, sigmaJ: 0.04, S0: 38, horizonDays: 30, paths: 50, seed: 5 });
    const b = jumpDiffusionPaths({ mu: 0.2, sigma: 0.25, lambda: 4, muJ: 0.05, sigmaJ: 0.04, S0: 38, horizonDays: 30, paths: 50, seed: 5 });
    expect(a).toEqual(b);
    expect(a[0]!.length).toBe(31);
  });

  it('compensator preserves E[S_T] ≈ S_0·exp(μT) under jumps (report #2 entry 20)', () => {
    // With Merton's drift correction −λκ, the expected terminal price matches
    // the pure-GBM expectation. Use a long horizon + many paths to reduce variance.
    const paths = jumpDiffusionPaths({
      mu: 0.2, sigma: 0.25, lambda: 4, muJ: 0.05, sigmaJ: 0.04,
      S0: 38, horizonDays: 252, paths: 20_000, seed: 99,
    });
    const ST = paths.map((p) => p[p.length - 1]!);
    const mean = ST.reduce((a, b) => a + b, 0) / ST.length;
    const expected = 38 * Math.exp(0.2 * 1); // T=252/252=1 yr
    // Loose: within ~5% of analytical mean.
    expect(Math.abs(mean - expected) / expected).toBeLessThan(0.05);
  });
});

describe('summaries', () => {
  it('percentilesAtEachStep returns 4 arrays length horizon+1', () => {
    const paths = [
      [1, 1.1, 1.2], [1, 0.9, 0.8], [1, 1.0, 1.0], [1, 0.95, 0.85], [1, 1.05, 1.1],
    ];
    const { p5, p50, p95, p99 } = percentilesAtEachStep(paths);
    expect(p5.length).toBe(3);
    expect(p99.length).toBe(3);
    expect(p50[0]).toBeCloseTo(1, 8);
    // p99 ≥ p95 at every step (sanity)
    for (let t = 0; t < p99.length; t++) {
      expect(p99[t]!).toBeGreaterThanOrEqual(p95[t]!);
    }
  });

  it('rolling 3-day max drawdown measures upward S moves (TRY weakening)', () => {
    // Monotonically rising USD/TRY = TRY weakening = collateral USD drawdown.
    const rising = [[1, 1.05, 1.10, 1.15, 1.20]];
    const ddUp = rolling3DayMaxDrawdown(rising, 3);
    // Worst 3-day move from t=0: (1.15-1)/1 = 0.15; from t=1: (1.20-1.05)/1.05 ≈ 0.143.
    expect(ddUp[0]).toBeCloseTo(0.15, 6);

    // Falling path (TRY strengthening) is GOOD for collateral → 0 drawdown.
    const falling = [[1, 0.95, 0.9, 0.85, 0.8]];
    const ddDown = rolling3DayMaxDrawdown(falling, 3);
    expect(ddDown[0]).toBe(0);
  });
});
