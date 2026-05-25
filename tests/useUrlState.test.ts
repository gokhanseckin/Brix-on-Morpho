import { describe, expect, it } from 'vitest';
import { DEFAULT_PRE_LIQUIDATION_ENABLED } from '@/lib/useUrlState';

describe('URL-state launch defaults', () => {
  it('does not assume borrowers authorize pre-liquidation by default', () => {
    expect(DEFAULT_PRE_LIQUIDATION_ENABLED).toBe(false);
  });
});
