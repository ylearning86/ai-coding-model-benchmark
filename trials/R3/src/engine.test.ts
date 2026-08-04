import { describe, expect, it } from 'vitest';
import {
  COLS,
  Game,
  KINDS,
  ROWS,
  mergeRanking,
  nextBag,
  parseRanking,
  rotate,
  sanitizeName,
  shapeOf,
  type Cell,
  type ScoreEntry,
} from './engine';

function fillRow(game: Game, row: number, skip: number[]): void {
  for (let c = 0; c < COLS; c += 1) {
    if (!skip.includes(c)) game.board[row][c] = 'I' as Cell;
  }
}

describe('board / pieces', () => {
  it('10 列 20 行で初期化される', () => {
    const game = new Game();
    expect(game.board).toHaveLength(ROWS);
    expect(game.board[0]).toHaveLength(COLS);
    expect(game.board.flat().every((c) => c === null)).toBe(true);
  });

  it('バッグには 7 種類すべてが 1 度ずつ入る', () => {
    const bag = nextBag(() => 0.42);
    expect(bag).toHaveLength(7);
    expect(new Set(bag).size).toBe(7);
    for (const kind of KINDS) expect(bag).toContain(kind);
  });

  it('時計回りの回転で形が変わる', () => {
    const rotated = rotate(shapeOf('T'), 1);
    expect(rotated).toEqual([
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ]);
  });
});

describe('操作', () => {
  it('左右に移動でき、壁を越えない', () => {
    const game = new Game();
    game.start();
    game.active = { kind: 'O', shape: shapeOf('O'), x: 0, y: 0 };
    expect(game.move(-1)).toBe(false);
    expect(game.move(1)).toBe(true);
    expect(game.active.x).toBe(1);
  });

  it('壁際の回転はキックで成立する', () => {
    const game = new Game();
    game.start();
    game.active = { kind: 'I', shape: rotate(shapeOf('I'), 1), x: 7, y: 0 };
    expect(game.rotatePiece(1)).toBe(true);
    expect(game.active?.x).toBe(6);
  });

  it('ハードドロップで底に固定されスコアが入る', () => {
    const game = new Game();
    game.start();
    game.score = 0;
    game.active = { kind: 'O', shape: shapeOf('O'), x: 0, y: 0 };
    game.hardDrop();
    expect(game.board[ROWS - 1][0]).toBe('O');
    expect(game.board[ROWS - 2][1]).toBe('O');
    expect(game.score).toBe(36);
  });

  it('ソフトドロップは 1 マス落として加点する', () => {
    const game = new Game();
    game.start();
    game.score = 0;
    game.active = { kind: 'O', shape: shapeOf('O'), x: 4, y: 0 };
    expect(game.softDrop()).toBe(true);
    expect(game.active?.y).toBe(1);
    expect(game.score).toBe(1);
  });

  it('ゴーストは着地点を返す', () => {
    const game = new Game();
    game.start();
    game.active = { kind: 'O', shape: shapeOf('O'), x: 0, y: 0 };
    expect(game.ghostY()).toBe(ROWS - 2);
  });

  it('ホールドは 1 回の落下につき 1 度だけ使える', () => {
    const game = new Game();
    game.start();
    const first = game.active?.kind;
    expect(game.holdPiece()).toBe(true);
    expect(game.hold).toBe(first);
    expect(game.holdPiece()).toBe(false);
  });

  it('一時停止中は落下しない', () => {
    const game = new Game();
    game.start();
    game.active = { kind: 'O', shape: shapeOf('O'), x: 4, y: 0 };
    game.togglePause();
    game.tick(5000);
    expect(game.status).toBe('paused');
    expect(game.active?.y).toBe(0);
  });

  it('自然落下で 1 マスずつ下がる', () => {
    const game = new Game();
    game.start();
    game.active = { kind: 'O', shape: shapeOf('O'), x: 4, y: 0 };
    game.tick(game.dropInterval);
    expect(game.active?.y).toBe(1);
  });
});

describe('ライン消去とスコア', () => {
  it('1 ライン消去で 100 点が入る', () => {
    const game = new Game();
    game.start();
    fillRow(game, ROWS - 1, [0, 1]);
    game.active = { kind: 'O', shape: shapeOf('O'), x: 0, y: 0 };
    game.hardDrop();
    expect(game.lines).toBe(1);
    expect(game.lastClear?.score).toBe(100);
    expect(game.board[ROWS - 1].every((c) => c === null)).toBe(false);
  });

  it('4 ライン同時消去で 800 点が入る', () => {
    const game = new Game();
    game.start();
    for (let r = ROWS - 4; r < ROWS; r += 1) fillRow(game, r, [0]);
    game.active = { kind: 'I', shape: rotate(shapeOf('I'), 1), x: -2, y: 0 };
    game.hardDrop();
    expect(game.lines).toBe(4);
    expect(game.lastClear?.score).toBe(800);
  });

  it('10 ライン到達でレベルが上がる', () => {
    const game = new Game();
    game.start();
    game.lines = 9;
    fillRow(game, ROWS - 1, [0, 1]);
    game.active = { kind: 'O', shape: shapeOf('O'), x: 0, y: 0 };
    game.hardDrop();
    expect(game.level).toBe(2);
    expect(game.lastClear?.levelUp).toBe(true);
  });

  it('積み上がるとゲームオーバーになる', () => {
    const game = new Game();
    game.start();
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 3; c <= 6; c += 1) game.board[r][c] = 'I' as Cell;
    }
    game.active = { kind: 'O', shape: shapeOf('O'), x: 8, y: 0 };
    game.hardDrop();
    expect(game.status).toBe('over');
  });
});

describe('保存データ', () => {
  it('ニックネームは制御文字を除去し 12 文字までに丸める', () => {
    expect(sanitizeName('  ab\u0000cd\u007f  ')).toBe('abcd');
    expect(sanitizeName('0123456789abcdef')).toBe('0123456789ab');
    expect(sanitizeName('   ')).toBe('PLAYER');
  });

  it('壊れた保存データは無視される', () => {
    expect(parseRanking(null)).toEqual([]);
    expect(parseRanking('not json')).toEqual([]);
    expect(parseRanking('{"a":1}')).toEqual([]);
    expect(parseRanking('[{"name":"x"},{"name":"y","score":10}]')).toHaveLength(1);
  });

  it('ランキングはスコア順に上位 10 件へ丸められる', () => {
    const base: ScoreEntry[] = Array.from({ length: 10 }, (_, i) => ({
      name: `P${i}`,
      score: (i + 1) * 100,
      lines: i,
      level: 1,
      at: i,
    }));
    const merged = mergeRanking(base, { name: 'NEW', score: 5000, lines: 40, level: 5, at: 99 });
    expect(merged).toHaveLength(10);
    expect(merged[0].name).toBe('NEW');
    expect(merged.at(-1)?.score).toBe(200);
  });
});
