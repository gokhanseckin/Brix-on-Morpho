import { createRng, gauss, type Rng } from './rng';

export type Path = number[]; // length = horizonDays + 1

export interface BootstrapArgs {
  returns: number[];
  S0: number;
  horizonDays: number;
  paths: number;
  seed: number | string;
}

export function bootstrapPaths(a: BootstrapArgs): Path[] {
  const rng = createRng(a.seed);
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    for (let t = 1; t <= a.horizonDays; t++) {
      const r = a.returns[Math.floor(rng() * a.returns.length)]!;
      s[t] = s[t - 1]! * Math.exp(r);
    }
    out.push(s);
  }
  return out;
}

export interface BlockBootstrapArgs extends BootstrapArgs {
  blockLength: number;
}

export function blockBootstrapPaths(a: BlockBootstrapArgs): Path[] {
  const rng = createRng(a.seed);
  const out: Path[] = [];
  for (let p = 0; p < a.paths; p++) {
    const s: number[] = new Array(a.horizonDays + 1);
    s[0] = a.S0;
    let t = 1;
    while (t <= a.horizonDays) {
      const start = Math.floor(rng() * Math.max(1, a.returns.length - a.blockLength));
      for (let b = 0; b < a.blockLength && t <= a.horizonDays; b++, t++) {
        const r = a.returns[start + b]!;
        s[t] = s[t - 1]! * Math.exp(r);
      }
    }
    out.push(s);
  }
  return out;
}
