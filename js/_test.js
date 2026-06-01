// _test.js — 逻辑层断言测试(node js/_test.js)
// 覆盖:气计算、提子、禁自杀、打劫禁着、多群同提、染色累加、各类眼计分。
'use strict';
const C = require('./config.js');
const Board = require('./board.js');
const Scoring = require('./scoring.js');
const { EMPTY, BLACK, WHITE } = C;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ FAIL: ' + msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (got ${a}, want ${b})`); }

// 在 N×N 上用字符图建盘:'.'=空 'B'=黑 'W'=白,行用 / 分隔或多参数
function makeCells(N, rows) {
  const cells = new Int8Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ch = rows[y][x];
      cells[y * N + x] = ch === 'B' ? BLACK : ch === 'W' ? WHITE : EMPTY;
    }
  }
  return cells;
}
function freshState(N, cells) {
  return {
    N,
    cells: cells || new Int8Array(N * N),
    paint: new Int16Array((N - 1) * (N - 1)),
    toMove: BLACK,
    stones: { [BLACK]: 99, [WHITE]: 99 },
    consecutivePasses: 0,
    history: new Set(),
    phase: 'playing',
    lastMove: null,
    lastWasPass: false,
  };
}
const idx = (x, y, N) => y * N + x;

console.log('— getGroup / liberties —');
{
  // 4x4: 黑单子在角(0,0),气 = 2
  const N = 4;
  const cells = makeCells(N, ['B...', '....', '....', '....']);
  const g = Board.getGroup(cells, N, idx(0, 0, N));
  eq(g.libertyCount, 2, '角单子气=2');

  // 中心单子(1,1) 气=4
  const cells2 = makeCells(N, ['....', '.B..', '....', '....']);
  eq(Board.getGroup(cells2, N, idx(1, 1, N)).libertyCount, 4, '中腹单子气=4');

  // 两子相连共享气,去重:(0,0)(1,0) 黑,气应为 3 (右(2,0)、下(0,1)、下(1,1))
  const cells3 = makeCells(N, ['BB..', '....', '....', '....']);
  eq(Board.getGroup(cells3, N, idx(0, 0, N)).libertyCount, 3, '两子连块气去重=3');
}

console.log('— 提子(capture) —');
{
  // 白子在(1,1),被黑(0,1)(2,1)(1,0)三面围,黑下(1,2)提白
  const N = 4;
  const cells = makeCells(N, ['.B..', 'BWB.', '....', '....']);
  const st = freshState(N, cells);
  st.toMove = BLACK;
  const r = Board.tryPlay(st, BLACK, idx(1, 2, N));
  ok(r.ok, '黑下(1,2)合法');
  eq(r.captured.length, 1, '提走1白子');
  eq(st.cells[idx(1, 1, N)], EMPTY, '白子(1,1)被提为空');
}

console.log('— 多群同时被提 —');
{
  // 两颗白子各处打吃,黑落一子同时提两群
  // 布局: 白(0,0)被黑(1,0)(0,1)围只差... 用更直接的:黑落(1,1)同时提(1,0)和(0,1)两个白单子
  // (1,0)白:邻(0,0)、(2,0)、(1,1)。(0,1)白:邻(0,0)、(1,1)、(0,2)
  // 设 (0,0)=B 角，(2,0)=B,(0,2)=B,则白(1,0)仅 (1,1) 一气；白(0,1)仅 (1,1) 一气
  const N = 4;
  const cells = makeCells(N, ['BWB.', 'W...', 'B...', '....']);
  const st = freshState(N, cells);
  st.toMove = BLACK;
  const r = Board.tryPlay(st, BLACK, idx(1, 1, N));
  ok(r.ok, '黑下(1,1)合法');
  eq(r.captured.length, 2, '同时提2白子');
  eq(st.cells[idx(1, 0, N)], EMPTY, '白(1,0)被提');
  eq(st.cells[idx(0, 1, N)], EMPTY, '白(0,1)被提');
}

console.log('— 禁止自杀 —');
{
  // 黑想下(0,0),四周被白围(1,0)(0,1)白,且不提任何白 → 自杀非法
  const N = 4;
  const cells = makeCells(N, ['.W..', 'W...', '....', '....']);
  const st = freshState(N, cells);
  st.toMove = BLACK;
  const r = Board.tryPlay(st, BLACK, idx(0, 0, N));
  ok(!r.ok && r.reason === 'suicide', '黑下(0,0)判自杀非法');
}

console.log('— 自杀点但能提子则合法 —');
{
  // 黑下(0,0):自身会无气,但能提掉无气的白 → 合法
  // (0,0)空, (1,0)=W,(0,1)=W；让该白群无气:(2,0)=B,(1,1)=B,(0,2)=B 包住白(1,0)(0,1)? 需白连通
  // 简化:白单子(1,0),邻(0,0)、(2,0)、(1,1)。设(2,0)=B,(1,1)=B。黑下(0,0)提白(1,0)。
  // 黑(0,0)落子后邻(1,0)变空→黑有气，不算自杀。
  const N = 4;
  const cells = makeCells(N, ['.WB.', '.B..', '....', '....']);
  const st = freshState(N, cells);
  st.toMove = BLACK;
  const r = Board.tryPlay(st, BLACK, idx(0, 0, N));
  ok(r.ok, '黑下(0,0)提白后合法');
  eq(r.captured.length, 1, '提走白(1,0)');
}

