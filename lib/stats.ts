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
