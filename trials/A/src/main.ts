import './styles.css';

import { Engine, type GameEvent, type GameView } from './game/engine';
import { Effects } from './ui/effects';
import { Hud } from './ui/hud';
import { InputController, type InputIntent } from './ui/input';
import { RankingStore, type ScoreEntry } from './ui/ranking';
import { BoardRenderer, PreviewRenderer } from './ui/renderer';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing required element: #${id}`);
  return found as T;
}

const boardCanvas = element<HTMLCanvasElement>('board');
const holdCanvas = element<HTMLCanvasElement>('hold-canvas');
const nextCanvas = element<HTMLCanvasElement>('next-canvas');
const boardSurface = element<HTMLElement>('board-surface');
const touchpad = element<HTMLElement>('touchpad');

const prefersReducedMotion =
  typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

const engine = new Engine();
const effects = new Effects(!prefersReducedMotion);
const boardRenderer = new BoardRenderer(boardCanvas);
const holdRenderer = new PreviewRenderer(holdCanvas);
const nextRenderer = new PreviewRenderer(nextCanvas);
const ranking = new RankingStore();

let entries: ScoreEntry[] = ranking.load();
let bestScore = entries[0]?.score ?? 0;
let playerName = ranking.loadName();
let gameOverHandled = false;

const hud = new Hud({
  onStart(name) {
    playerName = name;
    ranking.saveName(name);
    beginGame();
  },
  onResume() {
    if (engine.resume()) hud.hideOverlay();
  },
  onRestart() {
    beginGame();
  },
  onPauseToggle() {
    togglePause();
  },
  onNameChange(name) {
    playerName = name;
    ranking.saveName(name);
  },
  onClearRanking() {
    ranking.clear();
    entries = [];
    bestScore = 0;
    hud.renderRanking(entries);
    hud.toast('ランキングを消去しました');
  },
});

hud.setName(playerName);
hud.renderRanking(entries);

function beginGame(): void {
  gameOverHandled = false;
  effects.clear();
  input.releaseAll();
  engine.start();
  hud.hideOverlay();
  hud.renderRanking(entries);
}

function togglePause(): void {
  if (engine.status === 'playing') {
    engine.pause();
    input.releaseAll();
    hud.showPaused();
  } else if (engine.status === 'paused') {
    engine.resume();
    hud.hideOverlay();
  }
}

function handleIntent(intent: InputIntent): void {
  const status = engine.status;

  switch (intent.type) {
    case 'restart':
      beginGame();
      return;
    case 'pause':
      if (status === 'playing' || status === 'paused') togglePause();
      return;
    case 'confirm':
      hud.confirm();
      return;
    default:
      break;
  }

  if (status !== 'playing') return;

  switch (intent.type) {
    case 'move':
      if (intent.dir === -1) engine.moveLeft();
      else engine.moveRight();
      break;
    case 'rotate':
      handleEvents(engine.rotate(intent.dir));
      break;
    case 'softdrop':
      engine.setSoftDrop(intent.active);
      break;
    case 'harddrop':
      handleEvents(engine.hardDrop());
      break;
    case 'hold':
      handleEvents(engine.hold());
      break;
    default:
      break;
  }
}

const input = new InputController({
  board: boardSurface,
  pad: touchpad,
  emit: handleIntent,
});

function handleEvents(events: readonly GameEvent[]): void {
  if (events.length === 0) return;
  effects.consume(events);

  for (const event of events) {
    switch (event.kind) {
      case 'clear': {
        const label = event.label || 'CLEAR';
        hud.toast(`${label}  +${event.points}`, event.lineCount >= 4 ? 'strong' : 'normal');
        break;
      }
      case 'levelup':
        hud.toast(`LEVEL ${event.level}`, 'strong');
        break;
      case 'gameover':
        finishGame();
        break;
      default:
        break;
    }
  }
}

function finishGame(): void {
  if (gameOverHandled) return;
  gameOverHandled = true;
  input.releaseAll();

  const view = engine.getView();
  const result = ranking.submit({
    name: playerName,
    score: view.score,
    lines: view.lines,
    level: view.level,
  });

  entries = result.entries;
  bestScore = entries[0]?.score ?? bestScore;
  const rank = result.rank === -1 ? null : result.rank;

  hud.renderRanking(entries, rank === null ? null : rank - 1);
  hud.showGameOver({
    score: view.score,
    lines: view.lines,
    level: view.level,
    pieces: view.piecesPlaced,
    durationMs: view.elapsedMs,
    rank,
  });
}

function draw(view: GameView): void {
  boardRenderer.render(view, effects);
  holdRenderer.render([view.hold], view.holdUsed);
  nextRenderer.render(view.next);
  hud.update(view, Math.max(bestScore, view.score));
}

function resizeAll(): void {
  boardRenderer.resize();
  holdRenderer.resize();
  nextRenderer.resize();
  draw(engine.getView());
}

if (typeof ResizeObserver === 'function') {
  const observer = new ResizeObserver(() => resizeAll());
  observer.observe(boardSurface);
  observer.observe(holdCanvas);
  observer.observe(nextCanvas);
} else {
  globalThis.addEventListener('resize', resizeAll);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && engine.status === 'playing') {
    engine.pause();
    input.releaseAll();
    hud.showPaused();
  }
});

let previous = performance.now();

function frame(now: number): void {
  const delta = Math.min(now - previous, 100);
  previous = now;

  input.update(delta);
  handleEvents(engine.tick(delta));
  effects.update(delta);
  draw(engine.getView());

  globalThis.requestAnimationFrame(frame);
}

hud.showReady();
resizeAll();
globalThis.requestAnimationFrame(frame);
