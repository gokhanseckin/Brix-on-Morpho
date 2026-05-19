import seedrandom from 'seedrandom';

export type Rng = () => number;

export function createRng(seed: string | number): Rng {
  return seedrandom(String(seed));
}

/** Box–Muller standard normal. */
export function gauss(rng: Rng): number {
  const u1 = 1 - rng(); // (0,1]
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
