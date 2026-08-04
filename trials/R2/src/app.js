import { BlockGame, COLORS, SHAPES, COLS, ROWS } from './game.js';

const canvas = document.querySelector('#gameCanvas');
const context = canvas.getContext('2d');
const holdContext = document.querySelector('#holdCanvas').getContext('2d');
const nextContext = document.querySelector('#nextCanvas').getContext('2d');
const overlay = document.querySelector('#statusOverlay');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayKicker = document.querySelector('#overlayKicker');
const overlayText = document.querySelector('#overlayText');
const primaryButton = document.querySelector('#primaryButton');
const pauseButton = document.querySelector('#pauseButton');
const nicknameInput = document.querySelector('#nicknameInput');
const rankingList = document.querySelector('#rankingList');
const scoreValue = document.querySelector('#scoreValue');
const levelValue = document.querySelector('#levelValue');
const linesValue = document.querySelector('#linesValue');

const game = new BlockGame();
let running = false;
let lastDropAt = 0;
let lastFrameAt = 0;
let finishedRecorded = false;
let clearFlashUntil = 0;
const rankingKey = 'lumen-fall-ranking-v1';

function sanitizeName(value) {
  const compact = String(value).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 16);
  return compact || 'PLAYER';
}

function loadRanking() {
  try {
    const parsed = JSON.parse(localStorage.getItem(rankingKey) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(entry => entry && Number.isFinite(entry.score))
      .map(entry => ({ name: sanitizeName(entry.name), score: Math.max(0, Math.floor(entry.score)) }))
      .sort((a, b) => b.score - a.score).slice(0, 5);
  } catch {
    return [];
  }
}

function renderRanking() {
  rankingList.replaceChildren();
  const ranking = loadRanking();
  if (!ranking.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-rank';
    empty.textContent = 'NO SIGNAL YET';
    rankingList.append(empty);
    return;
  }
  ranking.forEach(entry => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const score = document.createElement('strong');
    name.textContent = entry.name;
    score.textContent = entry.score.toLocaleString();
    item.append(name, score);
    rankingList.append(item);
  });
}

function recordScore() {
  if (finishedRecorded) return;
  finishedRecorded = true;
  const ranking = [...loadRanking(), { name: sanitizeName(nicknameInput.value), score: game.score }]
    .sort((a, b) => b.score - a.score).slice(0, 5);
  try { localStorage.setItem(rankingKey, JSON.stringify(ranking)); } catch { /* Storage can be disabled. */ }
  renderRanking();
}

function drawCell(target, x, y, size, color, alpha = 1) {
  target.save();
  target.globalAlpha = alpha;
  target.fillStyle = color;
  target.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  target.fillStyle = 'rgba(255,255,255,.23)';
  target.fillRect(x * size + 3, y * size + 3, size - 6, 2);
  target.strokeStyle = color;
  target.globalAlpha = alpha * .45;
  target.strokeRect(x * size + 3.5, y * size + 3.5, size - 7, size - 7);
  target.restore();
}

function drawPiece(target, piece, size, overrideY = null, alpha = 1) {
  const y = overrideY ?? piece.y;
  piece.matrix.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => {
    if (cell && y + rowIndex >= 0) {
      drawCell(target, piece.x + columnIndex, y + rowIndex, size, COLORS[piece.type], alpha);
    }
  }));
}

function drawBoard(now) {
  const size = canvas.width / COLS;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#07101a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(91,129,150,.1)';
  context.lineWidth = 1;
  for (let x = 1; x < COLS; x += 1) {
    context.beginPath(); context.moveTo(x * size, 0); context.lineTo(x * size, canvas.height); context.stroke();
  }
  for (let y = 1; y < ROWS; y += 1) {
    context.beginPath(); context.moveTo(0, y * size); context.lineTo(canvas.width, y * size); context.stroke();
  }
  game.board.forEach((row, y) => row.forEach((type, x) => {
    if (type) drawCell(context, x, y, size, COLORS[type], now < clearFlashUntil ? .55 : 1);
  }));
  if (!game.over) {
    drawPiece(context, game.active, size, game.getGhostY(), .18);
    drawPiece(context, game.active, size);
  }
}

