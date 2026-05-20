'use client';
import dynamic from 'next/dynamic';

// react-katex's BlockMath, lazy-loaded so it never enters the dashboard bundle.
// SSR off — KaTeX renders to DOM in client only, which is fine for a static export.
const BlockMath = dynamic(
  () => import('react-katex').then((m) => m.BlockMath),
  { ssr: false, loading: () => <span className="font-mono text-xs">loading math…</span> },
);

import 'katex/dist/katex.min.css';

export function KatexBlock({ latex, fallback }: { latex?: string; fallback: string }) {
  if (!latex) {
    return (
      <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-full">
        {fallback}
      </pre>
    );
  }
  // KaTeX renders math as a single inline-block. In narrow containers (the
  // popover is ~380px) wide formulas would push the parent and create a
  // horizontal scrollbar on the whole popover. Wrap so the formula itself
  // scrolls horizontally instead — the rest of the popover stays within
  // the container width.
  return (
    <div className="max-w-full overflow-x-auto overflow-y-hidden">
      <BlockMath math={latex} />
    </div>
  );
}
