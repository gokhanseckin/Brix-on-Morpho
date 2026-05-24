'use client';
import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, KeyboardEvent } from 'react';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Cross-page link that preserves the current URL query string on navigation.
 *
 * The app keeps sidebar state in the URL via nuqs; a plain `<a href="/lltv">`
 * drops the search on a full reload, forcing the destination page to wait
 * for a post-render localStorage hydration that may flash defaults or pick
 * up a stale snapshot.
 *
 * Two-phase href synchronization:
 *   1. Mount-time `useEffect` captures `window.location.search` so the
 *      hover-preview href is correct after hydration. Render-time bare href
 *      keeps SSR/CSR byte-identical to avoid hydration mismatch.
 *   2. **JIT update on `onMouseDown` / `onKeyDown(Enter|Space)`** rewrites
 *      `e.currentTarget.href` against the *current* `window.location.search`
 *      right before navigation. This is the only path that captures URL
 *      mutations that happened after mount (e.g. user edited a sidebar
 *      value via nuqs between page load and link click) — useEffect with
 *      `[]` deps fires once and cannot see those later URL writes.
 *   `onMouseDown` (not `onClick`) is chosen because it fires for all
 *   mouse buttons (left / middle / ctrl-click → new tab) before the
 *   navigation gesture commits.
 */
export function CrossPageLink({
  href,
  children,
  onMouseDown,
  onKeyDown,
  ...rest
}: Props) {
  const [mountSearch, setMountSearch] = useState('');
  useEffect(() => {
    setMountSearch(window.location.search);
  }, []);
  const renderedHref = mountSearch ? insertSearch(href, mountSearch) : href;

  const syncHrefNow = (el: HTMLAnchorElement) => {
    const live = window.location.search;
    el.href = live ? insertSearch(href, live) : href;
  };

  const handleMouseDown = (e: MouseEvent<HTMLAnchorElement>) => {
    syncHrefNow(e.currentTarget);
    onMouseDown?.(e);
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      syncHrefNow(e.currentTarget);
    }
    onKeyDown?.(e);
  };

  return (
    <a
      {...rest}
      href={renderedHref}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    >
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
  return `${href.slice(0, hashIdx)}${search}${href.slice(hashIdx)}`;
}