function drawMini(target, type, slot, slotHeight) {
  if (!type) return;
  const matrix = SHAPES[type];
  const size = 20;
  const offsetX = (target.canvas.width - matrix[0].length * size) / 2 / size;
  const offsetY = (slot * slotHeight + (slotHeight - matrix.length * size) / 2) / size;
  matrix.forEach((row, y) => row.forEach((cell, x) => {
    if (cell) drawCell(target, offsetX + x, offsetY + y, size, COLORS[type]);
  }));
}

function renderMiniatures() {
  holdContext.clearRect(0, 0, 120, 96);
  nextContext.clearRect(0, 0, 120, 240);
  drawMini(holdContext, game.holdType, 0, 96);
  game.queue.slice(0, 3).forEach((type, index) => drawMini(nextContext, type, index, 80));
}

function renderStats() {
  scoreValue.textContent = game.score.toLocaleString();
  levelValue.textContent = game.level;
  linesValue.textContent = game.lines;
}

function showOverlay(kind) {
  overlay.classList.add('visible');
  nicknameInput.parentElement.hidden = kind === 'pause';
  if (kind === 'pause') {
    overlayKicker.textContent = 'SIGNAL SUSPENDED';
    overlayTitle.textContent = '一時停止';
    overlayText.textContent = '準備ができたら再開してください';
    primaryButton.textContent = 'RESUME';
  } else if (kind === 'over') {
    overlayKicker.textContent = 'SIGNAL LOST';
    overlayTitle.textContent = 'ゲームオーバー';
    overlayText.textContent = `${game.score.toLocaleString()} POINTS / ${game.lines} LINES`;
    primaryButton.textContent = 'RESTART';
  }
}

function startGame() {
  game.reset();
  nicknameInput.value = sanitizeName(nicknameInput.value);
  nicknameInput.parentElement.hidden = false;
  finishedRecorded = false;
  running = true;
  lastDropAt = performance.now();
  overlay.classList.remove('visible');
  pauseButton.textContent = 'Ⅱ';
  pauseButton.setAttribute('aria-label', '一時停止');
  renderMiniatures();
  renderStats();
}

function togglePause() {
  if (!running || game.over) return;
  const paused = game.togglePause();
  pauseButton.textContent = paused ? '▶' : 'Ⅱ';
  pauseButton.setAttribute('aria-label', paused ? '再開' : '一時停止');
  if (paused) showOverlay('pause');
  else {
    overlay.classList.remove('visible');
    lastDropAt = performance.now();
  }
}

function perform(action) {
  if (!running || game.over || game.paused) return;
  game.lastClear = 0;
  if (action === 'left') game.move(-1, 0);
  if (action === 'right') game.move(1, 0);
  if (action === 'rotate') game.rotate();
  if (action === 'down') game.stepDown(true);
  if (action === 'drop') game.hardDrop();
  if (action === 'hold') game.hold();
  if (game.lastClear) clearFlashUntil = performance.now() + 180;
  renderMiniatures();
  renderStats();
}

const keyActions = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate',
  ArrowDown: 'down', Space: 'drop', KeyC: 'hold'
};

window.addEventListener('keydown', event => {
  if (event.code === 'KeyP' || event.code === 'Escape') {
    event.preventDefault();
    togglePause();
    return;
  }
  const action = keyActions[event.code];
  if (action) {
    event.preventDefault();
    perform(action);
  }
});

document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    perform(button.dataset.action);
  });
});

primaryButton.addEventListener('click', () => game.paused ? togglePause() : startGame());
pauseButton.addEventListener('click', togglePause);

function loop(now) {
  const elapsed = Math.min(now - lastFrameAt, 50);
  lastFrameAt = now;
  if (running && !game.paused && !game.over && now - lastDropAt >= game.getDropInterval()) {
    game.lastClear = 0;
    game.stepDown();
    lastDropAt = now;
    if (game.lastClear) clearFlashUntil = now + 180;
    renderMiniatures();
    renderStats();
  }
  if (running && game.over) {
    recordScore();
    showOverlay('over');
    running = false;
  }
  drawBoard(now + elapsed * 0);
  requestAnimationFrame(loop);
}

renderRanking();
renderMiniatures();
renderStats();
requestAnimationFrame(loop);