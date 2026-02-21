/**
 * gameState.js - ゲームの状態管理と中核ロジック
 */

'use strict';

class GameState {
  constructor() {
    this.turn = 1;
    this.maxTurns = GameData.config.maxTurns;
    this.phase = 'player'; // 'player' | 'enemy' | 'gameover'
    this.fleets = [];
    this.ports = [];
    this.resources = {
      player: { ...GameData.config.initialResources.player },
      enemy: { ...GameData.config.initialResources.enemy }
    };
    this.gameResult = null; // 'victory' | 'defeat' | 'draw'
    this.pendingBattle = null; // 表示待ちの戦闘結果
    this.battleQueue = []; // 複数戦闘のキュー
    this.onBattleResolve = null; // 戦闘モーダル表示コールバック
    this.onStateChange = null; // 状態変更コールバック
    this.onLogAdd = null; // ログ追加コールバック
  }

  /**
   * ゲームを初期化
   */
  initialize() {
    this.turn = 1;
    this.phase = 'player';
    this.gameResult = null;
    this.pendingBattle = null;
    this.battleQueue = [];

    // 資源初期化
    this.resources = {
      player: { ...GameData.config.initialResources.player },
      enemy: { ...GameData.config.initialResources.enemy }
    };

    // 港初期化
    this.ports = GameData.ports.map(p => ({ ...p }));

    // 艦隊初期化
    this.fleets = [];
    for (const [owner, fleetConfigs] of Object.entries(GameData.initialFleets)) {
      for (const config of fleetConfigs) {
        this.fleets.push(new Fleet({
          ...config,
          owner,
          id: Utils.generateId()
        }));
      }
    }

    this.addLog('ゲーム開始。蒼海の覇権を目指せ！', 'info');
    this.addLog(`目標: ${GameData.config.victoryPorts}つ以上の港を確保、または敵港を全占領`, 'info');
  }

  // ===== マップ判定 =====

  /**
   * 指定座標が通行可能か
   */
  isPassable(x, y) {
    if (x < 0 || x >= GameData.map.width || y < 0 || y >= GameData.map.height) return false;
    const terrain = GameData.map.grid[y][x];
    return terrain !== 2; // 浅瀬は通行不可
  }

  /**
   * 指定座標に敵（相手勢力）の艦隊がいるか
   */
  hasEnemyFleet(x, y, myOwner) {
    return this.fleets.some(f => f.hp > 0 && f.x === x && f.y === y && f.owner !== myOwner);
  }

  /**
   * 指定座標に自軍の艦隊がいるか
   */
  hasFriendlyFleet(x, y, myOwner) {
    return this.fleets.some(f => f.hp > 0 && f.x === x && f.y === y && f.owner === myOwner);
  }

  /**
   * 指定座標の艦隊を取得
   */
  getFleetAt(x, y) {
    return this.fleets.find(f => f.hp > 0 && f.x === x && f.y === y) || null;
  }

  /**
   * 指定座標の港を取得
   */
  getPortAt(x, y) {
    return this.ports.find(p => p.x === x && p.y === y) || null;
  }

  // ===== プレイヤー行動 =====

  /**
   * 艦隊を移動させる
   * @returns {Object} { success, combat, log }
   */
  moveFleet(fleet, targetX, targetY) {
    if (fleet.hasMoved) {
      return { success: false, reason: 'この艦隊はすでに行動済みです' };
    }
    if (fleet.owner !== 'player') {
      return { success: false, reason: '自軍の艦隊のみ操作できます' };
    }

    // 移動可能範囲チェック
    const reachable = Utils.getReachableCells(
      fleet.x, fleet.y, fleet.movement,
      (x, y) => this.isPassable(x, y),
      (x, y) => this.hasEnemyFleet(x, y, 'player')
    );

    const targetCell = reachable.find(c => c.x === targetX && c.y === targetY);
    if (!targetCell) {
      return { success: false, reason: 'その位置には移動できません' };
    }

    // 自軍艦隊がいるマスには移動不可
    if (this.hasFriendlyFleet(targetX, targetY, 'player')) {
      return { success: false, reason: '自軍艦隊がいます' };
    }

    const oldX = fleet.x;
    const oldY = fleet.y;

    // 敵艦隊との戦闘チェック
    const enemyFleet = this.fleets.find(
      f => f.hp > 0 && f.x === targetX && f.y === targetY && f.owner === 'enemy'
    );

    if (enemyFleet) {
      // 移動して戦闘
      fleet.x = targetX;
      fleet.y = targetY;
      fleet.hasMoved = true;

      const result = Combat.resolve(fleet, enemyFleet);

      // 撃沈処理
      if (!result.attackerSurvived) {
        fleet.hp = 0;
        this.addLog(`${fleet.name} 撃沈！`, 'defeat');
      }
      if (!result.defenderSurvived) {
        enemyFleet.hp = 0;
        this.addLog(`${enemyFleet.name} 撃沈！`, 'victory');
      }

      // 勝者が港にいれば占領
      if (result.winner && result.winner.hp > 0) {
        this.checkAndCapturePort(result.winner);
      }

      this.addLog(`海戦: ${fleet.name} vs ${enemyFleet.name}`, 'battle');

      if (this.onBattleResolve) {
        this.onBattleResolve(fleet, enemyFleet, result);
      }

      this.checkVictoryConditions();
      if (this.onStateChange) this.onStateChange();

      return { success: true, combat: result };
    }

    // 通常移動
    fleet.moveTo(targetX, targetY);
    this.addLog(`${fleet.name} が (${oldX},${oldY}) → (${targetX},${targetY}) へ移動`, 'player');

    // 港の占領チェック
    this.checkAndCapturePort(fleet);

    this.checkVictoryConditions();
    if (this.onStateChange) this.onStateChange();

    return { success: true, combat: null };
  }

