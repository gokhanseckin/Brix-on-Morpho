// types/morphoMarket.ts

export type MarketParams = {
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
  apyAtTarget: number;     // 0..1
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

export type AssetMeta = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
  priceTimestamp: number | null;
};

export type OracleFeed = { address: string; decimals: number };

export type ChainlinkOracleV2Details = {
  kind: 'ChainlinkOracleV2';
  baseFeedOne: OracleFeed | null;
  baseFeedTwo: OracleFeed | null;
  quoteFeedOne: OracleFeed | null;
  quoteFeedTwo: OracleFeed | null;
  scaleFactor: bigint;
};

export type UnknownOracleDetails = {
  kind: 'Unknown';
  rawType: string;
};

export type OracleInfo = {
  address: string;
  details: ChainlinkOracleV2Details | UnknownOracleDetails;
};

export type IrmCurvePoint = {
  utilization: number;
  supplyApy: number;
  borrowApy: number;
};

export type PreLiquidationContract = {
  address: string;
  preLltv: bigint;
  preLCF1: bigint;
  preLCF2: bigint;
  preLIF1: bigint;
  preLIF2: bigint;
};

export type MarketWarning = { type: string; level: string };

export type MarketActivity = {
  feePct: number;
  creationBlockNumber: number;
  creationTimestamp: number;
  collateralAssetsUsd: number;
  badDebtUsd: number;
  realizedBadDebtUsd: number;
  warnings: MarketWarning[];
  oraclePrice: bigint;     // state.price raw
};

export type HistoryPoint = {
  timestamp: number;
  supplyApy: number;
  borrowApy: number;
  utilization: number;
};

export type MarketView = {
  chainId: number;
  marketId: `0x${string}`;
  params: MarketParams;
  state: MarketState;
  vaults: VaultAllocation[];
  collateral: AssetMeta;
  loan: AssetMeta;
  oracle: OracleInfo;
  irmCurve: IrmCurvePoint[];
  activity: MarketActivity;
  preLiquidations: PreLiquidationContract[];
};

export type ParsedMarketUrl =
  | { ok: true; chainId: number; marketId: `0x${string}` }
  | { ok: false; error: string };
