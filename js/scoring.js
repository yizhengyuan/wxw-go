// scoring.js — 终局围眼识别 + 计分(WXW.Scoring)
// 眼:空点,其所有「盘内」正交相邻点都是黑棋。每个合格空点独立算 1 个眼。
// 单眼得分 = 1(基础) + 该眼四周「格子(方格)」的染色值之和。
// 中腹眼四周 4 格、边线眼 2 格、角眼 1 格。paint 按格子索引,长度 (N-1)*(N-1)。
(function (g) {
  'use strict';

  const C = (g.WXW && g.WXW.Config) ? g.WXW.Config : require('./config.js');
  const Board = (g.WXW && g.WXW.Board) ? g.WXW.Board : require('./board.js');
  const { EMPTY, BLACK } = C;

  // 计算当前盘面(cells)+ 染色(paint)的围眼与总分。
  // 返回 { eyes: [{ idx, base, paintSum, score }], total }
  function score(cells, paint, N) {
    const eyes = [];
    let total = 0;
    for (let idx = 0; idx < cells.length; idx++) {
      if (cells[idx] !== EMPTY) continue;
      const ns = Board.neighbors(idx, N);
      if (ns.length === 0) continue; // 理论不会发生(N>=2)
      let allBlack = true;
      for (const n of ns) {
        if (cells[n] !== BLACK) { allBlack = false; break; }
      }
      if (!allBlack) continue;

      let paintSum = 0;
      for (const c of Board.cellsOfPoint(idx, N)) paintSum += paint[c];
      const s = 1 + paintSum;
      eyes.push({ idx, base: 1, paintSum, score: s });
      total += s;
    }
    return { eyes, total };
  }

  const Scoring = { score };

  g.WXW = g.WXW || {};
  g.WXW.Scoring = Scoring;
  if (typeof module !== 'undefined' && module.exports) module.exports = Scoring;
})(typeof window !== 'undefined' ? window : globalThis);
