export type TetrominoType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export interface Tetromino {
  type: TetrominoType;
  shape: number[][];
  color: string;
}

export interface ActivePiece {
  type: TetrominoType;
  shape: number[][];
  color: string;
  x: number;
  y: number;
}

export type Board = string[][];

export interface HighScore {
  name: string;
  score: number;
  lines: number;
  date: string;
}
