// lib/morphoApi.ts
import type { ParsedMarketUrl } from '@/types/morphoMarket';

const CHAIN_SLUGS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  unichain: 130,
};

const MARKET_ID_RE = /^0x[0-9a-fA-F]{64}$/;

export function parseMorphoUrl(input: string): ParsedMarketUrl {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }
  if (!url.hostname.endsWith('morpho.org')) {
    return { ok: false, error: 'Not a Morpho URL' };
  }
  // Path shape: /<chain>/market/<marketId>[/<slug>]
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 3 || parts[1] !== 'market') {
    return { ok: false, error: 'Could not find /<chain>/market/<id> in URL path' };
  }
  const chainSlug = parts[0]!.toLowerCase();
  const chainId = CHAIN_SLUGS[chainSlug];
  if (!chainId) {
    return { ok: false, error: `Unknown chain "${chainSlug}"` };
  }
  const rawId = parts[2]!;
  if (!MARKET_ID_RE.test(rawId)) {
    return { ok: false, error: 'Malformed marketId' };
  }
  return { ok: true, chainId, marketId: rawId.toLowerCase() as `0x${string}` };
}
