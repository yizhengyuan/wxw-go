// main.js — 装配 + 输入 + 回合循环(浏览器入口)
(function (g) {
  'use strict';

  const { Config: C, Board, Game, Render } = g.WXW;
  const { BLACK, WHITE } = C;

  const $ = (id) => document.getElementById(id);

  let state, view, busy = false, currentN = C.defaultN;

  function refreshHud() {
    $('black-stones').textContent = state.stones[BLACK];
    $('white-stones').textContent = state.stones[WHITE];
    $('target').textContent = state.targetScore;

    const preview = Game.previewScore(state);
    $('current-score').textContent = preview.total;

    // 提示行
    let hint = '';
    if (state.phase === 'ended') {
      hint = '对局结束';
    } else if (busy) {
      hint = '白棋思考中…';
    } else if (state.lastWasPass) {
      hint = '对方虚手,轮到你';
    } else {
      hint = '轮到你落子(执黑)';
    }
    if (state.message) hint = state.message;
    $('hint').textContent = hint;

    // 结果面板
    const panel = $('result');
    if (state.phase === 'ended' && state.result) {
      const r = state.result;
      const lines = r.eyes.length
        ? r.eyes.map(e => {
            const x = e.idx % state.N, y = Math.floor(e.idx / state.N);
            return `· 眼(${x},${y}): 1 基础 + ${e.paintSum} 染色 = ${e.score}`;
          }).join('<br>')
        : '· 没有围成任何眼';
      panel.innerHTML =
        `<div class="result-title ${r.win ? 'win' : 'lose'}">` +
        `${r.win ? '🎉 过关!' : '未过关'} 总分 ${r.total} / 目标 ${r.target}</div>` +
        `<div class="result-detail">${lines}</div>`;
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  }

  function render() {
    view.draw(state);
    refreshHud();
  }

  // 黑棋落子后,延时驱动白棋应手
  function scheduleWhite() {
    if (state.phase !== 'playing') { render(); return; }
    busy = true;
    render();
    setTimeout(() => {
      Game.whiteTurn(state);
      busy = false;
      render();
    }, C.render.turnDelayMs);
  }

  function onBoardClick(ev) {
    if (busy || state.phase !== 'playing' || state.toMove !== BLACK) return;
    const idx = view.hitTest(ev.clientX, ev.clientY);
    if (idx == null) return;
    const r = Game.playerPlay(state, idx);
    if (!r.ok) { render(); return; } // 非法手:显示原因
    scheduleWhite();
  }

  function onPass() {
    if (busy || state.phase !== 'playing' || state.toMove !== BLACK) return;
    Game.playerPass(state);
    scheduleWhite();
  }

  function startGame(N) {
    busy = false;
    currentN = N;
    state = Game.createState(N);
    view = Render.create($('board'), state);
    updateSizeButtons();
    render();
  }

  function onRestart() { startGame(currentN); }

  // 高亮当前选中的棋盘大小按钮
  function updateSizeButtons() {
    const btns = document.querySelectorAll('.size-btn');
    btns.forEach(b => {
      b.classList.toggle('active', Number(b.dataset.n) === currentN);
    });
  }

  function init() {
    // 动态生成棋盘大小按钮(依 config.levels)
    const bar = $('size-bar');
    Object.keys(C.levels).map(Number).sort((a, b) => a - b).forEach(N => {
      const btn = document.createElement('button');
      btn.className = 'size-btn';
      btn.dataset.n = N;
      btn.textContent = C.levels[N].label;
      btn.addEventListener('click', () => startGame(N));
      bar.appendChild(btn);
    });

    $('board').addEventListener('click', onBoardClick);
    $('pass-btn').addEventListener('click', onPass);
    $('restart-btn').addEventListener('click', onRestart);
    startGame(C.defaultN);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
