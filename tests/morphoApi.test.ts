// tests/morphoApi.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseMorphoUrl, fetchMarket, _resetMarketCache } from '@/lib/morphoApi';

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

const SAMPLE_RESPONSE = {
  data: {
    marketByUniqueKey: {
      uniqueKey: '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9',
      lltv: '860000000000000000',
      irmAddress: '0x870ac11d48b15db9a138cf899d20f13f79ba00bc',
      oracleAddress: '0x1234567890abcdef1234567890abcdef12345678',
      collateralAsset: { address: '0xc0', symbol: 'sAVUSD', decimals: 18 },
      loanAsset: { address: '0xc1', symbol: 'USDC', decimals: 6 },
      state: {
        supplyAssetsUsd: 1_000_000,
        borrowAssetsUsd: 600_000,
        utilization: 0.6,
        supplyApy: 0.045,
        borrowApy: 0.072,
        liquidityAssetsUsd: 400_000,
        rateAtUTarget: 0.04,
      },
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
                market: { uniqueKey: '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9' },
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
                market: { uniqueKey: '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9' },
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

    const id = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';
    const view = await fetchMarket(1, id);

    expect(view.chainId).toBe(1);
    expect(view.marketId).toBe(id);
    expect(view.params.lltv).toBe(860000000000000000n);
    expect(view.params.collateralAsset.symbol).toBe('sAVUSD');
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
    const view = await fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9');
    expect(view.vaults[0]!.allocationUsd).toBeGreaterThanOrEqual(view.vaults[1]!.allocationUsd);
  });

  it('caches by chainId:marketId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    });
    vi.stubGlobal('fetch', fetchMock);

    const id = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';
    await fetchMarket(1, id);
    await fetchMarket(1, id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on null marketByUniqueKey', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketByUniqueKey: null } }),
    }));
    await expect(
      fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9')
    ).rejects.toThrow(/not found/i);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    await expect(
      fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9')
    ).rejects.toThrow(/500/);
  });

  it('throws on GraphQL errors array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'bad query' }] }),
    }));
    await expect(
      fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9')
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
    const view = await fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9');
    expect(view.vaults).toEqual([]);
  });

  it('filters allocation array by marketId', async () => {
    // VaultA has two allocation entries; only the one matching the queried marketId should be used.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    }));
    const id = '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9';
    const view = await fetchMarket(1, id);
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
    const view = await fetchMarket(1, '0xe07d416323a1afbfe0bf2fe27ffb549ff565cf5c86d21b79fc60664038e597c9');
    expect(view.vaults).toHaveLength(1);
    expect(view.vaults[0]!.allocationUsd).toBe(0);
    expect(view.vaults[0]!.supplyCapUsd).toBeNull();
  });
});
