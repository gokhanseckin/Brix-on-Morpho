// lib/stats.ts
// Shared statistical helpers. Single source of truth for quantile semantics
// across the simulator. R-7 / linear-interpolation convention — matches
// numpy.percentile and R's default quantile().

/**
 * R-7 linear-interpolation quantile.
 *
 * Sorts `xs` (caller does not need to pre-sort) and computes the `q`-th
 * quantile via `idx = q · (n − 1)`, blending the two surrounding ordered
 * values. Returns 0 for the empty input (matches the prior useSimulator
 * fallback so call sites that relied on it stay green).
 *
 * Matches `numpy.percentile(xs, 100·q)` and R `quantile(xs, q)` defaults.
 */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (idx - lo) * (sorted[hi]! - sorted[lo]!);
}

/**
 * In-place variant for callers that already hold a sorted array and want
 * to avoid the copy+sort. Behavior matches `quantile` on the same data.
 */
export function quantileSorted(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (idx - lo) * (sorted[hi]! - sorted[lo]!);
}

// ---------------------------------------------------------------------------
// Beta distribution
// ---------------------------------------------------------------------------

/**
 * Lanczos log-Gamma. Accurate to ~1e-14 for positive real x. Used to compute
 * the Beta normalising constant without overflow for larger α + β.
 */
function logGamma(x: number): number {
  // Lanczos coefficients (g = 7, n = 9).
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflection formula.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0]!;
  const t = x + g + 0.5;
  for (let i = 1; i < c.length; i++) a += c[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/**
 * Beta(α, β) probability density at x ∈ (0, 1).
 *
 * Returns 0 at the singular boundaries when α < 1 or β < 1 — the true
 * density is infinite there, but for plotting we want a finite value so
 * the chart doesn't blow up. Sample in the interior to see the shape.
 */
export function betaPdf(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  if (alpha <= 0 || beta <= 0) return 0;
  const logPdf =
    (alpha - 1) * Math.log(x) +
    (beta - 1) * Math.log(1 - x) -
    logBeta(alpha, beta);
  return Math.exp(logPdf);
}

