import { PIECE_TYPES, type PieceType } from './pieces';

/**
 * Small, fast, deterministic PRNG. A seeded generator keeps the game fair and
 * lets the test-suite assert exact piece sequences.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Classic 7-bag randomiser: every permutation of the seven pieces is dealt
 * before the bag is refilled, so droughts are bounded.
 */
export class BagRandomizer {
  private readonly random: () => number;
  private bag: PieceType[] = [];

  constructor(seed: number = (Math.random() * 0xffffffff) >>> 0) {
    this.random = mulberry32(seed);
  }

  next(): PieceType {
    if (this.bag.length === 0) this.bag = this.shuffledBag();
    return this.bag.pop()!;
  }

  take(count: number): PieceType[] {
    return Array.from({ length: count }, () => this.next());
  }

  private shuffledBag(): PieceType[] {
    const bag = [...PIECE_TYPES];
    // Fisher-Yates; we pop from the end, so the shuffle order is what matters.
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }
}