console.log('— 打劫禁着(superko) —');
{
  // 经典劫形(在 4x4 局部):
  //  . B W .
  //  B W . W    -> 这里构造黑提白的劫
  // 用标准 ko 形:位置
  //   x: 0 1 2 3
  // y0: . B W .
  // y1: B . B W   (空点(1,1)是劫眼)  ... 设计一个能来回提的形
  // 采用经典:
  //  row0: . W B .
  //  row1: W . W B
  //  row2: . W B .
  // 让白(2,1)... 这里直接用最小劫:
  //  B W . .
  //  W . W .   黑在(1,1)... 复杂，改用程序化验证：
  // 构造:黑(0,1)(1,0)(1,2)(2,1)... 用真正的劫:
  //  . B W .
  //  B . B W    -> 白(2,0)?  采用文献标准 ko shape on edge:
  //
  // 直接构造:
  //  positions: B at (1,0),(0,1),(1,2); W at (2,1),(1,1) target
  //  Black to capture white (2,1)? Let's build a clean ko.
  //
  // Clean ko on 4x4:
  //  row0: . B W .
  //  row1: B W . W
  //  row2: . B W .
  // White stones: (2,0),(1,1),(3,1),(2,2). Black: (1,0),(0,1),(1,2).
  // Empty: (0,0),(3,0),(2,1),(0,2),(3,2),(0,3)..(3,3)
  // Black plays (2,1): captures white (1,1)? (1,1) liberties: up(1,0)=B,down(1,2)=B,left(0,1)=B,right(2,1)->now B => 0 libs => captured.
  // After capture (1,1) empty. Now white can recapture at (1,1) taking black (2,1)? black(2,1) libs: up(2,0)=W,down(2,2)=W,left(1,1)=empty-now,right(3,1)=W. one liberty (1,1).
  // White plays (1,1): captures black(2,1) (its only liberty filled) -> back to a position. superko should forbid white's immediate recapture because it recreates the prior whole-board position with same player to move.
  const N = 4;
  const cells = makeCells(N, [
    '.BW.',
    'BW.W',
    '.BW.',
    '....',
  ]);
  const st = freshState(N, cells);
  st.toMove = BLACK;
  // 记录初始局面进 history(模拟游戏中应有的初始入表)
  st.history.add(Board.hashPosition(st.cells, st.toMove));

  const r1 = Board.tryPlay(st, BLACK, idx(2, 1, N));
  ok(r1.ok, '黑提劫:下(2,1)合法');
  eq(r1.captured.length, 1, '提走白(1,1)');
  eq(st.cells[idx(1, 1, N)], EMPTY, '白(1,1)空');

  // 现在轮到白。白若立即在(1,1)提回 → 复现黑提之前的整体局面 → superko 禁
  const r2 = Board.tryPlay(st, WHITE, idx(1, 1, N));
  ok(!r2.ok && r2.reason === 'ko', '白立即提回(1,1)被打劫禁着');

  // 白在别处落子后,劫解除(下一手白可提回) —— 简单验证别处合法
  const r3 = Board.tryPlay(st, WHITE, idx(3, 3, N));
  ok(r3.ok, '白在他处(3,3)落子合法(劫材)');
}

console.log('— 染色累加(仅黑吃白,作用在格子上)—');
{
  // 黑提白(1,1):被吃点(1,1)四周的 4 个格子各 +1。
  // 格子索引 cellIdx = cj*(N-1)+ci。(1,1)四周格子:ci∈{0,1},cj∈{0,1} → cell 0,1,3,4
  const N = 4, M = N - 1;
  const cell = (ci, cj) => cj * M + ci;
  const cells = makeCells(N, ['.B..', 'BWB.', '....', '....']);
  const st = freshState(N, cells);
  st.toMove = BLACK;
  Board.tryPlay(st, BLACK, idx(1, 2, N)); // 提白(1,1)
  eq(st.paint[cell(0, 0)], 1, '格子(0,0)染色=1');
  eq(st.paint[cell(1, 0)], 1, '格子(1,0)染色=1');
  eq(st.paint[cell(0, 1)], 1, '格子(0,1)染色=1');
  eq(st.paint[cell(1, 1)], 1, '格子(1,1)染色=1');
  let tot = 0; for (let i = 0; i < st.paint.length; i++) tot += st.paint[i];
  eq(tot, 4, '共染 4 个格子(中腹被吃点)');

  // 角部被吃:染色应只触及 1 个格子。白(0,0),黑(1,0),黑落(0,1)提角白
  const cells3 = makeCells(N, ['WB..', '....', '....', '....']);
  const st3 = freshState(N, cells3);
  st3.toMove = BLACK;
  Board.tryPlay(st3, BLACK, idx(0, 1, N)); // 提角白(0,0)
  let tot3 = 0; for (let i = 0; i < st3.paint.length; i++) tot3 += st3.paint[i];
  eq(tot3, 1, '角部被吃只染 1 个格子');
  eq(st3.paint[cell(0, 0)], 1, '该格子是(0,0)');
}

