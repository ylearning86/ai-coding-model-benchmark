/**
 * Local leaderboard persistence.
 *
 * Everything read back from storage is treated as untrusted input: the payload
 * is parsed defensively, every field is validated and clamped, and names are
 * stripped of control characters. Rendering always uses `textContent`, so no
 * stored value can ever be interpreted as markup.
 */

export interface ScoreEntry {
  name: string;
  score: number;
  lines: number;
  level: number;
  /** ISO-8601 timestamp, or an empty string when unknown. */
  date: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const MAX_ENTRIES = 10;
export const MAX_NAME_LENGTH = 12;
export const DEFAULT_NAME = 'PLAYER';
export const STORAGE_KEY = 'prismfall.leaderboard.v1';
export const NAME_KEY = 'prismfall.nickname.v1';

// Stripping control characters is the entire point of this pattern.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g;

/** Normalises arbitrary input into a short, printable nickname. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_NAME;
  const cleaned = raw
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : DEFAULT_NAME;
}

function toCount(value: unknown, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.floor(n));
}

function toDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const time = Date.parse(value);
  return Number.isNaN(time) ? '' : new Date(time).toISOString();
}

const MAX_SCORE = 99_999_999;
const MAX_LINES = 999_999;
const MAX_LEVEL = 99;

export function normalizeEntry(raw: unknown): ScoreEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  if (!('score' in source)) return null;
  return {
    name: sanitizeName(source.name),
    score: toCount(source.score, MAX_SCORE),
    lines: toCount(source.lines, MAX_LINES),
    level: Math.max(1, toCount(source.level, MAX_LEVEL)),
    date: toDate(source.date),
  };
}

export function sortEntries(entries: readonly ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.lines !== a.lines) return b.lines - a.lines;
    return a.date.localeCompare(b.date);
  });
}

/** In-memory fallback used when storage is unavailable (e.g. private mode). */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

export function resolveStorage(): StorageLike {
  try {
    const probe = '__prismfall_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

export interface SubmitResult {
  entries: ScoreEntry[];
  /** 1-based position in the table, or -1 when the score did not make the cut. */
  rank: number;
}

export class RankingStore {
  private readonly storage: StorageLike;
  private readonly key: string;
  private readonly nameKey: string;

  constructor(storage: StorageLike = resolveStorage(), key = STORAGE_KEY, nameKey = NAME_KEY) {
    this.storage = storage;
    this.key = key;
    this.nameKey = nameKey;
  }

  load(): ScoreEntry[] {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return [];
    }
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const entries = parsed
      .map(normalizeEntry)
      .filter((entry): entry is ScoreEntry => entry !== null);
    return sortEntries(entries).slice(0, MAX_ENTRIES);
  }

  save(entries: readonly ScoreEntry[]): ScoreEntry[] {
    const trimmed = sortEntries(entries.map((entry) => normalizeEntry(entry)!)).slice(0, MAX_ENTRIES);
    try {
      this.storage.setItem(this.key, JSON.stringify(trimmed));
    } catch {
      // Storage full or blocked: the session simply continues without history.
    }
    return trimmed;
  }

  submit(entry: Partial<ScoreEntry> & { score: number }): SubmitResult {
    const normalized = normalizeEntry({ date: new Date().toISOString(), ...entry })!;
    const merged = sortEntries([...this.load(), normalized]).slice(0, MAX_ENTRIES);
    const saved = this.save(merged);
    const rank = saved.findIndex(
      (candidate) =>
        candidate.score === normalized.score &&
        candidate.name === normalized.name &&
        candidate.date === normalized.date,
    );
    return { entries: saved, rank: rank === -1 ? -1 : rank + 1 };
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Ignore: clearing is a convenience, never a requirement.
    }
  }

  loadName(): string {
    try {
      const stored = this.storage.getItem(this.nameKey);
      return stored === null ? '' : sanitizeName(stored);
    } catch {
      return '';
    }
  }

  saveName(name: string): string {
    const clean = sanitizeName(name);
    try {
      this.storage.setItem(this.nameKey, clean);
    } catch {
      // Ignore.
    }
    return clean;
  }
}
