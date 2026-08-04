import type { Cell } from '../game/pieces';
import type { GameEvent } from '../game/engine';
import type { PieceType } from '../game/pieces';

export interface LockFlash {
  cells: Cell[];
  type: PieceType;
  life: number;
  duration: number;
}

export interface DropTrail {
  cells: Cell[];
  type: PieceType;
  distance: number;
  life: number;
  duration: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  duration: number;
  hue: string;
}

/**
 * Purely cosmetic, time-based state. Effects never feed back into the engine,
 * so gameplay stays identical whether or not animations are enabled.
 */
export class Effects {
  readonly lockFlashes: LockFlash[] = [];
  readonly dropTrails: DropTrail[] = [];
  readonly sparks: Spark[] = [];
  shake = 0;
  private readonly enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  consume(events: readonly GameEvent[]): void {
    if (!this.enabled) return;
    for (const event of events) {
      switch (event.kind) {
        case 'lock':
          this.lockFlashes.push({
            cells: event.cells,
            type: event.piece,
            life: 0,
            duration: 220,
          });
          break;
        case 'harddrop':
          this.dropTrails.push({
            cells: event.cells,
            type: event.piece,
            distance: event.distance,
            life: 0,
            duration: 260,
          });
          this.shake = Math.min(1, this.shake + 0.18 + event.distance * 0.012);
          break;
        case 'clear':
          this.shake = Math.min(1.4, this.shake + 0.22 * event.lineCount);
          this.spawnRowSparks(event.rows, event.lineCount);
          break;
        default:
          break;
      }
    }
  }

  update(deltaMs: number): void {
    const dt = Math.max(0, Math.min(deltaMs, 100));
    decay(this.lockFlashes, dt);
    decay(this.dropTrails, dt);
    for (const spark of this.sparks) {
      spark.life += dt;
      spark.x += spark.vx * (dt / 16.67);
      spark.y += spark.vy * (dt / 16.67);
      spark.vy += 0.05 * (dt / 16.67);
    }
    for (let i = this.sparks.length - 1; i >= 0; i -= 1) {
      if (this.sparks[i].life >= this.sparks[i].duration) this.sparks.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt / 260);
  }

  clear(): void {
    this.lockFlashes.length = 0;
    this.dropTrails.length = 0;
    this.sparks.length = 0;
    this.shake = 0;
  }

  private spawnRowSparks(rows: readonly number[], lineCount: number): void {
    const palette = lineCount >= 4
      ? ['#8ff2f8', '#ffffff', '#2fd4e0']
      : ['#ffffff', '#dcb0ff', '#9db3ff'];
    for (const row of rows) {
      for (let i = 0; i < 14; i += 1) {
        this.sparks.push({
          x: Math.random() * 10,
          y: row + 0.5,
          vx: (Math.random() - 0.5) * 0.34,
          vy: (Math.random() - 0.8) * 0.16,
          life: 0,
          duration: 380 + Math.random() * 260,
          hue: palette[i % palette.length],
        });
      }
    }
  }
}

function decay(list: { life: number; duration: number }[], dt: number): void {
  for (const item of list) item.life += dt;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].life >= list[i].duration) list.splice(i, 1);
  }
}
