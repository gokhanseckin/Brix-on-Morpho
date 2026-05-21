import Link from 'next/link';
import type { Route } from 'next';

const SECTIONS: Array<{ slug: string; label: string; blurb: string }> = [
  { slug: 'liquidity-need', label: '1. Liquidity Need', blurb: 'How much USDM the vault must hold.' },
  { slug: 'fx-risk', label: '2. FX Risk', blurb: 'USD/TRY shocks, drawdowns, positions underwater.' },
  { slug: 'strategy', label: '3. Strategy', blurb: 'APYs, incentives, days to target.' },
  { slug: 'liquidation', label: '4. Liquidation', blurb: 'Liquidator economics and bad debt.' },
  { slug: 'vault', label: '5. Vault', blurb: 'Recommended LLTV, risk tier, deploy JSON.' },
  { slug: 'utilization', label: '6. Utilization', blurb: 'Target-utilization calibration: looper viability, stress, IRM kink.' },
  { slug: 'swap-liquidity', label: '7. Swap Liquidity', blurb: 'Uniswap v3 pool design for liquidators: asymmetric ladder, slippage, bad-debt math.' },
];

export default function HelpIndex() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Pick a section to read detailed explanations, formulas, worked examples, and diagrams.
      </p>
      <ul className="space-y-2">
        {SECTIONS.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/help/${s.slug}` as Route}
              className="block rounded border border-brix-border px-3 py-2 hover:bg-brix-surface"
            >
              <span className="font-medium">{s.label}</span>{' '}
              <span className="text-sm text-neutral-500">— {s.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
