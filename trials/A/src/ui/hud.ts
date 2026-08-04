import type { GameView } from '../game/engine';
import { MAX_NAME_LENGTH, sanitizeName, type ScoreEntry } from './ranking';

export interface GameSummary {
  score: number;
  lines: number;
  level: number;
  pieces: number;
  durationMs: number;
  rank: number | null;
}

export interface HudCallbacks {
  onStart(name: string): void;
  onResume(): void;
  onRestart(): void;
  onPauseToggle(): void;
  onNameChange(name: string): void;
  onClearRanking(): void;
}

type OverlayMode = 'hidden' | 'ready' | 'paused' | 'gameover';

function required<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as unknown as T;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/** Owns every DOM node outside the canvas: stats, overlays, toasts, ranking. */
export class Hud {
  private readonly score = required<HTMLElement>('stat-score');
  private readonly lines = required<HTMLElement>('stat-lines');
  private readonly level = required<HTMLElement>('stat-level');
  private readonly combo = required<HTMLElement>('stat-combo');
  private readonly best = required<HTMLElement>('stat-best');
  private readonly timer = required<HTMLElement>('stat-time');
  private readonly badge = required<HTMLElement>('status-badge');

  private readonly overlay = required<HTMLElement>('overlay');
  private readonly overlayEyebrow = required<HTMLElement>('overlay-eyebrow');
  private readonly overlayTitle = required<HTMLElement>('overlay-title');
  private readonly overlayText = required<HTMLElement>('overlay-text');
  private readonly overlaySummary = required<HTMLElement>('overlay-summary');
  private readonly overlayHint = required<HTMLElement>('overlay-hint');
  private readonly primary = required<HTMLButtonElement>('overlay-primary');
  private readonly secondary = required<HTMLButtonElement>('overlay-secondary');
  private readonly nameField = required<HTMLElement>('nickname-field');
  private readonly nameInput = required<HTMLInputElement>('nickname');

  private readonly rankingList = required<HTMLOListElement>('ranking-list');
  private readonly rankingEmpty = required<HTMLElement>('ranking-empty');
  private readonly clearRankingBtn = required<HTMLButtonElement>('btn-clear-ranking');
  private readonly pauseBtn = required<HTMLButtonElement>('btn-pause');
  private readonly restartBtn = required<HTMLButtonElement>('btn-restart');
  private readonly toastLayer = required<HTMLElement>('toast-layer');

  private mode: OverlayMode = 'ready';
  private lastCombo = -1;

