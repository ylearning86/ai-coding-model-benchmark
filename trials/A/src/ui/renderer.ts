import { COLS, ROWS } from '../game/constants';
import type { GameView } from '../game/engine';
import { PIECES, getCells, type PieceType } from '../game/pieces';
import type { Effects } from './effects';
import { FIELD_BOTTOM, FIELD_TOP, GRID_LINE, GRID_LINE_STRONG, PIECE_SKINS } from './theme';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

interface BlockOptions {
  alpha?: number;
  scale?: number;
  overlay?: string;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  px: number,
  py: number,
  size: number,
  options: BlockOptions = {},
): void {
  const { alpha = 1, scale = 1, overlay } = options;
  if (alpha <= 0 || scale <= 0) return;
  const skin = PIECE_SKINS[type];
  const inset = size * 0.06;
  const full = size - inset * 2;
  const w = full * scale;
  const h = full * scale;
  const x = px + inset + (full - w) / 2;
  const y = py + inset + (full - h) / 2;
  const radius = size * 0.2;

  ctx.save();
  ctx.globalAlpha = alpha;

  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, skin.light);
  gradient.addColorStop(0.45, skin.base);
  gradient.addColorStop(1, skin.dark);
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Glass highlight across the top third.
  roundRect(ctx, x + w * 0.12, y + h * 0.1, w * 0.76, h * 0.3, radius * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();

  roundRect(ctx, x, y, w, h, radius);
  ctx.strokeStyle = 'rgba(6, 8, 20, 0.45)';
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.stroke();

  if (overlay) {
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = overlay;
    ctx.fill();
  }
  ctx.restore();
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  px: number,
  py: number,
  size: number,
): void {
  const skin = PIECE_SKINS[type];
  const inset = size * 0.12;
  const w = size - inset * 2;
  ctx.save();
  roundRect(ctx, px + inset, py + inset, w, w, size * 0.16);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = skin.base;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.stroke();
  ctx.restore();
}

