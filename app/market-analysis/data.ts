// app/market-analysis/data.ts
// Curated benchmark shortlist for the Brix wiTRY/USDM market.
// Source of truth + rationale: docs/benchmark-markets.md
// Raw candidate pool: docs/morpho-benchmark-markets.json

export type Tier = 'A' | 'B' | 'C';

export interface Candidate {
  tier: Tier;
  uniqueKey: string;
  chainId: number;
  chainName: string;
  collateral: string;
  loan: string;
  lltv: number;
  tvlK: number | null;
  borrowK: number | null;
  ageDays: number | null;
  bucket: string;
  rationale: string;
}

export const SHORTLIST: Candidate[] = [
  {
    tier: 'A',
    uniqueKey: '0x5301093aee39723022f4d3c5b69ccca16f18642d35f5c07dab3e061d79b9328e',
    chainId: 8453,
    chainName: 'Base',
    collateral: 'sjEUR',
    loan: 'USDC',
    lltv: 0.86,
    tvlK: 48,
    borrowK: null,
    ageDays: null,
    bucket: 'FX-pegged (EUR)',
    rationale:
      'Only FX-vs-USD analog in Morpho Blue. Below $250k TVL floor — included as structural reference, not statistical sample.',
  },
  {
    tier: 'B',
    uniqueKey: '0x39d11026eae1c6ec02aa4c0910778664089cdd97c3fd23f68f7cd05e2e95af48',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'sUSDe',
    loan: 'DAI',
    lltv: 0.86,
    tvlK: 1353,
    borrowK: 1300,
    ageDays: 799,
    bucket: 'yield-bearing-stable',
    rationale:
      'Closest "wi-" analog at 0.86: yield-bearing collateral vs USD-stable loan. Only such market at this LLTV.',
  },
  {
    tier: 'B',
    uniqueKey: '0xe7e9694b754c4d4f7e21faf7223f6fa71abaeb10296a4c43a54a7977149687d2',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'wstETH',
    loan: 'USDT',
    lltv: 0.86,
    tvlK: 217724,
    borrowK: 177007,
    ageDays: 841,
    bucket: 'LST',
    rationale:
      'Largest, oldest LST/USD-stable market at target LLTV. Canonical yield-bearing volatile collateral benchmark.',
  },
  {
    tier: 'B',
    uniqueKey: '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'wstETH',
    loan: 'USDC',
    lltv: 0.86,
    tvlK: 47646,
    borrowK: 43049,
    ageDays: 870,
    bucket: 'LST',
    rationale:
      'Same collateral as wstETH/USDT — controls for loan-asset (USDT vs USDC) effect on borrower behavior.',
  },
  {
    tier: 'B',
    uniqueKey: '0x85d59152a0214bf6abce9f7a25a3a0a4f7d3a9b78b3a5e4ce25e2a3d4cc9a5b2',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'weETH',
    loan: 'PYUSD',
    lltv: 0.86,
    tvlK: 75000,
    borrowK: 67128,
    ageDays: 79,
    bucket: 'LRT',
    rationale:
      'Restaked-LRT collateral adds depeg-vs-LST tail. PYUSD loan diversifies the stable side. Confirm full uniqueKey before on-chain pull.',
  },
  {
    tier: 'B',
    uniqueKey: '0x6a7e36eb1379b1f54fb22d5d63a7b3a26e7e9c1c7d99e8a36b6f53e5d3a72c9d',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'LBTC',
    loan: 'PYUSD',
    lltv: 0.86,
    tvlK: 36000,
    borrowK: 32400,
    ageDays: 79,
    bucket: 'yield-bearing-BTC',
    rationale:
      'Yield-bearing BTC at 0.86 — collateral accrues vs USD, mirroring wiTRY accrual but with BTC volatility. Confirm full uniqueKey.',
  },
  {
    tier: 'C',
    uniqueKey: '0x9103c3b4e834476c9a62ea009ba2c884ee42e94e6e314a26f04d312434191836',
    chainId: 8453,
    chainName: 'Base',
    collateral: 'cbBTC',
    loan: 'USDC',
    lltv: 0.86,
    tvlK: 1377330,
    borrowK: 1234663,
    ageDays: 625,
    bucket: 'plain-BTC',
    rationale:
      'Largest market on Morpho Blue. Anchor of borrower behavior at LLTV 0.86 with non-yield-bearing volatile collateral.',
  },
  {
    tier: 'C',
    uniqueKey: '0x3a85e6190ad8aedf5d9d2da7c4d4bf3a6b7eafa9b7d4ae1fa9adb6d8a9a4c3f1',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'WBTC',
    loan: 'USDC',
    lltv: 0.86,
    tvlK: 159036,
    borrowK: 143400,
    ageDays: 856,
    bucket: 'plain-BTC',
    rationale:
      'Oldest meaningful BTC/USDC history on Morpho. Pairs with cbBTC/USDC to pin mature plain-BTC cohort. Confirm full uniqueKey.',
  },
  {
    tier: 'C',
    uniqueKey: '0x0f9563442d64ab3bd3bcb27058db0b0d4046a4c46f0acd811dacae9551d2b129',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'sdeUSD',
    loan: 'USDC',
    lltv: 0.915,
    tvlK: 453119,
    borrowK: 453119,
    ageDays: 471,
    bucket: 'yield-bearing-stable',
    rationale:
      'High-LLTV (0.915) yield-bearing-stable control — shows borrower-LTV concentration when collateral ≈ 1.0 and headroom is tight.',
  },
  {
    tier: 'C',
    uniqueKey: '0x8eaf7b29f02ba8d8c1d7aeb587403dcb16e2e943e4e2f5f94b0963c2386406c9',
    chainId: 1,
    chainName: 'Ethereum',
    collateral: 'PAXG',
    loan: 'USDC',
    lltv: 0.915,
    tvlK: 810453,
    borrowK: 810453,
    ageDays: 630,
    bucket: 'RWA (gold)',
    rationale:
      'RWA / slow-mean-reverting collateral at high-LLTV tier. Closest precedent for an FX-like (slow, non-stable) price process. Indexer reports near-zero collateralAssetsUsd — reconstruct borrower-LTV from on-chain positions.',
  },
];
