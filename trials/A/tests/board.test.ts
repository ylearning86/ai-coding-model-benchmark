import { describe, expect, it } from 'vitest';

import {
  cloneBoard,
  collides,
  createBoard,
  dropDistance,
  findFullRows,
  isBlocked,
  mergePiece,
  removeRows,
  stackHeight,
  type BoardCell,
} from '../src/game/board';
import { COLS, ROWS } from '../src/game/constants';
import type { Cell } from '../src/game/pieces';

/** Builds a board from ASCII rows: `.` is empty, any other char is a block. */
function boardFrom(rows: readonly string[]): BoardCell[][] {
  const board = createBoard();
  rows.forEach((row, index) => {
    const y = ROWS - rows.length + index;
    for (let x = 0; x < COLS; x += 1) {
      board[y][x] = row[x] && row[x] !== '.' ? 'I' : null;
    }
  });
  return board;
}

describe('board', () => {
  it('creates an empty 10x20 field', () => {
    const board = createBoard();
    expect(board).toHaveLength(ROWS);
    expect(board[0]).toHaveLength(COLS);
    expect(board.every((row) => row.every((cell) => cell === null))).toBe(true);
  });

  it('clones without sharing row references', () => {
    const board = createBoard();
    const copy = cloneBoard(board);
    copy[0][0] = 'T';
    expect(board[0][0]).toBeNull();
  });

  it('treats the walls and the floor as blocked but allows the hidden rows above', () => {
    const board = createBoard();
    expect(isBlocked(board, -1, 5)).toBe(true);
    expect(isBlocked(board, COLS, 5)).toBe(true);
    expect(isBlocked(board, 0, ROWS)).toBe(true);
    expect(isBlocked(board, 0, -3)).toBe(false);
    expect(isBlocked(board, 0, 0)).toBe(false);
  });

  it('detects collisions against settled blocks', () => {
    const board = createBoard();
    board[10][4] = 'S';
    expect(collides(board, [[4, 10]])).toBe(true);
    expect(collides(board, [[4, 9]])).toBe(false);
    expect(collides(board, [[4, 9], [4, 10]])).toBe(true);
  });

  it('merges a piece without mutating the source board', () => {
    const board = createBoard();
    const cells: Cell[] = [
      [0, 19],
      [1, 19],
    ];
    const merged = mergePiece(board, 'Z', cells);
    expect(merged[19][0]).toBe('Z');
    expect(merged[19][1]).toBe('Z');
    expect(board[19][0]).toBeNull();
  });

  it('finds every complete row', () => {
    const board = boardFrom(['##########', '#########.', '##########']);
    expect(findFullRows(board)).toEqual([ROWS - 3, ROWS - 1]);
  });

  it('removes rows, keeps the height stable and drops the stack down', () => {
    const board = boardFrom(['....#.....', '##########']);
    const result = removeRows(board, [ROWS - 1]);
    expect(result).toHaveLength(ROWS);
    expect(result[ROWS - 1][4]).toBe('I');
    expect(result[ROWS - 2].every((cell) => cell === null)).toBe(true);
    expect(result[0].every((cell) => cell === null)).toBe(true);
  });

  it('returns a copy when nothing is cleared', () => {
    const board = createBoard();
    const result = removeRows(board, []);
    expect(result).not.toBe(board);
    expect(result).toEqual(board);
  });

  it('measures how far a piece can fall', () => {
    const board = createBoard();
    expect(dropDistance(board, [[0, 0]])).toBe(ROWS - 1);
    board[15][0] = 'L';
    expect(dropDistance(board, [[0, 0]])).toBe(14);
    expect(dropDistance(board, [[0, 14]])).toBe(0);
  });

  it('reports the tallest stack column', () => {
    expect(stackHeight(createBoard())).toBe(0);
    expect(stackHeight(boardFrom(['....#.....', '##########']))).toBe(2);
  });
});
