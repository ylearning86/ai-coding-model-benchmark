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
  restartGame,
} from './game-logic.js';

const BOARD_CELLS = 200;
const storageKey = 'nova-tetris-ranking';

const playfield = document.getElementById('playfield');
const nextGrid = document.getElementById('next-grid');
const holdGrid = document.getElementById('hold-grid');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const statusPill = document.getElementById('status-pill');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const hardDropBtn = document.getElementById('hard-drop-btn');
const nicknameInput = document.getElementById('nickname');
const rankingEl = document.getElementById('ranking');

let game = createInitialState();
let dropTimer = null;
let rankingSaved = false;

function buildCells(container) {
  const cells = [];
  for (let i = 0; i < BOARD_CELLS; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    container.appendChild(cell);
    cells.push(cell);
  }
  return cells;
}

const boardCells = buildCells(playfield);
const nextCells = buildCells(nextGrid);
const holdCells = buildCells(holdGrid);

function renderBoard() {
  const { board, currentPiece } = game;
  boardCells.forEach((cell, index) => {
    const row = Math.floor(index / 10);
    const col = index % 10;
    const hasBlock = board[row][col];
    const active = currentPiece.matrix.some((rowData, rowIndex) => rowData.some((value, colIndex) => value && currentPiece.y + rowIndex === row && currentPiece.x + colIndex === col));
    cell.className = 'cell';
    if (hasBlock) {
      cell.classList.add('filled', hasBlock);
    } else if (active) {
      cell.classList.add('filled', currentPiece.type);
    }
    const ghostY = getGhostY(board, currentPiece);
    if (!hasBlock && !active && currentPiece.y <= ghostY) {
      const ghostRow = row;
      const ghostCol = col;
      const isGhost = currentPiece.matrix.some((rowData, rowIndex) => rowData.some((value, colIndex) => value && ghostY + rowIndex === ghostRow && currentPiece.x + colIndex === ghostCol));
      if (isGhost) cell.classList.add('ghost');
    }
  });
}

function renderPreview(grid, piece) {
  const cells = Array.from(grid.children);
  cells.forEach((cell, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    cell.className = 'cell';
    if (piece) {
      const matrix = piece.matrix;
      if (matrix[row] && matrix[row][col]) cell.classList.add('filled', piece.type);
    }
  });
}

function getPreviewMatrix(type) {
  switch (type) {
    case 'I': return [[1, 1, 1, 1]];
    case 'O': return [[1, 1], [1, 1]];
    case 'J': return [[1, 0, 0], [1, 1, 1], [0, 0, 0]];
    case 'L': return [[0, 0, 1], [1, 1, 1], [0, 0, 0]];
    case 'S': return [[0, 1, 1], [1, 1, 0], [0, 0, 0]];
    case 'T': return [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
    case 'Z': return [[1, 1, 0], [0, 1, 1], [0, 0, 0]];
    default: return [[0]];
  }
}

function stopLoop() {
  if (dropTimer) {
    clearInterval(dropTimer);
    dropTimer = null;
  }
}

function updateStatus() {
  statusPill.textContent = game.status === 'paused' ? 'Paused' : game.gameOver ? 'Game over' : 'Playing';
  scoreEl.textContent = game.score;
  levelEl.textContent = game.level;
  linesEl.textContent = game.lines;
  pauseBtn.textContent = game.status === 'paused' ? 'Resume' : 'Pause';
  hardDropBtn.textContent = 'Hard drop';
  renderBoard();
  renderPreview(nextGrid, game.nextPiece);
  if (game.holdPiece) {
    renderPreview(holdGrid, { ...game.holdPiece, matrix: getPreviewMatrix(game.holdPiece.type) });
  } else {
    renderPreview(holdGrid, null);
  }

  if (game.gameOver && !rankingSaved) {
    saveRanking();
    rankingSaved = true;
  } else if (!game.gameOver) {
    rankingSaved = false;
  }
}

function startLoop() {
  stopLoop();
  const tickMs = Math.max(160, 900 - (game.level - 1) * 70);
  dropTimer = setInterval(() => {
    game = stepGame(game);
    updateStatus();
    if (game.gameOver) stopLoop();
  }, tickMs);
}

function restart() {
  game = restartGame();
  updateStatus();
  startLoop();
}

function saveRanking() {
  const ranking = loadRanking();
  if (game.gameOver && game.score > 0) {
    const name = (nicknameInput.value || 'Player').trim().slice(0, 12) || 'Player';
    ranking.push({ name, score: game.score, lines: game.lines, level: game.level, date: new Date().toLocaleDateString() });
    ranking.sort((a, b) => b.score - a.score);
    const top = ranking.slice(0, 10);
    localStorage.setItem(storageKey, JSON.stringify(top));
    renderRanking(top);
  }
}

function loadRanking() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderRanking(items = loadRanking()) {
  rankingEl.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No scores yet';
    rankingEl.appendChild(empty);
    return;
  }
  items.forEach((entry, index) => {
    const item = document.createElement('li');
    item.textContent = `${index + 1}. ${entry.name} — ${entry.score} pts`;
    rankingEl.appendChild(item);
  });
}

function handleMove(dx) {
  game = movePiece(game, dx);
  updateStatus();
}

function handleKeydown(event) {
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'p', 'P'].includes(event.key)) event.preventDefault();
  if (game.status !== 'playing' && event.key.toLowerCase() !== 'p') return;
  switch (event.key) {
    case 'ArrowLeft':
      handleMove(-1);
      break;
    case 'ArrowRight':
      handleMove(1);
      break;
    case 'ArrowDown':
      game = softDrop(game);
      updateStatus();
      break;
    case 'ArrowUp':
      game = rotatePiece(game);
      updateStatus();
      break;
    case ' ':
      game = hardDrop(game);
      updateStatus();
      break;
    case 'p':
    case 'P':
      game = togglePause(game);
      updateStatus();
      break;
    default:
      break;
  }
}

pauseBtn.addEventListener('click', () => {
  game = togglePause(game);
  updateStatus();
  if (game.status === 'playing') {
    startLoop();
  } else {
    stopLoop();
  }
});

restartBtn.addEventListener('click', restart);
hardDropBtn.addEventListener('click', () => {
  game = hardDrop(game);
  updateStatus();
});

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-action');
    if (action === 'left') handleMove(-1);
    if (action === 'right') handleMove(1);
    if (action === 'soft') { game = softDrop(game); updateStatus(); }
    if (action === 'rotate') { game = rotatePiece(game); updateStatus(); }
    if (action === 'hard') { game = hardDrop(game); updateStatus(); }
    if (action === 'hold') { game = holdPiece(game); updateStatus(); }
  });
}

document.addEventListener('keydown', handleKeydown);

nicknameInput.addEventListener('input', () => {
  const safeValue = nicknameInput.value.replace(/[^\w\s-]/g, '').slice(0, 12);
  nicknameInput.value = safeValue || 'Player';
});

renderRanking(loadRanking());
updateStatus();
startLoop();
