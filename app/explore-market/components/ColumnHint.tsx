'use client';
import { useEffect, useId, useRef, useState } from 'react';

export function ColumnHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center gap-1">
      {label}
      <button
        type="button"
        aria-label={`Help for ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-600 text-[10px] leading-none text-neutral-400 hover:border-brix-accent hover:text-brix-accent"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-30 top-full right-0 mt-2 w-72 rounded-md border border-brix-border bg-brix-bg p-3 text-left text-xs font-normal normal-case tracking-normal text-neutral-300 shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
