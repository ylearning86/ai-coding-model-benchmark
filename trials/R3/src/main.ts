import {
  COLS,
  Game,
  ROWS,
  mergeRanking,
  parseRanking,
  sanitizeName,
  shapeOf,
  type Kind,
  type ScoreEntry,
} from './engine';

const COLORS: Record<Kind, string> = {
  I: '#3ad7f0',
  J: '#5b7cfa',
  L: '#ff9f43',
  O: '#ffd93d',
  S: '#3ddc97',
  T: '#b06bfa',
  Z: '#ff6b81',
};
const RANK_KEY = 'cascade.ranking.v1';
const NAME_KEY = 'cascade.player.v1';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`element #${id} not found`);
  return node as T;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas.getContext('2d');
  if (!c) throw new Error('2d context unavailable');
  return c;
}

const boardCanvas = el<HTMLCanvasElement>('board');
const nextCanvas = el<HTMLCanvasElement>('next');
const holdCanvas = el<HTMLCanvasElement>('hold');
const boardCtx = ctx2d(boardCanvas);
const overlay = el('overlay');
const ovTitle = el('ovTitle');
const ovText = el('ovText');
const ovForm = el('ovForm');
const nick = el<HTMLInputElement>('nick');
const btnPrimary = el<HTMLButtonElement>('btnPrimary');
const btnRestart = el<HTMLButtonElement>('btnRestart');
const rankingList = el<HTMLOListElement>('ranking');
const toast = el('toast');
const statScore = el('statScore');
const statLevel = el('statLevel');
const statLines = el('statLines');
const whoName = el('whoName');
const pad = el('pad');

const game = new Game();
let player = 'PLAYER';
let lastStatus = game.status;
let flashFx: { rows: number[]; until: number } | null = null;
let lockFx: { cells: [number, number][]; until: number } | null = null;
let trailFx: { cols: number[]; from: number; to: number; kind: Kind; until: number } | null = null;
let toastTimer = 0;

/* ---------- storage (localStorage は失敗しても遊べるようにする) ---------- */

function loadRanking(): ScoreEntry[] {
  try {
    return parseRanking(localStorage.getItem(RANK_KEY));
  } catch {
    return [];
  }
}

function saveRanking(list: ScoreEntry[]): void {
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify(list));
  } catch {
    /* 保存できない環境ではランキングを諦める */
  }
}

function loadName(): string {
  try {
    return sanitizeName(localStorage.getItem(NAME_KEY) ?? '');
  } catch {
    return 'PLAYER';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* 保存できない環境では名前を保持しない */
  }
}

/* ---------- rendering ---------- */

function fit(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}

function fitAll(): void {
  fit(boardCanvas);
  fit(nextCanvas);
  fit(holdCanvas);
}

function drawBlock(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha = 1,
): void {
  const pad2 = Math.max(1, size * 0.06);
  const inner = size - pad2 * 2;
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.fillRect(x + pad2, y + pad2, inner, inner);
  c.fillStyle = 'rgba(255,255,255,0.3)';
  c.fillRect(x + pad2, y + pad2, inner, inner * 0.26);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(x + pad2, y + pad2 + inner * 0.8, inner, inner * 0.2);
  c.globalAlpha = 1;
}

