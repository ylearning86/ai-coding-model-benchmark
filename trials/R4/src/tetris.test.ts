import { describe, it, expect } from "vitest";
import {
  createEmptyBoard,
  checkCollision,
  rotateMatrix,
  getGhostPosition,
  mergePiece,
  clearLines,
  calculateScore,
  getDropInterval,
  createPiece,
  generateBag,
  BOARD_WIDTH,
  BOARD_HEIGHT
} from "./tetris";

describe("Tetris Logic", () => {
  it("creates an empty board of size 10x20", () => {
    const board = createEmptyBoard();
    expect(board.length).toBe(20);
    expect(board[0].length).toBe(10);
    expect(board.every((row) => row.every((cell) => cell === ""))).toBe(true);
  });

  it("generates a 7-bag containing all 7 unique pieces", () => {
    const bag = generateBag();
    expect(bag.length).toBe(7);
    const unique = new Set(bag);
    expect(unique.size).toBe(7);
  });

  it("detects collision with left, right, and bottom walls", () => {
    const board = createEmptyBoard();
    const piece = createPiece("O"); // 2x2 piece at x=4, y=0

    expect(checkCollision(board, piece, -5, 0)).toBe(true);
    expect(checkCollision(board, piece, 5, 0)).toBe(true);
    expect(checkCollision(board, piece, 0, 19)).toBe(true);
    expect(checkCollision(board, piece, 0, 0)).toBe(false);
  });

  it("detects collision with existing blocks on the board", () => {
    const board = createEmptyBoard();
    board[10][4] = "#ffffff";
    const piece = createPiece("O");

    expect(checkCollision(board, piece, 0, 9)).toBe(true);
    expect(checkCollision(board, piece, 0, 5)).toBe(false);
  });

  it("rotates a 3x3 matrix clockwise correctly", () => {
    const matrix = [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ];
    const rotated = rotateMatrix(matrix);
    expect(rotated).toEqual([
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0]
    ]);
  });

  it("calculates the correct ghost position", () => {
    const board = createEmptyBoard();
    const piece = createPiece("I");
    const ghostY = getGhostPosition(board, piece);
    expect(ghostY).toBe(18);
  });

  it("merges a piece into the board", () => {
    const board = createEmptyBoard();
    const piece = createPiece("O");
    piece.y = 18;
    const merged = mergePiece(board, piece);

    expect(merged[18][4]).toBe(piece.color);
    expect(merged[18][5]).toBe(piece.color);
    expect(merged[19][4]).toBe(piece.color);
    expect(merged[19][5]).toBe(piece.color);
  });

  it("clears completed lines and updates board", () => {
    const board = createEmptyBoard();
    board[19] = Array(BOARD_WIDTH).fill("#ffffff");
    board[18] = Array(BOARD_WIDTH).fill("#ffffff");

    const { newBoard, clearedLines } = clearLines(board);
    expect(clearedLines).toBe(2);
    expect(newBoard.length).toBe(BOARD_HEIGHT);
    expect(newBoard[19].every((cell) => cell === "")).toBe(true);
  });

  it("calculates score based on lines cleared and level", () => {
    expect(calculateScore(1, 1)).toBe(100);
    expect(calculateScore(2, 1)).toBe(300);
    expect(calculateScore(3, 2)).toBe(1000);
    expect(calculateScore(4, 3)).toBe(3200);
  });

  it("calculates drop interval based on level", () => {
    expect(getDropInterval(1)).toBe(1000);
    expect(getDropInterval(5)).toBe(680);
    expect(getDropInterval(20)).toBe(100);
  });
});
