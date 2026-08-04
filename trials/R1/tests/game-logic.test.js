import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  getGhostY,
  hardDrop,
  holdPiece,
  movePiece,
  rotatePiece,
  softDrop,
  stepGame,
  togglePause,
} from '../src/game-logic.js';

test('moving a piece updates its x position when space is free', () => {
  const state = createInitialState();
  const moved = movePiece(state, 1);
  assert.equal(moved.currentPiece.x, state.currentPiece.x + 1);
});

test('rotating a piece returns a valid state without crashing', () => {
  const state = createInitialState();
  const rotated = rotatePiece(state);
  assert.ok(rotated.currentPiece.matrix.length > 0);
});

test('soft drop advances the piece and adds score', () => {
  const state = createInitialState();
  const dropped = softDrop(state);
  assert.equal(dropped.currentPiece.y, state.currentPiece.y + 1);
  assert.equal(dropped.score, state.score + 1);
});

test('hard drop lands the piece and updates the board', () => {
  const state = createInitialState();
  const dropped = hardDrop(state);
  assert.ok(dropped.board.some((row) => row.some(Boolean)) || dropped.gameOver);
});

test('hold swaps the active piece and disables immediate re-hold', () => {
  const state = createInitialState();
  const held = holdPiece(state);
  assert.equal(held.canHold, false);
  assert.ok(held.holdPiece);
});

test('ghost y is computed from the current board state', () => {
  const state = createInitialState();
  const ghostY = getGhostY(state.board, state.currentPiece);
  assert.equal(typeof ghostY, 'number');
});

test('pause toggles the game status', () => {
  const state = createInitialState();
  const paused = togglePause(state);
  assert.equal(paused.status, 'paused');
  const resumed = togglePause(paused);
  assert.equal(resumed.status, 'playing');
});

test('step game advances the piece downward', () => {
  const state = createInitialState();
  const stepped = stepGame(state);
  assert.equal(stepped.currentPiece.y, state.currentPiece.y + 1);
});
