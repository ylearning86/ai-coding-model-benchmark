export const COLS = 10;
export const ROWS = 20;
export const RANKING_LIMIT = 10;

export type Kind = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type Cell = Kind | null;
export type Status = 'ready' | 'playing' | 'paused' | 'over';

export const KINDS: readonly Kind[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

const SHAPES: Record<Kind, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const LINE_SCORE = [0, 100, 300, 500, 800];
const KICKS = [0, -1, 1, -2, 2];

export interface Active {
  kind: Kind;
  shape: number[][];
  x: number;
  y: number;
}

export interface ClearEvent {
  rows: number[];
  count: number;
  score: number;
  levelUp: boolean;
}

export interface LockEvent {
  cells: [number, number][];
  kind: Kind;
}

export interface TrailEvent {
  cols: number[];
  from: number;
  to: number;
  kind: Kind;
}

export interface ScoreEntry {
  name: string;
  score: number;
  lines: number;
  level: number;
  at: number;
}

export function shapeOf(kind: Kind): number[][] {
  return SHAPES[kind].map((row) => row.slice());
}

/** 正方行列を 90 度回転する (dir=1 で時計回り)。 */
export function rotate(shape: number[][], dir: 1 | -1): number[][] {
  const n = shape.length;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (dir === 1 ? shape[n - 1 - c][r] : shape[c][n - 1 - r])),
  );
}

/** 7 種を 1 巡させるバッグ方式の抽選。 */
export function nextBag(rng: () => number): Kind[] {
  const bag = KINDS.slice();
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag;
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null as Cell));
}

export class Game {
  board: Cell[][] = emptyBoard();
  active: Active | null = null;
  queue: Kind[] = [];
  hold: Kind | null = null;
  canHold = true;
  score = 0;
  lines = 0;
  level = 1;
  status: Status = 'ready';
  lastClear: ClearEvent | null = null;
  lastLock: LockEvent | null = null;
  lastTrail: TrailEvent | null = null;

