import type { SwapQuote } from './swap';
import type { PoolPreset } from '../poolPreset';

export function quoteLiquidatorSell(
  _preset: PoolPreset,
  _spot: number,
  _wTRYAmount: bigint,
): SwapQuote {
  throw new Error('quoteLiquidatorSell not implemented yet (Task 6)');
}
