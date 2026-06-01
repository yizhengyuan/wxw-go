// game.js — 游戏状态机(WXW.Game)
// 协调 board/ai/scoring,管理回合流转、pass 计数、终局判定。零 DOM 依赖。
(function (g) {
  'use strict';

  const C = (g.WXW && g.WXW.Config) ? g.WXW.Config : require('./config.js');
  const Board = (g.WXW && g.WXW.Board) ? g.WXW.Board : require('./board.js');
  const Scoring = (g.WXW && g.WXW.Scoring) ? g.WXW.Scoring : require('./scoring.js');
  const AI = (g.WXW && g.WXW.AI) ? g.WXW.AI : require('./ai.js');
  const { BLACK, WHITE } = C;

  function createState(N) {
    N = N || C.defaultN;
    const level = C.levels[N];
    if (!level) throw new Error('未知棋盘大小: ' + N);
    const state = {
      N,
      label: level.label,
      cells: new Int8Array(N * N),
      paint: new Int16Array((N - 1) * (N - 1)), // 染色值按「格子」索引
      toMove: BLACK,
      stones: { [BLACK]: level.stones.b, [WHITE]: level.stones.w },
      targetScore: level.targetScore,
      consecutivePasses: 0,
      history: new Set(),
      phase: 'playing',          // 'playing' | 'ended'
      result: null,              // 终局后 { eyes, total, target, win }
      lastMove: null,
      lastWasPass: false,
      message: '',               // 给 UI 的提示(如非法手原因)
    };
    // 初始空局面入 history(superko 基准)
    state.history.add(Board.hashPosition(state.cells, state.toMove));
    return state;
  }

  // 当前盘的潜在分(实时预览,与终局同一算法)
  function previewScore(state) {
    return Scoring.score(state.cells, state.paint, state.N);
  }

  // 终局:双方都「已尽手」(无子,或有子但全盘无合法落点)且连续两次虚手。
  // 「无合法落点也算尽手」保证 4×4 小盘不会因双方都还剩子却无处可下而陷入死循环,
  // 同时保留 GDD 意图:只要你还有子且有手可下,虚手就不会促成终局。
  function exhausted(state, color) {
    return !Board.hasLegalMove(state, color);
  }

  function checkEnd(state) {
    return exhausted(state, BLACK) &&
           exhausted(state, WHITE) &&
           state.consecutivePasses >= 2;
  }

  function finalize(state) {
    const sc = Scoring.score(state.cells, state.paint, state.N);
    state.phase = 'ended';
    state.result = {
      eyes: sc.eyes,
      total: sc.total,
      target: state.targetScore,
      win: sc.total >= state.targetScore,
    };
    return state.result;
  }

  // 黑棋(玩家)落子。返回 { ok, reason }
  function playerPlay(state, idx) {
    if (state.phase !== 'playing') return { ok: false, reason: 'ended' };
    if (state.toMove !== BLACK) return { ok: false, reason: 'not-your-turn' };
    const r = Board.tryPlay(state, BLACK, idx);
    if (!r.ok) { state.message = reasonText(r.reason); return r; }
    state.message = '';
    if (checkEnd(state)) finalize(state);
    return r;
  }

  // 黑棋虚手
  function playerPass(state) {
    if (state.phase !== 'playing') return { ok: false, reason: 'ended' };
    if (state.toMove !== BLACK) return { ok: false, reason: 'not-your-turn' };
    Board.applyPass(state, BLACK);
    state.message = '';
    if (checkEnd(state)) finalize(state);
    return { ok: true };
  }

  // 白棋(AI)走一手。返回 { type:'play'|'pass', idx? }
  function whiteTurn(state, rng) {
    if (state.phase !== 'playing' || state.toMove !== WHITE) return null;
    const mv = AI.choose(state, rng);
    if (mv.type === 'pass') {
      Board.applyPass(state, WHITE);
    } else {
      const r = Board.tryPlay(state, WHITE, mv.idx);
      if (!r.ok) { Board.applyPass(state, WHITE); return { type: 'pass', forced: true }; }
    }
    if (checkEnd(state)) finalize(state);
    return mv;
  }

  function reasonText(reason) {
    switch (reason) {
      case 'occupied': return '该点已有棋子';
      case 'suicide': return '不可自杀(落子后无气)';
      case 'ko': return '打劫禁着,不可立即提回';
      case 'no-stones': return '你已无棋子,只能虚手';
      case 'not-your-turn': return '还没轮到你';
      default: return '非法落子';
    }
  }

  const Game = {
    createState, previewScore, checkEnd, finalize,
    playerPlay, playerPass, whiteTurn, reasonText,
  };

  g.WXW = g.WXW || {};
  g.WXW.Game = Game;
  if (typeof module !== 'undefined' && module.exports) module.exports = Game;
})(typeof window !== 'undefined' ? window : globalThis);
