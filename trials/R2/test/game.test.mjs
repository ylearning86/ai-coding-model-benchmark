import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockGame, COLS, ROWS, SHAPES, createBoard, rotateMatrix, clearCompleteLines } from '../src/game.js';

test('board is 10 by 20 and initially empty', () => {
  const board = createBoard();
  assert.equal(board.length, ROWS);
  assert.ok(board.every(row => row.length === COLS && row.every(cell => cell === null)));
});

test('all seven tetrominoes contain four blocks', () => {
  assert.equal(Object.keys(SHAPES).length, 7);
  for (const shape of Object.values(SHAPES)) {
    assert.equal(shape.flat().filter(Boolean).length, 4);
  }
});

test('matrix rotation is clockwise', () => {
  assert.deepEqual(rotateMatrix([[1, 0], [1, 1]]), [[1, 1], [1, 0]]);
});

test('complete lines are removed and replaced at top', () => {
  const board = createBoard();
  board[18] = Array(COLS).fill('I');
  board[19] = Array(COLS).fill('O');
  const result = clearCompleteLines(board);
  assert.equal(result.cleared, 2);
  assert.ok(result.board[0].every(cell => cell === null));
  assert.equal(result.board.length, ROWS);
});

test('piece cannot leave horizontal bounds', () => {
  const game = new BlockGame(() => 0);
  while (game.move(-1, 0)) {}
  assert.equal(game.move(-1, 0), false);
  while (game.move(1, 0)) {}
  assert.equal(game.move(1, 0), false);
});

test('hard drop locks four cells and awards distance points', () => {
  const game = new BlockGame(() => 0);
  const distance = game.hardDrop();
  assert.ok(distance > 0);
  assert.equal(game.board.flat().filter(Boolean).length, 4);
  assert.ok(game.score >= distance * 2);
});

test('soft drop awards one point', () => {
  const game = new BlockGame(() => 0);
  assert.equal(game.stepDown(true), true);
  assert.equal(game.score, 1);
});

test('hold stores active piece and is limited to once per lock', () => {
  const game = new BlockGame(() => 0);
  const first = game.active.type;
  assert.equal(game.hold(), true);
  assert.equal(game.holdType, first);
  assert.equal(game.hold(), false);
  game.hardDrop();
  assert.equal(game.canHold, true);
});

test('ghost position is the last valid row', () => {
  const game = new BlockGame(() => 0);
  const ghostY = game.getGhostY();
  assert.equal(game.collides(game.active, game.active.x, ghostY), false);
  assert.equal(game.collides(game.active, game.active.x, ghostY + 1), true);
});

test('clearing one line updates score, lines, and level', () => {
  const game = new BlockGame(() => 0);
  game.board[19] = Array(COLS).fill('J');
  game.board[19][4] = null;
  game.board[19][5] = null;
  game.active = game.makePiece('O');
  game.active.x = 4;
  game.active.y = 18;
  game.lock();
  assert.equal(game.lines, 1);
  assert.equal(game.score, 100);
  assert.equal(game.level, 1);
});

test('level increases every ten cleared lines', () => {
  const game = new BlockGame(() => 0);
  game.lines = 9;
  game.board[19] = Array(COLS).fill('T');
  game.board[19][4] = null;
  game.board[19][5] = null;
  game.active = game.makePiece('O');
  game.active.x = 4;
  game.active.y = 18;
  game.lock();
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
});

test('pause blocks movement and can resume', () => {
  const game = new BlockGame(() => 0);
  const x = game.active.x;
  assert.equal(game.togglePause(), true);
  assert.equal(game.move(1, 0), false);
  assert.equal(game.active.x, x);
  assert.equal(game.togglePause(), false);
});