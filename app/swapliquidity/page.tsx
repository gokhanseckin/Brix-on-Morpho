import { SwapliquiditySidebar } from './SwapliquiditySidebar';
import { PoolStatePanel } from '@/app/components/swapliquidity/PoolStatePanel';
import { LiquidatorSwapPanel } from '@/app/components/swapliquidity/LiquidatorSwapPanel';
import { RecoveryDistributionPanel } from '@/app/components/swapliquidity/RecoveryDistributionPanel';
import { PresetExportPanel } from '@/app/components/swapliquidity/PresetExportPanel';

export const metadata = { title: 'Brix — Swap Liquidity Lab' };

export default function SwapLiquidityPage() {
  return (
    <main className="flex">
      <SwapliquiditySidebar />
      <div className="flex-1 p-6 space-y-8">
        <header>
          <h1 className="text-2xl font-bold">wTRY/USDM Swap Liquidity Lab</h1>
          <p id="page-subtitle" className="text-sm text-neutral-500 mt-1">
            Uniswap v3 pool design for liquidators. Models a kumbaya.xyz pool with an asymmetric
            LP ladder biased to absorb seized wTRY.
          </p>
        </header>
        <PoolStatePanel />
        <LiquidatorSwapPanel />
        <RecoveryDistributionPanel />
        <PresetExportPanel />
      </div>
    </main>
  );
}