  constructor(private readonly callbacks: HudCallbacks) {
    this.nameInput.maxLength = MAX_NAME_LENGTH;

    this.primary.addEventListener('click', () => this.handlePrimary());
    this.secondary.addEventListener('click', () => this.callbacks.onRestart());
    this.pauseBtn.addEventListener('click', () => this.callbacks.onPauseToggle());
    this.restartBtn.addEventListener('click', () => this.callbacks.onRestart());
    this.clearRankingBtn.addEventListener('click', () => {
      if (globalThis.confirm('ローカルに保存されたランキングを削除します。よろしいですか？')) {
        this.callbacks.onClearRanking();
      }
    });
    this.nameInput.addEventListener('change', () => {
      const clean = sanitizeName(this.nameInput.value);
      this.nameInput.value = clean;
      this.callbacks.onNameChange(clean);
    });
    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.handlePrimary();
      }
    });
  }

  /** Called when the player presses Enter outside of a text field. */
  confirm(): void {
    if (this.mode === 'hidden') return;
    this.handlePrimary();
  }

  private handlePrimary(): void {
    switch (this.mode) {
      case 'ready':
        this.callbacks.onStart(sanitizeName(this.nameInput.value));
        break;
      case 'paused':
        this.callbacks.onResume();
        break;
      case 'gameover':
        this.callbacks.onRestart();
        break;
      default:
        break;
    }
  }

  setName(name: string): void {
    this.nameInput.value = name;
  }

  getName(): string {
    return sanitizeName(this.nameInput.value);
  }

  update(view: GameView, best: number): void {
    this.score.textContent = formatNumber(view.score);
    this.lines.textContent = formatNumber(view.lines);
    this.level.textContent = String(view.level);
    this.best.textContent = formatNumber(best);
    this.timer.textContent = formatDuration(view.elapsedMs);

    const combo = view.combo > 0 ? view.combo : 0;
    if (combo !== this.lastCombo) {
      this.lastCombo = combo;
      this.combo.textContent = combo > 0 ? `${combo}` : '-';
      this.combo.classList.toggle('is-active', combo > 0);
    }

    this.pauseBtn.disabled = view.status !== 'playing' && view.status !== 'paused';
    this.pauseBtn.textContent = view.status === 'paused' ? '再開' : '一時停止';
    this.badge.textContent = statusLabel(view.status);
    this.badge.dataset.status = view.status;
  }

  showReady(): void {
    this.mode = 'ready';
    this.overlay.hidden = false;
    this.overlay.dataset.mode = 'ready';
    this.overlayEyebrow.textContent = 'WELCOME';
    this.overlayTitle.textContent = 'PRISMFALL';
    this.overlayText.textContent =
      '光のブロックを積み上げて、横一列をそろえて消していくパズルです。ニックネームを入れてスタートしてください。';
    this.overlaySummary.hidden = true;
    this.nameField.hidden = false;
    this.primary.textContent = 'ゲームを開始';
    this.secondary.hidden = true;
    this.overlayHint.textContent = '操作方法：← → 移動 / ↑ 回転 / ↓ ソフトドロップ / Space ハードドロップ / C ホールド';
  }

  showPaused(): void {
    this.mode = 'paused';
    this.overlay.hidden = false;
    this.overlay.dataset.mode = 'paused';
    this.overlayEyebrow.textContent = 'PAUSED';
    this.overlayTitle.textContent = '一時停止中';
    this.overlayText.textContent = '席を外しても大丈夫。準備ができたら再開してください。';
    this.overlaySummary.hidden = true;
    this.nameField.hidden = true;
    this.primary.textContent = '再開する';
    this.secondary.hidden = false;
    this.secondary.textContent = 'はじめから';
    this.overlayHint.textContent = 'P / Esc でも再開できます。R でリスタート。';
  }

  showGameOver(summary: GameSummary): void {
    this.mode = 'gameover';
    this.overlay.hidden = false;
    this.overlay.dataset.mode = 'gameover';
    this.overlayEyebrow.textContent = 'GAME OVER';
    this.overlayTitle.textContent =
      summary.rank !== null ? `ランキング ${summary.rank} 位！` : 'おつかれさまでした';
    this.overlayText.textContent =
      summary.rank !== null
        ? 'スコアをこの端末のランキングに保存しました。'
        : 'あと少しでランキング入りです。もう一度挑戦してみましょう。';
    this.nameField.hidden = true;
    this.primary.textContent = 'もう一度あそぶ';
    this.secondary.hidden = true;
    this.overlayHint.textContent = 'Enter / R キーでもリスタートできます。';

    this.overlaySummary.hidden = false;
    this.renderSummary(summary);
  }

  hideOverlay(): void {
    this.mode = 'hidden';
    this.overlay.hidden = true;
    this.overlay.dataset.mode = 'hidden';
  }

  private renderSummary(summary: GameSummary): void {
    this.overlaySummary.replaceChildren();
    const rows: Array<[string, string]> = [
      ['SCORE', formatNumber(summary.score)],
      ['LINES', formatNumber(summary.lines)],
      ['LEVEL', String(summary.level)],
      ['PIECES', formatNumber(summary.pieces)],
      ['TIME', formatDuration(summary.durationMs)],
    ];
    for (const [label, value] of rows) {
      const item = document.createElement('div');
      item.className = 'summary__item';
      const key = document.createElement('span');
      key.textContent = label;
      const val = document.createElement('strong');
      val.textContent = value;
      item.append(key, val);
      this.overlaySummary.append(item);
    }
  }

  renderRanking(entries: readonly ScoreEntry[], highlightIndex: number | null = null): void {
    this.rankingList.replaceChildren();
    this.rankingEmpty.hidden = entries.length > 0;
    this.clearRankingBtn.disabled = entries.length === 0;

    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'ranking__row';
      if (index === highlightIndex) item.classList.add('is-new');

      const rank = document.createElement('span');
      rank.className = 'ranking__rank';
      rank.textContent = String(index + 1);

      const name = document.createElement('span');
      name.className = 'ranking__name';
      // textContent only: player input is never interpreted as markup.
      name.textContent = entry.name;

      const score = document.createElement('span');
      score.className = 'ranking__score';
      score.textContent = formatNumber(entry.score);

      const meta = document.createElement('span');
      meta.className = 'ranking__meta';
      meta.textContent = `Lv.${entry.level} / ${formatNumber(entry.lines)}L / ${formatDate(entry.date)}`;

      item.append(rank, name, score, meta);
      this.rankingList.append(item);
    });
  }

  toast(text: string, tone: 'normal' | 'strong' = 'normal'): void {
    const node = document.createElement('div');
    node.className = `toast toast--${tone}`;
    node.textContent = text;
    this.toastLayer.append(node);
    globalThis.setTimeout(() => node.remove(), 1400);
    while (this.toastLayer.childElementCount > 4) {
      this.toastLayer.firstElementChild?.remove();
    }
  }
}

function statusLabel(status: GameView['status']): string {
  switch (status) {
    case 'playing':
      return 'PLAYING';
    case 'paused':
      return 'PAUSED';
    case 'gameover':
      return 'GAME OVER';
    default:
      return 'READY';
  }
}