/** Draws the main playfield, ghost, active piece and all transient effects. */
export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D context is not available in this browser.');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    const width = Math.max(80, Math.round(rect.width));
    const height = Math.max(160, Math.round(rect.height));
    if (width === this.cssWidth && height === this.cssHeight && dpr === this.dpr) return;
    this.cssWidth = width;
    this.cssHeight = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
  }

  render(view: GameView, effects: Effects): void {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;
    const cell = Math.min(w / COLS, h / ROWS);
    const fieldW = cell * COLS;
    const fieldH = cell * ROWS;
    const originX = (w - fieldW) / 2;
    const originY = (h - fieldH) / 2;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const shakeAmount = effects.shake;
    if (shakeAmount > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shakeAmount * cell * 0.22,
        (Math.random() - 0.5) * shakeAmount * cell * 0.22,
      );
    }

    this.drawField(originX, originY, fieldW, fieldH, cell);

    const clearingRows = new Set(view.clearing?.rows ?? []);
    const progress = view.clearing?.progress ?? 0;

    // Settled blocks.
    for (let y = 0; y < view.board.length; y += 1) {
      const row = view.board[y];
      for (let x = 0; x < row.length; x += 1) {
        const type = row[x];
        if (!type) continue;
        const clearing = clearingRows.has(y);
        drawBlock(ctx, type, originX + x * cell, originY + y * cell, cell, {
          scale: clearing ? 1 - progress * 0.75 : 1,
          alpha: clearing ? 1 - progress * 0.5 : 1,
          overlay: clearing ? `rgba(255,255,255,${0.75 * (1 - progress)})` : undefined,
        });
      }
    }

    // Sweeping light beam over the rows being cleared.
    if (view.clearing) {
      ctx.save();
      for (const row of view.clearing.rows) {
        const y = originY + row * cell;
        const beam = ctx.createLinearGradient(originX, y, originX + fieldW, y);
        beam.addColorStop(0, 'rgba(255,255,255,0)');
        beam.addColorStop(Math.min(1, progress), 'rgba(255,255,255,0.85)');
        beam.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = beam;
        ctx.globalAlpha = 1 - progress * 0.6;
        ctx.fillRect(originX, y + cell * 0.22, fieldW, cell * 0.56);
      }
      ctx.restore();
    }

    this.drawTrails(effects, originX, originY, cell);

    if (view.active && view.status !== 'gameover') {
      const { type, rotation, x, y } = view.active;
      if (view.ghostY !== null && view.ghostY !== y) {
        for (const [gx, gy] of getCells(type, rotation, x, view.ghostY)) {
          if (gy < 0) continue;
          drawGhost(ctx, type, originX + gx * cell, originY + gy * cell, cell);
        }
      }
      for (const [cx, cy] of getCells(type, rotation, x, y)) {
        if (cy < 0) continue;
        drawBlock(ctx, type, originX + cx * cell, originY + cy * cell, cell);
      }
    }

    this.drawLockFlashes(effects, originX, originY, cell);
    this.drawSparks(effects, originX, originY, cell);

    // Field border on top so blocks never bleed past the frame.
    ctx.save();
    roundRect(ctx, originX, originY, fieldW, fieldH, cell * 0.3);
    ctx.strokeStyle = 'rgba(150, 170, 235, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private drawField(x: number, y: number, w: number, h: number, cell: number): void {
    const ctx = this.ctx;
    ctx.save();
    roundRect(ctx, x, y, w, h, cell * 0.3);
    ctx.clip();

    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, FIELD_TOP);
    bg.addColorStop(1, FIELD_BOTTOM);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c += 1) {
      const px = Math.round(x + c * cell) + 0.5;
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
    }
    ctx.strokeStyle = GRID_LINE;
    ctx.stroke();

    ctx.beginPath();
    for (let r = 1; r < ROWS; r += 1) {
      const py = Math.round(y + r * cell) + 0.5;
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
    }
    ctx.strokeStyle = GRID_LINE_STRONG;
    ctx.stroke();
    ctx.restore();
  }

  private drawTrails(effects: Effects, originX: number, originY: number, cell: number): void {
    const ctx = this.ctx;
    for (const trail of effects.dropTrails) {
      const t = 1 - trail.life / trail.duration;
      if (t <= 0) continue;
      const skin = PIECE_SKINS[trail.type];
      ctx.save();
      ctx.globalAlpha = t * 0.5;
      for (const [x, y] of trail.cells) {
        const top = originY + (y - trail.distance) * cell;
        const height = trail.distance * cell;
        if (height <= 0) continue;
        const grad = ctx.createLinearGradient(0, top, 0, top + height);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, skin.glow);
        ctx.fillStyle = grad;
        ctx.fillRect(originX + x * cell + cell * 0.22, top, cell * 0.56, height);
      }
      ctx.restore();
    }
  }

  private drawLockFlashes(effects: Effects, originX: number, originY: number, cell: number): void {
    const ctx = this.ctx;
    for (const flash of effects.lockFlashes) {
      const t = 1 - flash.life / flash.duration;
      if (t <= 0) continue;
      ctx.save();
      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle = '#ffffff';
      for (const [x, y] of flash.cells) {
        if (y < 0) continue;
        roundRect(ctx, originX + x * cell, originY + y * cell, cell, cell, cell * 0.2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawSparks(effects: Effects, originX: number, originY: number, cell: number): void {
    const ctx = this.ctx;
    ctx.save();
    for (const spark of effects.sparks) {
      const t = 1 - spark.life / spark.duration;
      if (t <= 0) continue;
      ctx.globalAlpha = t;
      ctx.fillStyle = spark.hue;
      const size = Math.max(1, cell * 0.12 * t);
      ctx.fillRect(originX + spark.x * cell, originY + spark.y * cell, size, size);
    }
    ctx.restore();
  }
}

/** Renders a single piece centred inside a small preview canvas. */
export class PreviewRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D context is not available in this browser.');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    const width = Math.max(40, Math.round(rect.width));
    const height = Math.max(30, Math.round(rect.height));
    if (width === this.cssWidth && height === this.cssHeight && dpr === this.dpr) return;
    this.cssWidth = width;
    this.cssHeight = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
  }

  render(pieces: readonly (PieceType | null)[], dimmed = false): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    const slots = Math.max(1, pieces.length);
    // Wide canvases (mobile layout) lay the queue out left to right instead.
    const horizontal = this.cssWidth > this.cssHeight;
    const slotWidth = horizontal ? this.cssWidth / slots : this.cssWidth;
    const slotHeight = horizontal ? this.cssHeight : this.cssHeight / slots;
    ctx.globalAlpha = dimmed ? 0.35 : 1;
    for (let i = 0; i < slots; i += 1) {
      const type = pieces[i];
      if (!type) continue;
      const x = horizontal ? i * slotWidth : 0;
      const y = horizontal ? 0 : i * slotHeight;
      this.drawPiece(type, x, y, slotWidth, slotHeight);
    }
    ctx.restore();
  }

  private drawPiece(type: PieceType, bx: number, by: number, bw: number, bh: number): void {
    const cells = PIECES[type].rotations[0];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of cells) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    const cell = Math.min((bw * 0.66) / spanX, (bh * 0.66) / spanY);
    const offsetX = bx + (bw - spanX * cell) / 2;
    const offsetY = by + (bh - spanY * cell) / 2;
    for (const [x, y] of cells) {
      drawBlock(
        this.ctx,
        type,
        offsetX + (x - minX) * cell,
        offsetY + (y - minY) * cell,
        cell,
      );
    }
  }
}
