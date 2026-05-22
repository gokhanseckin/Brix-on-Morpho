'use client';
import { useEffect, useState } from 'react';
import { fetchMarketPositions, type BorrowerPosition } from '@/lib/morphoApi';

type State =
  | { loading: false; data: null; error: null }
  | { loading: true; data: null; error: null }
  | { loading: false; data: BorrowerPosition[]; error: null }
  | { loading: false; data: null; error: string };

const IDLE: State = { loading: false, data: null, error: null };

export function useMarketPositions(
  chainId: number | null,
  marketId: string | null
): State {
  const [state, setState] = useState<State>(IDLE);

  useEffect(() => {
    if (chainId == null || !marketId) {
      setState(IDLE);
      return;
    }
    const ac = new AbortController();
    setState({ loading: true, data: null, error: null });

    fetchMarketPositions(chainId, marketId, { signal: ac.signal })
      .then(data => {
        if (ac.signal.aborted) return;
        setState({ loading: false, data, error: null });
      })
      .catch(err => {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ loading: false, data: null, error: msg });
      });

    return () => ac.abort();
  }, [chainId, marketId]);

  return state;
}
