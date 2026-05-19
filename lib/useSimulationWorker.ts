'use client';
import { useEffect, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { WorkerApi, WorkerInput, WorkerOutput } from './simulation.worker';

export function useSimulationWorker() {
  const ref = useRef<Comlink.Remote<WorkerApi> | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkerOutput | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
    ref.current = Comlink.wrap<WorkerApi>(w);
    return () => {
      w.terminate();
      ref.current = null;
    };
  }, []);

  async function run(input: WorkerInput) {
    if (!ref.current) return;
    setRunning(true);
    try {
      const out = await ref.current.run(input);
      setResult(out);
    } finally {
      setRunning(false);
    }
  }

  return { running, result, run };
}