function renderBoard(now: number): void {
  const w = boardCanvas.width;
  const h = boardCanvas.height;
  const cell = w / COLS;
  boardCtx.clearRect(0, 0, w, h);
  boardCtx.fillStyle = '#080b14';
  boardCtx.fillRect(0, 0, w, h);

  boardCtx.strokeStyle = 'rgba(255,255,255,0.05)';
  boardCtx.lineWidth = 1;
  boardCtx.beginPath();
  for (let c = 1; c < COLS; c += 1) {
    boardCtx.moveTo(c * cell, 0);
    boardCtx.lineTo(c * cell, h);
  }
  for (let r = 1; r < ROWS; r += 1) {
    boardCtx.moveTo(0, r * cell);
    boardCtx.lineTo(w, r * cell);
  }
  boardCtx.stroke();

  if (trailFx) {
    const t = Math.max(0, (trailFx.until - now) / 220);
    for (const col of trailFx.cols) {
      const grad = boardCtx.createLinearGradient(0, trailFx.from * cell, 0, (trailFx.to + 1) * cell);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, COLORS[trailFx.kind]);
      boardCtx.globalAlpha = 0.4 * t;
      boardCtx.fillStyle = grad;
      boardCtx.fillRect(col * cell, trailFx.from * cell, cell, (trailFx.to - trailFx.from + 1) * cell);
      boardCtx.globalAlpha = 1;
    }
    if (t <= 0) trailFx = null;
  }

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const kind = game.board[r][c];
      if (kind) drawBlock(boardCtx, c * cell, r * cell, cell, COLORS[kind]);
    }
  }

  const piece = game.active;
  if (piece && game.status !== 'over') {
    const gy = game.ghostY();
    boardCtx.strokeStyle = COLORS[piece.kind];
    boardCtx.globalAlpha = 0.4;
    boardCtx.lineWidth = Math.max(1.5, cell * 0.06);
    piece.shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        const y = gy + r;
        if (y < 0) return;
        boardCtx.strokeRect(
          (piece.x + c) * cell + cell * 0.14,
          y * cell + cell * 0.14,
          cell * 0.72,
          cell * 0.72,
        );
      });
    });
    boardCtx.globalAlpha = 1;
  }

  if (piece) {
    piece.shape.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        const y = piece.y + r;
        if (y < 0) return;
        drawBlock(boardCtx, (piece.x + c) * cell, y * cell, cell, COLORS[piece.kind]);
      });
    });
  }

  if (lockFx) {
    const t = Math.max(0, (lockFx.until - now) / 140);
    boardCtx.globalAlpha = 0.55 * t;
    boardCtx.fillStyle = '#ffffff';
    for (const [x, y] of lockFx.cells) boardCtx.fillRect(x * cell, y * cell, cell, cell);
    boardCtx.globalAlpha = 1;
    if (t <= 0) lockFx = null;
  }

  if (flashFx) {
    const t = Math.max(0, (flashFx.until - now) / 320);
    for (const r of flashFx.rows) {
      const grad = boardCtx.createLinearGradient(0, r * cell, 0, (r + 1) * cell);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, `rgba(255,255,255,${0.85 * t})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      boardCtx.fillStyle = grad;
      boardCtx.fillRect(0, r * cell - cell * 0.4 * (1 - t), w, cell * (1 + 0.8 * (1 - t)));
    }
    if (t <= 0) flashFx = null;
  }
}

function drawPreview(canvas: HTMLCanvasElement, kinds: (Kind | null)[]): void {
  const c = ctx2d(canvas);
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);
  const slot = h / kinds.length;
  const cell = Math.min(w / 5.2, slot / 3.4);
  kinds.forEach((kind, i) => {
    if (!kind) return;
    const shape = shapeOf(kind);
    const pts: [number, number][] = [];
    shape.forEach((row, r) => {
      row.forEach((v, col) => {
        if (v) pts.push([col, r]);
      });
    });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const pw = (Math.max(...xs) - minX + 1) * cell;
    const ph = (Math.max(...ys) - minY + 1) * cell;
    const ox = (w - pw) / 2 - minX * cell;
    const oy = i * slot + (slot - ph) / 2 - minY * cell;
    for (const [px, py] of pts) {
      drawBlock(c, ox + px * cell, oy + py * cell, cell, COLORS[kind], i === 0 ? 1 : 0.6);
    }
  });
}

/* ---------- HUD / overlay ---------- */

let hud = { score: -1, level: -1, lines: -1 };

function updateHud(): void {
  if (hud.score !== game.score) {
    statScore.textContent = game.score.toLocaleString('en-US');
    hud.score = game.score;
  }
  if (hud.level !== game.level) {
    statLevel.textContent = String(game.level);
    hud.level = game.level;
  }
  if (hud.lines !== game.lines) {
    statLines.textContent = String(game.lines);
    hud.lines = game.lines;
  }
}

function showToast(text: string, accent = false): void {
  toast.textContent = text;
  toast.style.color = accent ? '#ffd93d' : '';
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 700);
}

function renderRanking(): void {
  const list = loadRanking();
  rankingList.replaceChildren();
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'まだ記録がありません';
    rankingList.append(li);
    return;
  }
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    const rk = document.createElement('span');
    rk.className = 'rk';
    rk.textContent = String(i + 1);
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = `${entry.name}  (Lv${entry.level} / ${entry.lines}L)`;
    const sc = document.createElement('span');
    sc.className = 'sc';
    sc.textContent = entry.score.toLocaleString('en-US');
    li.append(rk, nm, sc);
    rankingList.append(li);
  });
}

function showOverlay(view: 'ready' | 'paused' | 'over'): void {
  renderRanking();
  ovForm.style.display = view === 'paused' ? 'none' : '';
  btnRestart.style.display = view === 'ready' ? 'none' : '';
  if (view === 'ready') {
    ovTitle.textContent = 'CASCADE BLOCKS';
    ovText.textContent = 'ブロックを積んで横一列をそろえると消えます。ニックネームを入れて開始してください。';
    btnPrimary.textContent = 'ゲーム開始';
  } else if (view === 'paused') {
    ovTitle.textContent = 'PAUSED';
    ovText.textContent = '一時停止中です。再開すると続きから遊べます。';
    btnPrimary.textContent = '再開';
  } else {
    ovTitle.textContent = 'GAME OVER';
    ovText.textContent = `${player} — ${game.score.toLocaleString('en-US')} 点 / レベル ${game.level} / ${game.lines} ライン`;
    btnPrimary.textContent = 'もう一度あそぶ';
  }
  overlay.classList.add('show');
}

function hideOverlay(): void {
  overlay.classList.remove('show');
}

function startGame(): void {
  player = sanitizeName(nick.value);
  nick.value = player;
  whoName.textContent = player;
  saveName(player);
  game.start();
  lastStatus = 'playing';
  flashFx = null;
  lockFx = null;
  trailFx = null;
  hud = { score: -1, level: -1, lines: -1 };
  hideOverlay();
}

function finish(): void {
  const entry: ScoreEntry = {
    name: player,
    score: game.score,
    lines: game.lines,
    level: game.level,
    at: Date.now(),
  };
  saveRanking(mergeRanking(loadRanking(), entry));
  showOverlay('over');
}

function togglePause(): void {
  if (game.status === 'playing') {
    game.togglePause();
    showOverlay('paused');
  } else if (game.status === 'paused') {
    game.togglePause();
    hideOverlay();
  }
}

/* ---------- input ---------- */

function act(name: string): void {
  switch (name) {
    case 'left': game.move(-1); break;
    case 'right': game.move(1); break;
    case 'rotate': game.rotatePiece(1); break;
    case 'rotateCCW': game.rotatePiece(-1); break;
    case 'soft': game.softDrop(); break;
    case 'hard': game.hardDrop(); break;
    case 'hold': game.holdPiece(); break;
    case 'pause': togglePause(); break;
    case 'restart': startGame(); break;
    default: break;
  }
}

const KEYS: Record<string, string> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'rotate',
  x: 'rotate',
  X: 'rotate',
  z: 'rotateCCW',
  Z: 'rotateCCW',
  ArrowDown: 'soft',
  ' ': 'hard',
  c: 'hold',
  C: 'hold',
  p: 'pause',
  P: 'pause',
  Escape: 'pause',
  r: 'restart',
  R: 'restart',
};

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnPrimary.click();
    }
    return;
  }
  const action = KEYS[e.key];
  if (!action) return;
  e.preventDefault();
  if (game.status === 'ready' || (game.status === 'over' && action !== 'restart')) return;
  act(action);
});

let repeatDelay = 0;
let repeatTimer = 0;

function stopRepeat(): void {
  window.clearTimeout(repeatDelay);
  window.clearInterval(repeatTimer);
}

pad.addEventListener('pointerdown', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.act;
  if (!action) return;
  e.preventDefault();
  act(action);
  if (action === 'left' || action === 'right' || action === 'soft') {
    stopRepeat();
    repeatDelay = window.setTimeout(() => {
      repeatTimer = window.setInterval(() => act(action), 60);
    }, 190);
  }
});
pad.addEventListener('pointerup', stopRepeat);
pad.addEventListener('pointercancel', stopRepeat);
pad.addEventListener('pointerleave', stopRepeat);

let swipe: { x: number; y: number; t: number; moved: boolean } | null = null;

boardCanvas.addEventListener('pointerdown', (e) => {
  swipe = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
});
boardCanvas.addEventListener('pointermove', (e) => {
  if (!swipe || game.status !== 'playing') return;
  const step = boardCanvas.getBoundingClientRect().width / COLS;
  const dx = e.clientX - swipe.x;
  if (Math.abs(dx) >= step) {
    act(dx > 0 ? 'right' : 'left');
    swipe.x += Math.sign(dx) * step;
    swipe.moved = true;
  }
});
boardCanvas.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dy = e.clientY - swipe.y;
  const quick = performance.now() - swipe.t < 400;
  if (!swipe.moved && game.status === 'playing') {
    if (quick && dy > 46) act('hard');
    else if (Math.abs(dy) < 16) act('rotate');
  }
  swipe = null;
});

btnPrimary.addEventListener('click', () => {
  if (game.status === 'paused') togglePause();
  else startGame();
});
btnRestart.addEventListener('click', startGame);
window.addEventListener('resize', fitAll);

/* ---------- loop ---------- */

function consume(now: number): void {
  if (game.lastLock) {
    lockFx = { cells: game.lastLock.cells, until: now + 140 };
    game.lastLock = null;
  }
  if (game.lastTrail) {
    trailFx = { ...game.lastTrail, until: now + 220 };
    game.lastTrail = null;
  }
  if (game.lastClear) {
    const ev = game.lastClear;
    game.lastClear = null;
    flashFx = { rows: ev.rows, until: now + 320 };
    if (ev.levelUp) {
      showToast(`LEVEL ${game.level}`, true);
      statLevel.classList.remove('pulse');
      void statLevel.offsetWidth;
      statLevel.classList.add('pulse');
    } else {
      showToast(`+${ev.score}`);
    }
  }
  if (game.status === 'over' && lastStatus !== 'over') finish();
  lastStatus = game.status;
}

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(100, now - last);
  last = now;
  if (game.status === 'playing') game.tick(dt);
  consume(now);
  updateHud();
  renderBoard(now);
  drawPreview(nextCanvas, game.queue.slice(0, 3));
  drawPreview(holdCanvas, [game.hold]);
  requestAnimationFrame(frame);
}

player = loadName();
nick.value = player;
whoName.textContent = player;
fitAll();
showOverlay('ready');
requestAnimationFrame(frame);
