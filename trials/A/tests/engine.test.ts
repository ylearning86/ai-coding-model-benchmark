import { beforeEach, describe, expect, it } from 'vitest';

import { createBoard, type BoardCell } from '../src/game/board';
import { COLS, LOCK_DELAY_MS, ROWS } from '../src/game/constants';
import { Engine, type GameEvent } from '../src/game/engine';
import type { PieceType } from '../src/game/pieces';

const SEED = 20260804;

function emptyBoard(): BoardCell[][] {
  return createBoard();
}

function fullBoard(): BoardCell[][] {
  return createBoard().map((row) => row.map(() => 'I' as BoardCell));
}

function fill(board: BoardCell[][], y: number, columns: readonly number[], type: PieceType = 'J'): void {
  for (const x of columns) board[y][x] = type;
}

function kinds(events: readonly GameEvent[]): string[] {
  return events.map((event) => event.kind);
}

/** Advances the engine in chunks so the internal 250 ms clamp never swallows time. */
function advance(engine: Engine, ms: number): GameEvent[] {
  const events: GameEvent[] = [];
  let left = ms;
  while (left > 0) {
    const slice = Math.min(200, left);
    events.push(...engine.tick(slice));
    left -= slice;
  }
  return events;
}

describe('Engine lifecycle', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ seed: SEED });
  });

  it('starts idle and switches to playing', () => {
    expect(engine.status).toBe('ready');
    engine.start(SEED);
    expect(engine.status).toBe('playing');
    expect(engine.getActive()).not.toBeNull();
    expect(engine.getNext()).toHaveLength(3);
    expect(engine.score).toBe(0);
    expect(engine.lines).toBe(0);
    expect(engine.level).toBe(1);
  });

  it('replays identically for the same seed', () => {
    const a = new Engine({ seed: 42 });
    const b = new Engine({ seed: 42 });
    a.start(42);
    b.start(42);
    expect(a.getActive()?.type).toBe(b.getActive()?.type);
    expect(a.getNext()).toEqual(b.getNext());
  });

  it('pauses, blocks input, then resumes', () => {
    engine.start(SEED);
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: -1 });
    expect(engine.pause()).toBe(true);
    expect(engine.status).toBe('paused');
    expect(engine.tick(1000)).toEqual([]);
    expect(engine.moveLeft()).toBe(false);
    expect(engine.getActive()?.x).toBe(3);
    expect(engine.resume()).toBe(true);
    expect(engine.status).toBe('playing');
    expect(engine.togglePause()).toBe(true);
    expect(engine.status).toBe('paused');
  });

  it('restarts back to a clean state', () => {
    engine.start(SEED);
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: -1 });
    engine.hardDrop();
    expect(engine.score).toBeGreaterThan(0);
    engine.restart(SEED);
    expect(engine.score).toBe(0);
    expect(engine.lines).toBe(0);
    expect(engine.piecesPlaced).toBe(0);
    expect(engine.status).toBe('playing');
    expect(engine.getBoard().every((row) => row.every((cell) => cell === null))).toBe(true);
  });

  it('ends the game when a new piece cannot spawn', () => {
    engine.start(SEED);
    engine.setBoardForTesting(fullBoard());
    engine.setActiveForTesting(null);
    const events = engine.tick(16);
    expect(kinds(events)).toContain('gameover');
    expect(engine.status).toBe('gameover');
    expect(engine.tick(1000)).toEqual([]);
  });
});

describe('Engine movement', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ seed: SEED });
    engine.start(SEED);
    engine.setBoardForTesting(emptyBoard());
  });

  it('moves left and right inside the walls', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: -1 });
    expect(engine.moveLeft()).toBe(true);
    expect(engine.getActive()?.x).toBe(2);
    expect(engine.moveRight()).toBe(true);
    expect(engine.getActive()?.x).toBe(3);
  });

  it('refuses to move through the left wall', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 0, y: -1 });
    expect(engine.moveLeft()).toBe(false);
    expect(engine.getActive()?.x).toBe(0);
  });

  it('refuses to move through the right wall', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: COLS - 4, y: -1 });
    expect(engine.moveRight()).toBe(false);
    expect(engine.getActive()?.x).toBe(COLS - 4);
  });

  it('applies gravity once per interval at level 1', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: -1 });
    advance(engine, 900);
    expect(engine.getActive()?.y).toBe(-1);
    advance(engine, 200);
    expect(engine.getActive()?.y).toBe(0);
  });

  it('scores one point per cell while soft dropping', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: -1 });
    engine.setSoftDrop(true);
    expect(engine.isSoftDropping()).toBe(true);
    engine.tick(210);
    expect(engine.getActive()!.y).toBeGreaterThan(-1);
    expect(engine.score).toBe(engine.getActive()!.y + 1);
    engine.setSoftDrop(false);
    expect(engine.isSoftDropping()).toBe(false);
  });

  it('hard drops to the floor, scores two per cell and locks', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: -1 });
    const events = engine.hardDrop();
    expect(kinds(events)).toContain('harddrop');
    expect(kinds(events)).toContain('lock');
    expect(engine.score).toBe((ROWS - 1) * 2);
    expect(engine.piecesPlaced).toBe(1);
    const board = engine.getBoard();
    expect(board[ROWS - 1].slice(3, 7).every((cell) => cell === 'I')).toBe(true);
  });

  it('reports the ghost landing position', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: -1 });
    expect(engine.getGhostY()).toBe(ROWS - 2);
    engine.setActiveForTesting(null);
    expect(engine.getGhostY()).toBeNull();
  });

  it('waits for the lock delay before settling a grounded piece', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: ROWS - 2 });
    advance(engine, LOCK_DELAY_MS - 100);
    expect(engine.piecesPlaced).toBe(0);
    advance(engine, 200);
    expect(engine.piecesPlaced).toBe(1);
  });
});