  /**
   * 港で艦隊を建造する
   */
  buildFleet(port, shipTypeId) {
    if (port.owner !== 'player') {
      return { success: false, reason: '自軍の港でのみ建造できます' };
    }

    const shipType = GameData.shipTypes[shipTypeId];
    if (!shipType) {
      return { success: false, reason: '不明な艦種です' };
    }

    const cost = shipType.cost;
    if (this.resources.player.fuel < cost.fuel || this.resources.player.steel < cost.steel) {
      return { success: false, reason: '資源が不足しています' };
    }

    // 港に艦隊がいるか確認
    const fleetAtPort = this.fleets.find(
      f => f.hp > 0 && f.x === port.x && f.y === port.y
    );
    if (fleetAtPort) {
      return { success: false, reason: 'この港には既に艦隊がいます' };
    }

    // 資源消費
    this.resources.player.fuel -= cost.fuel;
    this.resources.player.steel -= cost.steel;

    // 艦隊作成
    const fleetCount = this.fleets.filter(f => f.owner === 'player').length + 1;
    const newFleet = new Fleet({
      name: `第${fleetCount}艦隊`,
      type: shipTypeId,
      owner: 'player',
      x: port.x,
      y: port.y,
      hasMoved: true // 建造したターンは行動済み
    });
    this.fleets.push(newFleet);

    this.addLog(`⚓ ${port.name} で ${shipType.name} を建造！`, 'player');
    if (this.onStateChange) this.onStateChange();

    return { success: true, fleet: newFleet };
  }

  // ===== 港の占領 =====

  /**
   * 艦隊がいる座標の港を占領チェック
   */
  checkAndCapturePort(fleet) {
    const port = this.getPortAt(fleet.x, fleet.y);
    if (!port) return false;
    if (port.owner === fleet.owner) return false;

    const oldOwner = port.owner;
    port.owner = fleet.owner;

    const ownerName = GameData.factions[fleet.owner].name;
    const oldOwnerName = GameData.factions[oldOwner].name;
    this.addLog(`🏴 ${fleet.name} が ${port.name} を占領！（${oldOwnerName} → ${ownerName}）`, 'battle');

    return true;
  }

  // ===== ターン進行 =====

  /**
   * プレイヤーターン終了 → 敵ターン実行
   */
  endPlayerTurn() {
    if (this.phase !== 'player') return;

    this.phase = 'enemy';
    this.addLog(`--- ターン ${this.turn} 敵フェーズ ---`, 'info');

    if (this.onStateChange) this.onStateChange();

    // 少し遅延してAI実行（UIの更新を待つ）
    setTimeout(() => {
      this.executeEnemyTurn();
    }, 300);
  }

  /**
   * 敵ターン実行
   */
  executeEnemyTurn() {
    const aiLogs = AI.executeTurn(this);
    for (const log of aiLogs) {
      this.addLog(log, 'enemy');
    }

    this.checkVictoryConditions();

    if (this.gameResult) {
      this.phase = 'gameover';
      if (this.onStateChange) this.onStateChange();
      return;
    }

    // 次のターンへ（少し遅延してUIを更新させる）
    setTimeout(() => {
      this.startNewTurn();
    }, 200);
  }

  /**
   * 新しいターンを開始
   */
  startNewTurn() {
    this.turn++;

    if (this.turn > this.maxTurns) {
      // ターン数超過
      this.evaluateFinalResult();
      this.phase = 'gameover';
      if (this.onStateChange) this.onStateChange();
      return;
    }

    // 資源収入
    this.collectIncome();

    // 全艦隊の行動リセット
    for (const fleet of this.fleets) {
      if (fleet.hp > 0) fleet.resetTurn();
    }

    this.phase = 'player';
    this.addLog(`=== ターン ${this.turn} 開始 ===`, 'info');

    if (this.onStateChange) this.onStateChange();
  }

  /**
   * 資源収入処理
   */
  collectIncome() {
    const income = { player: { fuel: 0, steel: 0 }, enemy: { fuel: 0, steel: 0 } };

    for (const port of this.ports) {
      if (port.owner === 'player' || port.owner === 'enemy') {
        income[port.owner].fuel += port.income.fuel;
        income[port.owner].steel += port.income.steel;
      }
    }

    this.resources.player.fuel += income.player.fuel;
    this.resources.player.steel += income.player.steel;
    this.resources.enemy.fuel += income.enemy.fuel;
    this.resources.enemy.steel += income.enemy.steel;

    if (income.player.fuel > 0 || income.player.steel > 0) {
      this.addLog(
        `💰 資源収入: 燃料+${income.player.fuel} 鋼材+${income.player.steel}`,
        'player'
      );
    }
  }

