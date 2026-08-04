/** Playfield width in cells. */
export const COLS = 10;

/** Visible playfield height in cells. */
export const ROWS = 20;

/** How many upcoming pieces are shown to the player. */
export const NEXT_COUNT = 3;

/** Time a grounded piece may be nudged before it locks (ms). */
export const LOCK_DELAY_MS = 500;

/** Upper bound on lock-delay resets so a piece cannot be stalled forever. */
export const MAX_LOCK_RESETS = 15;

/** Duration of the line-clear animation before rows collapse (ms). */
export const LINE_CLEAR_MS = 320;

/** Fixed cell interval while soft dropping (ms). */
export const SOFT_DROP_INTERVAL_MS = 35;

/** Fastest gravity we allow, so high levels stay humanly playable (ms). */
export const MIN_GRAVITY_MS = 60;

/** Level at which the speed curve stops getting harder. */
export const MAX_LEVEL = 20;

/** Lines required to advance one level. */
export const LINES_PER_LEVEL = 10;
