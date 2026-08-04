import { LINES_PER_LEVEL, MAX_LEVEL, MIN_GRAVITY_MS } from './constants';

/** How a placement was achieved, which changes both the score and the label. */
export type SpinKind = 'none' | 'tspin' | 'tspin-mini';

/** Base points for 0-4 cleared lines (index = line count). */
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
export const TSPIN_SCORES = [400, 800, 1200, 1600] as const;
export const TSPIN_MINI_SCORES = [100, 200, 400, 400] as const;

const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'] as const;

export function levelForLines(lines: number): number {
  const safe = Number.isFinite(lines) && lines > 0 ? Math.floor(lines) : 0;
  return Math.min(MAX_LEVEL, Math.floor(safe / LINES_PER_LEVEL) + 1);
}

/** Milliseconds a piece takes to fall one cell at the given level. */
export function gravityIntervalMs(level: number): number {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  const seconds = Math.pow(0.8 - (clamped - 1) * 0.007, clamped - 1);
  return Math.max(MIN_GRAVITY_MS, Math.round(seconds * 1000));
}

export function basePoints(lineCount: number, spin: SpinKind): number {
  const n = Math.max(0, Math.min(4, Math.floor(lineCount)));
  if (spin === 'tspin') return TSPIN_SCORES[Math.min(n, 3)];
  if (spin === 'tspin-mini') return TSPIN_MINI_SCORES[Math.min(n, 3)];
  return LINE_SCORES[n];
}

/** A clear is "difficult" (and therefore back-to-back eligible) if it is a quad or a spin. */
export function isDifficultClear(lineCount: number, spin: SpinKind): boolean {
  return lineCount === 4 || (spin !== 'none' && lineCount > 0);
}

export interface ClearScore {
  points: number;
  label: string;
  difficult: boolean;
}

/**
 * Points for a placement, including the back-to-back bonus and combo chain.
 * `combo` is the number of *consecutive* clears before this one (0 = first).
 */
export function scoreClear(options: {
  lineCount: number;
  spin: SpinKind;
  level: number;
  combo: number;
  backToBack: boolean;
}): ClearScore {
  const { lineCount, spin, level, combo, backToBack } = options;
  const safeLevel = Math.max(1, Math.floor(level));
  const difficult = isDifficultClear(lineCount, spin);
  let points = basePoints(lineCount, spin) * safeLevel;
  if (difficult && backToBack) points = Math.floor(points * 1.5);
  if (lineCount > 0 && combo > 0) points += 50 * combo * safeLevel;

  const parts: string[] = [];
  if (spin === 'tspin') parts.push('T-SPIN');
  if (spin === 'tspin-mini') parts.push('T-SPIN MINI');
  if (lineCount > 0) parts.push(CLEAR_NAMES[Math.min(4, lineCount)]);
  if (difficult && backToBack) parts.unshift('B2B');

  return { points, label: parts.join(' ').trim(), difficult };
}

export function softDropPoints(cells: number): number {
  return Math.max(0, Math.floor(cells));
}

export function hardDropPoints(cells: number): number {
  return Math.max(0, Math.floor(cells)) * 2;
}
