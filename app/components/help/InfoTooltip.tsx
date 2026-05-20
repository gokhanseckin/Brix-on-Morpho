'use client';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * Sidebar param help. Click to open, ESC or click-outside to close.
 * Visually + behaviorally matches HelpPopover (the body `?` button) so the
 * two interactions feel like the same thing at different granularities.
 */
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

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
      const dlg = document.getElementById(id);
      if (dlg && !dlg.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, id]);

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
      {open && (
        <div
          id={id}
          role="dialog"
          aria-modal="false"
          className="absolute left-0 z-50 mt-2 w-64 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-xs shadow-xl normal-case tracking-normal"
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
        </div>
      )}
    </span>
  );
}
