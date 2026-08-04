import { describe, expect, it } from 'vitest';

import { LINES_PER_LEVEL, MAX_LEVEL, MIN_GRAVITY_MS } from '../src/game/constants';
import {
  basePoints,
  gravityIntervalMs,
  hardDropPoints,
  isDifficultClear,
  levelForLines,
  scoreClear,
  softDropPoints,
} from '../src/game/scoring';

describe('scoring', () => {
  it('advances one level per ten lines and stops at the cap', () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(LINES_PER_LEVEL - 1)).toBe(1);
    expect(levelForLines(LINES_PER_LEVEL)).toBe(2);
    expect(levelForLines(LINES_PER_LEVEL * 4 + 3)).toBe(5);
    expect(levelForLines(LINES_PER_LEVEL * 999)).toBe(MAX_LEVEL);
  });

  it('makes gravity faster on every level and never faster than the floor', () => {
    let previous = Infinity;
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const interval = gravityIntervalMs(level);
      expect(interval).toBeLessThanOrEqual(previous);
      expect(interval).toBeGreaterThanOrEqual(MIN_GRAVITY_MS);
      previous = interval;
    }
    expect(gravityIntervalMs(1)).toBe(1000);
  });

  it('awards the standard base points per clear size', () => {
    expect(basePoints(0, 'none')).toBe(0);
    expect(basePoints(1, 'none')).toBe(100);
    expect(basePoints(2, 'none')).toBe(300);
    expect(basePoints(3, 'none')).toBe(500);
    expect(basePoints(4, 'none')).toBe(800);
  });

  it('awards more for spins than for plain clears', () => {
    expect(basePoints(0, 'tspin')).toBe(400);
    expect(basePoints(1, 'tspin')).toBe(800);
    expect(basePoints(2, 'tspin')).toBe(1200);
    expect(basePoints(1, 'tspin-mini')).toBe(200);
    expect(basePoints(1, 'tspin')).toBeGreaterThan(basePoints(1, 'none'));
  });

  it('marks quads and spins as difficult clears', () => {
    expect(isDifficultClear(4, 'none')).toBe(true);
    expect(isDifficultClear(1, 'tspin')).toBe(true);
    expect(isDifficultClear(1, 'tspin-mini')).toBe(true);
    expect(isDifficultClear(3, 'none')).toBe(false);
    expect(isDifficultClear(0, 'none')).toBe(false);
  });

  it('multiplies the base value by the current level', () => {
    const level1 = scoreClear({ lineCount: 2, spin: 'none', level: 1, combo: 0, backToBack: false });
    const level5 = scoreClear({ lineCount: 2, spin: 'none', level: 5, combo: 0, backToBack: false });
    expect(level1.points).toBe(300);
    expect(level5.points).toBe(1500);
  });

  it('adds the back-to-back bonus only to difficult clears', () => {
    const quad = scoreClear({ lineCount: 4, spin: 'none', level: 1, combo: 0, backToBack: true });
    const triple = scoreClear({ lineCount: 3, spin: 'none', level: 1, combo: 0, backToBack: true });
    expect(quad.points).toBe(1200);
    expect(quad.difficult).toBe(true);
    expect(triple.points).toBe(500);
    expect(triple.difficult).toBe(false);
  });

  it('adds a combo bonus that scales with the chain and the level', () => {
    const noCombo = scoreClear({ lineCount: 1, spin: 'none', level: 2, combo: 0, backToBack: false });
    const combo3 = scoreClear({ lineCount: 1, spin: 'none', level: 2, combo: 3, backToBack: false });
    expect(noCombo.points).toBe(200);
    expect(combo3.points).toBe(200 + 50 * 3 * 2);
  });

  it('builds a readable label for the HUD', () => {
    expect(scoreClear({ lineCount: 4, spin: 'none', level: 1, combo: 0, backToBack: false }).label).toBe('QUAD');
    expect(scoreClear({ lineCount: 2, spin: 'tspin', level: 1, combo: 0, backToBack: false }).label).toBe('T-SPIN DOUBLE');
    expect(scoreClear({ lineCount: 0, spin: 'tspin', level: 1, combo: 0, backToBack: false }).label).toBe('T-SPIN');
    expect(scoreClear({ lineCount: 4, spin: 'none', level: 1, combo: 0, backToBack: true }).label).toBe('B2B QUAD');
  });

  it('rewards drops per travelled cell', () => {
    expect(softDropPoints(0)).toBe(0);
    expect(softDropPoints(6)).toBe(6);
    expect(hardDropPoints(6)).toBe(12);
    expect(hardDropPoints(-2)).toBe(0);
  });
});
