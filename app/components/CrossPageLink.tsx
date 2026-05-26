'use client';
import { useEffect, useState } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, KeyboardEvent } from 'react';
import { STORAGE_KEY } from '@/lib/useUrlState';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Cross-page link that preserves sidebar state on navigation.
 *
 * State propagation has three legs that must all align:
 *   1. nuqs writes editable params to `window.location.search` on change.
 *   2. `useUrlState` mirrors the full state into `localStorage` so it
 *      survives full reloads / new tabs.
 *   3. This component reads the live state at click time and appends it
 *      to the destination href, so the destination page sees the URL
 *      params on its very first render — no flash of stale defaults,
 *      no dependency on the destination's own post-render localStorage
 *      hydration to kick in.
 *
 * Source priority for the appended search:
 *   - `window.location.search` if non-empty (current page already has
 *     state in the URL — use it verbatim).
 *   - Else `localStorage[STORAGE_KEY]` serialized as a query string
 *     (current page didn't render useUrlState, but state from a prior
 *     page is still on disk).
 *
 * JIT update on `onMouseDown` / `onKeyDown(Enter|Space)` covers the
 * mount-time-stale case: nuqs may write the URL after this component
 * mounted, and useEffect with [] deps can't see those later writes.
 * Mutating `e.currentTarget.href` right before navigation is safe —
 * the browser uses the current href for the navigation that the
 * following mouseup / click commits.
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
    setMountSearch(getLiveSearch());
  }, []);
  const renderedHref = mountSearch ? insertSearch(href, mountSearch) : href;

  const syncHrefNow = (el: HTMLAnchorElement) => {
    const live = getLiveSearch();
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
 * Return the current search string — `?key=val&...` — sourced from the
 * URL, or from localStorage if the URL is bare. Returns '' if neither
 * has state. Safe under SSR (no window).
 */
function getLiveSearch(): string {
  if (typeof window === 'undefined') return '';
  const fromUrl = window.location.search;
  if (fromUrl) return fromUrl;
  return readStorageAsSearch();
}

function readStorageAsSearch(): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(parsed)) {
      if (v === undefined || v === null) continue;
      sp.set(k, String(v));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
  } catch {
    return '';
  }
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