console.log('— 白吃黑不触发染色 —');
{
  const N = 4;
  const cells = makeCells(N, ['.W..', 'WBW.', '....', '....']);
  const st = freshState(N, cells);
  st.toMove = WHITE;
  st.history.add(Board.hashPosition(st.cells, st.toMove));
  const r = Board.tryPlay(st, WHITE, idx(1, 2, N)); // 白提黑(1,1)
  ok(r.ok && r.captured.length === 1, '白提黑1子');
  let any = 0;
  for (let i = 0; i < st.paint.length; i++) any += st.paint[i];
  eq(any, 0, '白吃黑染色总量=0');
}

console.log('— 围眼计分:中腹眼 + 染色(格子)叠加 —');
{
  const N = 4, M = N - 1;
  const cell = (ci, cj) => cj * M + ci;
  // 中腹眼(1,1):四正交邻(0,1)(2,1)(1,0)(1,2)为黑;(0,0)填黑以免角部成空眼,确保只1个眼
  const cells = makeCells(N, ['BB..', 'B.B.', '.B..', '....']);
  const paint = new Int16Array(M * M);
  // (1,1)四周 4 格 = cell(0,0)(1,0)(0,1)(1,1);染色 1,2,0,3 → sum=6
  paint[cell(0, 0)] = 1; paint[cell(1, 0)] = 2; paint[cell(0, 1)] = 0; paint[cell(1, 1)] = 3;
  const res = Scoring.score(cells, paint, N);
  const eye = res.eyes.find(e => e.idx === idx(1, 1, N));
  ok(!!eye, '识别到中腹眼(1,1)');
  eq(res.eyes.length, 1, '仅1个眼');
  eq(eye.score, 1 + 6, '中腹眼得分=1+6=7');
}

console.log('— 角眼计分(只 1 个格子)—');
{
  const N = 4, M = N - 1;
  const cell = (ci, cj) => cj * M + ci;
  // 角眼(0,0):邻(1,0)(0,1)为黑。四周只有 1 个格子 = cell(0,0)
  const cells = makeCells(N, ['.B..', 'BB..', '....', '....']);
  const paint = new Int16Array(M * M);
  paint[cell(0, 0)] = 5;
  const res = Scoring.score(cells, paint, N);
  const eye = res.eyes.find(e => e.idx === idx(0, 0, N));
  ok(!!eye, '识别到角眼(0,0)');
  eq(eye.score, 1 + 5, '角眼得分=1+5=6');
}

console.log('— 边线眼计分(2 个格子)—');
{
  const N = 4, M = N - 1;
  const cell = (ci, cj) => cj * M + ci;
  // 边线眼(1,0)(上边,空点):邻(0,0)(2,0)(1,1)为黑
  // (1,0)四周格子:ci∈{0,1},cj∈{-1,0}→cj=0 → cell(0,0)(1,0)
  const cells = makeCells(N, ['B.B.', '.B..', '....', '....']);
  const paint = new Int16Array(M * M);
  paint[cell(0, 0)] = 2; paint[cell(1, 0)] = 4; // sum=6
  const res = Scoring.score(cells, paint, N);
  const eye = res.eyes.find(e => e.idx === idx(1, 0, N));
  ok(!!eye, '识别到边线眼(1,0)');
  eq(eye.score, 1 + 6, '边线眼得分=1+6=7');
}

console.log('— 相邻空点不算眼 —');
{
  const N = 4, M = N - 1;
  // (0,0)与(1,0)都空且周围黑,但二者正交相邻 → 互相破坏,都不算眼
  const cells = makeCells(N, ['..B.', 'BB..', '....', '....']);
  const res = Scoring.score(cells, new Int16Array(M * M), N);
  eq(res.eyes.length, 0, '相邻空点都不算眼');
}

console.log('— pass 与终局计数 —');
{
  const N = 4;
  const st = freshState(N);
  st.stones = { [BLACK]: 0, [WHITE]: 0 };
  st.toMove = BLACK;
  Board.applyPass(st, BLACK);
  eq(st.consecutivePasses, 1, '黑pass后计数=1');
  Board.applyPass(st, WHITE);
  eq(st.consecutivePasses, 2, '白pass后计数=2');
  ok(st.stones[BLACK] === 0 && st.stones[WHITE] === 0 && st.consecutivePasses >= 2, '满足终局条件');
}

console.log('— 余量为0禁止落子 —');
{
  const N = 4;
  const st = freshState(N);
  st.stones = { [BLACK]: 0, [WHITE]: 0 };
  st.toMove = BLACK;
  const r = Board.tryPlay(st, BLACK, idx(0, 0, N));
  ok(!r.ok && r.reason === 'no-stones', '无子时落子非法');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