  private bag: Kind[] = [];
  private acc = 0;
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
    this.reset();
  }

  get dropInterval(): number {
    return Math.max(90, 900 - (this.level - 1) * 75);
  }

  reset(): void {
    this.board = emptyBoard();
    this.queue = [];
    this.bag = [];
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.acc = 0;
    this.lastClear = null;
    this.lastLock = null;
    this.lastTrail = null;
    this.status = 'ready';
    this.spawn();
  }

  start(): void {
    this.reset();
    this.status = 'playing';
  }

  togglePause(): void {
    if (this.status === 'playing') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'playing';
  }

  move(dx: number): boolean {
    if (this.status !== 'playing' || !this.active) return false;
    if (this.collides(this.active, dx, 0, this.active.shape)) return false;
    this.active.x += dx;
    return true;
  }

  rotatePiece(dir: 1 | -1): boolean {
    if (this.status !== 'playing' || !this.active) return false;
    const shape = rotate(this.active.shape, dir);
    for (const kick of KICKS) {
      if (!this.collides(this.active, kick, 0, shape)) {
        this.active.x += kick;
        this.active.shape = shape;
        return true;
      }
    }
    return false;
  }

  softDrop(): boolean {
    if (this.status !== 'playing' || !this.active) return false;
    if (this.collides(this.active, 0, 1, this.active.shape)) return false;
    this.active.y += 1;
    this.score += 1;
    this.acc = 0;
    return true;
  }

  hardDrop(): void {
    if (this.status !== 'playing' || !this.active) return;
    const piece = this.active;
    const from = piece.y;
    let dist = 0;
    while (!this.collides(piece, 0, dist + 1, piece.shape)) dist += 1;
    piece.y += dist;
    this.score += dist * 2;
    const cols = new Set<number>();
    piece.shape.forEach((row) => {
      row.forEach((v, c) => {
        if (v) cols.add(piece.x + c);
      });
    });
    this.lastTrail = { cols: [...cols], from, to: piece.y, kind: piece.kind };
    this.lock();
  }

  holdPiece(): boolean {
    if (this.status !== 'playing' || !this.active || !this.canHold) return false;
    const current = this.active.kind;
    const swap = this.hold;
    this.hold = current;
    this.canHold = false;
    this.spawn(swap ?? undefined);
    return true;
  }

  /** 着地点となる y 座標。ゴースト表示に使う。 */
  ghostY(): number {
    if (!this.active) return 0;
    let dist = 0;
    while (!this.collides(this.active, 0, dist + 1, this.active.shape)) dist += 1;
    return this.active.y + dist;
  }

  tick(ms: number): void {
    if (this.status !== 'playing' || !this.active) return;
    this.acc += ms;
    while (this.acc >= this.dropInterval) {
      this.acc -= this.dropInterval;
      if (this.collides(this.active, 0, 1, this.active.shape)) {
        this.lock();
        break;
      }
      this.active.y += 1;
    }
  }

  private fillQueue(): void {
    while (this.queue.length < 5) {
      if (this.bag.length === 0) this.bag = nextBag(this.rng);
      const kind = this.bag.shift();
      if (kind) this.queue.push(kind);
    }
  }

  private spawn(kind?: Kind): void {
    this.fillQueue();
    const next = kind ?? this.queue.shift() ?? 'T';
    this.fillQueue();
    const shape = shapeOf(next);
    const piece: Active = {
      kind: next,
      shape,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: 0,
    };
    this.active = piece;
    if (this.collides(piece, 0, 0, piece.shape)) this.status = 'over';
  }

  private collides(piece: Active, dx: number, dy: number, shape: number[][]): boolean {
    for (let r = 0; r < shape.length; r += 1) {
      for (let c = 0; c < shape[r].length; c += 1) {
        if (!shape[r][c]) continue;
        const x = piece.x + dx + c;
        const y = piece.y + dy + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && this.board[y][x] !== null) return true;
      }
    }
    return false;
  }

  private lock(): void {
    const piece = this.active;
    if (!piece) return;
    const cells: [number, number][] = [];
    let above = false;
    for (let r = 0; r < piece.shape.length; r += 1) {
      for (let c = 0; c < piece.shape[r].length; c += 1) {
        if (!piece.shape[r][c]) continue;
        const x = piece.x + c;
        const y = piece.y + r;
        if (y < 0) {
          above = true;
          continue;
        }
        this.board[y][x] = piece.kind;
        cells.push([x, y]);
      }
    }
    this.lastLock = { cells, kind: piece.kind };
    this.acc = 0;
    this.clearLines();
    this.canHold = true;
    if (above) {
      this.status = 'over';
      this.active = null;
      return;
    }
    this.spawn();
  }

  private clearLines(): void {
    const rows: number[] = [];
    for (let r = 0; r < ROWS; r += 1) {
      if (this.board[r].every((cell) => cell !== null)) rows.push(r);
    }
    if (rows.length === 0) return;
    this.board = this.board.filter((_, r) => !rows.includes(r));
    while (this.board.length < ROWS) {
      this.board.unshift(Array.from({ length: COLS }, () => null as Cell));
    }
    const gained = LINE_SCORE[rows.length] * this.level;
    const before = this.level;
    this.score += gained;
    this.lines += rows.length;
    this.level = Math.floor(this.lines / 10) + 1;
    this.lastClear = { rows, count: rows.length, score: gained, levelUp: this.level > before };
  }
}

const code = (ch: string): number => ch.codePointAt(0) ?? 0;

/** 制御文字を除去し 12 文字までに丸めた表示名を返す。 */
export function sanitizeName(raw: string): string {
  const cleaned = Array.from(String(raw ?? ''))
    .filter((ch) => code(ch) >= 0x20 && code(ch) !== 0x7f)
    .join('')
    .trim()
    .slice(0, 12);
  return cleaned.length > 0 ? cleaned : 'PLAYER';
}

function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function sortEntries(list: ScoreEntry[]): ScoreEntry[] {
  return [...list].sort((a, b) => (b.score - a.score) || (a.at - b.at));
}

export function mergeRanking(list: ScoreEntry[], entry: ScoreEntry): ScoreEntry[] {
  return sortEntries([...list, entry]).slice(0, RANKING_LIMIT);
}

/** localStorage 由来の文字列を検証しながら復元する。 */
export function parseRanking(raw: string | null): ScoreEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: ScoreEntry[] = [];
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const score = Number(rec.score);
    if (!Number.isFinite(score) || score < 0) continue;
    out.push({
      name: sanitizeName(typeof rec.name === 'string' ? rec.name : ''),
      score: Math.floor(score),
      lines: toCount(rec.lines),
      level: Math.max(1, toCount(rec.level)),
      at: toCount(rec.at),
    });
  }
  return sortEntries(out).slice(0, RANKING_LIMIT);
}
