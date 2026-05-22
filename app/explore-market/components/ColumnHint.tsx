'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_WIDTH = 288; // tailwind w-72

export function ColumnHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    let left = rect.right - TOOLTIP_WIDTH;
    if (left < margin) left = margin;
    if (left + TOOLTIP_WIDTH > window.innerWidth - margin) {
      left = window.innerWidth - TOOLTIP_WIDTH - margin;
    }
    setPos({ top: rect.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !tipRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Help for ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-600 text-[10px] leading-none text-neutral-400 hover:border-brix-accent hover:text-brix-accent"
      >
        ?
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <span
          ref={tipRef}
          id={id}
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: TOOLTIP_WIDTH }}
          className="z-50 rounded-md border border-brix-border bg-brix-bg p-3 text-left text-xs font-normal normal-case tracking-normal text-neutral-300 shadow-lg"
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
