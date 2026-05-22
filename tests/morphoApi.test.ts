// tests/morphoApi.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseMorphoUrl, fetchMarket, _resetMarketCache, fetchMarketHistory, _resetHistoryCache } from '@/lib/morphoApi';

describe('parseMorphoUrl', () => {
  const id = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';

  it('parses canonical URL with slug', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/${id}/savusd-usdc`);
    expect(r).toEqual({ ok: true, chainId: 1, marketId: id });
  });

  it('parses URL with hash anchor', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/${id}/savusd-usdc#risk`);
    expect(r).toEqual({ ok: true, chainId: 1, marketId: id });
  });

  it('parses URL without trailing slug', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/${id}`);
    expect(r).toEqual({ ok: true, chainId: 1, marketId: id });
  });

  it('parses base chain', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/base/market/${id}`);
    expect(r).toEqual({ ok: true, chainId: 8453, marketId: id });
  });

  it('trims surrounding whitespace', () => {
    const r = parseMorphoUrl(`   https://app.morpho.org/ethereum/market/${id}   `);
    expect(r.ok).toBe(true);
  });

  it('rejects unknown chain slug', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/solana/market/${id}`);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/chain/i) });
  });

  it('rejects malformed marketId (too short)', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/0xdeadbeef`);
    expect(r.ok).toBe(false);
  });

  it('rejects malformed marketId (non-hex)', () => {
    const r = parseMorphoUrl(`https://app.morpho.org/ethereum/market/0xZZZZ${'0'.repeat(60)}`);
    expect(r.ok).toBe(false);
  });

  it('rejects unrelated URL', () => {
    const r = parseMorphoUrl('https://example.com/foo');
    expect(r.ok).toBe(false);
  });

  it('rejects plain text', () => {
    const r = parseMorphoUrl('not a url');
    expect(r.ok).toBe(false);
  });
});

const ID = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';

const SAMPLE_RESPONSE = {
  data: {
    marketByUniqueKey: {
      uniqueKey: ID,
      lltv: '860000000000000000',
      irmAddress: '0x870ac11d48b15db9a138cf899d20f13f79ba00bc',
      oracleAddress: '0x1234567890abcdef1234567890abcdef12345678',
      creationBlockNumber: 24249174,
      creationTimestamp: '1768589183',
      warnings: [],
      collateralAsset: {
        address: '0xc0',
        symbol: 'sAVUSD',
        name: 'Staked avUSD',
        decimals: 18,
        price: { usd: 1.17, timestamp: 1779426806 },
      },
      loanAsset: {
        address: '0xc1',
        symbol: 'USDC',
        name: 'USDCoin',
        decimals: 6,
        price: { usd: 1.00, timestamp: 1779439141 },
      },
      state: {
        supplyAssetsUsd: 1_000_000,
        borrowAssetsUsd: 600_000,
        utilization: 0.6,
        supplyApy: 0.045,
        borrowApy: 0.072,
        liquidityAssetsUsd: 400_000,
        rateAtUTarget: 0.04,
        apyAtTarget: 0.0855,
        fee: 0,
        price: '1170553706056013390000000',
        collateralAssetsUsd: 11_708_677,
        timestamp: '1779438983',
      },
      badDebt: { usd: 0 },
      realizedBadDebt: { usd: 0 },
      oracle: {
        address: '0x839940de5043e7c6eDaf063714AFe7F20De5ff12',
        type: 'ChainlinkOracleV2',
        data: {
          baseFeedOne: { address: '0x9fBb7D07ae32B3F75c2a5805C2153243A2532589', decimals: 18 },
          baseFeedTwo: null,
          quoteFeedOne: null,
          quoteFeedTwo: null,
          scaleFactor: '1000000',
        },
      },
      currentIrmCurve: [
        { utilization: 0, supplyApy: 0, borrowApy: 0.02 },
        { utilization: 0.5, supplyApy: 0.025, borrowApy: 0.05 },
        { utilization: 1, supplyApy: 0.1, borrowApy: 0.2 },
      ],
      preLiquidations: { items: [] },
      supplyingVaults: [
        {
          address: '0xVaultA',
          name: 'Steakhouse USDC',
          symbol: 'steakUSDC',
          state: {
            totalAssetsUsd: 50_000_000,
            allocation: [
              {
                supplyAssetsUsd: 800_000,
                supplyCapUsd: 2_000_000,
                market: { uniqueKey: ID },
              },
              {
                supplyAssetsUsd: 999_999,
                supplyCapUsd: 1_000_000_000,
                market: { uniqueKey: '0xdead0000000000000000000000000000000000000000000000000000000000ad' },
              },
            ],
          },
        },
        {
          address: '0xVaultB',
          name: 'Gauntlet USDC',
          symbol: 'gtUSDC',
          state: {
            totalAssetsUsd: 30_000_000,
            allocation: [
              {
                supplyAssetsUsd: 200_000,
                supplyCapUsd: null,
                market: { uniqueKey: ID },
              },
            ],
          },
        },
      ],
    },
  },
};

