import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { LiquidityNeed } from './components/sections/LiquidityNeed';
import { FXRisk } from './components/sections/FXRisk';
import { LiquidityStrategy } from './components/sections/LiquidityStrategy';
import { LiquidationDesign } from './components/sections/LiquidationDesign';
import { VaultRecommendations } from './components/sections/VaultRecommendations';

export default function Page() {
  return (
    <div className="grid grid-cols-[320px_1fr] min-h-screen bg-brix-bg text-neutral-200">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-brix-border p-4 bg-neutral-950">
        <Sidebar />
      </aside>
      <main className="p-8 space-y-16 max-w-5xl">
        <TopNav />
        <header className="border-b border-brix-border pb-8">
          <div className="brix-kicker mb-4">Brix · Internal · Morpho Launch</div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            wiTRY <span className="text-brix-accent">→</span> USDM
            <br />
            <span className="text-neutral-400">Market Simulator</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-400">
            Pre-launch parameter calibration for a Morpho Blue market on MegaETH.
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
          <h2 className="sr-only">5. Deployment Recommendations (Market + Pre-liq + Vault)</h2>
          <VaultRecommendations />
        </section>
      </main>
    </div>
  );
}
