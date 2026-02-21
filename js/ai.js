/**
 * ai.js - 敵AIの行動ロジック
 * 優先順位: 1)近い港へ占領 2)勝てそうなら交戦 3)資源が溜まったら建造
 */

'use strict';

const AI = {
  /**
   * AIターンを実行する
   * @param {GameState} gameState
   * @returns {Array} 実行したアクションのログ
   */
  executeTurn(gameState) {
    const logs = [];
    const enemyFleets = gameState.fleets.filter(f => f.owner === 'enemy' && f.hp > 0);
    const config = GameData.config.ai;

    // 全艦隊の行動をリセット（AIターン開始時）
    for (const fleet of enemyFleets) {
      fleet.resetTurn();
    }

    // 各艦隊の行動を決定
    for (const fleet of enemyFleets) {
      const action = this.decideAction(fleet, gameState);
      if (action) {
        const result = this.executeAction(fleet, action, gameState);
        if (result) logs.push(...result);
      }
    }

    // 建造判定
    const buildLogs = this.tryBuild(gameState);
    logs.push(...buildLogs);

    return logs;
  },

  /**
   * 行動を決定
   */
  decideAction(fleet, gameState) {
    const playerFleets = gameState.fleets.filter(f => f.owner === 'player' && f.hp > 0);
    const reachableCells = this.getReachable(fleet, gameState);

    // 1) 占領可能な港（プレイヤー港・中立港）を最優先で探す
    const targetPort = this.findBestPort(fleet, gameState, reachableCells);
    if (targetPort) {
      return { type: 'capture', port: targetPort, cell: { x: targetPort.x, y: targetPort.y } };
    }

    // 2) 攻撃可能な敵艦隊を探す（勝率チェック付き）
    for (const cell of reachableCells) {
      const targetFleet = playerFleets.find(f => f.x === cell.x && f.y === cell.y);
      if (targetFleet) {
        const winRate = Combat.estimateWinRate(fleet, targetFleet);
        if (winRate >= GameData.config.ai.aggressionLevel) {
          return { type: 'attack', target: targetFleet, cell };
        }
      }
    }

    // 3) 最も近い未占領港へ向かう
    const nearestPort = this.findNearestNonEnemyPort(fleet, gameState);
    if (nearestPort) {
      const moveCell = this.getMoveToward(fleet, nearestPort.x, nearestPort.y, gameState, reachableCells);
      if (moveCell) {
        return { type: 'move', cell: moveCell };
      }
    }

    // 4) 最も近いプレイヤー艦隊へ向かう（攻撃的）
    if (playerFleets.length > 0) {
      const nearest = this.findNearest(fleet, playerFleets);
      const moveCell = this.getMoveToward(fleet, nearest.x, nearest.y, gameState, reachableCells);
      if (moveCell) {
        return { type: 'move', cell: moveCell };
      }
    }

    return null;
  },

  /**
   * 行動を実行
   */
  executeAction(fleet, action, gameState) {
    const logs = [];

    if (action.type === 'attack') {
      // 移動して攻撃
      const oldX = fleet.x;
      const oldY = fleet.y;
      fleet.moveTo(action.cell.x, action.cell.y);
      logs.push(`敵 ${fleet.name} が (${oldX},${oldY}) から (${fleet.x},${fleet.y}) へ移動`);

      // 戦闘
      const result = Combat.resolve(fleet, action.target);
      logs.push(...result.log.map(l => `  ${l}`));

      // 撃沈処理
      if (!result.attackerSurvived) {
        fleet.hp = 0;
        logs.push(`敵 ${fleet.name} 撃沈`);
      }
      if (!result.defenderSurvived) {
        action.target.hp = 0;
        logs.push(`${action.target.name} 撃沈`);
      }

      // 勝者が港にいれば占領
      if (result.winner && result.winner.hp > 0) {
        gameState.checkAndCapturePort(result.winner);
      }

      gameState.showBattleModal(fleet, action.target, result);

    } else if (action.type === 'capture') {
      const oldX = fleet.x;
      const oldY = fleet.y;
      fleet.moveTo(action.cell.x, action.cell.y);
      logs.push(`敵 ${fleet.name} が (${oldX},${oldY}) から (${fleet.x},${fleet.y}) へ移動`);
      gameState.checkAndCapturePort(fleet);

    } else if (action.type === 'move') {
      const oldX = fleet.x;
      const oldY = fleet.y;
      fleet.moveTo(action.cell.x, action.cell.y);
      logs.push(`敵 ${fleet.name} が (${oldX},${oldY}) から (${fleet.x},${fleet.y}) へ移動`);
      gameState.checkAndCapturePort(fleet);
    }

    return logs;
  },

  /**
   * 建造を試みる
   */
  tryBuild(gameState) {
    const logs = [];
    const enemyPorts = gameState.ports.filter(p => p.owner === 'enemy');
    const resources = gameState.resources.enemy;
    const threshold = GameData.config.ai.buildThreshold;

    if (resources.fuel < threshold.fuel || resources.steel < threshold.steel) {
      return logs;
    }

    // 艦隊のいない港を探す
    for (const port of enemyPorts) {
      const fleetAtPort = gameState.fleets.find(
        f => f.owner === 'enemy' && f.x === port.x && f.y === port.y && f.hp > 0
      );
      if (fleetAtPort) continue;

      // 建造する艦種を決定
      let buildType = null;
      const buildTypes = GameData.config.ai.preferredBuildTypes;

      for (const type of buildTypes) {
        const cost = GameData.shipTypes[type].cost;
        if (resources.fuel >= cost.fuel && resources.steel >= cost.steel) {
          buildType = type;
          break;
        }
      }

      if (buildType) {
        const cost = GameData.shipTypes[buildType].cost;
        resources.fuel -= cost.fuel;
        resources.steel -= cost.steel;

        const shipData = GameData.shipTypes[buildType];
        const newFleet = new Fleet({
          name: `敵${shipData.name}隊`,
          type: buildType,
          owner: 'enemy',
          x: port.x,
          y: port.y
        });
        newFleet.hasMoved = true; // 建造したターンは行動済み
        gameState.fleets.push(newFleet);

        logs.push(`⚓ 敵が ${port.name} で ${shipData.name} を建造！`);
        break; // 1ターンに1隻まで
      }
    }

    return logs;
  },

  /**
   * 移動可能なセルを取得
   */
  getReachable(fleet, gameState) {
    return Utils.getReachableCells(
      fleet.x, fleet.y, fleet.movement,
      (x, y) => gameState.isPassable(x, y),
      (x, y) => gameState.hasEnemyFleet(x, y, 'enemy') // 敵（プレイヤー）がいるか
    );
  },

  /**
   * 最も近い未占領港を探す（到達可能範囲内）
   */
  findBestPort(fleet, gameState, reachableCells) {
    const nonEnemyPorts = gameState.ports.filter(p => p.owner !== 'enemy');

    for (const cell of reachableCells) {
      const port = nonEnemyPorts.find(p => p.x === cell.x && p.y === cell.y);
      if (port) return port;
    }
    return null;
  },

  /**
   * 最も近い非敵港を探す（全マップ）
   */
  findNearestNonEnemyPort(fleet, gameState) {
    const nonEnemyPorts = gameState.ports.filter(p => p.owner !== 'enemy');
    if (nonEnemyPorts.length === 0) return null;

    return nonEnemyPorts.reduce((nearest, port) => {
      const dist = Utils.manhattanDistance(fleet.x, fleet.y, port.x, port.y);
      const nearestDist = Utils.manhattanDistance(fleet.x, fleet.y, nearest.x, nearest.y);
      return dist < nearestDist ? port : nearest;
    });
  },

  /**
   * 最も近いユニットを探す
   */
  findNearest(fleet, units) {
    return units.reduce((nearest, unit) => {
      const dist = Utils.manhattanDistance(fleet.x, fleet.y, unit.x, unit.y);
      const nearestDist = Utils.manhattanDistance(fleet.x, fleet.y, nearest.x, nearest.y);
      return dist < nearestDist ? unit : nearest;
    });
  },

  /**
   * 目標に向かう最善の移動先を取得
   */
  getMoveToward(fleet, targetX, targetY, gameState, reachableCells) {
    if (reachableCells.length === 0) return null;

    // 目標に最も近い到達可能セルを選択
    // ただし他の艦隊がいるセルは除外
    const validCells = reachableCells.filter(cell => {
      // 自軍艦隊がいるセルは除外
      const friendlyFleet = gameState.fleets.find(
        f => f.owner === 'enemy' && f.hp > 0 && f.x === cell.x && f.y === cell.y
      );
      return !friendlyFleet;
    });

    if (validCells.length === 0) return null;

    return validCells.reduce((best, cell) => {
      const dist = Utils.manhattanDistance(cell.x, cell.y, targetX, targetY);
      const bestDist = Utils.manhattanDistance(best.x, best.y, targetX, targetY);
      return dist < bestDist ? cell : best;
    });
  }
};
