import {
  COLS,
  LINE_CLEAR_MS,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  NEXT_COUNT,
  ROWS,
  SOFT_DROP_INTERVAL_MS,
} from './constants';
import {
  collides,
  createBoard,
  dropDistance,
  findFullRows,
  isBlocked,
  mergePiece,
  removeRows,
  type Board,
  type BoardCell,
} from './board';
import { PIECES, getCells, kicksFor, normalizeRotation, type Cell, type PieceType } from './pieces';
import { BagRandomizer } from './rng';
import {
  basePoints,
  gravityIntervalMs,
  hardDropPoints,
  levelForLines,
  scoreClear,
  softDropPoints,
  type SpinKind,
} from './scoring';

export type GameStatus = 'ready' | 'playing' | 'paused' | 'gameover';

export interface ActivePiece {
  type: PieceType;
  rotation: number;
  x: number;
  y: number;
}

export interface ClearingState {
  rows: number[];
  elapsed: number;
}

export type GameEvent =
  | { kind: 'spawn'; piece: PieceType }
  | { kind: 'move' }
  | { kind: 'rotate'; success: boolean }
  | { kind: 'hold'; piece: PieceType }
  | { kind: 'harddrop'; cells: Cell[]; distance: number; piece: PieceType }
  | { kind: 'lock'; cells: Cell[]; piece: PieceType }
  | {
      kind: 'clear';
      rows: number[];
      lineCount: number;
      spin: SpinKind;
      points: number;
      label: string;
    }
  | { kind: 'levelup'; level: number }
  | { kind: 'gameover' };

export interface GameView {
  status: GameStatus;
  board: Board;
  active: ActivePiece | null;
  ghostY: number | null;
  hold: PieceType | null;
  holdUsed: boolean;
  next: PieceType[];
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBack: boolean;
  clearing: { rows: number[]; progress: number } | null;
  elapsedMs: number;
  piecesPlaced: number;
}

export interface EngineOptions {
  seed?: number;
  rows?: number;
  cols?: number;
}

type LastAction = 'none' | 'move' | 'rotate';

/**
 * Headless game engine. It owns every rule of the game and is completely free
 * of DOM access, which is what makes it directly unit-testable.
 */
export class Engine {
  readonly rows: number;
  readonly cols: number;

  private board: BoardCell[][];
  private bag: BagRandomizer;
  private queue: PieceType[] = [];
  private active: ActivePiece | null = null;
  private heldPiece: PieceType | null = null;
  private holdUsed = false;

  private statusValue: GameStatus = 'ready';
  private clearing: ClearingState | null = null;

  private scoreValue = 0;
  private linesValue = 0;
  private levelValue = 1;
  private comboValue = -1;
  private backToBackValue = false;
  private piecesPlacedValue = 0;
  private elapsed = 0;

  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private softDropping = false;
  private lastAction: LastAction = 'none';
  private lastKickIndex = 0;
  private seed: number;

  constructor(options: EngineOptions = {}) {
    this.rows = options.rows ?? ROWS;
    this.cols = options.cols ?? COLS;
    this.seed = options.seed ?? (Math.random() * 0xffffffff) >>> 0;
    this.board = createBoard(this.rows, this.cols);
    this.bag = new BagRandomizer(this.seed);
    this.refillQueue();
  }

  // ---------------------------------------------------------------- lifecycle

  /** Resets everything and begins a new game. */
  start(seed?: number): void {
    this.seed = seed ?? (Math.random() * 0xffffffff) >>> 0;
    this.board = createBoard(this.rows, this.cols);
    this.bag = new BagRandomizer(this.seed);
    this.queue = [];
    this.refillQueue();
    this.active = null;
    this.heldPiece = null;
    this.holdUsed = false;
    this.clearing = null;
    this.scoreValue = 0;
    this.linesValue = 0;
    this.levelValue = 1;
    this.comboValue = -1;
    this.backToBackValue = false;
    this.piecesPlacedValue = 0;
    this.elapsed = 0;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.softDropping = false;
    this.lastAction = 'none';
    this.lastKickIndex = 0;
    this.statusValue = 'playing';
    this.spawn([]);
  }

  restart(seed?: number): void {
    this.start(seed);
  }