describe('Engine rotation', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ seed: SEED });
    engine.start(SEED);
    engine.setBoardForTesting(emptyBoard());
  });

  it('rotates freely in open space', () => {
    engine.setActiveForTesting({ type: 'T', rotation: 0, x: 3, y: 5 });
    const events = engine.rotateCW();
    expect(events).toEqual([{ kind: 'rotate', success: true }]);
    expect(engine.getActive()?.rotation).toBe(1);
    engine.rotateCCW();
    expect(engine.getActive()?.rotation).toBe(0);
  });

  it('never rotates the O piece', () => {
    engine.setActiveForTesting({ type: 'O', rotation: 0, x: 4, y: 5 });
    expect(engine.rotateCW()).toEqual([{ kind: 'rotate', success: false }]);
    expect(engine.getActive()?.rotation).toBe(0);
  });

  it('kicks the I piece away from the left wall', () => {
    engine.setActiveForTesting({ type: 'I', rotation: 1, x: -2, y: 5 });
    const events = engine.rotateCW();
    expect(events).toEqual([{ kind: 'rotate', success: true }]);
    const active = engine.getActive()!;
    expect(active.rotation).toBe(2);
    expect(active.x).toBe(0);
  });

  it('fails to rotate when every candidate is blocked', () => {
    const board = emptyBoard();
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        board[y][x] = 'S';
      }
    }
    // A one-row-tall pocket: the flat I piece fits, but no vertical variant does.
    for (let x = 3; x <= 6; x += 1) board[6][x] = null;
    engine.setBoardForTesting(board);
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 3, y: 5 });
    expect(engine.rotateCW()).toEqual([{ kind: 'rotate', success: false }]);
    expect(engine.getActive()?.rotation).toBe(0);
  });
});

describe('Engine hold', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ seed: SEED });
    engine.start(SEED);
    engine.setBoardForTesting(emptyBoard());
  });

  it('stores the current piece and pulls the next one', () => {
    const current = engine.getActive()!.type;
    const upcoming = engine.getNext()[0];
    const events = engine.hold();
    expect(kinds(events)).toContain('hold');
    expect(engine.getHold()).toBe(current);
    expect(engine.getActive()?.type).toBe(upcoming);
  });

  it('allows only one hold per placement', () => {
    engine.hold();
    const held = engine.getHold();
    const active = engine.getActive()!.type;
    expect(engine.hold()).toEqual([]);
    expect(engine.getHold()).toBe(held);
    expect(engine.getActive()?.type).toBe(active);
  });

  it('re-enables hold after the piece locks', () => {
    engine.hold();
    expect(engine.getView().holdUsed).toBe(true);
    engine.hardDrop();
    expect(engine.getView().holdUsed).toBe(false);
    expect(engine.hold()).not.toEqual([]);
  });

  it('swaps with the stored piece on the second hold', () => {
    const first = engine.getActive()!.type;
    engine.hold();
    const second = engine.getActive()!.type;
    engine.hardDrop();
    engine.setActiveForTesting({ type: 'T', rotation: 0, x: 3, y: 0 });
    engine.hold();
    expect(engine.getActive()?.type).toBe(first);
    expect(engine.getHold()).toBe('T');
    expect(second).toBeDefined();
  });
});

