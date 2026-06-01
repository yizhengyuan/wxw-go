// ai.js — 白棋难度0启发式选点(WXW.AI)
// 不做搜索,纯规则打分。策略(GDD 难度0):
//   1) 优先破坏黑棋潜在眼位  2) 侵入黑势迫使黑消耗  3) 避免自投打吃(被吃会送黑染色)
(function (g) {
  'use strict';

  const C = (g.WXW && g.WXW.Config) ? g.WXW.Config : require('./config.js');
  const Board = (g.WXW && g.WXW.Board) ? g.WXW.Board : require('./board.js');
  const { EMPTY, BLACK, WHITE } = C;

  // 计算某空点正交邻点中黑子数量(用于"破眼/侵入"评估)
  function blackNeighborCount(cells, N, idx) {
    let c = 0;
    for (const n of Board.neighbors(idx, N)) if (cells[n] === BLACK) c++;
    return c;
  }

  // 该空点是否「几乎是黑眼」:盘内正交邻点全黑(白下进去能破坏成眼)
  function wouldBeBlackEye(cells, N, idx) {
    const ns = Board.neighbors(idx, N);
    if (ns.length === 0) return false;
    for (const n of ns) if (cells[n] !== BLACK) return false;
    return true;
  }

  // 选点:返回 { type:'play', idx } 或 { type:'pass' }
  // rng:可注入的随机源(默认 Math.random),便于测试可复现。
  function choose(state, rng) {
    rng = rng || Math.random;
    if (state.stones[WHITE] <= 0) return { type: 'pass' };

    const N = state.N;
    const cells = state.cells;
    const w = C.ai;

    let best = null, bestScore = -Infinity;
    for (let idx = 0; idx < cells.length; idx++) {
      if (cells[idx] !== EMPTY) continue;

      // 用真实规则模拟,过滤非法手(自杀/被占),并拿到提子/己方气数
      const r = Board.computePlay(cells, N, WHITE, idx);
      if (!r.ok) continue;
      // superko 同样要排除(复现历史局面)
      const h = Board.hashPosition(r.next, BLACK);
      if (state.history.has(h)) continue;

      let s = 0;
      const bn = blackNeighborCount(cells, N, idx);

      // (A) 破坏黑棋成眼点
      if (wouldBeBlackEye(cells, N, idx)) s += w.W_DESTROY_EYE;
      s += w.W_DESTROY_EYE * 0.25 * bn; // 接近成眼也加分(连续值)

      // (B) 侵入黑势
      s += w.W_INVADE * bn;

      // (C) 能提到黑子
      if (r.captured.length > 0) s += w.W_CAPTURE * r.captured.length;

      // (D) 避免自投打吃:落子后自己这群只剩 1 气 → 重罚
      if (r.myLiberty <= 1) s += w.PENALTY_ATARI;

      // (E) 轻微中心偏好 + 抖动
      const x = idx % N, y = Math.floor(idx / N);
      const cx = (N - 1) / 2;
      const centerness = 1 - (Math.abs(x - cx) + Math.abs(y - cx)) / (2 * cx || 1);
      s += w.W_CENTER * centerness;
      s += (rng() - 0.5) * w.JITTER;

      if (s > bestScore) { bestScore = s; best = idx; }
    }

    if (best === null) return { type: 'pass' };
    if (bestScore < w.PASS_THRESHOLD) return { type: 'pass' };
    return { type: 'play', idx: best };
  }

  const AI = { choose, blackNeighborCount, wouldBeBlackEye };

  g.WXW = g.WXW || {};
  g.WXW.AI = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
