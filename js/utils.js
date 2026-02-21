/**
 * utils.js - 汎用ユーティリティ関数
 */

'use strict';

const Utils = {
  /**
   * 2点間のマンハッタン距離
   */
  manhattanDistance(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  },

  /**
   * 2点間のチェビシェフ距離（8方向移動用）
   */
  chebyshevDistance(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  },

  /**
   * ランダム整数（min以上max以下）
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * ランダム浮動小数点（min以上max未満）
   */
  randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  },

  /**
   * 配列からランダム要素を取得
   */
  randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  /**
   * 値をmin〜maxにクランプ
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * BFS（幅優先探索）で移動可能なマスを取得
   * @param {number} startX - 開始X
   * @param {number} startY - 開始Y
   * @param {number} movement - 移動力
   * @param {Function} isPassable - (x, y) => boolean
   * @param {Function} isOccupied - (x, y) => boolean（敵ユニットがいるか）
   * @returns {Array} 到達可能な座標の配列 [{x, y, cost}]
   */
  getReachableCells(startX, startY, movement, isPassable, isOccupied) {
    const visited = new Map();
    const queue = [{ x: startX, y: startY, cost: 0 }];
    const result = [];

    visited.set(`${startX},${startY}`, 0);

    while (queue.length > 0) {
      const current = queue.shift();
      const { x, y, cost } = current;

      if (x !== startX || y !== startY) {
        result.push({ x, y, cost });
      }

      if (cost >= movement) continue;

      const neighbors = [
        { x: x - 1, y: y },
        { x: x + 1, y: y },
        { x: x, y: y - 1 },
        { x: x, y: y + 1 }
      ];

      for (const nb of neighbors) {
        const key = `${nb.x},${nb.y}`;
        if (!isPassable(nb.x, nb.y)) continue;
        if (visited.has(key)) continue;
        // 敵ユニットがいるマスは通過不可だが目的地にはなれる（戦闘）
        const newCost = cost + 1;
        if (newCost <= movement) {
          visited.set(key, newCost);
          if (!isOccupied(nb.x, nb.y)) {
            queue.push({ x: nb.x, y: nb.y, cost: newCost });
          } else {
            result.push({ x: nb.x, y: nb.y, cost: newCost, isEnemy: true });
          }
        }
      }
    }

    return result;
  },

  /**
   * A*経路探索
   * @returns {Array|null} 経路の座標配列、到達不可の場合null
   */
  findPath(startX, startY, goalX, goalY, isPassable, mapWidth, mapHeight) {
    const heuristic = (x, y) => Math.abs(x - goalX) + Math.abs(y - goalY);

    const openSet = new Map();
    const closedSet = new Set();
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();

    const startKey = `${startX},${startY}`;
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(startX, startY));
    openSet.set(startKey, { x: startX, y: startY });

    while (openSet.size > 0) {
      // fScoreが最小のノードを取得
      let currentKey = null;
      let minF = Infinity;
      for (const [key, node] of openSet) {
        const f = fScore.get(key) || Infinity;
        if (f < minF) {
          minF = f;
          currentKey = key;
        }
      }

      const current = openSet.get(currentKey);
      if (current.x === goalX && current.y === goalY) {
        // 経路を再構築
        const path = [];
        let key = currentKey;
        while (cameFrom.has(key)) {
          const [cx, cy] = key.split(',').map(Number);
          path.unshift({ x: cx, y: cy });
          key = cameFrom.get(key);
        }
        return path;
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 }
      ];

      for (const nb of neighbors) {
        if (nb.x < 0 || nb.x >= mapWidth || nb.y < 0 || nb.y >= mapHeight) continue;
        if (!isPassable(nb.x, nb.y)) continue;

        const nbKey = `${nb.x},${nb.y}`;
        if (closedSet.has(nbKey)) continue;

        const tentativeG = (gScore.get(currentKey) || 0) + 1;
        if (!openSet.has(nbKey)) {
          openSet.set(nbKey, nb);
        } else if (tentativeG >= (gScore.get(nbKey) || Infinity)) {
          continue;
        }

        cameFrom.set(nbKey, currentKey);
        gScore.set(nbKey, tentativeG);
        fScore.set(nbKey, tentativeG + heuristic(nb.x, nb.y));
      }
    }

    return null; // 到達不可
  },

  /**
   * 深いコピー（JSONシリアライズ可能なオブジェクト）
   */
  deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * 色を16進数からRGBAに変換
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  /**
   * ユニークIDを生成
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
};
