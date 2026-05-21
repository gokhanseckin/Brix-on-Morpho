import { Sidebar } from './components/Sidebar';
import { LiquidityNeed } from './components/sections/LiquidityNeed';
import { FXRisk } from './components/sections/FXRisk';
import { LiquidityStrategy } from './components/sections/LiquidityStrategy';
import { LiquidationDesign } from './components/sections/LiquidationDesign';
import { VaultRecommendations } from './components/sections/VaultRecommendations';

export default function Page() {
  return (
    <div className="grid grid-cols-[320px_1fr] min-h-screen">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-neutral-300 dark:border-neutral-700 p-4 bg-neutral-50 dark:bg-neutral-900">
        <Sidebar />
      </aside>
      <main className="p-6 space-y-12 max-w-5xl">
        <header>
          <h1 className="text-2xl font-bold">Brix · wiTRY → USDM Market Simulator</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Pre-launch parameter calibration for a Morpho Blue market on MegaETH.
          </p>
          <p className="text-sm mt-2">
            <a href="/utilization" className="text-blue-600 underline">Target utilization calibration →</a>
          </p>
        </header>
        <section id="section-liquidity-need-anchor">
          <h2 className="sr-only">1. USDM Liquidity Need</h2>
          <LiquidityNeed />
        </section>
        <section id="section-fx-risk-anchor">
          <h2 className="sr-only">2. FX Risk</h2>
          <FXRisk />
        </section>
        <section id="section-liquidity-strategy-anchor">
          <h2 className="sr-only">3. Liquidity Strategy</h2>
          <LiquidityStrategy />
        </section>
        <section id="section-liquidation-design-anchor">
          <h2 className="sr-only">4. Liquidation Design</h2>
          <LiquidationDesign />
        </section>
        <section id="section-vault-recommendations-anchor">
          <h2 className="sr-only">5. Vault V2 Parameter Recommendations</h2>
          <VaultRecommendations />
        </section>
      </main>
    </div>
  );
}
