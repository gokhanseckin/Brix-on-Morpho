'use client';
import { usePathname } from 'next/navigation';
import { CrossPageLink } from './CrossPageLink';

type NavItem = { href: string; label: string };

const ITEMS: NavItem[] = [
  { href: '/', label: 'Simulator' },
  { href: '/utilization', label: 'Utilization' },
  { href: '/lltv', label: 'LLTV' },
  { href: '/swapliquidity', label: 'Swap Liquidity' },
  { href: '/explore-market', label: 'Explore Markets' },
  { href: '/help', label: 'Help' },
  { href: '/assignment', label: 'Pitch Deck' },
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
          <CrossPageLink
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
          </CrossPageLink>
        );
      })}
    </nav>
  );
}
