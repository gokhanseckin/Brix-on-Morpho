import { describe, expect, it } from 'vitest';
import { DEFAULT_KINK_CLEARANCE, DEFAULT_PRE_LIQUIDATION_ENABLED } from '@/lib/useUrlState';

describe('URL-state launch defaults', () => {
  it('does not assume borrowers authorize pre-liquidation by default', () => {
    expect(DEFAULT_PRE_LIQUIDATION_ENABLED).toBe(false);
  });

  it('does not enforce an extra utilization gap below the fixed IRM kink by default', () => {
    expect(DEFAULT_KINK_CLEARANCE).toBe(0);
  });
});
