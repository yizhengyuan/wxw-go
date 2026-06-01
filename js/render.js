// render.js — Canvas 绘制(WXW.Render)
// 唯一接触 Canvas 的逻辑之一(另一为 main 的输入)。每帧全量重画(16 点小盘,无需脏区)。
(function (g) {
  'use strict';

  const C = g.WXW.Config;
  const Board = g.WXW.Board;
  const { EMPTY, BLACK, WHITE } = C;

  function create(canvas, state) {
    const ctx = canvas.getContext('2d');
    const R = C.render;
    const N = state.N;

    // 高 DPI:后端尺寸 = 逻辑尺寸 * dpr,CSS 尺寸保持逻辑尺寸
    const dpr = (g.devicePixelRatio || 1);
    canvas.style.width = R.size + 'px';
    canvas.style.height = R.size + 'px';
    canvas.width = Math.round(R.size * dpr);
    canvas.height = Math.round(R.size * dpr);
    ctx.scale(dpr, dpr);

    const gap = (R.size - 2 * R.margin) / (N - 1);
    const px = (x) => R.margin + x * gap;     // 列 → x 像素
    const py = (y) => R.margin + y * gap;     // 行 → y 像素
    const stoneR = gap * R.stoneRatio;

    // 像素 → 最近交叉点 idx(过远返回 null)
    function hitTest(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const mx = (clientX - rect.left);
      const my = (clientY - rect.top);
      const x = Math.round((mx - R.margin) / gap);
      const y = Math.round((my - R.margin) / gap);
      if (x < 0 || x >= N || y < 0 || y >= N) return null;
      const dx = mx - px(x), dy = my - py(y);
      if (Math.hypot(dx, dy) > gap * 0.5) return null;
      return y * N + x;
    }

    function draw(curState) {
      const s = curState;
      ctx.clearRect(0, 0, R.size, R.size);

      // 1) 木色底
      ctx.fillStyle = '#e8c887';
      ctx.fillRect(0, 0, R.size, R.size);

      // 2) 网格线
      ctx.strokeStyle = '#6b4f2a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        ctx.moveTo(px(0), py(i)); ctx.lineTo(px(N - 1), py(i)); // 横
        ctx.moveTo(px(i), py(0)); ctx.lineTo(px(i), py(N - 1)); // 竖
      }
      ctx.stroke();

      // 3) 染色层:画在「格子(方格)」里 —— 格子是网格线围成的方格,(N-1)×(N-1) 个。
      const M = N - 1; // 每行格子数
      for (let ci = 0; ci < M; ci++) {
        for (let cj = 0; cj < M; cj++) {
          const v = s.paint[cj * M + ci];
          if (v <= 0) continue;
          const a = Math.min(0.6, 0.15 * v);
          ctx.fillStyle = `rgba(230,120,30,${a})`;
          // 格子区域:左上角交叉点 (ci,cj) 到右下角 (ci+1,cj+1),内缩 1px 露出网格线
          ctx.fillRect(px(ci) + 1, py(cj) + 1, gap - 2, gap - 2);
          // 数字画在格子中心
          ctx.fillStyle = '#7a3a00';
          ctx.font = `bold ${Math.round(gap * 0.26)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(v), px(ci) + gap / 2, py(cj) + gap / 2);
        }
      }

      // 4) 终局眼高亮(在棋子之下,空点上)
      if (s.phase === 'ended' && s.result) {
        for (const eye of s.result.eyes) {
          const x = eye.idx % N, y = Math.floor(eye.idx / N);
          ctx.fillStyle = 'rgba(40,170,90,0.45)';
          ctx.beginPath();
          ctx.arc(px(x), py(y), stoneR * 0.95, 0, Math.PI * 2);
          ctx.fill();
          // 眼得分
          ctx.fillStyle = '#14532d';
          ctx.font = `bold ${Math.round(gap * 0.3)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+' + eye.score, px(x), py(y));
        }
      }

      // 5) 棋子
      for (let idx = 0; idx < s.cells.length; idx++) {
        const c = s.cells[idx];
        if (c === EMPTY) continue;
        const x = idx % N, y = Math.floor(idx / N);
        ctx.beginPath();
        ctx.arc(px(x), py(y), stoneR, 0, Math.PI * 2);
        if (c === BLACK) {
          ctx.fillStyle = '#1a1a1a';
          ctx.fill();
        } else {
          ctx.fillStyle = '#fafafa';
          ctx.fill();
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // 6) 最后一手高亮
      if (s.lastMove != null && s.cells[s.lastMove] !== EMPTY) {
        const x = s.lastMove % N, y = Math.floor(s.lastMove / N);
        ctx.strokeStyle = s.cells[s.lastMove] === BLACK ? '#e74c3c' : '#c0392b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px(x), py(y), stoneR * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    return { draw, hitTest };
  }

  g.WXW = g.WXW || {};
  g.WXW.Render = { create };
})(typeof window !== 'undefined' ? window : globalThis);