  // ===== 勝敗判定 =====

  /**
   * 勝利条件をチェック
   */
  checkVictoryConditions() {
    if (this.gameResult) return;

    const playerPorts = this.ports.filter(p => p.owner === 'player').length;
    const enemyPorts = this.ports.filter(p => p.owner === 'enemy').length;
    const playerFleets = this.fleets.filter(f => f.owner === 'player' && f.hp > 0).length;
    const enemyFleets = this.fleets.filter(f => f.owner === 'enemy' && f.hp > 0).length;

    // 勝利条件
    if (enemyPorts === 0) {
      this.gameResult = 'victory';
      this.addLog('🎉 敵の港を全て占領！完全勝利！', 'victory');
      return;
    }

    if (playerPorts >= GameData.config.victoryPorts) {
      this.gameResult = 'victory';
      this.addLog(`🎉 ${GameData.config.victoryPorts}つの港を確保！勝利！`, 'victory');
      return;
    }

    if (enemyFleets === 0 && enemyPorts === 0) {
      this.gameResult = 'victory';
      this.addLog('🎉 敵勢力を壊滅！勝利！', 'victory');
      return;
    }

    // 敗北条件
    if (playerPorts === 0) {
      this.gameResult = 'defeat';
      this.addLog('💀 自軍の港が全て失われた。敗北...', 'defeat');
      return;
    }

    if (playerFleets === 0) {
      this.gameResult = 'defeat';
      this.addLog('💀 自軍艦隊が全滅。敗北...', 'defeat');
      return;
    }
  }

  /**
   * 最終ターン到達時の結果評価
   */
  evaluateFinalResult() {
    const playerPorts = this.ports.filter(p => p.owner === 'player').length;
    const enemyPorts = this.ports.filter(p => p.owner === 'enemy').length;

    if (playerPorts > enemyPorts) {
      this.gameResult = 'victory';
      this.addLog(`⏱️ 制限ターン到達。港数 ${playerPorts} vs ${enemyPorts} で勝利！`, 'victory');
    } else if (playerPorts < enemyPorts) {
      this.gameResult = 'defeat';
      this.addLog(`⏱️ 制限ターン到達。港数 ${playerPorts} vs ${enemyPorts} で敗北...`, 'defeat');
    } else {
      this.gameResult = 'draw';
      this.addLog(`⏱️ 制限ターン到達。港数同数で引き分け。`, 'info');
    }
  }

  // ===== ユーティリティ =====

  /**
   * ログを追加
   */
  addLog(message, type = 'info') {
    if (this.onLogAdd) {
      this.onLogAdd(message, type);
    }
  }

  /**
   * 戦闘モーダルを表示（AIから呼ばれる）
   */
  showBattleModal(attacker, defender, result) {
    if (this.onBattleResolve) {
      this.onBattleResolve(attacker, defender, result);
    }
  }

  /**
   * 勢力統計を取得
   */
  getStats() {
    return {
      player: {
        ports: this.ports.filter(p => p.owner === 'player').length,
        fleets: this.fleets.filter(f => f.owner === 'player' && f.hp > 0).length,
        resources: { ...this.resources.player }
      },
      enemy: {
        ports: this.ports.filter(p => p.owner === 'enemy').length,
        fleets: this.fleets.filter(f => f.owner === 'enemy' && f.hp > 0).length,
        resources: { ...this.resources.enemy }
      }
    };
  }

  // ===== セーブ/ロード =====

  /**
   * ゲーム状態をシリアライズ
   */
  serialize() {
    return {
      turn: this.turn,
      maxTurns: this.maxTurns,
      phase: this.phase,
      fleets: this.fleets.map(f => f.serialize()),
      ports: this.ports.map(p => ({ ...p })),
      resources: Utils.deepCopy(this.resources),
      gameResult: this.gameResult,
      savedAt: new Date().toISOString()
    };
  }

  /**
   * ゲーム状態をデシリアライズ
   */
  deserialize(data) {
    this.turn = data.turn;
    this.maxTurns = data.maxTurns;
    this.phase = data.phase;
    this.fleets = data.fleets.map(f => Fleet.deserialize(f));
    this.ports = data.ports;
    this.resources = data.resources;
    this.gameResult = data.gameResult;
  }

  /**
   * LocalStorageにセーブ
   */
  save() {
    try {
      const data = this.serialize();
      localStorage.setItem('naval_strategy_save', JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('セーブ失敗:', e);
      return false;
    }
  }

  /**
   * LocalStorageからロード
   */
  load() {
    try {
      const raw = localStorage.getItem('naval_strategy_save');
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.deserialize(data);
      return true;
    } catch (e) {
      console.error('ロード失敗:', e);
      return false;
    }
  }

  /**
   * セーブデータが存在するか
   */
  hasSaveData() {
    return !!localStorage.getItem('naval_strategy_save');
  }
}
