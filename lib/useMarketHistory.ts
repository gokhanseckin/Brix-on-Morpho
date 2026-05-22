// lib/useMarketHistory.ts
'use client';
import { useEffect, useState } from 'react';
import { fetchMarketHistory } from '@/lib/morphoApi';
import type { HistoryPoint } from '@/types/morphoMarket';

type State =
  | { loading: false; data: null; error: null }
  | { loading: true; data: null; error: null }
  | { loading: false; data: HistoryPoint[]; error: null }
  | { loading: false; data: null; error: string };

const IDLE: State = { loading: false, data: null, error: null };

export function useMarketHistory(
  chainId: number | null,
  marketId: string | null,
  days = 30
): State {
  const [state, setState] = useState<State>(IDLE);

  useEffect(() => {
    if (chainId == null || !marketId) {
      setState(IDLE);
      return;
    }
    const ac = new AbortController();
    setState({ loading: true, data: null, error: null });

    fetchMarketHistory(chainId, marketId, days, { signal: ac.signal })
      .then((data) => {
        if (ac.signal.aborted) return;
        setState({ loading: false, data, error: null });
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ loading: false, data: null, error: msg });
      });

    return () => ac.abort();
  }, [chainId, marketId, days]);

  return state;
}
