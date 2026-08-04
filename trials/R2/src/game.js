export const COLS = 10;
export const ROWS = 20;

export const COLORS = {
  I: '#4deeea', O: '#ffd166', T: '#b388ff', S: '#69db7c',
  Z: '#ff5c7a', J: '#5c9dff', L: '#ff9f43'
};

export const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function rotateMatrix(matrix) {
  return matrix[0].map((_, column) => matrix.map(row => row[column]).reverse());
}

export function clearCompleteLines(board) {
  const remaining = board.filter(row => row.some(cell => cell === null));
  const cleared = ROWS - remaining.length;
  while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
  return { board: remaining, cleared };
}

function cloneShape(type) {
  return SHAPES[type].map(row => [...row]);
}

export class BlockGame {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.board = createBoard();
    this.queue = [];
    this.holdType = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.over = false;
    this.paused = false;
    this.lastClear = 0;
    this.fillQueue();
    this.spawn();
  }

  fillQueue() {
    while (this.queue.length < 7) {
      const bag = Object.keys(SHAPES);
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(this.random() * (index + 1));
        [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
      }
      this.queue.push(...bag);
    }
  }

  makePiece(type) {
    const matrix = cloneShape(type);
    return { type, matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: 0 };
  }

  spawn(type = null) {
    if (!type) {
      this.fillQueue();
      type = this.queue.shift();
      this.fillQueue();
    }
    this.active = this.makePiece(type);
    if (this.collides(this.active)) this.over = true;
  }

  collides(piece, x = piece.x, y = piece.y, matrix = piece.matrix) {
    return matrix.some((row, rowIndex) => row.some((cell, columnIndex) => {
      if (!cell) return false;
      const boardX = x + columnIndex;
      const boardY = y + rowIndex;
      return boardX < 0 || boardX >= COLS || boardY >= ROWS ||
        (boardY >= 0 && this.board[boardY][boardX] !== null);
    }));
  }

  move(deltaX, deltaY) {
    if (this.over || this.paused) return false;
    const nextX = this.active.x + deltaX;
    const nextY = this.active.y + deltaY;
    if (this.collides(this.active, nextX, nextY)) return false;
    this.active.x = nextX;
    this.active.y = nextY;
    return true;
  }

  rotate() {
    if (this.over || this.paused || this.active.type === 'O') return false;
    const rotated = rotateMatrix(this.active.matrix);
    const kicks = [0, -1, 1, -2, 2];
    for (const offset of kicks) {
      if (!this.collides(this.active, this.active.x + offset, this.active.y, rotated)) {
        this.active.x += offset;
        this.active.matrix = rotated;
        return true;
      }
    }
    return false;
  }

  stepDown(manual = false) {
    if (this.move(0, 1)) {
      if (manual) this.score += 1;
      return true;
    }
    if (!this.over && !this.paused) this.lock();
    return false;
  }

  hardDrop() {
    if (this.over || this.paused) return 0;
    let distance = 0;
    while (this.move(0, 1)) distance += 1;
    this.score += distance * 2;
    this.lock();
    return distance;
  }

  lock() {
    let aboveTop = false;
    this.active.matrix.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
      if (!cell) return;
      const y = this.active.y + rowIndex;
      if (y < 0) aboveTop = true;
      else this.board[y][this.active.x + columnIndex] = this.active.type;
    }));
    if (aboveTop) {
      this.over = true;
      return;
    }
    const result = clearCompleteLines(this.board);
    this.board = result.board;
    this.lastClear = result.cleared;
    this.score += [0, 100, 300, 500, 800][result.cleared] * this.level;
    this.lines += result.cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    this.canHold = true;
    this.spawn();
  }

  hold() {
    if (this.over || this.paused || !this.canHold) return false;
    const outgoing = this.active.type;
    if (this.holdType) {
      const incoming = this.holdType;
      this.holdType = outgoing;
      this.spawn(incoming);
    } else {
      this.holdType = outgoing;
      this.spawn();
    }
    this.canHold = false;
    return true;
  }

  getGhostY() {
    let y = this.active.y;
    while (!this.collides(this.active, this.active.x, y + 1)) y += 1;
    return y;
  }

  togglePause() {
    if (!this.over) this.paused = !this.paused;
    return this.paused;
  }

  getDropInterval() {
    return Math.max(90, 760 - (this.level - 1) * 65);
  }
}