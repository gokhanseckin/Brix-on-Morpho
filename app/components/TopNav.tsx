'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';

type NavItem = { href: Route; label: string };

const ITEMS: NavItem[] = [
  { href: '/' as Route, label: 'Simulator' },
  { href: '/utilization' as Route, label: 'Utilization' },
  { href: '/lltv' as Route, label: 'LLTV' },
  { href: '/swapliquidity' as Route, label: 'Swap Liquidity' },
  { href: '/explore-market' as Route, label: 'Explore Markets' },
  { href: '/help' as Route, label: 'Help' },
  { href: '/assignment' as Route, label: 'Pitch Deck' },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="flex flex-wrap items-center gap-1 text-sm border-b border-brix-border pb-3 mb-6"
    >
      {ITEMS.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={
              'rounded-md px-3 py-1.5 transition-colors ' +
              (active
                ? 'bg-brix-accent/10 text-brix-accent border border-brix-accent/30'
                : 'text-neutral-400 hover:text-brix-accent border border-transparent hover:border-brix-border')
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
