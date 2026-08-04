import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NAME,
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  RankingStore,
  createMemoryStorage,
  normalizeEntry,
  sanitizeName,
  sortEntries,
  type ScoreEntry,
  type StorageLike,
} from '../src/ui/ranking';

function entry(partial: Partial<ScoreEntry> & { score: number }): ScoreEntry {
  return {
    name: 'PLAYER',
    lines: 0,
    level: 1,
    date: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

/** Storage that always throws, mimicking a blocked / quota-exceeded environment. */
function hostileStorage(): StorageLike {
  return {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
}

describe('sanitizeName', () => {
  it('falls back to the default name for non-strings', () => {
    expect(sanitizeName(null)).toBe(DEFAULT_NAME);
    expect(sanitizeName(undefined)).toBe(DEFAULT_NAME);
    expect(sanitizeName(42)).toBe(DEFAULT_NAME);
    expect(sanitizeName({ toString: () => 'nope' })).toBe(DEFAULT_NAME);
  });

  it('strips control characters and zero-width injections', () => {
    expect(sanitizeName('AB\u0000CD')).toBe('ABCD');
    expect(sanitizeName('AB\u200bCD')).toBe('ABCD');
    expect(sanitizeName('AB\u2028CD')).toBe('ABCD');
  });

  it('collapses whitespace and trims the result', () => {
    expect(sanitizeName('   sky    walker  ')).toBe('sky walker');
    // Newlines and tabs are control characters, so they are removed outright
    // before the remaining runs of spaces get collapsed.
    expect(sanitizeName('a\n\tb')).toBe('ab');
    expect(sanitizeName('a \n\t b')).toBe('a b');
  });

  it('caps the length', () => {
    expect(sanitizeName('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('ABCDEFGHIJKL');
    expect(sanitizeName('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toHaveLength(MAX_NAME_LENGTH);
  });

  it('uses the default name when nothing printable remains', () => {
    expect(sanitizeName('')).toBe(DEFAULT_NAME);
    expect(sanitizeName('    ')).toBe(DEFAULT_NAME);
    expect(sanitizeName('\u0000\u0001')).toBe(DEFAULT_NAME);
  });

  it('keeps markup-looking text verbatim as plain text', () => {
    // Sanitising must not silently rewrite characters; the UI renders with
    // textContent, so angle brackets can never become live markup.
    expect(sanitizeName('<b>hi</b>')).toBe('<b>hi</b>');
  });
});

describe('normalizeEntry', () => {
  it('rejects values that are not score-bearing objects', () => {
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry('1000')).toBeNull();
    expect(normalizeEntry(1000)).toBeNull();
    expect(normalizeEntry({ name: 'NO SCORE' })).toBeNull();
  });

  it('clamps numeric fields into safe ranges', () => {
    const normalized = normalizeEntry({
      name: 'X',
      score: 1e12,
      lines: -5,
      level: 0,
      date: '2026-01-01T00:00:00.000Z',
    });
    expect(normalized).toEqual({
      name: 'X',
      score: 99_999_999,
      lines: 0,
      level: 1,
      date: '2026-01-01T00:00:00.000Z',
    });
  });

  it('coerces string numbers and floors fractions', () => {
    const normalized = normalizeEntry({ score: '1234.9', lines: '42.7', level: '3.2' });
    expect(normalized?.score).toBe(1234);
    expect(normalized?.lines).toBe(42);
    expect(normalized?.level).toBe(3);
  });

  it('caps the level and rejects unusable dates', () => {
    const normalized = normalizeEntry({ score: 10, level: 500, date: 'not-a-date' });
    expect(normalized?.level).toBe(99);
    expect(normalized?.date).toBe('');
    expect(normalizeEntry({ score: 10, date: 12345 })?.date).toBe('');
  });

  it('sanitises the stored name', () => {
    expect(normalizeEntry({ score: 1, name: '  ev\u0000il  ' })?.name).toBe('evil');
    expect(normalizeEntry({ score: 1 })?.name).toBe(DEFAULT_NAME);
  });
});

describe('sortEntries', () => {
  it('orders by score, then lines, then oldest first', () => {
    const sorted = sortEntries([
      entry({ name: 'C', score: 100, lines: 5 }),
      entry({ name: 'A', score: 300, lines: 2 }),
      entry({ name: 'B', score: 300, lines: 9 }),
      entry({ name: 'D', score: 100, lines: 5, date: '2025-01-01T00:00:00.000Z' }),
    ]);
    expect(sorted.map((item) => item.name)).toEqual(['B', 'A', 'D', 'C']);
  });

  it('does not mutate the input array', () => {
    const input = [entry({ name: 'LOW', score: 1 }), entry({ name: 'HIGH', score: 9 })];
    sortEntries(input);
    expect(input.map((item) => item.name)).toEqual(['LOW', 'HIGH']);
  });
});

describe('RankingStore', () => {
  it('returns an empty table when nothing is stored', () => {
    const store = new RankingStore(createMemoryStorage());
    expect(store.load()).toEqual([]);
  });

  it('reports a 1-based rank for a submitted score', () => {
    const store = new RankingStore(createMemoryStorage());
    const first = store.submit({ name: 'ALPHA', score: 5000, lines: 12, level: 2 });
    expect(first.rank).toBe(1);
    expect(first.entries).toHaveLength(1);

    const second = store.submit({ name: 'BETA', score: 9000, lines: 20, level: 3 });
    expect(second.rank).toBe(1);
    expect(second.entries.map((item) => item.name)).toEqual(['BETA', 'ALPHA']);
  });

  it('keeps only the top entries', () => {
    const store = new RankingStore(createMemoryStorage());
    for (let i = 1; i <= MAX_ENTRIES + 5; i += 1) {
      store.submit({ name: `P${i}`, score: i * 100 });
    }
    const entries = store.load();
    expect(entries).toHaveLength(MAX_ENTRIES);
    expect(entries[0].score).toBe((MAX_ENTRIES + 5) * 100);
    expect(entries[entries.length - 1].score).toBe(6 * 100);
  });

  it('reports -1 when the score does not make the cut', () => {
    const store = new RankingStore(createMemoryStorage());
    for (let i = 1; i <= MAX_ENTRIES; i += 1) {
      store.submit({ name: `P${i}`, score: i * 1000 });
    }
    const result = store.submit({ name: 'TINY', score: 5 });
    expect(result.rank).toBe(-1);
    expect(result.entries.some((item) => item.name === 'TINY')).toBe(false);
  });

  it('sanitises submitted names before persisting them', () => {
    const store = new RankingStore(createMemoryStorage());
    const result = store.submit({ name: '  ha\u0000ck  er  ', score: 10 });
    expect(result.entries[0].name).toBe('hack er');
  });

  it('ignores malformed persisted payloads', () => {
    const storage = createMemoryStorage();
    const store = new RankingStore(storage, 'k', 'n');

    storage.setItem('k', 'not json at all');
    expect(store.load()).toEqual([]);

    storage.setItem('k', '{"not":"an array"}');
    expect(store.load()).toEqual([]);

    storage.setItem('k', '[null, 7, {"name":"OK","score":42}]');
    const entries = store.load();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: 'OK', score: 42, level: 1 });
  });

  it('clears the stored table', () => {
    const store = new RankingStore(createMemoryStorage());
    store.submit({ name: 'ALPHA', score: 1000 });
    expect(store.load()).toHaveLength(1);
    store.clear();
    expect(store.load()).toEqual([]);
  });

  it('round-trips the nickname', () => {
    const store = new RankingStore(createMemoryStorage());
    expect(store.loadName()).toBe('');
    expect(store.saveName('  Aurora  ')).toBe('Aurora');
    expect(store.loadName()).toBe('Aurora');
    expect(store.saveName('   ')).toBe(DEFAULT_NAME);
    expect(store.loadName()).toBe(DEFAULT_NAME);
  });

  it('survives a storage backend that throws', () => {
    const store = new RankingStore(hostileStorage());
    expect(store.load()).toEqual([]);
    expect(() => store.clear()).not.toThrow();
    expect(store.loadName()).toBe('');
    expect(store.saveName('ALPHA')).toBe('ALPHA');
    const result = store.submit({ name: 'ALPHA', score: 100 });
    expect(result.entries[0].name).toBe('ALPHA');
  });
});
