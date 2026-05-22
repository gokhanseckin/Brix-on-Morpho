// tests/morphoApi.test.ts
import { describe, it, expect } from 'vitest';
import { parseMorphoUrl } from '@/lib/morphoApi';

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
