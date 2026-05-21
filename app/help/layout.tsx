import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Route } from 'next';

const SECTIONS: Array<{ slug: string; label: string }> = [
  { slug: 'liquidity-need', label: '1. Liquidity Need' },
  { slug: 'fx-risk', label: '2. FX Risk' },
  { slug: 'strategy', label: '3. Strategy' },
  { slug: 'liquidation', label: '4. Liquidation' },
  { slug: 'vault', label: '5. Vault' },
  { slug: 'utilization', label: '6. Utilization' },
];

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 bg-brix-bg min-h-screen text-neutral-200">
      <header className="mb-8 border-b border-brix-border pb-6">
        <div className="brix-kicker mb-3">Brix · Documentation</div>
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Help <span className="text-brix-accent">·</span> parameter docs
          </h1>
          <Link href="/" className="text-sm text-brix-accent hover:text-brix-accentHover">
            ← Back to dashboard
          </Link>
        </div>
      </header>
      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        {SECTIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/help/${s.slug}` as Route}
            className="rounded border border-brix-border px-3 py-1 hover:bg-brix-surface"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
