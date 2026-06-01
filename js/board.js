// board.js — 棋盘数据 + 围棋规则引擎 + 染色(WXW.Board)
// 纯逻辑,零 DOM 依赖,可在 node 下加载用于测试。
(function (g) {
  'use strict';

  const C = (g.WXW && g.WXW.Config) ? g.WXW.Config : require('./config.js');
  const { EMPTY, BLACK, WHITE } = C;

  const other = (color) => (color === BLACK ? WHITE : BLACK);
  const idxOf = (x, y, N) => y * N + x;
  const xOf = (idx, N) => idx % N;
  const yOf = (idx, N) => Math.floor(idx / N);

  // 正交 4 邻(越界过滤)
  function neighbors(idx, N) {
    const x = idx % N, y = Math.floor(idx / N);
    const out = [];
    if (x > 0) out.push(idx - 1);
    if (x < N - 1) out.push(idx + 1);
    if (y > 0) out.push(idx - N);
    if (y < N - 1) out.push(idx + N);
    return out;
  }

  // 斜对角 4 点(越界过滤)—— 通用工具,目前主要用于参考
  function diagNeighbors(idx, N) {
    const x = idx % N, y = Math.floor(idx / N);
    const out = [];
    const D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of D) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < N && ny >= 0 && ny < N) out.push(ny * N + nx);
    }
    return out;
  }

  // 染色/计分作用在「格子(方格)」上,不是交叉点。
  // N×N 交叉点 → (N-1)×(N-1) 个方格;方格 (ci,cj) 由交叉点 (ci,cj)(ci+1,cj)(ci,cj+1)(ci+1,cj+1) 围成。
  // 索引:cellIdx = cj*(N-1) + ci,ci,cj ∈ [0, N-2]。
  // cellsOfPoint:某交叉点四周(斜对角)的格子集合 —— 中腹点 4 个、边线点 2 个、角点 1 个。
  function cellsOfPoint(idx, N) {
    const x = idx % N, y = Math.floor(idx / N);
    const M = N - 1; // 每行格子数
    const out = [];
    for (const ci of [x - 1, x]) {
      for (const cj of [y - 1, y]) {
        if (ci >= 0 && ci <= M - 1 && cj >= 0 && cj <= M - 1) out.push(cj * M + ci);
      }
    }
    return out;
  }

  // flood fill:返回某子所在同色连通块及其气(气用 Set 去重)
  function getGroup(cells, N, start) {
    const color = cells[start];
    const stones = new Set();
    const liberties = new Set();
    if (color === EMPTY) return { color, stones, liberties, libertyCount: 0 };
    const stack = [start];
    const visited = new Set();
    while (stack.length) {
      const i = stack.pop();
      if (visited.has(i)) continue;
      visited.add(i);
      stones.add(i);
      for (const n of neighbors(i, N)) {
        if (cells[n] === EMPTY) liberties.add(n);
        else if (cells[n] === color && !visited.has(n)) stack.push(n);
      }
    }
    return { color, stones, liberties, libertyCount: liberties.size };
  }

  // 纯函数:在 cells 上模拟一手棋的盘面机制(放子→提对方→判自杀),不涉及 ko/余量。
  // 返回 { ok, reason, next, captured, myLiberty, myGroupSize }
  function computePlay(cells, N, color, idx) {
    if (cells[idx] !== EMPTY) return { ok: false, reason: 'occupied' };
    const opp = other(color);
    const next = Int8Array.from(cells);
    next[idx] = color;

    // 提对方无气邻群(setEMPTY 立即生效,天然去重)
    const captured = [];
    for (const n of neighbors(idx, N)) {
      if (next[n] === opp) {
        const grp = getGroup(next, N, n);
        if (grp.libertyCount === 0) {
          for (const s of grp.stones) { next[s] = EMPTY; captured.push(s); }
        }
      }
    }

    // 自杀判定(提完对方后看自己这群是否仍无气)
    const myGroup = getGroup(next, N, idx);
    if (myGroup.libertyCount === 0) return { ok: false, reason: 'suicide' };

    return {
      ok: true, next, captured,
      myLiberty: myGroup.libertyCount,
      myGroupSize: myGroup.stones.size,
    };
  }

  // 局面哈希:含「轮到谁走」(superko 区分同形不同手番)
  function hashPosition(cells, toMove) {
    let s = toMove + ':';
    for (let i = 0; i < cells.length; i++) s += cells[i];
    return s;
  }

  // 染色:每个被吃白子,其所在交叉点四周的「格子」分数永久 +1(盘外的格子自动忽略)。
  // paint 按格子索引,长度 (N-1)*(N-1)。
  function applyPaint(paint, N, captured) {
    for (const cap of captured) {
      for (const c of cellsOfPoint(cap, N)) paint[c] += 1;
    }
  }

  // 真正落子:校验(phase/手番/余量)+ 盘面机制 + 打劫(positional superko),成功则提交 state。
  // 返回 { ok, reason, captured }
  function tryPlay(state, color, idx) {
    if (state.phase !== 'playing') return { ok: false, reason: 'ended' };
    if (state.toMove !== color) return { ok: false, reason: 'not-your-turn' };
    if (state.stones[color] <= 0) return { ok: false, reason: 'no-stones' };

    const r = computePlay(state.cells, state.N, color, idx);
    if (!r.ok) return { ok: false, reason: r.reason };

    const opp = other(color);
    const h = hashPosition(r.next, opp);
    if (state.history.has(h)) return { ok: false, reason: 'ko' };

    // 提交
    state.cells = r.next;
    state.stones[color] -= 1;
    state.consecutivePasses = 0;
    state.lastMove = idx;
    state.lastWasPass = false;
    if (color === BLACK && r.captured.length > 0) {
      applyPaint(state.paint, state.N, r.captured);
    }
    state.history.add(h);
    state.toMove = opp;
    return { ok: true, captured: r.captured };
  }

  // 该方此刻是否存在任一合法落点(无子或处处非法则 false)。
  // 用于终局判定:有子但无处可下的一方视为"已尽手"。
  function hasLegalMove(state, color) {
    if (state.stones[color] <= 0) return false;
    const N = state.N, cells = state.cells, opp = other(color);
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== EMPTY) continue;
      const r = computePlay(cells, N, color, i);
      if (!r.ok) continue;
      if (state.history.has(hashPosition(r.next, opp))) continue; // superko
      return true;
    }
    return false;
  }

  // 虚手:不消耗棋子,连续 pass 计数 +1,切换手番。superko 不记 pass 局面。
  function applyPass(state, color) {
    if (state.toMove !== color) return { ok: false, reason: 'not-your-turn' };
    state.consecutivePasses += 1;
    state.lastWasPass = true;
    state.lastMove = null;
    state.toMove = other(color);
    return { ok: true };
  }

  const Board = {
    other, idxOf, xOf, yOf,
    neighbors, diagNeighbors, cellsOfPoint, getGroup,
    computePlay, hashPosition, applyPaint,
    tryPlay, applyPass, hasLegalMove,
  };

  g.WXW = g.WXW || {};
  g.WXW.Board = Board;
  if (typeof module !== 'undefined' && module.exports) module.exports = Board;
})(typeof window !== 'undefined' ? window : globalThis);
