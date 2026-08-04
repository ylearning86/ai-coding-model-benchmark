export type InputIntent =
  | { type: 'move'; dir: -1 | 1 }
  | { type: 'rotate'; dir: 1 | -1 }
  | { type: 'softdrop'; active: boolean }
  | { type: 'harddrop' }
  | { type: 'hold' }
  | { type: 'pause' }
  | { type: 'restart' }
  | { type: 'confirm' };

export const DAS_MS = 150;
export const ARR_MS = 40;

type Emit = (intent: InputIntent) => void;

const KEY_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_SOFT = new Set(['ArrowDown', 'KeyS']);
const KEY_CW = new Set(['ArrowUp', 'KeyX', 'KeyW']);
const KEY_CCW = new Set(['KeyZ', 'ControlLeft', 'ControlRight']);
const KEY_HARD = new Set(['Space']);
const KEY_HOLD = new Set(['KeyC', 'ShiftLeft', 'ShiftRight']);
const KEY_PAUSE = new Set(['KeyP', 'Escape']);
const KEY_RESTART = new Set(['KeyR']);
const KEY_CONFIRM = new Set(['Enter', 'NumpadEnter']);

const HANDLED_KEYS = new Set<string>([
  ...KEY_LEFT,
  ...KEY_RIGHT,
  ...KEY_SOFT,
  ...KEY_CW,
  ...KEY_CCW,
  ...KEY_HARD,
  ...KEY_HOLD,
  ...KEY_PAUSE,
  ...KEY_RESTART,
]);

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Keyboard + touch input with delayed auto shift (DAS) and auto repeat rate
 * (ARR) so held directions feel precise instead of runaway-fast.
 */
export class InputController {
  private readonly emit: Emit;
  private readonly board: HTMLElement;
  private readonly pad: HTMLElement;

  private dir: -1 | 0 | 1 = 0;
  private dasTimer = 0;
  private charged = false;
  private softActive = false;
  private padSoftActive = false;
  private readonly pressedKeys = new Set<string>();
  private readonly padDirections = new Map<number, -1 | 1>();

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private lastStepX = 0;
  private startTime = 0;
  private moved = false;
  private gestureHardDropped = false;

  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKeyDown(event);
  private readonly onKeyUp = (event: KeyboardEvent) => this.handleKeyUp(event);
  private readonly onBlur = () => this.releaseAll();
  private readonly onPadDown = (event: PointerEvent) => this.handlePadDown(event);
  private readonly onPadUp = (event: PointerEvent) => this.handlePadUp(event);
  private readonly onBoardDown = (event: PointerEvent) => this.handleBoardDown(event);
  private readonly onBoardMove = (event: PointerEvent) => this.handleBoardMove(event);
  private readonly onBoardUp = (event: PointerEvent) => this.handleBoardUp(event);

  constructor(options: { board: HTMLElement; pad: HTMLElement; emit: Emit }) {
    this.emit = options.emit;
    this.board = options.board;
    this.pad = options.pad;

    globalThis.addEventListener('keydown', this.onKeyDown);
    globalThis.addEventListener('keyup', this.onKeyUp);
    globalThis.addEventListener('blur', this.onBlur);

    this.pad.addEventListener('pointerdown', this.onPadDown);
    this.pad.addEventListener('pointerup', this.onPadUp);
    this.pad.addEventListener('pointercancel', this.onPadUp);
    this.pad.addEventListener('pointerleave', this.onPadUp);
    this.pad.addEventListener('contextmenu', preventDefault);

    this.board.addEventListener('pointerdown', this.onBoardDown);
    this.board.addEventListener('pointermove', this.onBoardMove);
    this.board.addEventListener('pointerup', this.onBoardUp);
    this.board.addEventListener('pointercancel', this.onBoardUp);
    this.board.addEventListener('contextmenu', preventDefault);
  }

  /** Drives auto-repeat. Must be called once per animation frame. */
  update(deltaMs: number): void {
    if (this.dir === 0) return;
    this.dasTimer += deltaMs;
    if (!this.charged) {
      if (this.dasTimer >= DAS_MS) {
        this.charged = true;
        this.dasTimer -= DAS_MS;
        this.emit({ type: 'move', dir: this.dir });
      } else {
        return;
      }
    }
    let guard = 0;
    while (this.dasTimer >= ARR_MS && guard < 32) {
      this.dasTimer -= ARR_MS;
      guard += 1;
      this.emit({ type: 'move', dir: this.dir });
    }
  }

  /** Cancels every held key/pointer. Used on pause, game over and blur. */
  releaseAll(): void {
    this.pressedKeys.clear();
    this.padDirections.clear();
    this.dir = 0;
    this.charged = false;
    this.dasTimer = 0;
    this.padSoftActive = false;
    this.pointerId = null;
    this.setSoftDrop(false);
  }

  destroy(): void {
    globalThis.removeEventListener('keydown', this.onKeyDown);
    globalThis.removeEventListener('keyup', this.onKeyUp);
    globalThis.removeEventListener('blur', this.onBlur);
    this.pad.removeEventListener('pointerdown', this.onPadDown);
    this.pad.removeEventListener('pointerup', this.onPadUp);
    this.pad.removeEventListener('pointercancel', this.onPadUp);
    this.pad.removeEventListener('pointerleave', this.onPadUp);
    this.pad.removeEventListener('contextmenu', preventDefault);
    this.board.removeEventListener('pointerdown', this.onBoardDown);
    this.board.removeEventListener('pointermove', this.onBoardMove);
    this.board.removeEventListener('pointerup', this.onBoardUp);
    this.board.removeEventListener('pointercancel', this.onBoardUp);
    this.board.removeEventListener('contextmenu', preventDefault);
  }

