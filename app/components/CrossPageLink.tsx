'use client';
import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes } from 'react';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Cross-page link that preserves the current URL query string on navigation.
 *
 * The app keeps sidebar state in the URL via nuqs, and falls back to
 * localStorage when the URL is bare. Plain `<a href="/lltv">` triggers a
 * full reload to a bare URL, which forces every destination page to wait
 * for a post-render useEffect to read localStorage — causing a visible
 * flash of default values (or stale values if the write hasn't flushed).
 *
 * This helper appends `window.location.search` to the destination href
 * after mount, so URL state survives the reload. The bare href is emitted
 * during static build / first client render to avoid hydration mismatch;
 * a useEffect updates it before the user can plausibly click.
 */
export function CrossPageLink({ href, children, ...rest }: Props) {
  const [search, setSearch] = useState('');
  useEffect(() => {
    setSearch(window.location.search);
  }, []);
  const finalHref = search ? insertSearch(href, search) : href;
  return (
    <a href={finalHref} {...rest}>
      {children}
    </a>
  );
}

/**
 * Append `?search` to a URL between its path and any `#fragment`.
 * Without this split, `/lltv#section` + `?x=1` would yield
 * `/lltv#section?x=1`, where `?x=1` becomes part of the fragment.
 */
function insertSearch(href: string, search: string): string {
  const hashIdx = href.indexOf('#');
  if (hashIdx === -1) return `${href}${search}`;
  const path = href.slice(0, hashIdx);
  const hash = href.slice(hashIdx);
  return `${path}${search}${hash}`;
}
