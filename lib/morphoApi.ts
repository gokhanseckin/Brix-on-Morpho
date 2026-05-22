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

import type { MarketView, VaultAllocation } from '@/types/morphoMarket';

const ENDPOINT = 'https://blue-api.morpho.org/graphql';

const MARKET_QUERY = `
  query Market($chainId: Int!, $uniqueKey: String!) {
    marketByUniqueKey(chainId: $chainId, uniqueKey: $uniqueKey) {
      uniqueKey
      lltv
      irmAddress
      oracleAddress
      collateralAsset { address symbol decimals }
      loanAsset { address symbol decimals }
      state {
        supplyAssetsUsd
        borrowAssetsUsd
        utilization
        supplyApy
        borrowApy
        liquidityAssetsUsd
        rateAtUTarget
      }
      supplyingVaults {
        address name symbol
        state {
          totalAssetsUsd
          allocation {
            supplyAssetsUsd
            supplyCapUsd
            market { uniqueKey }
          }
        }
      }
    }
  }
`;

const cache = new Map<string, MarketView>();

export function _resetMarketCache(): void {
  cache.clear();
}

export async function fetchMarket(
  chainId: number,
  marketId: string,
  options?: { signal?: AbortSignal }
): Promise<MarketView> {
  const key = `${chainId}:${marketId.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: MARKET_QUERY,
      variables: { chainId, uniqueKey: marketId },
    }),
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) {
    throw new Error(`Morpho API HTTP ${res.status}`);
  }

  const json = await res.json() as {
    data?: { marketByUniqueKey: RawMarket | null };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }
  const m = json.data?.marketByUniqueKey;
  if (!m) {
    throw new Error('Market not found on Morpho Blue API');
  }

  const view: MarketView = {
    chainId,
    marketId: marketId.toLowerCase() as `0x${string}`,
    params: {
      collateralAsset: m.collateralAsset,
      loanAsset: m.loanAsset,
      lltv: BigInt(m.lltv),
      irmAddress: m.irmAddress,
      oracleAddress: m.oracleAddress,
    },
    state: {
      supplyAssetsUsd: m.state.supplyAssetsUsd ?? 0,
      borrowAssetsUsd: m.state.borrowAssetsUsd ?? 0,
      utilization: m.state.utilization ?? 0,
      supplyApy: m.state.supplyApy ?? 0,
      borrowApy: m.state.borrowApy ?? 0,
      liquidityAssetsUsd: m.state.liquidityAssetsUsd ?? 0,
      rateAtUTarget: m.state.rateAtUTarget ?? 0,
    },
    vaults: mapVaults(m.supplyingVaults ?? [], marketId),
  };

  cache.set(key, view);
  return view;
}

type RawAsset = { address: string; symbol: string; decimals: number };
type RawVault = {
  address: string;
  name: string;
  symbol: string;
  state: {
    totalAssetsUsd: number | null;
    allocation: Array<{
      supplyAssetsUsd: number | null;
      supplyCapUsd: number | null;
      market: { uniqueKey: string };
    }> | null;
  };
};
type RawMarket = {
  uniqueKey: string;
  lltv: string;
  irmAddress: string;
  oracleAddress: string;
  collateralAsset: RawAsset;
  loanAsset: RawAsset;
  state: {
    supplyAssetsUsd: number | null;
    borrowAssetsUsd: number | null;
    utilization: number | null;
    supplyApy: number | null;
    borrowApy: number | null;
    liquidityAssetsUsd: number | null;
    rateAtUTarget: number | null;
  };
  supplyingVaults: RawVault[] | null;
};

function mapVaults(raw: RawVault[], marketId: string): VaultAllocation[] {
  return raw
    .map(v => {
      const totalAssetsUsd = v.state.totalAssetsUsd ?? 0;
      const entry = (v.state.allocation ?? []).find(
        a => a.market.uniqueKey.toLowerCase() === marketId.toLowerCase()
      );
      const allocationUsd = entry?.supplyAssetsUsd ?? 0;
      return {
        address: v.address,
        name: v.name,
        symbol: v.symbol,
        totalAssetsUsd,
        allocationUsd,
        allocationPctOfVault: totalAssetsUsd > 0 ? allocationUsd / totalAssetsUsd : 0,
        supplyCapUsd: entry?.supplyCapUsd ?? null,
      };
    })
    .sort((a, b) => b.allocationUsd - a.allocationUsd);
}
