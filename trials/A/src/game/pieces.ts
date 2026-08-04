/**
 * Piece geometry and Super Rotation System (SRS) wall-kick data.
 *
 * Every piece is described by a square bounding box. Rotation states are
 * pre-computed by rotating the spawn matrix clockwise inside that box, which
 * keeps the runtime rotation code trivial and makes the data easy to verify.
 */

export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

/** A cell offset expressed as [x, y] with y growing downwards. */
export type Cell = readonly [number, number];

export const PIECE_TYPES: readonly PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** Spawn shapes drawn top-to-bottom; `#` marks a filled cell. */
const SPAWN_SHAPES: Record<PieceType, readonly string[]> = {
  I: ['....', '####', '....', '....'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
  O: ['##', '##'],
  S: ['.##', '##.', '...'],
  T: ['.#.', '###', '...'],
  Z: ['##.', '.##', '...'],
};

function shapeToCells(rows: readonly string[]): Cell[] {
  const cells: Cell[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === '#') cells.push([x, y]);
    }
  });
  return cells;
}

/** Rotate a cell clockwise inside an `size` x `size` bounding box. */
function rotateCellCW(cell: Cell, size: number): Cell {
  const [x, y] = cell;
  return [size - 1 - y, x];
}

function sortCells(cells: Cell[]): Cell[] {
  return [...cells].sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
}

export interface PieceDefinition {
  readonly type: PieceType;
  /** Size of the square bounding box the piece rotates inside. */
  readonly boxSize: number;
  /** Cell offsets for rotation states 0 (spawn), 1 (CW), 2 (180), 3 (CCW). */
  readonly rotations: readonly (readonly Cell[])[];
  /** Vertical offset applied at spawn so the piece is fully visible. */
  readonly spawnOffsetY: number;
  /** Horizontal offset applied at spawn so the piece is centred. */
  readonly spawnOffsetX: number;
}

function buildDefinition(type: PieceType, cols: number): PieceDefinition {
  const shape = SPAWN_SHAPES[type];
  const boxSize = shape.length;
  const rotations: Cell[][] = [];
  let current = sortCells(shapeToCells(shape));
  for (let i = 0; i < 4; i += 1) {
    rotations.push(current);
    current = sortCells(current.map((cell) => rotateCellCW(cell, boxSize)));
  }
  const topRow = Math.min(...rotations[0].map((cell) => cell[1]));
  return {
    type,
    boxSize,
    rotations,
    spawnOffsetY: -topRow,
    spawnOffsetX: Math.floor((cols - boxSize) / 2),
  };
}

const DEFINITION_COLS = 10;

export const PIECES: Record<PieceType, PieceDefinition> = {
  I: buildDefinition('I', DEFINITION_COLS),
  J: buildDefinition('J', DEFINITION_COLS),
  L: buildDefinition('L', DEFINITION_COLS),
  O: buildDefinition('O', DEFINITION_COLS),
  S: buildDefinition('S', DEFINITION_COLS),
  T: buildDefinition('T', DEFINITION_COLS),
  Z: buildDefinition('Z', DEFINITION_COLS),
};

export function normalizeRotation(rotation: number): number {
  return ((rotation % 4) + 4) % 4;
}

/** Absolute board cells occupied by a piece placed at (x, y). */
export function getCells(type: PieceType, rotation: number, x: number, y: number): Cell[] {
  const definition = PIECES[type];
  const offsets = definition.rotations[normalizeRotation(rotation)];
  return offsets.map(([ox, oy]) => [x + ox, y + oy] as Cell);
}

/**
 * SRS kick offsets, stored exactly as published: the second component points
 * *up*. `kicksFor` flips it so callers can work in screen coordinates.
 */
const KICKS_JLSTZ: Record<string, readonly Cell[]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const KICKS_I: Record<string, readonly Cell[]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

const NO_KICKS: readonly Cell[] = [[0, 0]];

/**
 * Candidate offsets to try when rotating from one state to another, already
 * converted to screen coordinates (positive y moves down).
 */
export function kicksFor(type: PieceType, from: number, to: number): Cell[] {
  if (type === 'O') return [[0, 0]];
  const key = `${normalizeRotation(from)}>${normalizeRotation(to)}`;
  const table = type === 'I' ? KICKS_I : KICKS_JLSTZ;
  const raw = table[key] ?? NO_KICKS;
  // `dy === 0 ? 0 : -dy` avoids producing a negative zero.
  return raw.map(([dx, dy]) => [dx, dy === 0 ? 0 : -dy] as Cell);
}
