'use client';
import { usePathname } from 'next/navigation';
import pkg from '../../package.json';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/assignment')) return null;
  return (
    <footer className="border-t border-brix-border mt-12 px-8 py-4 text-xs text-neutral-500 flex items-center justify-between gap-4">
      <span>v{pkg.version}</span>
      <span>
        Developed by{' '}
        <a
          href="https://github.com/gokhanseckin"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brix-accent hover:text-brix-accentHover underline-offset-2 hover:underline"
        >
          Gokhan Seckin
        </a>
      </span>
    </footer>
  );
}