describe('Engine line clears', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ seed: SEED });
    engine.start(SEED);
  });

  it('clears a completed row and collapses the stack', () => {
    const board = emptyBoard();
    fill(board, ROWS - 1, [4, 5, 6, 7, 8, 9]);
    board[ROWS - 2][9] = 'L';
    engine.setBoardForTesting(board);
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 0, y: -1 });

    const events = engine.hardDrop();
    const clear = events.find((event) => event.kind === 'clear');
    expect(clear).toBeDefined();
    if (clear?.kind === 'clear') {
      expect(clear.lineCount).toBe(1);
      expect(clear.rows).toEqual([ROWS - 1]);
      expect(clear.label).toBe('SINGLE');
      expect(clear.points).toBeGreaterThan(0);
    }
    expect(engine.lines).toBe(1);
    expect(engine.getView().clearing).not.toBeNull();

    advance(engine, 400);
    expect(engine.getView().clearing).toBeNull();
    expect(engine.getBoard()[ROWS - 1][9]).toBe('L');
    expect(engine.getBoard()[ROWS - 1][0]).toBeNull();
  });

  it('clears four rows at once and flags back-to-back', () => {
    const board = emptyBoard();
    for (let y = ROWS - 4; y < ROWS; y += 1) {
      fill(board, y, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
    engine.setBoardForTesting(board);
    engine.setActiveForTesting({ type: 'I', rotation: 1, x: 7, y: ROWS - 4 });

    const events = engine.hardDrop();
    const clear = events.find((event) => event.kind === 'clear');
    expect(clear?.kind === 'clear' && clear.lineCount).toBe(4);
    expect(clear?.kind === 'clear' && clear.label).toBe('QUAD');
    expect(engine.lines).toBe(4);
    expect(engine.getView().backToBack).toBe(true);
  });

  it('raises the level every ten lines', () => {
    const board = emptyBoard();
    for (let y = ROWS - 4; y < ROWS; y += 1) {
      fill(board, y, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
    engine.setBoardForTesting(board);
    engine.setActiveForTesting({ type: 'I', rotation: 1, x: 7, y: ROWS - 4 });
    engine.hardDrop();
    expect(engine.level).toBe(1);

    advance(engine, 400);
    const board2 = emptyBoard();
    for (let y = ROWS - 4; y < ROWS; y += 1) {
      fill(board2, y, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
    engine.setBoardForTesting(board2);
    engine.setActiveForTesting({ type: 'I', rotation: 1, x: 7, y: ROWS - 4 });
    engine.hardDrop();
    expect(engine.lines).toBe(8);

    advance(engine, 400);
    const board3 = emptyBoard();
    for (let y = ROWS - 2; y < ROWS; y += 1) {
      fill(board3, y, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
    engine.setBoardForTesting(board3);
    engine.setActiveForTesting({ type: 'I', rotation: 1, x: 7, y: ROWS - 4 });
    engine.hardDrop();
    expect(engine.lines).toBe(10);
    expect(engine.level).toBe(2);
  });

  it('builds a combo across consecutive clears and resets it on a dry placement', () => {
    const setup = (): void => {
      const board = emptyBoard();
      fill(board, ROWS - 1, [0, 1, 2, 3, 4, 5]);
      engine.setBoardForTesting(board);
      engine.setActiveForTesting({ type: 'I', rotation: 0, x: 6, y: -1 });
    };

    setup();
    engine.hardDrop();
    expect(engine.combo).toBe(0);
    advance(engine, 400);

    setup();
    engine.hardDrop();
    expect(engine.combo).toBe(1);
    advance(engine, 400);

    engine.setBoardForTesting(emptyBoard());
    engine.setActiveForTesting({ type: 'I', rotation: 0, x: 0, y: -1 });
    engine.hardDrop();
    expect(engine.combo).toBe(-1);
  });

  it('detects a T-spin and pays the spin bonus', () => {
    const board = emptyBoard();
    fill(board, ROWS - 3, [3, 5]);
    fill(board, ROWS - 2, [0, 1, 2, 6, 7, 8, 9]);
    fill(board, ROWS - 1, [3, 5]);
    engine.setBoardForTesting(board);
    engine.setActiveForTesting({ type: 'T', rotation: 0, x: 3, y: ROWS - 3 });
    engine.markRotatedForTesting(0);

    const before = engine.score;
    const events = engine.lockNowForTesting();
    const clear = events.find((event) => event.kind === 'clear');
    expect(clear?.kind === 'clear' && clear.spin).toBe('tspin');
    expect(clear?.kind === 'clear' && clear.label).toBe('T-SPIN SINGLE');
    expect(engine.score - before).toBe(800);
  });

  it('does not award a spin when the last action was a move', () => {
    const board = emptyBoard();
    fill(board, ROWS - 3, [3, 5]);
    fill(board, ROWS - 1, [3, 5]);
    engine.setBoardForTesting(board);
    engine.setActiveForTesting({ type: 'T', rotation: 0, x: 3, y: ROWS - 3 });

    const before = engine.score;
    engine.lockNowForTesting();
    expect(engine.score).toBe(before);
  });
});

describe('Engine view', () => {
  it('exposes a complete snapshot for the renderer', () => {
    const engine = new Engine({ seed: SEED });
    engine.start(SEED);
    const view = engine.getView();
    expect(view.status).toBe('playing');
    expect(view.board).toHaveLength(ROWS);
    expect(view.next).toHaveLength(3);
    expect(view.active).not.toBeNull();
    expect(view.ghostY).not.toBeNull();
    expect(view.hold).toBeNull();
    expect(view.holdUsed).toBe(false);
    expect(view.clearing).toBeNull();
    expect(view.elapsedMs).toBe(0);
    expect(view.piecesPlaced).toBe(0);
  });

  it('copies the active piece so callers cannot mutate the engine', () => {
    const engine = new Engine({ seed: SEED });
    engine.start(SEED);
    const active = engine.getActive()!;
    active.x = 99;
    expect(engine.getActive()?.x).not.toBe(99);
  });
});