describe('fetchMarket', () => {
  beforeEach(() => {
    _resetMarketCache();
    vi.restoreAllMocks();
  });

  it('maps GraphQL response to MarketView', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = await fetchMarket(1, ID);

    expect(view.chainId).toBe(1);
    expect(view.marketId).toBe(ID);
    expect(view.params.lltv).toBe(860000000000000000n);
    expect(view.collateral.symbol).toBe('sAVUSD');
    expect(view.state.utilization).toBeCloseTo(0.6, 10);
    expect(view.vaults).toHaveLength(2);
    expect(view.vaults[0]!.name).toBe('Steakhouse USDC');
    expect(view.vaults[0]!.allocationPctOfVault).toBeCloseTo(800_000 / 50_000_000, 10);
    expect(view.vaults[1]!.supplyCapUsd).toBeNull();
  });

  it('sorts vaults by allocation desc', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.vaults[0]!.allocationUsd).toBeGreaterThanOrEqual(view.vaults[1]!.allocationUsd);
  });

  it('caches by chainId:marketId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchMarket(1, ID);
    await fetchMarket(1, ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on null marketByUniqueKey', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketByUniqueKey: null } }),
    }));
    await expect(
      fetchMarket(1, ID)
    ).rejects.toThrow(/not found/i);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    await expect(
      fetchMarket(1, ID)
    ).rejects.toThrow(/500/);
  });

  it('throws on GraphQL errors array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'bad query' }] }),
    }));
    await expect(
      fetchMarket(1, ID)
    ).rejects.toThrow(/bad query/);
  });

  it('handles null supplyingVaults (empty array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          marketByUniqueKey: { ...SAMPLE_RESPONSE.data.marketByUniqueKey, supplyingVaults: null },
        },
      }),
    }));
    const view = await fetchMarket(1, ID);
    expect(view.vaults).toEqual([]);
  });

  it('filters allocation array by marketId', async () => {
    // VaultA has two allocation entries; only the one matching the queried marketId should be used.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const view = await fetchMarket(1, ID);
    const vaultA = view.vaults.find(v => v.address === '0xVaultA');
    // Should use the 800_000 entry, NOT the 999_999 unrelated-market entry
    expect(vaultA?.allocationUsd).toBe(800_000);
    expect(vaultA?.supplyCapUsd).toBe(2_000_000);
  });

  it('treats null state.allocation as zero allocation', async () => {
    const responseWithNullAlloc = {
      data: {
        marketByUniqueKey: {
          ...SAMPLE_RESPONSE.data.marketByUniqueKey,
          supplyingVaults: [
            {
              address: '0xVaultC',
              name: 'Null Alloc Vault',
              symbol: 'nullVault',
              state: { totalAssetsUsd: 10_000_000, allocation: null },
            },
          ],
        },
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseWithNullAlloc,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.vaults).toHaveLength(1);
    expect(view.vaults[0]!.allocationUsd).toBe(0);
    expect(view.vaults[0]!.supplyCapUsd).toBeNull();
  });

  it('maps Chainlink V2 oracle data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.oracle.address).toBe('0x839940de5043e7c6eDaf063714AFe7F20De5ff12');
    expect(view.oracle.details.kind).toBe('ChainlinkOracleV2');
    if (view.oracle.details.kind === 'ChainlinkOracleV2') {
      expect(view.oracle.details.baseFeedOne?.address).toBe('0x9fBb7D07ae32B3F75c2a5805C2153243A2532589');
      expect(view.oracle.details.scaleFactor).toBe(1000000n);
    }
  });

  it('falls back to Unknown for non-V2 oracle types', async () => {
    const resp = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
    resp.data.marketByUniqueKey.oracle = {
      address: '0xLegacy',
      type: 'ChainlinkOracle',
      data: null,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => resp,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.oracle.details.kind).toBe('Unknown');
    if (view.oracle.details.kind === 'Unknown') {
      expect(view.oracle.details.rawType).toBe('ChainlinkOracle');
    }
  });

  it('maps activity, creation, and bigints', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.activity.creationBlockNumber).toBe(24249174);
    expect(view.activity.creationTimestamp).toBe(1768589183);
    expect(view.activity.feePct).toBe(0);
    expect(view.activity.collateralAssetsUsd).toBe(11_708_677);
    expect(view.activity.oraclePrice).toBe(1170553706056013390000000n);
    expect(view.irmCurve).toHaveLength(3);
    expect(view.irmCurve[1]!.utilization).toBe(0.5);
  });

  it('maps preLiquidations to bigints', async () => {
    const resp = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
    resp.data.marketByUniqueKey.preLiquidations = {
      items: [
        {
          address: '0xPreLiq',
          preLltv: '900000000000000000',
          preLCF1: '100000000000000000',
          preLCF2: '500000000000000000',
          preLIF1: '1010000000000000000',
          preLIF2: '1080000000000000000',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => resp,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.preLiquidations).toHaveLength(1);
    expect(view.preLiquidations[0]!.preLltv).toBe(900000000000000000n);
    expect(view.preLiquidations[0]!.preLIF2).toBe(1080000000000000000n);
  });

  it('handles null oracle / irmCurve / warnings / pre-liq', async () => {
    const resp = JSON.parse(JSON.stringify(SAMPLE_RESPONSE));
    resp.data.marketByUniqueKey.oracle = null;
    resp.data.marketByUniqueKey.currentIrmCurve = null;
    resp.data.marketByUniqueKey.warnings = null;
    resp.data.marketByUniqueKey.preLiquidations = null;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => resp,
    }));
    const view = await fetchMarket(1, ID);
    expect(view.oracle.details.kind).toBe('Unknown');
    expect(view.irmCurve).toEqual([]);
    expect(view.activity.warnings).toEqual([]);
    expect(view.preLiquidations).toEqual([]);
  });
});

