import { describe, expect, it } from 'vitest';

import { BagRandomizer, mulberry32 } from '../src/game/rng';
import { PIECE_TYPES } from '../src/game/pieces';

describe('rng', () => {
  it('produces a deterministic stream for a given seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const first = Array.from({ length: 8 }, () => a());
    const second = Array.from({ length: 8 }, () => b());
    expect(first).toEqual(second);
  });

  it('stays inside [0, 1)', () => {
    const random = mulberry32(99);
    for (let i = 0; i < 200; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 5 }, mulberry32(1));
    const b = Array.from({ length: 5 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });
});

describe('BagRandomizer', () => {
  it('deals every piece exactly once per bag of seven', () => {
    const bag = new BagRandomizer(7);
    for (let round = 0; round < 20; round += 1) {
      const drawn = bag.take(7);
      expect(drawn).toHaveLength(7);
      expect(new Set(drawn).size).toBe(7);
      for (const type of PIECE_TYPES) {
        expect(drawn).toContain(type);
      }
    }
  });

  it('repeats the same order for the same seed', () => {
    const a = new BagRandomizer(2024).take(21);
    const b = new BagRandomizer(2024).take(21);
    expect(a).toEqual(b);
  });

  it('shuffles: two different seeds rarely agree', () => {
    const a = new BagRandomizer(11).take(28).join('');
    const b = new BagRandomizer(12).take(28).join('');
    expect(a).not.toBe(b);
  });

  it('never repeats a type more than twice in a row across bag borders', () => {
    const drawn = new BagRandomizer(31).take(70);
    for (let i = 2; i < drawn.length; i += 1) {
      expect(drawn[i] === drawn[i - 1] && drawn[i - 1] === drawn[i - 2]).toBe(false);
    }
  });
});
