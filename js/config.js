// config.js — 关卡参数与常量(WXW.Config)
// 本版只做单关基本闭环;数值集中在此,方便调。
(function (g) {
  'use strict';

  const EMPTY = 0;
  const BLACK = 1; // 玩家
  const WHITE = 2; // 电脑

  const Config = {
    // 棋子颜色枚举
    EMPTY, BLACK, WHITE,

    // 默认开局的棋盘大小(路数 = 交叉点边长 N)
    defaultN: 4,

    // 各章棋盘参数。棋子数 ≈ N²/2(沿用 GDD 第一章 4×4→8 的比例)。
    // targetScore 是平衡旋钮,下方数值由 greedy 机器人实测各盘可达上限校准而来。
    levels: {
      4: { N: 4, label: '4 路', stones: { b: 8,  w: 8  }, targetScore: 3 },
      5: { N: 5, label: '5 路', stones: { b: 12, w: 12 }, targetScore: 4 },
      6: { N: 6, label: '6 路', stones: { b: 18, w: 18 }, targetScore: 6 },
      7: { N: 7, label: '7 路', stones: { b: 24, w: 24 }, targetScore: 8 },
    },

    // 白棋 AI(难度0)启发式权重 —— 可调
    ai: {
      W_DESTROY_EYE: 10,        // 破坏黑棋成眼点(按黑邻点数加权)
      W_INVADE: 3,              // 侵入黑势(周围黑子多)
      W_CAPTURE: 6,             // 这手能提到黑子
      PENALTY_ATARI: -15,       // 落子后自己这群只剩 1 气(自投打吃)
      W_CENTER: 1,              // 轻微中心偏好
      JITTER: 0.2,              // 随机抖动幅度(打破平局)
      PASS_THRESHOLD: -8,       // 最优手低于此分则虚手
    },

    // 渲染常量
    render: {
      size: 480,            // canvas 逻辑边长(CSS 像素)
      margin: 56,           // 棋盘到画布边的留白
      stoneRatio: 0.42,     // 棋子半径 / 格距
      turnDelayMs: 320,     // 黑棋落子后到白棋应手的延时(让玩家看清)
    },
  };

  g.WXW = g.WXW || {};
  g.WXW.Config = Config;
  if (typeof module !== 'undefined' && module.exports) module.exports = Config;
})(typeof window !== 'undefined' ? window : globalThis);
