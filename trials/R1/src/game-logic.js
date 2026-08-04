export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};

const COLORS = { I: 'I', J: 'J', L: 'L', O: 'O', S: 'S', T: 'T', Z: 'Z' };

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function createRandomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  return createPiece(type);
}

function createPiece(type) {
  return {
    type,
    matrix: cloneMatrix(SHAPES[type]),
    x: Math.floor((BOARD_WIDTH - SHAPES[type][0].length) / 2),
    y: 0,
  };
}

function isValidPosition(board, piece, offsetX = 0, offsetY = 0) {
  const matrix = piece.matrix;
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue;
      const x = piece.x + col + offsetX;
      const y = piece.y + row + offsetY;
      if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return false;
      if (y >= 0 && board[y][x]) return false;
    }
  }
  return true;
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function mergePiece(board, piece) {
  const nextBoard = board.map((row) => [...row]);
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value) {
        const y = piece.y + rowIndex;
        const x = piece.x + colIndex;
        if (y >= 0) nextBoard[y][x] = COLORS[piece.type];
      }
    });
  });
  return nextBoard;
}

function clearLines(board) {
  const nextRows = [];
  let cleared = 0;
  board.forEach((row) => {
    if (row.every(Boolean)) {
      cleared += 1;
    } else {
      nextRows.push(row);
    }
  });
  while (nextRows.length < BOARD_HEIGHT) {
    nextRows.unshift(Array(BOARD_WIDTH).fill(null));
  }
  return { board: nextRows, cleared };
}

export function createInitialState() {
  return {
    board: createEmptyBoard(),
    currentPiece: createRandomPiece(),
    nextPiece: createRandomPiece(),
    holdPiece: null,
    canHold: true,
    score: 0,
    level: 1,
    lines: 0,
    status: 'playing',
    gameOver: false,
  };
}

export function movePiece(state, dx) {
  if (state.status !== 'playing' || state.gameOver) return state;
  const nextState = { ...state, currentPiece: { ...state.currentPiece, x: state.currentPiece.x + dx } };
  if (isValidPosition(nextState.board, nextState.currentPiece)) return nextState;
  return state;
}

export function rotatePiece(state) {
  if (state.status !== 'playing' || state.gameOver) return state;
  const rotated = { ...state.currentPiece, matrix: rotateMatrix(state.currentPiece.matrix) };
  const attempts = [0, -1, 1, -2, 2];
  for (const offset of attempts) {
    const candidate = { ...rotated, x: state.currentPiece.x + offset };
    if (isValidPosition(state.board, candidate)) {
      return { ...state, currentPiece: candidate };
    }
  }
  return state;
}

export function softDrop(state) {
  if (state.status !== 'playing' || state.gameOver) return state;
  const nextPiece = { ...state.currentPiece, y: state.currentPiece.y + 1 };
  if (isValidPosition(state.board, nextPiece)) {
    return { ...state, currentPiece: nextPiece, score: state.score + 1 };
  }
  return finalizePiece(state);
}

export function hardDrop(state) {
  if (state.status !== 'playing' || state.gameOver) return state;
  let current = state.currentPiece;
  let next = { ...current, y: current.y + 1 };
  while (isValidPosition(state.board, next)) {
    current = next;
    next = { ...current, y: current.y + 1 };
  }
  const landed = { ...state, currentPiece: current, score: state.score + current.y * 2 };
  return finalizePiece(landed);
}

export function holdPiece(state) {
  if (state.status !== 'playing' || state.gameOver || !state.canHold) return state;
  if (!state.holdPiece) {
    const nextHold = state.currentPiece.type;
    const newCurrent = state.nextPiece;
    return {
      ...state,
      holdPiece: { type: nextHold },
      currentPiece: { ...newCurrent, x: Math.floor((BOARD_WIDTH - newCurrent.matrix[0].length) / 2), y: 0 },
      nextPiece: createRandomPiece(),
      canHold: false,
    };
  }
  const swapped = state.currentPiece.type;
  const holdType = state.holdPiece.type;
  const newCurrent = createPiece(holdType);
  return {
    ...state,
    currentPiece: { ...newCurrent, x: Math.floor((BOARD_WIDTH - newCurrent.matrix[0].length) / 2), y: 0 },
    holdPiece: { type: swapped },
    canHold: false,
  };
}

export function stepGame(state) {
  if (state.status !== 'playing' || state.gameOver) return state;
  const moved = { ...state.currentPiece, y: state.currentPiece.y + 1 };
  if (isValidPosition(state.board, moved)) {
    return { ...state, currentPiece: moved };
  }
  return finalizePiece(state);
}

export function getGhostY(board, piece) {
  let ghostPiece = { ...piece, y: piece.y };
  while (isValidPosition(board, { ...ghostPiece, y: ghostPiece.y + 1 })) {
    ghostPiece = { ...ghostPiece, y: ghostPiece.y + 1 };
  }
  return ghostPiece.y;
}

function finalizePiece(state) {
  const mergedBoard = mergePiece(state.board, state.currentPiece);
  const { board: clearedBoard, cleared } = clearLines(mergedBoard);
  const lines = state.lines + cleared;
  const level = 1 + Math.floor(lines / 10);
  const scoreIncrease = [0, 100, 300, 500, 800][cleared] + (cleared ? 40 : 0);
  const nextPiece = state.nextPiece;
  const spawned = { ...nextPiece, x: Math.floor((BOARD_WIDTH - nextPiece.matrix[0].length) / 2), y: 0 };
  const gameOver = !isValidPosition(clearedBoard, spawned);
  return {
    ...state,
    board: clearedBoard,
    currentPiece: spawned,
    nextPiece: createRandomPiece(),
    canHold: true,
    score: state.score + scoreIncrease,
    level,
    lines,
    gameOver,
    status: gameOver ? 'game-over' : 'playing',
  };
}

export function togglePause(state) {
  if (state.gameOver) return state;
  if (state.status === 'playing') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'playing' };
  return state;
}

export function restartGame() {
  return createInitialState();
}
