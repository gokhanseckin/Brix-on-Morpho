import { describe, it, expect } from 'vitest';
import { buildAsymmetricLadder, DEFAULT_BAND_SPLIT } from '@/lib/poolPreset';
import { quoteLiquidatorSell } from '@/lib/univ3';

describe('quoteLiquidatorSell — asymmetric ladder', () => {
  it('returns positive output and bounded slippage for $25k wTRY sell at base spot', () => {
    const spot = 0.029;
    const preset = buildAsymmetricLadder(spot, 500_000, DEFAULT_BAND_SPLIT, 3000);
    // $25k of wTRY at spot 0.029 USDM. In sim units (1e6 wei = $1):
    const wTRYwei = BigInt(Math.floor((25_000 / spot) * 1e6));
    const q = quoteLiquidatorSell(preset, spot, wTRYwei);
    expect(q.amountOut).toBeGreaterThan(0n);
    expect(q.slippagePct).toBeLessThan(0.02); // spec acceptance §7.2 (revised: $25k sell into $500k AMM)
  });

  it('slippage grows with sell size', () => {
    const spot = 0.029;
    const preset = buildAsymmetricLadder(spot, 500_000, DEFAULT_BAND_SPLIT, 3000);
    const small = quoteLiquidatorSell(preset, spot, BigInt(Math.floor((5_000 / spot) * 1e6)));
    const large = quoteLiquidatorSell(preset, spot, BigInt(Math.floor((50_000 / spot) * 1e6)));
    expect(large.slippagePct).toBeGreaterThan(small.slippagePct);
  });
});