describe('fetchMarketHistory', () => {
  beforeEach(() => {
    _resetHistoryCache();
    vi.restoreAllMocks();
  });

  const HISTORY_RESP = {
    data: {
      marketByUniqueKey: {
        historicalState: {
          supplyApy: [
            { x: 1700000000, y: 0.04 },
            { x: 1700086400, y: 0.045 },
          ],
          borrowApy: [
            { x: 1700000000, y: 0.06 },
            { x: 1700086400, y: 0.065 },
          ],
          utilization: [
            { x: 1700000000, y: 0.7 },
            { x: 1700086400, y: 0.72 },
          ],
        },
      },
    },
  };

  it('joins three series by timestamp, sorted ascending', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => HISTORY_RESP,
    }));
    const out = await fetchMarketHistory(1, '0xabc', 30);
    expect(out).toEqual([
      { timestamp: 1700000000, supplyApy: 0.04, borrowApy: 0.06, utilization: 0.7 },
      { timestamp: 1700086400, supplyApy: 0.045, borrowApy: 0.065, utilization: 0.72 },
    ]);
  });

  it('returns empty array when historicalState is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketByUniqueKey: null } }),
    }));
    const out = await fetchMarketHistory(1, '0xabc', 30);
    expect(out).toEqual([]);
  });

  it('caches by (chainId, marketId, days)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => HISTORY_RESP,
    });
    vi.stubGlobal('fetch', fetchMock);
    await fetchMarketHistory(1, '0xabc', 30);
    await fetchMarketHistory(1, '0xabc', 30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
