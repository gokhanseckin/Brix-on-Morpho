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

import type {
  MarketView,
  VaultAllocation,
  AssetMeta,
  OracleInfo,
  PreLiquidationContract,
  HistoryPoint,
} from '@/types/morphoMarket';

const ENDPOINT = 'https://blue-api.morpho.org/graphql';

const MARKET_QUERY = `
  query Market($chainId: Int!, $uniqueKey: String!) {
    marketByUniqueKey(chainId: $chainId, uniqueKey: $uniqueKey) {
      uniqueKey
      lltv
      irmAddress
      oracleAddress
      creationBlockNumber
      creationTimestamp
      warnings { type level }
      collateralAsset {
        address symbol name decimals
        price { usd timestamp }
      }
      loanAsset {
        address symbol name decimals
        price { usd timestamp }
      }
      state {
        supplyAssetsUsd
        borrowAssetsUsd
        utilization
        supplyApy
        borrowApy
        liquidityAssetsUsd
        rateAtUTarget
        apyAtTarget
        fee
        price
        collateralAssetsUsd
        timestamp
      }
      badDebt { usd }
      realizedBadDebt { usd }
      oracle {
        address
        type
        data {
          ... on MorphoChainlinkOracleV2Data {
            baseFeedOne { address decimals }
            baseFeedTwo { address decimals }
            quoteFeedOne { address decimals }
            quoteFeedTwo { address decimals }
            scaleFactor
          }
        }
      }
      currentIrmCurve { utilization supplyApy borrowApy }
      preLiquidations {
        items { address preLltv preLCF1 preLCF2 preLIF1 preLIF2 }
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
    collateral: mapAsset(m.collateralAsset),
    loan: mapAsset(m.loanAsset),
    oracle: mapOracle(m.oracle),
    irmCurve: m.currentIrmCurve ?? [],
    activity: {
      feePct: m.state.fee ?? 0,
      creationBlockNumber: m.creationBlockNumber ?? 0,
      creationTimestamp: m.creationTimestamp ? Number(m.creationTimestamp) : 0,
      collateralAssetsUsd: m.state.collateralAssetsUsd ?? 0,
      badDebtUsd: m.badDebt?.usd ?? 0,
      realizedBadDebtUsd: m.realizedBadDebt?.usd ?? 0,
      warnings: m.warnings ?? [],
      oraclePrice: m.state.price ? BigInt(m.state.price) : 0n,
    },
    preLiquidations: (m.preLiquidations?.items ?? []).map(mapPreLiq),
    vaults: mapVaults(m.supplyingVaults ?? [], marketId),
  };

  cache.set(key, view);
  return view;
}

type RawPrice = { usd: number | null; timestamp: number | null } | null;
type RawAsset = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: RawPrice;
};
type RawFeed = { address: string; decimals: number } | null;
type RawOracleData = {
  baseFeedOne?: RawFeed;
  baseFeedTwo?: RawFeed;
  quoteFeedOne?: RawFeed;
  quoteFeedTwo?: RawFeed;
  scaleFactor?: string;
} | null;
type RawOracle = {
  address: string;
  type: string;
  data: RawOracleData;
};
type RawIrmPoint = { utilization: number; supplyApy: number; borrowApy: number };
type RawPreLiq = {
  address: string;
  preLltv: string;
  preLCF1: string;
  preLCF2: string;
  preLIF1: string;
  preLIF2: string;
};
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
  creationBlockNumber: number;
  creationTimestamp: string;
  warnings: Array<{ type: string; level: string }> | null;
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
    apyAtTarget: number | null;
    fee: number | null;
    price: string | null;
    collateralAssetsUsd: number | null;
    timestamp: string | null;
  };
  badDebt: { usd: number | null } | null;
  realizedBadDebt: { usd: number | null } | null;
  oracle: RawOracle | null;
  currentIrmCurve: RawIrmPoint[] | null;
  preLiquidations: { items: RawPreLiq[] | null } | null;
  supplyingVaults: RawVault[] | null;
};

function mapAsset(a: RawAsset): AssetMeta {
  return {
    address: a.address,
    symbol: a.symbol,
    name: a.name,
    decimals: a.decimals,
    priceUsd: a.price?.usd ?? null,
    priceTimestamp: a.price?.timestamp ?? null,
  };
}

function mapOracle(o: RawOracle | null): OracleInfo {
  if (!o) {
    return { address: '', details: { kind: 'Unknown', rawType: 'null' } };
  }
  if (o.type === 'ChainlinkOracleV2' && o.data) {
    return {
      address: o.address,
      details: {
        kind: 'ChainlinkOracleV2',
        baseFeedOne: o.data.baseFeedOne ?? null,
        baseFeedTwo: o.data.baseFeedTwo ?? null,
        quoteFeedOne: o.data.quoteFeedOne ?? null,
        quoteFeedTwo: o.data.quoteFeedTwo ?? null,
        scaleFactor: o.data.scaleFactor ? BigInt(o.data.scaleFactor) : 0n,
      },
    };
  }
  return { address: o.address, details: { kind: 'Unknown', rawType: o.type } };
}

function mapPreLiq(p: RawPreLiq): PreLiquidationContract {
  return {
    address: p.address,
    preLltv: BigInt(p.preLltv),
    preLCF1: BigInt(p.preLCF1),
    preLCF2: BigInt(p.preLCF2),
    preLIF1: BigInt(p.preLIF1),
    preLIF2: BigInt(p.preLIF2),
  };
}

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

const HISTORY_QUERY = `
  query History($chainId: Int!, $uniqueKey: String!, $start: Int!, $end: Int!) {
    marketByUniqueKey(chainId: $chainId, uniqueKey: $uniqueKey) {
      historicalState {
        supplyApy(options: { startTimestamp: $start, endTimestamp: $end, interval: DAY }) { x y }
        borrowApy(options: { startTimestamp: $start, endTimestamp: $end, interval: DAY }) { x y }
        utilization(options: { startTimestamp: $start, endTimestamp: $end, interval: DAY }) { x y }
      }
    }
  }
