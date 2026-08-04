import { TetrominoType, Tetromino, ActivePiece, Board } from "./types";

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const TETROMINOES: Record<TetrominoType, Tetromino> = {
  I: {
    type: "I",
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: "#00f0f0"
  },
  J: {
    type: "J",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: "#3b82f6"
  },
  L: {
    type: "L",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: "#f97316"
  },
  O: {
    type: "O",
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: "#eab308"
  },
  S: {
    type: "S",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    color: "#22c55e"
  },
  T: {
    type: "T",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    color: "#a855f7"
  },
  Z: {
    type: "Z",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ],
    color: "#ef4444"
  }
};

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(""));
}

export function generateBag(): TetrominoType[] {
  const types: TetrominoType[] = ["I", "J", "L", "O", "S", "T", "Z"];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

export function createPiece(type: TetrominoType): ActivePiece {
  const tetromino = TETROMINOES[type];
  const startX = Math.floor((BOARD_WIDTH - tetromino.shape[0].length) / 2);
  return {
    type: tetromino.type,
    shape: tetromino.shape.map((row) => [...row]),
    color: tetromino.color,
    x: startX,
    y: 0
  };
}

export function checkCollision(board: Board, piece: ActivePiece, offsetX = 0, offsetY = 0, newShape?: number[][]): boolean {
  const shape = newShape || piece.shape;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] !== 0) {
        const newX = piece.x + c + offsetX;
        const newY = piece.y + r + offsetY;

        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
          return true;
        }
        if (newY >= 0 && board[newY][newX] !== "") {
          return true;
        }
      }
    }
  }
  return false;
}

export function rotateMatrix(matrix: number[][]): number[][] {
  const N = matrix.length;
  const result: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      result[c][N - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

export function getGhostPosition(board: Board, piece: ActivePiece): number {
  let ghostY = piece.y;
  while (!checkCollision(board, piece, 0, ghostY - piece.y + 1)) {
    ghostY++;
  }
  return ghostY;
}

export function mergePiece(board: Board, piece: ActivePiece): Board {
  const newBoard = board.map((row) => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] !== 0) {
        const boardY = piece.y + r;
        const boardX = piece.x + c;
        if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
          newBoard[boardY][boardX] = piece.color;
        }
      }
    }
  }
  return newBoard;
}

export function clearLines(board: Board): { newBoard: Board; clearedLines: number } {
  let clearedLines = 0;
  const newBoard: Board = [];

  for (let r = 0; r < BOARD_HEIGHT; r++) {
    if (board[r].every((cell) => cell !== "")) {
      clearedLines++;
    } else {
      newBoard.push([...board[r]]);
    }
  }

  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(""));
  }

  return { newBoard, clearedLines };
}

export function calculateScore(linesCleared: number, level: number): number {
  const baseScores = [0, 100, 300, 500, 800];
  return (baseScores[linesCleared] || 0) * level;
}

export function getDropInterval(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 80);
}
