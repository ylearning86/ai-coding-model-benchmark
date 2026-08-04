import { COLS, ROWS } from './constants';
import type { Cell, PieceType } from './pieces';

/** `null` means empty; otherwise the piece type that filled the cell. */
export type BoardCell = PieceType | null;
export type Board = readonly BoardCell[][];

export function createBoard(rows = ROWS, cols = COLS): BoardCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null as BoardCell));
}

export function cloneBoard(board: Board): BoardCell[][] {
  return board.map((row) => [...row]);
}

/**
 * Cells above the playfield (y < 0) are treated as free space so pieces can
 * spawn and rotate partly off-screen, matching the usual guideline behaviour.
 */
export function isBlocked(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= COLS) return true;
  if (y >= board.length) return true;
  if (y < 0) return false;
  return board[y][x] !== null;
}

export function collides(board: Board, cells: readonly Cell[]): boolean {
  return cells.some(([x, y]) => isBlocked(board, x, y));
}

/** Returns a new board with the given cells stamped in. Cells above the field are dropped. */
export function mergePiece(board: Board, type: PieceType, cells: readonly Cell[]): BoardCell[][] {
  const next = cloneBoard(board);
  for (const [x, y] of cells) {
    if (y < 0 || y >= next.length || x < 0 || x >= COLS) continue;
    next[y][x] = type;
  }
  return next;
}

export function findFullRows(board: Board): number[] {
  const rows: number[] = [];
  for (let y = 0; y < board.length; y += 1) {
    if (board[y].every((cell) => cell !== null)) rows.push(y);
  }
  return rows;
}

/** Removes rows and drops everything above them, keeping the board height stable. */
export function removeRows(board: Board, rows: readonly number[]): BoardCell[][] {
  if (rows.length === 0) return cloneBoard(board);
  const doomed = new Set(rows);
  const kept = board.filter((_, y) => !doomed.has(y)).map((row) => [...row]);
  const missing = board.length - kept.length;
  const fresh = Array.from({ length: missing }, () =>
    Array.from({ length: COLS }, () => null as BoardCell),
  );
  return [...fresh, ...kept];
}

/** Lowest y the piece can fall to from its current position (used for the ghost). */
export function dropDistance(
  board: Board,
  cells: readonly Cell[],
): number {
  let distance = 0;
  for (;;) {
    const moved = cells.map(([x, y]) => [x, y + distance + 1] as Cell);
    if (collides(board, moved)) return distance;
    distance += 1;
    if (distance > board.length + 4) return distance;
  }
}

/** Height of the tallest stack column, useful for HUD feedback and tests. */
export function stackHeight(board: Board): number {
  for (let y = 0; y < board.length; y += 1) {
    if (board[y].some((cell) => cell !== null)) return board.length - y;
  }
  return 0;
}
