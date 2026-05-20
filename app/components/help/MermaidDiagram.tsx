'use client';
import { useEffect, useId, useRef, useState } from 'react';

export function MermaidDiagram({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        const { svg } = await mermaid.render(`mermaid-${id}`, source);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return (
      <pre className="font-mono text-xs text-red-600 whitespace-pre-wrap border border-red-200 rounded p-2">
        mermaid error: {error}
      </pre>
    );
  }
  return <div ref={ref} className="not-prose" />;
}
