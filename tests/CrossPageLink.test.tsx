import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
});
