'use client';
import { usePathname } from 'next/navigation';
import pkg from '../../package.json';

const REPO_URL = 'https://github.com/gokhanseckin/Brix-on-Morpho';

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith('/assignment')) return null;
  const sha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const sha7 = sha ? sha.slice(0, 7) : 'dev';
  const commitUrl = sha ? `${REPO_URL}/commit/${sha}` : REPO_URL;
  return (
    <footer className="border-t border-brix-border mt-12 px-8 py-4 text-xs text-neutral-500 flex items-center justify-between gap-4">
      <span className="font-mono">
        v{pkg.version} ·{' '}
        <a
          href={commitUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-brix-accent hover:text-brix-accentHover hover:underline"
        >
          {sha7}
        </a>
      </span>
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
