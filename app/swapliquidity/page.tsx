import Link from 'next/link';
import { SwapliquiditySidebar } from './SwapliquiditySidebar';
import { TopNav } from '@/app/components/TopNav';
import { PoolStatePanel } from '@/app/components/swapliquidity/PoolStatePanel';
import { LiquidatorSwapPanel } from '@/app/components/swapliquidity/LiquidatorSwapPanel';
import { SlippageCurvePanel } from '@/app/components/swapliquidity/SlippageCurvePanel';
import { RecoveryDistributionPanel } from '@/app/components/swapliquidity/RecoveryDistributionPanel';

export const metadata = { title: 'Brix — Swap Liquidity Lab' };

export default function SwapLiquidityPage() {
  return (
    <main className="flex bg-brix-bg min-h-screen text-neutral-200">
      <SwapliquiditySidebar />
      <div className="flex-1 p-8 space-y-10">
        <TopNav />
        <header className="border-b border-brix-border pb-6">
          <div className="flex items-center justify-between">
            <div className="brix-kicker mb-3">Brix · Swap liquidity lab</div>
            <Link
              href="/#section-liquidation-design"
              className="text-xs text-brix-accent hover:text-brix-accentHover"
            >
              See liquidation impact →
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            wTRY <span className="text-brix-accent">/</span> USDM pool design
          </h1>
          <p id="page-subtitle" className="text-sm text-neutral-400 mt-3 max-w-2xl leading-relaxed">
            Uniswap v3 pool design for liquidators. Models a kumbaya.xyz pool with an asymmetric
            LP ladder biased to absorb seized wTRY. The ladder you configure here feeds Section 4
            of the market simulator — slippage and bad-debt math both consume this preset.
          </p>
        </header>
        <PoolStatePanel />
        <SlippageCurvePanel />
        <LiquidatorSwapPanel />
        <RecoveryDistributionPanel />
      </div>
    </main>
  );
}