  pause(): boolean {
    if (this.statusValue !== 'playing') return false;
    this.statusValue = 'paused';
    this.softDropping = false;
    return true;
  }

  resume(): boolean {
    if (this.statusValue !== 'paused') return false;
    this.statusValue = 'playing';
    return true;
  }

  togglePause(): boolean {
    return this.statusValue === 'paused' ? this.resume() : this.pause();
  }

  // ------------------------------------------------------------------- update

  /** Advances the simulation by `deltaMs` and returns everything that happened. */
  tick(deltaMs: number): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.statusValue !== 'playing') return events;
    const dt = Math.max(0, Math.min(deltaMs, 250));
    this.elapsed += dt;

    if (this.clearing) {
      this.clearing.elapsed += dt;
      if (this.clearing.elapsed >= LINE_CLEAR_MS) {
        this.board = removeRows(this.board, this.clearing.rows);
        this.clearing = null;
        this.spawn(events);
      }
      return events;
    }

    if (!this.active) {
      this.spawn(events);
      if (this.statusValue !== 'playing' || !this.active) return events;
    }

    const gravity = gravityIntervalMs(this.levelValue);
    const interval = this.softDropping ? Math.min(gravity, SOFT_DROP_INTERVAL_MS) : gravity;
    this.gravityAcc += dt;
    let steps = 0;
    while (this.gravityAcc >= interval && steps < 64) {
      this.gravityAcc -= interval;
      steps += 1;
      if (!this.shift(0, 1)) {
        this.gravityAcc = 0;
        break;
      }
      this.lastAction = 'move';
      this.lockTimer = 0;
      this.lockResets = 0;
      if (this.softDropping) this.scoreValue += softDropPoints(1);
    }

    if (this.isGrounded()) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY_MS) this.lockPiece(events);
    } else {
      this.lockTimer = 0;
    }

    return events;
  }

  // ------------------------------------------------------------------- inputs

  moveLeft(): boolean {
    return this.moveHorizontally(-1);
  }

  moveRight(): boolean {
    return this.moveHorizontally(1);
  }

  rotate(direction: 1 | -1): GameEvent[] {
    const events: GameEvent[] = [];
    if (!this.canAct()) return events;
    const piece = this.active!;
    if (piece.type === 'O') {
      events.push({ kind: 'rotate', success: false });
      return events;
    }
    const from = piece.rotation;
    const to = normalizeRotation(from + direction);
    const kicks = kicksFor(piece.type, from, to);
    for (let i = 0; i < kicks.length; i += 1) {
      const [dx, dy] = kicks[i];
      const nx = piece.x + dx;
      const ny = piece.y + dy;
      if (!collides(this.board, getCells(piece.type, to, nx, ny))) {
        piece.rotation = to;
        piece.x = nx;
        piece.y = ny;
        this.lastAction = 'rotate';
        this.lastKickIndex = i;
        this.refreshLockDelay();
        events.push({ kind: 'rotate', success: true });
        return events;
      }
    }
    events.push({ kind: 'rotate', success: false });
    return events;
  }

  rotateCW(): GameEvent[] {
    return this.rotate(1);
  }

  rotateCCW(): GameEvent[] {
    return this.rotate(-1);
  }

  setSoftDrop(enabled: boolean): void {
    if (this.softDropping === enabled) return;
    this.softDropping = enabled;
    this.gravityAcc = 0;
  }

  isSoftDropping(): boolean {
    return this.softDropping;
  }

  hardDrop(): GameEvent[] {
    const events: GameEvent[] = [];
    if (!this.canAct()) return events;
    const piece = this.active!;
    const cellsBefore = getCells(piece.type, piece.rotation, piece.x, piece.y);
    const distance = dropDistance(this.board, cellsBefore);
    if (distance > 0) {
      piece.y += distance;
      this.scoreValue += hardDropPoints(distance);
      this.lastAction = 'move';
      events.push({
        kind: 'harddrop',
        cells: getCells(piece.type, piece.rotation, piece.x, piece.y),
        distance,
        piece: piece.type,
      });
    }
    this.lockPiece(events);
    return events;
  }

  hold(): GameEvent[] {
    const events: GameEvent[] = [];
    if (!this.canAct() || this.holdUsed) return events;
    const current = this.active!.type;
    let incoming: PieceType;
    if (this.heldPiece === null) {
      incoming = this.queue.shift()!;
      this.refillQueue();
    } else {
      incoming = this.heldPiece;
    }
    this.heldPiece = current;
    this.holdUsed = true;
    this.active = this.createPiece(incoming);
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastAction = 'none';
    events.push({ kind: 'hold', piece: current });
    if (collides(this.board, this.activeCells())) this.endGame(events);
    return events;
  }

  // -------------------------------------------------------------------- state

  get status(): GameStatus {
    return this.statusValue;
  }

  get score(): number {
    return this.scoreValue;
  }

  get lines(): number {
    return this.linesValue;
  }

  get level(): number {
    return this.levelValue;
  }

  get combo(): number {
    return this.comboValue;
  }

  get piecesPlaced(): number {
    return this.piecesPlacedValue;
  }

  getBoard(): Board {
    return this.board;
  }

  getActive(): ActivePiece | null {
    return this.active ? { ...this.active } : null;
  }

  getNext(count = NEXT_COUNT): PieceType[] {
    return this.queue.slice(0, count);
  }

  getHold(): PieceType | null {
    return this.heldPiece;
  }

  getGhostY(): number | null {
    if (!this.active || this.clearing) return null;
    return this.active.y + dropDistance(this.board, this.activeCells());
  }

  getView(): GameView {
    return {
      status: this.statusValue,
      board: this.board,
      active: this.getActive(),
      ghostY: this.getGhostY(),
      hold: this.heldPiece,
      holdUsed: this.holdUsed,
      next: this.getNext(),
      score: this.scoreValue,
      lines: this.linesValue,
      level: this.levelValue,
      combo: this.comboValue,
      backToBack: this.backToBackValue,
      clearing: this.clearing
        ? {
            rows: [...this.clearing.rows],
            progress: Math.min(1, this.clearing.elapsed / LINE_CLEAR_MS),
          }
        : null,
      elapsedMs: this.elapsed,
      piecesPlaced: this.piecesPlacedValue,
    };
  }

  // ------------------------------------------------------------------ internal

  private canAct(): boolean {
    return this.statusValue === 'playing' && this.active !== null && this.clearing === null;
  }

  private activeCells(): Cell[] {
    const piece = this.active!;
    return getCells(piece.type, piece.rotation, piece.x, piece.y);
  }

  private moveHorizontally(direction: -1 | 1): boolean {
    if (!this.canAct()) return false;
    if (!this.shift(direction, 0)) return false;
    this.lastAction = 'move';
    this.refreshLockDelay();
    return true;
  }

  private shift(dx: number, dy: number): boolean {
    const piece = this.active;
    if (!piece) return false;
    const target = getCells(piece.type, piece.rotation, piece.x + dx, piece.y + dy);
    if (collides(this.board, target)) return false;
    piece.x += dx;
    piece.y += dy;
    return true;
  }

  private isGrounded(): boolean {
    if (!this.active) return false;
    const piece = this.active;
    return collides(this.board, getCells(piece.type, piece.rotation, piece.x, piece.y + 1));
  }

  /** Grounded pieces get a limited number of lock-delay refreshes. */
  private refreshLockDelay(): void {
    if (!this.isGrounded()) return;
    if (this.lockResets >= MAX_LOCK_RESETS) return;
    this.lockResets += 1;
    this.lockTimer = 0;
  }

  private refillQueue(): void {
    while (this.queue.length < NEXT_COUNT + 1) this.queue.push(this.bag.next());
  }

  private createPiece(type: PieceType): ActivePiece {
    const definition = PIECES[type];
    return {
      type,
      rotation: 0,
      x: definition.spawnOffsetX,
      y: definition.spawnOffsetY,
    };
  }

  private spawn(events: GameEvent[]): void {
    const type = this.queue.shift()!;
    this.refillQueue();
    this.active = this.createPiece(type);
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastAction = 'none';
    this.lastKickIndex = 0;
    events.push({ kind: 'spawn', piece: type });
    if (collides(this.board, this.activeCells())) this.endGame(events);
  }

  private endGame(events: GameEvent[]): void {
    this.statusValue = 'gameover';
    this.softDropping = false;
    this.clearing = null;
    events.push({ kind: 'gameover' });
  }

  private lockPiece(events: GameEvent[]): void {
    const piece = this.active;
    if (!piece) return;
    const cells = this.activeCells();
    const spin = this.detectSpin(piece);
    const lockedOut = cells.every(([, y]) => y < 0);

    this.board = mergePiece(this.board, piece.type, cells);
    this.active = null;
    this.holdUsed = false;
    this.piecesPlacedValue += 1;
    this.softDropping = false;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    events.push({ kind: 'lock', cells, piece: piece.type });

    if (lockedOut) {
      this.endGame(events);
      return;
    }

    const fullRows = findFullRows(this.board);
    if (fullRows.length === 0) {
      this.comboValue = -1;
      if (spin !== 'none') {
        this.scoreValue += basePoints(0, spin) * this.levelValue;
      }
      this.lastAction = 'none';
      this.spawn(events);
      return;
    }

    this.comboValue += 1;
    const result = scoreClear({
      lineCount: fullRows.length,
      spin,
      level: this.levelValue,
      combo: this.comboValue,
      backToBack: this.backToBackValue,
    });
    this.scoreValue += result.points;
    this.backToBackValue = result.difficult;
    this.linesValue += fullRows.length;

    const nextLevel = levelForLines(this.linesValue);
    const levelChanged = nextLevel !== this.levelValue;
    this.levelValue = nextLevel;

    events.push({
      kind: 'clear',
      rows: [...fullRows],
      lineCount: fullRows.length,
      spin,
      points: result.points,
      label: result.label,
    });
    if (levelChanged) events.push({ kind: 'levelup', level: nextLevel });

    this.clearing = { rows: fullRows, elapsed: 0 };
    this.lastAction = 'none';
  }

  /**
   * Three-corner T-spin detection: the placement only counts when the last
   * successful action was a rotation and at least three corners around the
   * T centre are blocked.
   */
  private detectSpin(piece: ActivePiece): SpinKind {
    if (piece.type !== 'T' || this.lastAction !== 'rotate') return 'none';
    const cx = piece.x + 1;
    const cy = piece.y + 1;
    const topLeft = isBlocked(this.board, cx - 1, cy - 1);
    const topRight = isBlocked(this.board, cx + 1, cy - 1);
    const bottomRight = isBlocked(this.board, cx + 1, cy + 1);
    const bottomLeft = isBlocked(this.board, cx - 1, cy + 1);
    const blocked = [topLeft, topRight, bottomRight, bottomLeft].filter(Boolean).length;
    if (blocked < 3) return 'none';

    // Corners that face the stem of the T, indexed by rotation state.
    const facing: [boolean, boolean][] = [
      [topLeft, topRight],
      [topRight, bottomRight],
      [bottomRight, bottomLeft],
      [bottomLeft, topLeft],
    ];
    const [a, b] = facing[normalizeRotation(piece.rotation)];
    if (a && b) return 'tspin';
    // The last kick of the SRS table always promotes a mini to a full spin.
    if (this.lastKickIndex === 4) return 'tspin';
    return 'tspin-mini';
  }

  // ------------------------------------------------------------- test helpers

  /** Replaces the board contents. Intended for tests and deterministic setups. */
  setBoardForTesting(cells: BoardCell[][]): void {
    this.board = cells.map((row) => [...row]);
  }

  /** Forces the active piece into a known state. Intended for tests. */
  setActiveForTesting(piece: ActivePiece | null): void {
    this.active = piece ? { ...piece } : null;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.gravityAcc = 0;
  }

  /** Overrides the upcoming piece order. Intended for tests. */
  setQueueForTesting(queue: PieceType[]): void {
    this.queue = [...queue];
    this.refillQueue();
  }

  /** Immediately locks the active piece where it stands. Intended for tests. */
  lockNowForTesting(): GameEvent[] {
    const events: GameEvent[] = [];
    this.lockPiece(events);
    return events;
  }

  /** Marks the last action as a rotation so spin detection can be tested. */
  markRotatedForTesting(kickIndex = 0): void {
    this.lastAction = 'rotate';
    this.lastKickIndex = kickIndex;
  }
}
