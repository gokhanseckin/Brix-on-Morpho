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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <h1 className="text-lg font-semibold">Help</h1>
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to dashboard
        </Link>
      </header>
      <nav className="mb-6 flex flex-wrap gap-3 text-sm">
        {SECTIONS.map((s) => (
          <Link
            key={s.slug}
            href={`/help/${s.slug}` as Route}
            className="rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
