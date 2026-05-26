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
    'bandCoreLowerPct',
    'bandCoreUpperPct',
    'bandAbsorbLowerPct',
    'bandAbsorbUpperPct',
    'bandTailLowerPct',
    'bandTailUpperPct',
    'swapSellUSD',
  ];

  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-xl font-semibold">7. Swap Liquidity Lab</h2>
        <p className="text-sm text-neutral-500 mt-1 max-w-prose">
          A Uniswap v3 pool design lab for the wTRY/USDM pair on a kumbaya.xyz fork.
          It explains configured pool capital, active liquidity, and hypothetical
          seized-wTRY sale probes. The home simulator, not this page, estimates
          unresolved protocol debt after modeled liquidation behavior.
        </p>
      </header>

      <Section title="What this lab is, in one paragraph">
        <p className="text-sm max-w-prose">
          You configure a pool ladder and request hypothetical sales of seized wTRY.
          The page calculates AMM output, fees, price movement, and whether sale
          proceeds would cover the liquidator&apos;s repayment before gas. Section 4
          also repeats that single-trade probe over sampled terminal FX spots. A
          shortfall here means that probe would not cover repayment; it is not a
          statement that the protocol has booked bad debt.
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
            and this model calculates the resulting output. The available choices
            are 0.30% with spacing 60 and 1.00% with spacing 200. The page does
            not estimate trading volume or LP returns.
          </li>
        </ul>
      </Section>

      <Section title="The asymmetric ladder we use">
        <p className="text-sm max-w-prose">
          The pool builder divides configured launch capital across three editable
          positions. These defaults put extra capital below initial spot for the
          wTRY-sell scenarios modeled on this page:
        </p>
        <ul className="text-sm max-w-prose space-y-2 list-disc list-inside mt-2">
          <li>
            <b>Core (-5% to +5% of spot, 30% by default)</b> - a narrow range
            around initial spot.
          </li>
          <li>
            <b>Absorb (-15% to -5%, 50% by default)</b> - below initial spot and
            one-sided in USDM at launch for the default endpoints. It can supply
            output after a simulated sell reaches this range.
          </li>
          <li>
            <b>Tail (-90% to +30%, 20% by default)</b> - a broad range that includes
            initial spot and therefore contributes to active liquidity at launch.
          </li>
        </ul>
        <p className="text-sm max-w-prose mt-2">
          The `USD` amounts in the band table are configured launch marked values.
          They sum to configured pool capital. Active liquidity `L` is different:
          it includes only ranges containing the current modeled spot.
        </p>
      </Section>

      <Section title="How a seized-collateral probe flows through this pool">
        <ol className="text-sm max-w-prose space-y-2 list-decimal list-inside">
          <li>
            The scenario starts with a collateral value representing seized wTRY.
          </li>
          <li>
            The liquidator repays the borrower&apos;s debt in USDM and receives{' '}
            <code>collateral_USD = debt × LIF(lltv)</code> in seized wTRY. LIF
            (Liquidation Incentive Factor) is a bonus, e.g. LIF(0.86) is about
            1.04384, which corresponds to a 4.20% effective-slip repayment buffer. See{' '}
            <a className="text-brix-accent hover:underline" href="/help/liquidation">
              /help/liquidation
            </a>{' '}
            for the formula.
          </li>
          <li>
            The page requests a wTRY-to-USDM sale through the configured AMM (function{' '}
            <code>quoteLiquidatorSell</code> in{' '}
            <code>lib/univ3/quoteLiquidatorSell.ts</code>).
          </li>
          <li>
            The quote returns <code>usdmOut</code>. Effective slip includes fee,
            execution price movement, and any unfilled requested notional after
            represented liquidity is exhausted.
          </li>
          <li>
            Repayment shortfall = <code>max(0, debtToRepay - usdmOut)</code>.
            Helper: <code>liquidatorExecutionShortfall</code> in{' '}
            <code>lib/liquidatorShortfallMath.ts</code>.
          </li>
        </ol>
        <p className="text-sm max-w-prose mt-2">
          A zero-shortfall probe has <code>usdmOut &gt;= debtToRepay</code>. It says
          the hypothetical AMM sale covers repayment before gas. The homepage
          cascade separately calculates residual Morpho debt.
        </p>
      </Section>

      <Section title="Worked example: a default-config liquidation">
        <p className="text-sm max-w-prose">
          Concrete numbers using the default pool configuration, with the sell-size
          slider manually set to a $25,000 seized-collateral probe instead of its
          $1,000,000 URL-state default. Open{' '}
          <a className="text-brix-accent hover:underline" href="/swapliquidity">
            /swapliquidity
          </a>{' '}
          in another tab and follow along.
        </p>
        <table className="text-xs mt-3 max-w-prose">
          <tbody>
            {[
              ['Scenario inputs', '$500k configured capital, 30/50/20 split, fee 0.30%, LLTV 86%'],
              ['Default band ranges', 'Core -5% to +5%; Absorb -15% to -5%; Tail -90% to +30%'],
              ['USD/TRY baseline', '= 45 (default) → spot wTRY/USDM ≈ 0.0222'],
              ['LIF(0.86)', '≈ 1.04384 → LIF buffer = 4.20%'],
              ['Probe input', '$25,000 of seized wTRY notional'],
              ['Debt to repay', '$25,000 / 1.04384 = $23,950'],
              ['Calculated AMM output', 'USDM received ≈ $24,726; effective slip ≈ 1.094%'],
              ['Marginal price movement', 'Marginal price slip ≈ 1.587%; fee on filled input = $75'],
              ['Calculated shortfall', 'max(0, 23,950 - 24,726) = $0 before gas'],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="font-medium pr-4 py-1">{k}</td>
                <td className="py-1">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-sm max-w-prose mt-3">
          In this probe, proceeds cover repayment before gas because effective slip
          is below the 4.20% LIF buffer. If effective slip crosses that buffer, the
          page reports a liquidator repayment shortfall. It does not claim whether a
          real transaction executes or whether unresolved protocol debt remains.
        </p>
      </Section>

      <Section title="How to read the charts">
        <ul className="text-sm max-w-prose space-y-3 list-disc list-inside">
          <li>
            <b>Net liquidity changes by tick (§1):</b> each bar marks a tick boundary where `L`
            changes. The sign is stored for price moving upward. A wTRY sell moves
            downward, so the swap crosses these boundaries in reverse order.
          </li>
          <li>
            <b>Band allocation table (§1):</b> configured launch marked allocation.
            Its USD column sums to configured pool capital, not active liquidity `L`.
          </li>
          <li>
            <b>Slippage curve (§2):</b> deterministic requested-sell sweep at initial
            spot. The 1% line is a comparison reference; the LIF-buffer line is a
            before-gas repayment reference for seized-collateral interpretation.
          </li>
          <li>
            <b>Liquidator swap KPIs (§3):</b> one requested-sale quote at initial
            spot. `USDM received` is output; effective slip includes fee and impact;
            marginal slip is final-price movement.
          </li>
          <li>
            <b>Liquidator execution shortfall (§4):</b> the histogram repeats the
            slider probe at sampled terminal-FX sizes against a pool fixed at initial
            spot. The second chart is a deterministic size sweep. Both report
            hypothetical before-gas repayment shortfall, not protocol bad debt.
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
  poolTVL_USD: 'Configured pool capital (USD)',
  bandSplitCore: 'Core band share',
  bandSplitAbsorb: 'Absorb band share',
  bandCoreLowerPct: 'Core lower range edge',
  bandCoreUpperPct: 'Core upper range edge',
  bandAbsorbLowerPct: 'Absorb lower range edge',
  bandAbsorbUpperPct: 'Absorb upper range edge',
  bandTailLowerPct: 'Tail lower range edge',
  bandTailUpperPct: 'Tail upper range edge',
  swapSellUSD: 'Requested seized-wTRY probe (USD)',
};

const GLOSSARY: Array<[string, string]> = [
  ['protocol bad debt', 'Residual Morpho debt after modeled liquidation behavior. It is calculated by the home simulator, not by this single-trade probe panel.'],
  ['repayment shortfall', 'max(0, debtToRepay - AMM proceeds) for a hypothetical sale. A non-zero probe shortfall does not itself mean protocol debt was realized.'],
  ['core / absorb / tail bands', 'Three configured LP positions. Current defaults are Core -5% to +5%, Absorb -15% to -5%, and Tail -90% to +30% of initial spot.'],
  ['fee tier', 'Encoded input-fee option. Fee tier 3000 means 0.30% and spacing 60; 10000 means 1.00% and spacing 200.'],
  ['LIF', 'Liquidation Incentive Factor. LIF(0.86) is about 1.04384, giving a modeled before-gas effective-slip buffer of 4.20%.'],
  ['liquidity (L)', 'Uniswap v3 internal parameter that ties a position\'s reserves to its price range. Bigger L in-range = less slippage.'],
  ['LLTV', 'Liquidation Loan-To-Value. Maximum debt/collateral ratio before liquidation fires. Governance-tier specific. Default 86%.'],
  ['effective slip', 'max(0, 1 - USDM received / requested sell notional). Includes modeled fee, price movement, and unfilled requested notional.'],
  ['marginal price slip', '(entry price - final price) / entry price for a wTRY sell. This endpoint measure differs from effective slip.'],
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
  ['Asymmetric ladder builder', 'lib/poolPreset.ts (buildLadderFromInputs)'],
  ['Liquidator repayment-shortfall math', 'lib/liquidatorShortfallMath.ts (liquidatorExecutionShortfall)'],
  ['LIF formula', 'lib/morphoMath.ts (LIF)'],
  ['Page entry', 'app/swapliquidity/page.tsx'],
  ['Sidebar controls', 'app/swapliquidity/SwapliquiditySidebar.tsx'],
];
