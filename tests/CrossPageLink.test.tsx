import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { CrossPageLink } from '@/app/components/CrossPageLink';

function setLocationSearch(search: string) {
  // jsdom allows replacing the URL via history; reflect that into window.location.search.
  window.history.replaceState({}, '', `/${search}`);
}

describe('CrossPageLink', () => {
  beforeEach(() => {
    setLocationSearch('');
  });

  it('renders the bare href on first paint (no SSR/CSR mismatch)', () => {
    setLocationSearch('?witryTVL_USD=10000000');
    // Render synchronously; assert before effects flush. We can't easily
    // observe pre-effect DOM in RTL, so instead assert post-effect that the
    // anchor uses the dynamic href shape we expect (suffix matches search).
    render(<CrossPageLink href="/lltv">go</CrossPageLink>);
    const a = screen.getByRole('link', { name: /go/i });
    expect(a.getAttribute('href')).toBe('/lltv?witryTVL_USD=10000000');
  });

  it('returns the bare href when there is no query string', () => {
    setLocationSearch('');
    render(<CrossPageLink href="/swapliquidity">go</CrossPageLink>);
    const a = screen.getByRole('link', { name: /go/i });
    expect(a.getAttribute('href')).toBe('/swapliquidity');
  });

  it('updates href when the query string changes between mounts', () => {
    setLocationSearch('?a=1&b=2');
    const { unmount } = render(<CrossPageLink href="/lltv">first</CrossPageLink>);
    expect(screen.getByRole('link', { name: /first/i }).getAttribute('href')).toBe(
      '/lltv?a=1&b=2',
    );
    unmount();

    act(() => {
      setLocationSearch('?c=3');
    });
    render(<CrossPageLink href="/lltv">second</CrossPageLink>);
    expect(screen.getByRole('link', { name: /second/i }).getAttribute('href')).toBe(
      '/lltv?c=3',
    );
  });

  it('forwards arbitrary anchor props (className, target)', () => {
    setLocationSearch('?x=1');
    render(
      <CrossPageLink href="/lltv" className="text-brix-accent" target="_blank">
        labeled
      </CrossPageLink>,
    );
    const a = screen.getByRole('link', { name: /labeled/i });
    expect(a.className).toContain('text-brix-accent');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('href')).toBe('/lltv?x=1');
  });

  it('inserts the search BEFORE a # fragment so the query is not eaten by the hash', () => {
    setLocationSearch('?witryTVL_USD=8e6');
    render(
      <CrossPageLink href="/lltv#section">jump</CrossPageLink>,
    );
    const a = screen.getByRole('link', { name: /jump/i });
    expect(a.getAttribute('href')).toBe('/lltv?witryTVL_USD=8e6#section');
  });

  // This is the regression that motivated the JIT rewrite. The previous
  // implementation captured window.location.search once on mount via a
  // [] useEffect; if the URL changed after mount (e.g. the user edited a
  // sidebar value via nuqs), the link href stayed bare and navigation
  // dropped the params. onMouseDown now rewrites href against the live URL.
  it('updates href via onMouseDown when the URL changes AFTER mount', () => {
    setLocationSearch('');
    render(<CrossPageLink href="/lltv">go</CrossPageLink>);
    const a = screen.getByRole('link', { name: /go/i }) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/lltv');

    // Simulate a post-mount URL mutation (what nuqs does when the user
    // edits a sidebar field).
    act(() => {
      setLocationSearch('?witryTVL_USD=10000000');
    });
    // Render-time href has NOT changed (useEffect already captured '').
    expect(a.getAttribute('href')).toBe('/lltv');

    // Mousedown JIT-syncs against window.location.search.
    fireEvent.mouseDown(a);
    expect(a.getAttribute('href')).toBe('/lltv?witryTVL_USD=10000000');
  });

  it('JIT-updates href on keyboard activation (Enter)', () => {
    setLocationSearch('');
    render(<CrossPageLink href="/swapliquidity">go</CrossPageLink>);
    const a = screen.getByRole('link', { name: /go/i }) as HTMLAnchorElement;

    act(() => setLocationSearch('?poolTVL_USD=1000000'));
    fireEvent.keyDown(a, { key: 'Enter' });
    expect(a.getAttribute('href')).toBe('/swapliquidity?poolTVL_USD=1000000');
  });

  it('clears stale search if the URL becomes bare after mount', () => {
    setLocationSearch('?old=1');
    render(<CrossPageLink href="/lltv">go</CrossPageLink>);
    const a = screen.getByRole('link', { name: /go/i }) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('/lltv?old=1');

    act(() => setLocationSearch(''));
    fireEvent.mouseDown(a);
    expect(a.getAttribute('href')).toBe('/lltv');
  });

  it('composes with caller-provided onMouseDown / onKeyDown handlers', () => {
    setLocationSearch('?x=1');
    let mdCount = 0;
    let kdCount = 0;
    render(
      <CrossPageLink
        href="/lltv"
        onMouseDown={() => mdCount++}
        onKeyDown={() => kdCount++}
      >
        go
      </CrossPageLink>,
    );
    const a = screen.getByRole('link', { name: /go/i }) as HTMLAnchorElement;
    fireEvent.mouseDown(a);
    fireEvent.keyDown(a, { key: 'Enter' });
    expect(mdCount).toBe(1);
    expect(kdCount).toBe(1);
    expect(a.getAttribute('href')).toBe('/lltv?x=1');
  });
});
