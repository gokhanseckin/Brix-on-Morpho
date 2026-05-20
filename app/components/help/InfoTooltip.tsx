'use client';
import { useId, useState } from 'react';

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        aria-label="More info"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 text-[10px] leading-none text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        ⓘ
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 z-50 mt-1 w-64 -translate-x-1/2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-xs shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
