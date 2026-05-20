import { createRng, gauss } from './rng';
import { quantileSorted } from './stats';

export type Path = number[]; // length = horizonDays + 1

export interface BootstrapArgs {
  returns: number[];
  S0: number;
  horizonDays: number;
  paths: number;
  seed: number | string;
}

export function bootstrapPaths(a: BootstrapArgs): Path[] {
  const rng = createRng(a.seed);
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    for (let t = 1; t <= a.horizonDays; t++) {
      const r = a.returns[Math.floor(rng() * a.returns.length)]!;
      s[t] = s[t - 1]! * Math.exp(r);
    }
    out.push(s);
  }
  return out;
}

export interface BlockBootstrapArgs extends BootstrapArgs {
  blockLength: number;
}

export interface GbmArgs {
  mu: number;
  sigma: number;
  S0: number;
  horizonDays: number;
  paths: number;
  seed: number | string;
}

export function gbmPaths(a: GbmArgs): Path[] {
  const rng = createRng(a.seed);
  const dt = 1 / 252;
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    for (let t = 1; t <= a.horizonDays; t++) {
      const z = gauss(rng);
      s[t] = s[t - 1]! * Math.exp((a.mu - 0.5 * a.sigma * a.sigma) * dt + a.sigma * Math.sqrt(dt) * z);
    }
    out.push(s);
  }
  return out;
}

export function fitGbmParams(returns: number[]): { mu: number; sigma: number } {
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  // Daily → annualized assuming 252 trading days
  return { mu: mean * 252 + 0.5 * variance * 252, sigma: Math.sqrt(variance * 252) };
}

export interface JumpArgs extends GbmArgs {
  lambda: number;
  muJ: number;
  sigmaJ: number;
}

export function jumpDiffusionPaths(a: JumpArgs): Path[] {
  const rng = createRng(a.seed);
  const dt = 1 / 252;
  // κ = E[e^J − 1] = exp(μJ + σJ²/2) − 1
  const kappa = Math.exp(a.muJ + 0.5 * a.sigmaJ * a.sigmaJ) - 1;
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    for (let t = 1; t <= a.horizonDays; t++) {
      const z = gauss(rng);
      // Poisson(λ·dt): for small dt, draw via inverse-transform or thinning.
      const lambdaDt = a.lambda * dt;
      let nJumps = 0;
      // Knuth: for small λ·dt this is fine
      const L = Math.exp(-lambdaDt);
      let k = 0, prod = rng();
      while (prod > L) { k++; prod *= rng(); }
      nJumps = k;
      let jumpSum = 0;
      for (let j = 0; j < nJumps; j++) jumpSum += a.muJ + a.sigmaJ * gauss(rng);
      const drift = (a.mu - 0.5 * a.sigma * a.sigma - a.lambda * kappa) * dt;
      s[t] = s[t - 1]! * Math.exp(drift + a.sigma * Math.sqrt(dt) * z + jumpSum);
    }
    out.push(s);
  }
  return out;
}

export function blockBootstrapPaths(a: BlockBootstrapArgs): Path[] {
  const rng = createRng(a.seed);
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    let t = 1;
    while (t <= a.horizonDays) {
      const start = Math.floor(rng() * Math.max(1, a.returns.length - a.blockLength));
      for (let b = 0; b < a.blockLength && t <= a.horizonDays; b++, t++) {
        const r = a.returns[start + b]!;
        s[t] = s[t - 1]! * Math.exp(r);
      }
    }
    out.push(s);
  }
  return out;
}

export function percentilesAtEachStep(paths: Path[]): { p5: number[]; p50: number[]; p95: number[] } {
  const n = paths[0]!.length;
  const p5 = new Array<number>(n);
  const p50 = new Array<number>(n);
  const p95 = new Array<number>(n);
  for (let t = 0; t < n; t++) {
    const col = paths.map((p) => p[t]!).sort((a, b) => a - b);
    p5[t] = quantileSorted(col, 0.05);
    p50[t] = quantileSorted(col, 0.5);
    p95[t] = quantileSorted(col, 0.95);
  }
  return { p5, p50, p95 };
}

/**
 * For each USD/TRY path, the largest rolling `window`-day **upward** move
 * in S (USD/TRY), reported as a positive fraction.
 *
 * Report #2 entry #23 fix: the previous implementation measured the largest
 * downward move (TRY *strengthening*), which is the opposite of the event
 * spec §2 cares about. wiTRY collateral is denominated in TRY, valued in
 * USD as `~1/S`; an upward move in S = TRY weakening = collateral USD
 * value falling = "drawdown" for the lender. The 3-day window proxies the
 * secondary-market exit risk window for liquidators.
 *
 * The yield-accrual offset over a 3-day window is ≤ 0.3% even at iTRY APY
 * = 38% (`1.38^(3/365) ≈ 1.0028`), well below the FX magnitudes that
 * dominate drawdown. Ignored here for simplicity.
 */
export function rolling3DayMaxDrawdown(paths: Path[], window: number): number[] {
  return paths.map((p) => {
    let maxDd = 0;
    for (let i = 0; i + window < p.length; i++) {
      const start = p[i]!;
      let maxAfter = start;
      for (let j = i + 1; j <= i + window; j++) if (p[j]! > maxAfter) maxAfter = p[j]!;
      const dd = (maxAfter - start) / start;
      if (dd > maxDd) maxDd = dd;
    }
    return maxDd;
  });
}