`;

const historyCache = new Map<string, HistoryPoint[]>();

export function _resetHistoryCache(): void {
  historyCache.clear();
}

export async function fetchMarketHistory(
  chainId: number,
  marketId: string,
  days = 30,
  options?: { signal?: AbortSignal }
): Promise<HistoryPoint[]> {
  const key = `${chainId}:${marketId.toLowerCase()}:${days}`;
  const cached = historyCache.get(key);
  if (cached) return cached;

  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: HISTORY_QUERY,
      variables: { chainId, uniqueKey: marketId, start, end },
    }),
    ...(options?.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) throw new Error(`Morpho API HTTP ${res.status}`);
  const json = await res.json() as {
    data?: { marketByUniqueKey: { historicalState: { supplyApy: Pt[]; borrowApy: Pt[]; utilization: Pt[] } } | null };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  const h = json.data?.marketByUniqueKey?.historicalState;
  if (!h) {
    historyCache.set(key, []);
    return [];
  }

  const byTs = new Map<number, HistoryPoint>();
  for (const pt of h.supplyApy ?? []) byTs.set(pt.x, { timestamp: pt.x, supplyApy: pt.y, borrowApy: 0, utilization: 0 });
  for (const pt of h.borrowApy ?? []) {
    const e = byTs.get(pt.x) ?? { timestamp: pt.x, supplyApy: 0, borrowApy: 0, utilization: 0 };
    e.borrowApy = pt.y;
    byTs.set(pt.x, e);
  }
  for (const pt of h.utilization ?? []) {
    const e = byTs.get(pt.x) ?? { timestamp: pt.x, supplyApy: 0, borrowApy: 0, utilization: 0 };
    e.utilization = pt.y;
    byTs.set(pt.x, e);
  }
  const out = Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
  historyCache.set(key, out);
  return out;
}

type Pt = { x: number; y: number };
