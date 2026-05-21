import { KPI_HELP, CHART_HELP, PARAM_HELP } from '@/lib/help/registry';
import { KPI_KEYS, KPI_SECTION } from '@/lib/help/kpiKeys';
import { CHART_KEYS, CHART_SECTION } from '@/lib/help/chartKeys';
import { KpiEntry, ChartEntry, ParamEntry } from '@/app/components/help/SectionPage';

export default function HelpSwapLiquidity() {
  const kpis = KPI_KEYS.filter((k) => KPI_SECTION[k] === 'swap-liquidity');
  const charts = CHART_KEYS.filter((c) => CHART_SECTION[c] === 'swap-liquidity');
  const paramKeys: Array<keyof typeof PARAM_HELP> = [
    'poolFeeTier',
    'poolTVL_USD',
    'bandSplitCore',
    'bandSplitAbsorb',
  ];

  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-xl font-semibold">7. Swap Liquidity Lab</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          A Uniswap v3 pool design lab for the wTRY/USDM pair on a kumbaya.xyz fork.
          This page walks through the AMM mechanics, the asymmetric LP ladder we built
          to absorb wTRY liquidations, and the bad-debt math that ties it back to
          protocol safety. Written for a backend engineer who&apos;s heard of AMMs but
          hasn&apos;t deployed liquidity before.
        </p>
      </header>

      <Section title="What this lab is, in one paragraph">
        <p className="text-sm max-w-prose">
          When a borrower&apos;s position goes underwater, a liquidator seizes their wTRY
          collateral and immediately dumps it into the wTRY/USDM AMM to repay the
          USDM debt. If the AMM sale doesn&apos;t cover the debt, the protocol books
          <em> bad debt</em>. This page lets you design that AMM — pool depth, fee
          tier, and how capital is split across price bands — and tells you how often
          bad debt will fire under simulated FX futures.
        </p>
      </Section>

      <Section title="Uniswap v3 in five minutes">
        <ul className="text-sm max-w-prose space-y-3 list-disc list-inside">
          <li>
            <b>Pools are price curves.</b> The classic AMM holds two reserves <code>x</code>{' '}
            and <code>y</code> on a curve <code>x · y = k</code>. Anyone can swap one
            asset for the other; the price moves as the reserves shift.
          </li>
          <li>
            <b>Uniswap v3 adds concentrated liquidity.</b> LPs declare a price{' '}
            <em>range</em> <code>[a, b]</code> for their position. Inside the range,
            their capital trades like a much deeper symmetric pool centered on the
            range. Outside, the position becomes 100% one asset and earns no fees.
          </li>
          <li>
            <b>Ticks are an integer grid for prices.</b> Every price is{' '}
            <code>1.0001 ^ tick</code>. So tick = 0 means price = 1, tick = 100 means
            price ≈ 1.01. LP positions snap their range endpoints to multiples of{' '}
            <code>tickSpacing</code>. The 0.30% fee tier uses spacing 60, the 1.00%
            tier uses 200 — coarser grid = wider per-tick range = less precise but
            more robust to jitter.
          </li>
          <li>
            <b>sqrtPriceX96 is an encoding detail.</b> Uniswap stores prices as{' '}
            <code>√price × 2^96</code> to avoid floating point and to make the swap
            math associative. If you see a giant integer, that&apos;s what it is. The
            page surfaces real prices, not sqrtPriceX96.
          </li>
          <li>
            <b>Fee tier = LP commission.</b> Every swap pays a fee on the input,
            distributed pro-rata to in-range LPs. 0.30% is standard for volatile
            pairs; 1.00% pays LPs enough to bother with a thin book on a fresh
            launch. Higher fee = wider tick spacing.
          </li>
        </ul>
      </Section>

      <Section title="The asymmetric ladder we use">
        <p className="text-sm max-w-prose">
          A standard symmetric LP (e.g. ±20% around spot) wastes capital: the upside
          half never gets used because wTRY drops, not rises, when liquidations fire.
          So we split capital across three asymmetric bands:
        </p>
        <ul className="text-sm max-w-prose space-y-2 list-disc list-inside mt-2">
          <li>
            <b>Core (±5% around spot, ~30% of TVL)</b> — captures normal trading,
            earns the lion&apos;s share of fees during quiet times.
          </li>
          <li>
            <b>Absorb (−25% → −10%, ~50% of TVL)</b> — sits below spot in pure USDM.
            When wTRY price crashes into this range (exactly when liquidators are
            unwinding), the band buys wTRY at a discount and pays out USDM. This is
            the <em>catch net</em>.
          </li>
          <li>
            <b>Tail (−50% → +15%, ~20% of TVL)</b> — wide backstop for catastrophic
            moves. Thin per-tick depth but always present.
          </li>
        </ul>
        <p className="text-sm max-w-prose mt-2">
          The split is controlled by the sidebar sliders. Default 30/50/20 is sized
          for a small-vault launch; production deployments should tune to expected
          liquidation flow.
        </p>
      </Section>

      <Section title="How a liquidation actually flows through this pool">
        <ol className="text-sm max-w-prose space-y-2 list-decimal list-inside">
          <li>
            wTRY price falls. A position&apos;s loan-to-value crosses LLTV. Anyone can
            liquidate it.
          </li>
          <li>
            The liquidator repays the borrower&apos;s debt in USDM and receives{' '}
            <code>collateral_USD = debt × LIF(lltv)</code> in seized wTRY. LIF
            (Liquidation Incentive Factor) is a small bonus, e.g. LIF(0.86) ≈ 1.044
            → 4.4% bonus. See{' '}
            <a className="text-blue-600 hover:underline" href="/help/liquidation">
              /help/liquidation
            </a>{' '}
            for the formula.
          </li>
          <li>
            The liquidator immediately dumps the seized wTRY into this AMM (function{' '}
            <code>quoteLiquidatorSell</code> in{' '}
            <code>lib/univ3/quoteLiquidatorSell.ts</code>).
          </li>
          <li>
            The AMM returns <code>usdmOut</code>. Slippage + fee eat into the LIF
            bonus.
          </li>
          <li>
            Bad debt = <code>max(0, debt − usdmOut)</code>. Helper:{' '}
            <code>badDebtFromAMMSale</code> in <code>lib/badDebtMath.ts</code>.
          </li>
        </ol>
        <p className="text-sm max-w-prose mt-2">
          The healthy case is <code>usdmOut ≥ debt</code> — slippage + fee stayed
          inside the LIF buffer, the liquidator pocketed the spread, the protocol
          ate zero loss.
        </p>
      </Section>

      <Section title="Worked example: a default-config liquidation">
        <p className="text-sm max-w-prose">
          Concrete numbers using the page&apos;s default settings. Open{' '}
          <a className="text-blue-600 hover:underline" href="/swapliquidity">
            /swapliquidity
          </a>{' '}
          in another tab and follow along.
        </p>
        <table className="text-xs mt-3 max-w-prose">
          <tbody>
            {[
              ['Sidebar settings', '$500k pool, 30/50/20 split, fee 0.30%, LLTV 86%'],
              ['USD/TRY baseline', '≈ 38.5 → spot wTRY/USDM ≈ 0.026'],
              ['LIF(0.86)', '≈ 1.044 → LIF buffer ≈ 4.4%'],
              ['Liquidation event', '$25,000 of seized wTRY notional'],
              ['Debt repaid (at trigger)', '$25,000 / 1.044 ≈ $23,946'],
              ['AMM quote (default ladder)', 'slippage ≈ 0.6%, USDM out ≈ $24,850'],
              ['Bad debt', 'max(0, 23,946 − 24,850) = $0'],
              ['Liquidator profit', '24,850 − 23,946 = $904 minus gas'],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="font-medium pr-4 py-1">{k}</td>
                <td className="py-1">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm max-w-prose mt-3">
          Bad debt would have fired if AMM proceeds fell below $23,946 — i.e. if
          slippage + fee exceeded 4.4%. That requires either much deeper price impact
          (pool drained, or a $100k+ sell), or a higher LLTV with a thinner buffer
          (LIF(0.945) ≈ 1.017 → only a 1.7% buffer).
        </p>
      </Section>

      <Section title="How to read the charts">
        <ul className="text-sm max-w-prose space-y-3 list-disc list-inside">
          <li>
            <b>Liquidity by tick (§1):</b> each bar marks a tick where an LP position
            begins or ends. The big positive bars below current spot are the Absorb
            band opening — that&apos;s the depth the AMM offers when wTRY crashes.
            Negative bars are the upper edges of bands (liquidity removed when price
            crosses going up).
          </li>
          <li>
            <b>Band allocation table (§1):</b> per-band breakdown of where the
            pool&apos;s capital sits. Sums to the sidebar&apos;s Total TVL.
          </li>
          <li>
            <b>Liquidator swap KPIs (§2):</b> single-swap quote for the sell-size you
            pick with the slider. Move the slider to feel slippage rise with size.
          </li>
          <li>
            <b>Bad-debt distribution (§3):</b> histogram of bad-debt rate across the
            Monte-Carlo FX paths from the homepage. A tall bar at 0% on the left =
            healthy. A long right tail = stressed paths the LIF buffer didn&apos;t
            cover. The p95 KPI is the worst 1-in-20 future and is what the insurance
            buffer must size against.
          </li>
        </ul>
      </Section>

      <Section title="Detailed entries">
        <p className="text-xs text-neutral-500 max-w-prose">
          Every popover icon on /swapliquidity links to one of the entries below.
          Anchors match the popover&apos;s key, so &quot;More info →&quot; lands you
          on the right section.
        </p>
      </Section>

      <header id="params">
        <h3 className="text-lg font-semibold">Sidebar parameters</h3>
      </header>
      {paramKeys.map((k) => (
        <ParamEntry key={k} id={k as string} label={paramLabels[k] ?? k} help={PARAM_HELP[k]} />
      ))}

      <header id="kpis">
        <h3 className="text-lg font-semibold">KPIs</h3>
      </header>
      {kpis.map((k) => (
        <KpiEntry key={k} id={k} help={KPI_HELP[k]} />
      ))}

      <header id="charts">
        <h3 className="text-lg font-semibold">Charts &amp; structured outputs</h3>
      </header>
      {charts.map((c) => (
        <ChartEntry key={c} id={c} help={CHART_HELP[c]} />
      ))}

      <Section title="Glossary">
        <dl className="text-xs max-w-prose space-y-2">
          {GLOSSARY.map(([term, def]) => (
            <div key={term}>
              <dt className="font-semibold inline">{term}: </dt>
              <dd className="inline text-neutral-700 dark:text-neutral-300">{def}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Code map">
        <table className="text-xs max-w-prose">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <th className="text-left pr-4 py-1">Concept</th>
              <th className="text-left py-1">Source</th>
            </tr>
          </thead>
          <tbody>
            {CODE_MAP.map(([concept, src]) => (
              <tr key={concept} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="pr-4 py-1">{concept}</td>
                <td className="py-1 font-mono">{src}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

const paramLabels: Partial<Record<string, string>> = {
  poolFeeTier: 'Fee tier',
  poolTVL_USD: 'Pool TVL (USD)',
  bandSplitCore: 'Core band share',
  bandSplitAbsorb: 'Absorb band share',
};

const GLOSSARY: Array<[string, string]> = [
  ['bad debt', 'Debt that the liquidator could not recover from the AMM sale. The protocol absorbs it as a loss to suppliers (or an insurance buffer).'],
  ['core / absorb / tail bands', 'The three LP positions that make up the asymmetric ladder. Core sits ±5% around spot, Absorb at −25% → −10%, Tail at −50% → +15%.'],
  ['fee tier', 'Per-swap commission paid to LPs. 0.30% (spacing 60) or 1.00% (spacing 200). Higher tier means coarser tick grid.'],
  ['LIF', 'Liquidation Incentive Factor. Multiplier on debt that defines how much collateral the liquidator seizes. LIF(0.86) ≈ 1.044 → liquidator gets 4.4% bonus.'],
  ['liquidity (L)', 'Uniswap v3 internal parameter that ties a position\'s reserves to its price range. Bigger L in-range = less slippage.'],
  ['LLTV', 'Liquidation Loan-To-Value. Maximum debt/collateral ratio before liquidation fires. Governance-tier specific. Default 86%.'],
  ['recovery rate', 'AMM proceeds ÷ debt-at-trigger. 100%+ means liquidator covered the debt. <100% means bad debt.'],
  ['slippage', 'Price impact of a swap. (entry price − exit price) / entry price. Grows with swap size.'],
  ['sqrtPriceX96', 'Uniswap\'s internal price encoding: √price × 2^96. Not a number you read; just a marker for "this is an encoded price."'],
  ['tick', 'Integer index on the price grid. price = 1.0001 ^ tick. Bounded by MIN_TICK / MAX_TICK.'],
  ['tick spacing', 'How coarse the grid is. 60 for 0.30% fee, 200 for 1.00% fee. LP range endpoints must snap to multiples.'],
];

const CODE_MAP: Array<[string, string]> = [
  ['Tick math (price ↔ tick ↔ sqrtPriceX96)', 'lib/univ3/tickMath.ts'],
  ['Liquidity math (L ↔ amounts)', 'lib/univ3/liquidityMath.ts'],
  ['Tick-walking swap engine', 'lib/univ3/swap.ts'],
  ['Materialize a preset into a PoolState', 'lib/univ3/quoteLiquidatorSell.ts (materializePool)'],
  ['Liquidator sell quote', 'lib/univ3/quoteLiquidatorSell.ts (quoteLiquidatorSell)'],
  ['Asymmetric ladder builder', 'lib/poolPreset.ts (buildAsymmetricLadder)'],
  ['Bad-debt math (LLTV + LIF aware)', 'lib/badDebtMath.ts (badDebtFromAMMSale)'],
  ['LIF formula', 'lib/morphoMath.ts (LIF)'],
  ['Page entry', 'app/swapliquidity/page.tsx'],
  ['Sidebar controls', 'app/swapliquidity/SwapliquiditySidebar.tsx'],
];
