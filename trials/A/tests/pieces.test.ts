import { describe, expect, it } from 'vitest';

import {
  getCells,
  kicksFor,
  normalizeRotation,
  PIECES,
  PIECE_TYPES,
  type Cell,
} from '../src/game/pieces';

function key(cells: readonly Cell[]): string {
  return [...cells]
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(' ');
}

describe('pieces', () => {
  it('defines exactly seven tetromino types', () => {
    expect(PIECE_TYPES).toHaveLength(7);
    expect(new Set(PIECE_TYPES).size).toBe(7);
  });

  it('gives every rotation state exactly four cells', () => {
    for (const type of PIECE_TYPES) {
      const definition = PIECES[type];
      expect(definition.rotations).toHaveLength(4);
      for (const rotation of definition.rotations) {
        expect(rotation).toHaveLength(4);
      }
    }
  });

  it('keeps cells inside the bounding box for every rotation', () => {
    for (const type of PIECE_TYPES) {
      const { boxSize, rotations } = PIECES[type];
      for (const rotation of rotations) {
        for (const [x, y] of rotation) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(boxSize);
          expect(y).toBeLessThan(boxSize);
        }
      }
    }
  });

  it('returns to the spawn shape after four clockwise rotations', () => {
    for (const type of PIECE_TYPES) {
      expect(key(getCells(type, 4, 0, 0))).toBe(key(getCells(type, 0, 0, 0)));
      expect(key(getCells(type, -1, 0, 0))).toBe(key(getCells(type, 3, 0, 0)));
    }
  });

  it('keeps the O piece identical in every rotation', () => {
    const spawn = key(getCells('O', 0, 0, 0));
    for (let rotation = 1; rotation < 4; rotation += 1) {
      expect(key(getCells('O', rotation, 0, 0))).toBe(spawn);
    }
  });

  it('normalises rotation indices', () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(4)).toBe(0);
    expect(normalizeRotation(-1)).toBe(3);
    expect(normalizeRotation(9)).toBe(1);
  });

  it('translates cells by the requested origin', () => {
    const at00 = getCells('T', 0, 0, 0);
    const at32 = getCells('T', 0, 3, 2);
    expect(at32).toEqual(at00.map(([x, y]) => [x + 3, y + 2]));
  });

  it('spawns pieces fully inside the visible field', () => {
    for (const type of PIECE_TYPES) {
      const { spawnOffsetX, spawnOffsetY } = PIECES[type];
      const cells = getCells(type, 0, spawnOffsetX, spawnOffsetY);
      expect(Math.min(...cells.map(([, y]) => y))).toBe(0);
      expect(Math.min(...cells.map(([x]) => x))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...cells.map(([x]) => x))).toBeLessThan(10);
    }
  });

  it('never offers wall kicks to the O piece', () => {
    expect(kicksFor('O', 0, 1)).toEqual([[0, 0]]);
    expect(kicksFor('O', 3, 0)).toEqual([[0, 0]]);
  });

  it('exposes five SRS candidates converted to screen coordinates', () => {
    // Published 0>1 data for J/L/S/T/Z is (0,0) (-1,0) (-1,+1) (0,-2) (-1,-2)
    // with y pointing up; on screen the vertical component flips sign.
    expect(kicksFor('T', 0, 1)).toEqual([
      [0, 0],
      [-1, 0],
      [-1, -1],
      [0, 2],
      [-1, 2],
    ]);
    expect(kicksFor('I', 0, 1)).toEqual([
      [0, 0],
      [-2, 0],
      [1, 0],
      [-2, 1],
      [1, -2],
    ]);
    for (const type of PIECE_TYPES) {
      if (type === 'O') continue;
      for (let from = 0; from < 4; from += 1) {
        for (const direction of [1, -1]) {
          const kicks = kicksFor(type, from, from + direction);
          expect(kicks).toHaveLength(5);
          expect(kicks[0]).toEqual([0, 0]);
        }
      }
    }
  });

  it('mirrors the kick table between opposite transitions', () => {
    // Negating zero would yield -0, which toEqual treats as a distinct value.
    const negate = (n: number): number => (n === 0 ? 0 : -n);
    for (const type of ['T', 'I'] as const) {
      for (let from = 0; from < 4; from += 1) {
        const to = (from + 1) % 4;
        const forward = kicksFor(type, from, to);
        const backward = kicksFor(type, to, from);
        for (let i = 1; i < forward.length; i += 1) {
          expect(backward[i]).toEqual([negate(forward[i][0]), negate(forward[i][1])]);
        }
      }
    }
  });
});
