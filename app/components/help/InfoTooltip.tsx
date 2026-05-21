'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { Route } from 'next';
import type { HelpSection } from '@/lib/help/types';

interface MoreInfoLink {
  section: HelpSection;
  anchor: string;
}

/**
 * Sidebar param help. Click to open, ESC or click-outside to close.
 * Renders via portal with fixed positioning so it escapes the sidebar's
 * overflow-y-auto clipping (overflow-y:auto forces overflow-x:auto too).
 *
 * If `moreInfo` is provided, a "More info →" link is appended that points
 * at /help/<section>#<anchor>.
 */
export function InfoTooltip({ text, moreInfo }: { text: string; moreInfo?: MoreInfoLink }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const popoverStyle = computePopoverStyle(rect);

  return (
    <span className="relative inline-block align-middle ml-2">
      <button
        ref={triggerRef}
        type="button"
        aria-label="More info"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-400 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ?
      </button>
      {open && mounted && rect && createPortal(
        <div
          ref={popoverRef}
          id={id}
          role="dialog"
          aria-modal="false"
          style={popoverStyle}
          className="fixed z-[100] w-64 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-xs shadow-xl normal-case tracking-normal"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="leading-snug">{text}</span>
            <button
              type="button"
              aria-label="Close help"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 leading-none"
            >
              ×
            </button>
          </div>
          {moreInfo && (
            <div className="mt-3 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-right">
              <Link
                href={{ pathname: `/help/${moreInfo.section}` as Route, hash: moreInfo.anchor }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => setOpen(false)}
              >
                More info →
              </Link>
            </div>
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}

const POPOVER_WIDTH = 256; // matches w-64
const VIEWPORT_PADDING = 8;

function computePopoverStyle(rect: DOMRect | null): React.CSSProperties {
  if (!rect) return { visibility: 'hidden' };
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : POPOVER_WIDTH;
  // Default: align left edge with trigger, drop below. Flip leftward if it
  // would overflow the right viewport edge.
  let left = rect.left;
  if (left + POPOVER_WIDTH + VIEWPORT_PADDING > viewportW) {
    left = Math.max(VIEWPORT_PADDING, viewportW - POPOVER_WIDTH - VIEWPORT_PADDING);
  }
  return { top: rect.bottom + 8, left };
}