  // ----------------------------------------------------------------- keyboard

  private handleKeyDown(event: KeyboardEvent): void {
    if (isTextEntry(event.target)) {
      if (KEY_CONFIRM.has(event.code)) this.emit({ type: 'confirm' });
      return;
    }
    if (HANDLED_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (this.pressedKeys.has(event.code)) return;
    this.pressedKeys.add(event.code);

    if (KEY_LEFT.has(event.code)) return this.pressDirection(-1);
    if (KEY_RIGHT.has(event.code)) return this.pressDirection(1);
    if (KEY_SOFT.has(event.code)) return this.setSoftDrop(true);
    if (KEY_CW.has(event.code)) return this.emit({ type: 'rotate', dir: 1 });
    if (KEY_CCW.has(event.code)) return this.emit({ type: 'rotate', dir: -1 });
    if (KEY_HARD.has(event.code)) return this.emit({ type: 'harddrop' });
    if (KEY_HOLD.has(event.code)) return this.emit({ type: 'hold' });
    if (KEY_PAUSE.has(event.code)) return this.emit({ type: 'pause' });
    if (KEY_RESTART.has(event.code)) return this.emit({ type: 'restart' });
    if (KEY_CONFIRM.has(event.code)) return this.emit({ type: 'confirm' });
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.pressedKeys.delete(event.code)) return;
    if (KEY_LEFT.has(event.code)) this.releaseDirection(-1);
    if (KEY_RIGHT.has(event.code)) this.releaseDirection(1);
    if (KEY_SOFT.has(event.code)) this.setSoftDrop(false);
  }

  private pressDirection(dir: -1 | 1): void {
    this.dir = dir;
    this.charged = false;
    this.dasTimer = 0;
    this.emit({ type: 'move', dir });
  }

  private releaseDirection(dir: -1 | 1): void {
    if (this.dir !== dir) return;
    const opposite = dir === -1 ? 1 : -1;
    const oppositeHeld =
      [...this.pressedKeys].some((code) =>
        opposite === -1 ? KEY_LEFT.has(code) : KEY_RIGHT.has(code),
      ) || [...this.padDirections.values()].includes(opposite);
    if (oppositeHeld) {
      this.pressDirection(opposite);
      return;
    }
    this.dir = 0;
    this.charged = false;
    this.dasTimer = 0;
  }

  private setSoftDrop(active: boolean): void {
    if (this.softActive === active) return;
    this.softActive = active;
    this.emit({ type: 'softdrop', active });
  }

  // -------------------------------------------------------------- touch pad

  private handlePadDown(event: PointerEvent): void {
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
    if (!button) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    const action = button.dataset.action;
    switch (action) {
      case 'left':
        this.padDirections.set(event.pointerId, -1);
        this.pressDirection(-1);
        break;
      case 'right':
        this.padDirections.set(event.pointerId, 1);
        this.pressDirection(1);
        break;
      case 'softdrop':
        this.padSoftActive = true;
        this.setSoftDrop(true);
        break;
      case 'rotate-cw':
        this.emit({ type: 'rotate', dir: 1 });
        break;
      case 'rotate-ccw':
        this.emit({ type: 'rotate', dir: -1 });
        break;
      case 'harddrop':
        this.emit({ type: 'harddrop' });
        break;
      case 'hold':
        this.emit({ type: 'hold' });
        break;
      case 'pause':
        this.emit({ type: 'pause' });
        break;
      default:
        break;
    }
  }

  private handlePadUp(event: PointerEvent): void {
    const held = this.padDirections.get(event.pointerId);
    if (held !== undefined) {
      this.padDirections.delete(event.pointerId);
      this.releaseDirection(held);
    }
    if (this.padSoftActive) {
      this.padSoftActive = false;
      this.setSoftDrop(false);
    }
  }

  // ------------------------------------------------------------ board swipes

  private handleBoardDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse') return;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.lastStepX = event.clientX;
    this.startTime = event.timeStamp;
    this.moved = false;
    this.gestureHardDropped = false;
    this.board.setPointerCapture?.(event.pointerId);
  }

  private handleBoardMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const step = this.stepSize();
    const dx = event.clientX - this.lastStepX;
    const totalY = event.clientY - this.startY;
    const totalX = event.clientX - this.startX;

    if (Math.abs(dx) >= step) {
      const steps = Math.trunc(dx / step);
      const dir: -1 | 1 = steps > 0 ? 1 : -1;
      for (let i = 0; i < Math.min(Math.abs(steps), 4); i += 1) {
        this.emit({ type: 'move', dir });
      }
      this.lastStepX += steps * step;
      this.moved = true;
    }

    if (
      !this.gestureHardDropped &&
      totalY > step * 2.2 &&
      Math.abs(totalX) < step &&
      event.timeStamp - this.startTime < 320
    ) {
      this.gestureHardDropped = true;
      this.moved = true;
      this.emit({ type: 'harddrop' });
    } else if (!this.gestureHardDropped && totalY > step && Math.abs(totalX) < step) {
      this.moved = true;
      this.setSoftDrop(true);
    }
  }

  private handleBoardUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
    this.setSoftDrop(false);
    const duration = event.timeStamp - this.startTime;
    if (!this.moved && duration < 260) this.emit({ type: 'rotate', dir: 1 });
  }

  private stepSize(): number {
    const rect = this.board.getBoundingClientRect();
    return Math.max(18, rect.width / 10);
  }
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
