// app/explore-market/components/BorrowerLtvBetaCard.tsx
'use client';
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { betaPdf, fitBetaMoM } from '@/lib/stats';
import { useMarketPositions } from '@/lib/useMarketPositions';
import type { BorrowerPosition } from '@/lib/morphoApi';

const SAMPLES = 100;

function fractions(positions: BorrowerPosition[], lltvDec: number): number[] {
  const out: number[] = [];
  const eps = 1e-4;
  for (const p of positions) {
    const ltv = p.borrowAssetsUsd / p.collateralUsd;
    if (!Number.isFinite(ltv) || ltv <= 0) continue;
    const f = ltv / lltvDec;
    if (f <= 0) continue;
    out.push(Math.min(1 - eps, Math.max(eps, f)));
  }
  return out;
}

export function BorrowerLtvBetaCard({
  chainId,
  marketId,
  lltv,
}: {
  chainId: number;
  marketId: string;
  lltv: bigint;
}) {
  const { loading, data, error } = useMarketPositions(chainId, marketId);
  const lltvDec = Number(lltv) / 1e18;

  const fit = useMemo(() => {
    if (!data) return null;
    const fs = fractions(data, lltvDec);
    return { fs, beta: fitBetaMoM(fs) };
  }, [data, lltvDec]);

  const curve = useMemo(() => {
    if (!fit?.beta) return [];
    const pts: Array<{ x: number; pdf: number }> = [];
    for (let i = 1; i < SAMPLES; i++) {
      const x = i / SAMPLES;
      pts.push({ x, pdf: betaPdf(x, fit.beta.alpha, fit.beta.beta) });
    }
    return pts;
  }, [fit]);

  return (
    <section className="rounded-lg border border-brix-border bg-brix-card p-6 space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-neutral-200">Borrower LTV — Beta fit</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Same Beta(α, β) shape used on the home-page simulator, fitted (method of moments)
          to the live per-borrower LTVs as a fraction of LLTV. Compare this to similar markets
          to calibrate your own α / β.
        </p>
      </header>

      {loading && <p className="text-sm text-neutral-400">Loading positions…</p>}
      {error && (
        <p className="text-sm text-red-400">Could not load positions: {error}</p>
      )}
      {data && fit && (
        <>
          <dl className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 text-sm">
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">α (alpha)</dt>
              <dd className="text-neutral-200 tabular-nums">
                {fit.beta ? fit.beta.alpha.toFixed(2) : '—'}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">β (beta)</dt>
              <dd className="text-neutral-200 tabular-nums">
                {fit.beta ? fit.beta.beta.toFixed(2) : '—'}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Mean LTV / LLTV</dt>
              <dd className="text-neutral-200 tabular-nums">
                {fit.beta ? `${(fit.beta.mean * 100).toFixed(1)}%` : '—'}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Mean absolute LTV</dt>
              <dd className="text-neutral-200 tabular-nums">
                {fit.beta ? `${(fit.beta.mean * lltvDec * 100).toFixed(1)}%` : '—'}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Positions used</dt>
              <dd className="text-neutral-200 tabular-nums">
                {fit.beta ? fit.beta.n : fit.fs.length} / {data.length}
              </dd>
            </div>
          </dl>

          {fit.beta ? (
            <div>
              <div className="border border-brix-border rounded p-2 bg-brix-bg">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={curve} margin={{ top: 8, right: 20, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={[0, 1]}
                      tickFormatter={(x: number) => `${Math.round(x * 100)}%`}
                      label={{ value: 'LTV fraction of LLTV', position: 'insideBottom', offset: -2 }}
                    />
                    <YAxis
                      tickFormatter={(x: number) => x.toFixed(1)}
                      label={{ value: 'density', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(v) => Number(v).toFixed(3)}
                      labelFormatter={(x) => `LTV fraction = ${(Number(x) * 100).toFixed(0)}%`}
                    />
                    <ReferenceLine
                      x={fit.beta.mean}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{
                        value: `mean ${(fit.beta.mean * 100).toFixed(1)}%`,
                        fill: '#ef4444',
                        fontSize: 11,
                        position: 'top',
                      }}
                    />
                    <Line type="monotone" dataKey="pdf" stroke="#3b82f6" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Fitted via method of moments: k = m(1−m)/v − 1, α = m·k, β = (1−m)·k, where
                m and v are the sample mean and variance of per-borrower LTV / LLTV.
              </p>
            </div>
          ) : (
            <p className="text-sm text-yellow-400">
              Not enough variance in the sample to identify α and β (need ≥ 2 distinct LTVs
              with variance &lt; m(1−m)).
            </p>
          )}
        </>
      )}
    </section>
  );
}
