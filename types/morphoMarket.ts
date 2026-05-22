// types/morphoMarket.ts

export type MarketParams = {
  collateralAsset: { address: string; symbol: string; decimals: number };
  loanAsset: { address: string; symbol: string; decimals: number };
  lltv: bigint;            // raw 1e18
  irmAddress: string;
  oracleAddress: string;
};

export type MarketState = {
  supplyAssetsUsd: number;
  borrowAssetsUsd: number;
  utilization: number;     // 0..1
  supplyApy: number;       // 0..1
  borrowApy: number;       // 0..1
  liquidityAssetsUsd: number;
  rateAtUTarget: number;   // 0..1
};

export type VaultAllocation = {
  address: string;
  name: string;
  symbol: string;
  totalAssetsUsd: number;
  allocationUsd: number;
  allocationPctOfVault: number;  // 0..1
  supplyCapUsd: number | null;   // null if uncapped
};

export type MarketView = {
  chainId: number;
  marketId: `0x${string}`;
  params: MarketParams;
  state: MarketState;
  vaults: VaultAllocation[];
};

export type ParsedMarketUrl =
  | { ok: true; chainId: number; marketId: `0x${string}` }
  | { ok: false; error: string };
