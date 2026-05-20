'use client';
import { useSimulator } from '@/lib/useSimulator';
import type { KpiHelp } from '@/lib/help/types';

// In PR #1 this is a stub: it renders the description + the step expressions
// verbatim. Section PRs will use `useSimulator()` to substitute live values
// into each step expression. The useSimulator() import stays here so the wiring
// is in place; just unused for now.
export function WorkedExample({ example }: { example: NonNullable<KpiHelp['workedExample']> }) {
  void useSimulator(); // wire is here for PR #2+
  return (
    <div className="text-sm space-y-2">
      <p className="text-neutral-700 dark:text-neutral-300">{example.description}</p>
      <ol className="list-decimal list-inside space-y-1 font-mono text-xs">
        {example.steps.map((s, i) => (
          <li key={i}>
            <span className="text-neutral-500">{s.label}:</span> {s.expression}
          </li>
        ))}
      </ol>
    </div>
  );
}
