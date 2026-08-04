import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  TETROMINOES,
  createEmptyBoard,
  generateBag,
  createPiece,
  checkCollision,
  rotateMatrix,
  getGhostPosition,
  mergePiece,
  clearLines,
  calculateScore,
  getDropInterval
} from "./tetris";
import { ActivePiece, Board, HighScore, TetrominoType } from "./types";

const BLOCK_SIZE = 28;

export function App() {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [activePiece, setActivePiece] = useState<ActivePiece | null>(null);
  const [bag, setBag] = useState<TetrominoType[]>([]);
  const [nextPiece, setNextPiece] = useState<TetrominoType | null>(null);
  const [holdPiece, setHoldPiece] = useState<TetrominoType | null>(null);
  const [canHold, setCanHold] = useState<boolean>(true);

  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);

  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStarted, setIsStarted] = useState<boolean>(false);

  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [nickname, setNickname] = useState<string>("");
  const [scoreSubmitted, setScoreSubmitted] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const boardRef = useRef(board);
  boardRef.current = board;
  const activePieceRef = useRef(activePiece);
  activePieceRef.current = activePiece;
  const bagRef = useRef(bag);
  bagRef.current = bag;
  const nextPieceRef = useRef(nextPiece);
  nextPieceRef.current = nextPiece;
  const isGameOverRef = useRef(isGameOver);
  isGameOverRef.current = isGameOver;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isStartedRef = useRef(isStarted);
  isStartedRef.current = isStarted;
  const levelRef = useRef(level);
  levelRef.current = level;
  const canHoldRef = useRef(canHold);
  canHoldRef.current = canHold;
  const holdPieceRef = useRef(holdPiece);
  holdPieceRef.current = holdPiece;

  // Load High Scores
  useEffect(() => {
    try {
      const saved = localStorage.getItem("block_puzzle_scores");
      if (saved) {
        setHighScores(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const getNextFromBag = useCallback((): { pieceType: TetrominoType; newBag: TetrominoType[] } => {
    let currentBag = [...bagRef.current];
    if (currentBag.length === 0) {
      currentBag = generateBag();
    }
    const pieceType = currentBag.shift()!;
    if (currentBag.length === 0) {
      currentBag = generateBag();
    }
    return { pieceType, newBag: currentBag };
  }, []);

  const spawnPiece = useCallback((pType?: TetrominoType) => {
    let pieceType = pType;
    if (!pieceType) {
      if (nextPieceRef.current) {
        pieceType = nextPieceRef.current;
        const { pieceType: upcoming, newBag } = getNextFromBag();
        setNextPiece(upcoming);
        setBag(newBag);
      } else {
        const { pieceType: first, newBag: bag1 } = getNextFromBag();
        pieceType = first;
        const { pieceType: second, newBag: bag2 } = getNextFromBag();
        setNextPiece(second);
        setBag(bag2);
      }
    }

    const newPiece = createPiece(pieceType);
    if (checkCollision(boardRef.current, newPiece)) {
      setIsGameOver(true);
      setActivePiece(null);
    } else {
      setActivePiece(newPiece);
    }
  }, [getNextFromBag]);

  const startGame = () => {
    const emptyBoard = createEmptyBoard();
    setBoard(emptyBoard);
    boardRef.current = emptyBoard;

    setScore(0);
    setLines(0);
    setLevel(1);
    setIsGameOver(false);
    setIsPaused(false);
    setIsStarted(true);
    setHoldPiece(null);
    setCanHold(true);
    setScoreSubmitted(false);

    const initialBag = generateBag();
    const firstType = initialBag.shift()!;
    const secondType = initialBag.shift()!;
    setBag(initialBag);
    setNextPiece(secondType);

    const firstPiece = createPiece(firstType);
    setActivePiece(firstPiece);
  };

  const lockPiece = useCallback((pieceToLock: ActivePiece) => {
    const merged = mergePiece(boardRef.current, pieceToLock);
    const { newBoard, clearedLines } = clearLines(merged);

    setBoard(newBoard);
    boardRef.current = newBoard;

    if (clearedLines > 0) {
      setLines((prevLines) => {
        const updatedLines = prevLines + clearedLines;
        const newLevel = Math.floor(updatedLines / 10) + 1;
        setLevel(newLevel);
        return updatedLines;
      });

      setScore((prevScore) => prevScore + calculateScore(clearedLines, levelRef.current));
    }

    setCanHold(true);
    spawnPiece();
  }, [spawnPiece]);

  const moveLeft = useCallback(() => {
    if (!activePieceRef.current || isPausedRef.current || isGameOverRef.current) return;
    if (!checkCollision(boardRef.current, activePieceRef.current, -1, 0)) {
      setActivePiece((prev) => (prev ? { ...prev, x: prev.x - 1 } : null));
    }
  }, []);

  const moveRight = useCallback(() => {
    if (!activePieceRef.current || isPausedRef.current || isGameOverRef.current) return;
    if (!checkCollision(boardRef.current, activePieceRef.current, 1, 0)) {
      setActivePiece((prev) => (prev ? { ...prev, x: prev.x + 1 } : null));
    }
  }, []);

  const moveDown = useCallback(() => {
    if (!activePieceRef.current || isPausedRef.current || isGameOverRef.current) return;
    if (!checkCollision(boardRef.current, activePieceRef.current, 0, 1)) {
      setActivePiece((prev) => (prev ? { ...prev, y: prev.y + 1 } : null));
    } else {
      lockPiece(activePieceRef.current);
    }
  }, [lockPiece]);

  const hardDrop = useCallback(() => {
    if (!activePieceRef.current || isPausedRef.current || isGameOverRef.current) return;
    const ghostY = getGhostPosition(boardRef.current, activePieceRef.current);
    const droppedPiece = { ...activePieceRef.current, y: ghostY };
    setActivePiece(droppedPiece);
    lockPiece(droppedPiece);
  }, [lockPiece]);

  const rotate = useCallback(() => {
    if (!activePieceRef.current || isPausedRef.current || isGameOverRef.current) return;
    const rotatedShape = rotateMatrix(activePieceRef.current.shape);
    // Basic wall kick check
    const offsets = [0, -1, 1, -2, 2];
    for (const offset of offsets) {
      if (!checkCollision(boardRef.current, activePieceRef.current, offset, 0, rotatedShape)) {
        setActivePiece((prev) => (prev ? { ...prev, shape: rotatedShape, x: prev.x + offset } : null));
        return;
      }
    }
  }, []);

  const handleHold = useCallback(() => {
    if (!activePieceRef.current || !canHoldRef.current || isPausedRef.current || isGameOverRef.current) return;

    const currentType = activePieceRef.current.type;
    setCanHold(false);

    if (holdPieceRef.current) {
      const swappedType = holdPieceRef.current;
      setHoldPiece(currentType);
      spawnPiece(swappedType);
    } else {
      setHoldPiece(currentType);
      spawnPiece();
    }
  }, [spawnPiece]);

  const togglePause = useCallback(() => {
    if (!isStartedRef.current || isGameOverRef.current) return;
    setIsPaused((prev) => !prev);
  }, []);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isStartedRef.current || isGameOverRef.current) return;

      switch (e.key) {
        case "ArrowLeft":
          moveLeft();
          break;
        case "ArrowRight":
          moveRight();
          break;
        case "ArrowDown":
          moveDown();
          break;
        case "ArrowUp":
        case "x":
        case "X":
          rotate();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
        case "c":
        case "C":
        case "Shift":
          handleHold();
          break;
        case "p":
        case "P":
        case "Escape":
          togglePause();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveLeft, moveRight, moveDown, rotate, hardDrop, handleHold, togglePause]);

  // Drop timer
  useEffect(() => {
    if (!isStarted || isPaused || isGameOver) return;
    const interval = setInterval(() => {
      moveDown();
    }, getDropInterval(level));

    return () => clearInterval(interval);
  }, [isStarted, isPaused, isGameOver, level, moveDown]);

  // Main Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK_SIZE);
      ctx.lineTo(BOARD_WIDTH * BLOCK_SIZE, r * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK_SIZE, 0);
      ctx.lineTo(c * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);
      ctx.stroke();
    }

    // Draw Board Blocks
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (board[r][c] !== "") {
          drawBlock(ctx, c, r, board[r][c]);
        }
      }
    }

    // Draw Ghost & Active Piece
    if (activePiece && !isPaused && !isGameOver) {
      const ghostY = getGhostPosition(board, activePiece);

      // Draw Ghost Piece
      for (let r = 0; r < activePiece.shape.length; r++) {
        for (let c = 0; c < activePiece.shape[r].length; c++) {
          if (activePiece.shape[r][c] !== 0) {
            drawBlock(ctx, activePiece.x + c, ghostY + r, activePiece.color, true);
          }
        }
      }

      // Draw Active Piece
      for (let r = 0; r < activePiece.shape.length; r++) {
        for (let c = 0; c < activePiece.shape[r].length; c++) {
          if (activePiece.shape[r][c] !== 0) {
            drawBlock(ctx, activePiece.x + c, activePiece.y + r, activePiece.color);
          }
        }
      }
    }
  }, [board, activePiece, isPaused, isGameOver]);

  // Preview Box Renderer Helper
  const drawPreview = (canvas: HTMLCanvasElement | null, type: TetrominoType | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!type) return;

    const tetromino = TETROMINOES[type];
    const size = 20;
    const offsetX = (canvas.width - tetromino.shape[0].length * size) / 2;
    const offsetY = (canvas.height - tetromino.shape.length * size) / 2;

    for (let r = 0; r < tetromino.shape.length; r++) {
      for (let c = 0; c < tetromino.shape[r].length; c++) {
        if (tetromino.shape[r][c] !== 0) {
          ctx.fillStyle = tetromino.color;
          ctx.fillRect(offsetX + c * size, offsetY + r * size, size - 1, size - 1);
        }
      }
    }
  };

  useEffect(() => {
    drawPreview(holdCanvasRef.current, holdPiece);
  }, [holdPiece]);

  useEffect(() => {
    drawPreview(nextCanvasRef.current, nextPiece);
  }, [nextPiece]);

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isGhost = false) => {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

      // Inner highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, 3);
      ctx.fillRect(px + 1, py + 1, 3, BLOCK_SIZE - 2);
    }
  };

  const handleSaveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    const newScore: HighScore = {
      name: nickname.trim().slice(0, 10), // Limit name length
      score,
      lines,
      date: new Date().toLocaleDateString()
    };

    const updated = [...highScores, newScore].sort((a, b) => b.score - a.score).slice(0, 5);
    setHighScores(updated);
    setScoreSubmitted(true);

    try {
      localStorage.setItem("block_puzzle_scores", JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="game-container">
      <div className="header">
        <h1>BLOCK PUZZLE</h1>
      </div>

      <div className="main-layout">
        {/* Left Side Panel */}
        <div className="side-panel">
          <div className="card">
            <div className="card-title">HOLD</div>
            <div className="preview-box">
              <canvas ref={holdCanvasRef} width={80} height={80} />
            </div>
          </div>

          <div className="card">
            <div className="card-title">SCORE</div>
            <div className="stat-value">{score}</div>
          </div>

          <div className="card">
            <div className="card-title">LEVEL</div>
            <div className="stat-value">{level}</div>
          </div>

          <div className="card">
            <div className="card-title">LINES</div>
            <div className="stat-value">{lines}</div>
          </div>
        </div>

        {/* Board Center */}
        <div className="board-container">
          <canvas ref={canvasRef} width={BOARD_WIDTH * BLOCK_SIZE} height={BOARD_HEIGHT * BLOCK_SIZE} className="board-canvas" />

          {!isStarted && (
            <div className="overlay">
              <h2>BLOCK PUZZLE</h2>
              <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>矢印キーで移動・回転</p>
              <button className="btn" onClick={startGame}>
                ゲーム開始
              </button>
            </div>
          )}

          {isPaused && isStarted && !isGameOver && (
            <div className="overlay">
              <h2>PAUSED</h2>
              <button className="btn" onClick={togglePause}>
                再開
              </button>
              <button className="btn" style={{ background: "rgba(255,255,255,0.1)" }} onClick={startGame}>
                リスタート
              </button>
            </div>
          )}

          {isGameOver && (
            <div className="overlay">
              <h2>GAME OVER</h2>
              <p>スコア: {score}</p>

              {!scoreSubmitted ? (
                <form onSubmit={handleSaveScore} style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ニックネーム"
                    maxLength={10}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                  <button type="submit" className="btn" disabled={!nickname.trim()}>
                    記録を保存
                  </button>
                </form>
              ) : (
                <p style={{ color: "#22c55e", fontSize: "0.9rem" }}>スコアを保存しました！</p>
              )}

              <button className="btn" onClick={startGame} style={{ marginTop: "8px" }}>
                もう一度遊ぶ
              </button>
            </div>
          )}
        </div>

        {/* Right Side Panel */}
        <div className="side-panel right-panel">
          <div className="card">
            <div className="card-title">NEXT</div>
            <div className="preview-box">
              <canvas ref={nextCanvasRef} width={80} height={80} />
            </div>
          </div>

          <div className="card" style={{ width: "100%" }}>
            <div className="card-title">RANKING</div>
            {highScores.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "#64748b" }}>記録なし</p>
            ) : (
              <ul className="leaderboard-list">
                {highScores.map((item, index) => (
                  <li key={index} className="leaderboard-item">
                    <span>
                      {index + 1}. {item.name}
                    </span>
                    <span style={{ color: "#06b6d4" }}>{item.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button className="btn" style={{ width: "100%", fontSize: "0.85rem" }} onClick={togglePause} disabled={!isStarted || isGameOver}>
            {isPaused ? "再開" : "一時停止"}
          </button>
        </div>
      </div>

      {/* Touch Controls for Mobile */}
      <div className="touch-controls">
        <div className="touch-row">
          <button className="touch-btn" onClick={handleHold}>
            HOLD
          </button>
          <button className="touch-btn" onClick={rotate}>
            ROTATE
          </button>
          <button className="touch-btn" onClick={hardDrop}>
            DROP
          </button>
        </div>
        <div className="touch-row">
          <button className="touch-btn" onClick={moveLeft}>
            ◀
          </button>
          <button className="touch-btn" onClick={moveDown}>
            ▼
          </button>
          <button className="touch-btn" onClick={moveRight}>
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
