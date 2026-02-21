/**
 * ui.js - UIコントローラー（パネル更新・モーダル管理）
 */

'use strict';

class UI {
  constructor(gameState, renderer) {
    this.gameState = gameState;
    this.renderer = renderer;
    this.selectedFleet = null;
    this.selectedPort = null;
    this.highlightCells = [];
    this.battleQueue = [];
    this.isBattleModalOpen = false;
  }

  // ===== 画面切り替え =====

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
  }

  // ===== ヘッダー更新 =====

  updateHeader() {
    const gs = this.gameState;
    const turnLabel = document.getElementById('turn-phase-label');
    const turnNumber = document.getElementById('turn-number');
    const resFuel = document.getElementById('res-fuel');
    const resSteel = document.getElementById('res-steel');

    if (gs.phase === 'player') {
      turnLabel.textContent = '自軍ターン';
      turnLabel.className = 'phase-label player-phase';
    } else if (gs.phase === 'enemy') {
      turnLabel.textContent = '敵ターン処理中...';
      turnLabel.className = 'phase-label enemy-phase';
    }

    turnNumber.textContent = `ターン ${gs.turn} / ${gs.maxTurns}`;
    resFuel.textContent = gs.resources.player.fuel;
    resSteel.textContent = gs.resources.player.steel;
  }

  // ===== 勢力情報更新 =====

  updateFactionInfo() {
    const stats = this.gameState.getStats();
    document.getElementById('player-ports').textContent = stats.player.ports;
    document.getElementById('player-fleets').textContent = stats.player.fleets;
    document.getElementById('enemy-ports').textContent = stats.enemy.ports;
    document.getElementById('enemy-fleets').textContent = stats.enemy.fleets;
  }

  // ===== 情報パネル更新 =====

  updateInfoPanel() {
    const infoContent = document.getElementById('info-content');

    if (this.selectedFleet && this.selectedFleet.hp > 0) {
      const fleet = this.selectedFleet;
      const shipType = GameData.shipTypes[fleet.type];
      const hpRatio = fleet.getHpRatio();
      const hpClass = hpRatio > 0.6 ? 'hp-high' : hpRatio > 0.3 ? 'hp-mid' : 'hp-low';
      const ownerName = GameData.factions[fleet.owner].name;

      infoContent.innerHTML = `
        <div class="info-fleet">
          <div class="fleet-name">${fleet.name}</div>
          <div class="fleet-type">${shipType.name} (${shipType.symbol}) - ${ownerName}</div>
          <div class="hp-bar-container">
            <div class="hp-bar-label">HP: ${fleet.hp} / ${fleet.maxHp}</div>
            <div class="hp-bar">
              <div class="hp-bar-fill ${hpClass}" style="width: ${hpRatio * 100}%"></div>
            </div>
          </div>
          <div class="info-stat">
            <span class="stat-label">攻撃力</span>
            <span class="stat-value">${fleet.attack}</span>
          </div>
          <div class="info-stat">
            <span class="stat-label">防御力</span>
            <span class="stat-value">${fleet.defense}</span>
          </div>
          <div class="info-stat">
            <span class="stat-label">移動力</span>
            <span class="stat-value">${fleet.movement}</span>
          </div>
          <div class="info-stat">
            <span class="stat-label">位置</span>
            <span class="stat-value">(${fleet.x}, ${fleet.y})</span>
          </div>
          <div class="info-stat">
            <span class="stat-label">状態</span>
            <span class="stat-value">${fleet.hasMoved ? '行動済' : '行動可能'}</span>
          </div>
        </div>
      `;
    } else if (this.selectedPort) {
      const port = this.selectedPort;
      const ownerClass = `owner-${port.owner}`;
      const ownerName = GameData.factions[port.owner].name;

      infoContent.innerHTML = `
        <div class="info-port">
          <div class="port-name">⚓ ${port.name}</div>
          <span class="port-owner-badge ${ownerClass}">${ownerName}</span>
          <div class="port-income">
            収入: 燃料 +${port.income.fuel} / 鋼材 +${port.income.steel} / ターン
          </div>
          ${port.owner === 'player' ? this.buildBuildButton(port) : ''}
        </div>
      `;

      // 建造ボタンのイベント
      const buildBtn = document.getElementById('quick-build-btn');
      if (buildBtn) {
        buildBtn.addEventListener('click', () => {
          this.showBuildModal(port);
        });
      }
    } else {
      infoContent.innerHTML = '<p class="info-placeholder">マップ上のユニットまたは港を選択してください</p>';
    }
  }

  buildBuildButton(port) {
    const fleetAtPort = this.gameState.fleets.find(
      f => f.hp > 0 && f.x === port.x && f.y === port.y
    );
    if (fleetAtPort) {
      return `<div style="color: var(--text-dim); font-size: 12px; margin-top: 8px;">艦隊が停泊中（建造不可）</div>`;
    }
    if (this.gameState.phase !== 'player') {
      return '';
    }
    return `<button id="quick-build-btn" class="btn btn-gold btn-full" style="margin-top: 10px;">⚓ 艦隊建造</button>`;
  }

  // ===== ハイライト管理 =====

  showMoveHighlights(fleet) {
    const reachable = Utils.getReachableCells(
      fleet.x, fleet.y, fleet.movement,
      (x, y) => this.gameState.isPassable(x, y),
      (x, y) => this.gameState.hasEnemyFleet(x, y, 'player')
    );

    const highlights = [];
    for (const cell of reachable) {
      // 自軍艦隊がいるセルは除外
      if (this.gameState.hasFriendlyFleet(cell.x, cell.y, 'player')) continue;

      const enemyFleet = this.gameState.fleets.find(
        f => f.hp > 0 && f.x === cell.x && f.y === cell.y && f.owner === 'enemy'
      );
      const port = this.gameState.getPortAt(cell.x, cell.y);

      if (enemyFleet) {
        highlights.push({ x: cell.x, y: cell.y, type: 'attack' });
      } else if (port && port.owner !== 'player') {
        highlights.push({ x: cell.x, y: cell.y, type: 'port' });
      } else {
        highlights.push({ x: cell.x, y: cell.y, type: 'move' });
      }
    }

    this.highlightCells = highlights;
    this.renderer.setHighlights(highlights);
  }

  clearHighlights() {
    this.highlightCells = [];
    this.renderer.clearHighlights();
  }

  // ===== 選択管理 =====

  selectFleet(fleet) {
    this.selectedFleet = fleet;
    this.selectedPort = null;
    this.renderer.setSelectedFleet(fleet);

    if (fleet.owner === 'player' && !fleet.hasMoved && this.gameState.phase === 'player') {
      this.showMoveHighlights(fleet);
    } else {
      this.clearHighlights();
    }

    this.updateInfoPanel();
  }

  selectPort(port) {
    this.selectedPort = port;
    this.selectedFleet = null;
    this.renderer.setSelectedPort(port);
    this.clearHighlights();
    this.updateInfoPanel();
  }

  clearSelection() {
    this.selectedFleet = null;
    this.selectedPort = null;
    this.renderer.clearSelection();
    this.clearHighlights();
    this.updateInfoPanel();
  }

  // ===== クリック処理 =====

  handleMapClick(x, y) {
    if (this.gameState.phase !== 'player') return;
    if (this.isBattleModalOpen) return;

    const clickedFleet = this.gameState.getFleetAt(x, y);
    const clickedPort = this.gameState.getPortAt(x, y);

    // 移動先クリック（艦隊選択中）
    if (this.selectedFleet && this.selectedFleet.owner === 'player') {
      const isHighlighted = this.highlightCells.some(c => c.x === x && c.y === y);

      if (isHighlighted) {
        // 移動実行
        const result = this.gameState.moveFleet(this.selectedFleet, x, y);
        if (!result.success) {
          this.showToast(result.reason, 'error');
        }
        this.clearSelection();
        this.updateAll();
        return;
      }
    }

    // 自軍艦隊クリック
    if (clickedFleet && clickedFleet.owner === 'player') {
      if (this.selectedFleet && this.selectedFleet.id === clickedFleet.id) {
        // 同じ艦隊を再クリック → 選択解除
        this.clearSelection();
      } else {
        this.selectFleet(clickedFleet);
      }
      return;
    }

    // 港クリック
    if (clickedPort) {
      this.selectPort(clickedPort);
      return;
    }

    // 何もない場所クリック → 選択解除
    this.clearSelection();
  }

  // ===== 建造モーダル =====

  showBuildModal(port) {
    if (this.gameState.phase !== 'player') return;

    const modal = document.getElementById('build-modal');
    const portName = document.getElementById('build-port-name');
    const buildOptions = document.getElementById('build-options');

    portName.textContent = `建造港: ${port.name}`;
    buildOptions.innerHTML = '';

    for (const [typeId, shipType] of Object.entries(GameData.shipTypes)) {
      const cost = shipType.cost;
      const canAfford = this.gameState.resources.player.fuel >= cost.fuel &&
                        this.gameState.resources.player.steel >= cost.steel;

      const option = document.createElement('div');
      option.className = `build-option ${canAfford ? '' : 'disabled'}`;
      option.innerHTML = `
        <div class="build-option-symbol">${shipType.symbol}</div>
        <div class="build-option-info">
          <div class="build-option-name">${shipType.name}</div>
          <div class="build-option-stats">
            HP:${shipType.hp} 攻:${shipType.attack} 防:${shipType.defense} 移:${shipType.movement}
          </div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${shipType.description}</div>
        </div>
        <div class="build-option-cost">
          ⛽${cost.fuel}<br>🔩${cost.steel}
        </div>
      `;

      if (canAfford) {
        option.addEventListener('click', () => {
          const result = this.gameState.buildFleet(port, typeId);
          if (result.success) {
            this.hideBuildModal();
            this.clearSelection();
            this.updateAll();
            this.showToast(`${shipType.name} を建造しました！`, 'success');
          } else {
            this.showToast(result.reason, 'error');
          }
        });
      }

      buildOptions.appendChild(option);
    }

    modal.classList.remove('hidden');
  }

  hideBuildModal() {
    document.getElementById('build-modal').classList.add('hidden');
  }

  // ===== 戦闘モーダル =====

  showBattleModal(attacker, defender, result) {
    this.isBattleModalOpen = true;
    const modal = document.getElementById('battle-modal');
    const playerSide = attacker.owner === 'player' ? attacker : defender;
    const enemySide = attacker.owner === 'enemy' ? attacker : defender;

    document.getElementById('battle-player-name').textContent = playerSide.name;
    document.getElementById('battle-player-hp').textContent =
      `HP: ${playerSide.hp} / ${playerSide.maxHp}`;
    document.getElementById('battle-enemy-name').textContent = enemySide.name;
    document.getElementById('battle-enemy-hp').textContent =
      `HP: ${enemySide.hp} / ${enemySide.maxHp}`;

    const logEl = document.getElementById('battle-log-modal');
    logEl.innerHTML = result.log.map(l => `<p>${l}</p>`).join('');
    logEl.scrollTop = logEl.scrollHeight;

    modal.classList.remove('hidden');
  }

  hideBattleModal() {
    document.getElementById('battle-modal').classList.add('hidden');
    this.isBattleModalOpen = false;
  }

  // ===== ゲームオーバーモーダル =====

  showGameOverModal() {
    const gs = this.gameState;
    const modal = document.getElementById('gameover-modal');
    const icon = document.getElementById('gameover-icon');
    const title = document.getElementById('gameover-title');
    const message = document.getElementById('gameover-message');
    const turnEl = document.getElementById('gameover-turn');
    const portsEl = document.getElementById('gameover-ports');

    const stats = gs.getStats();

    if (gs.gameResult === 'victory') {
      icon.textContent = '🏆';
      title.textContent = '勝利！';
      title.style.color = '#c8a84b';
      message.textContent = '蒼海の覇権を掌握した！連合艦隊の栄光は永遠に輝く。';
    } else if (gs.gameResult === 'defeat') {
      icon.textContent = '💀';
      title.textContent = '敗北...';
      title.style.color = '#ff4a4a';
      message.textContent = '帝国艦隊の猛攻に屈した。再起を期して戦略を練り直せ。';
    } else {
      icon.textContent = '⚖️';
      title.textContent = '引き分け';
      title.style.color = '#aaaaaa';
      message.textContent = '制限ターンを迎えた。港数が同数で決着がつかなかった。';
    }

    turnEl.textContent = `${gs.turn} ターン`;
    portsEl.textContent = `${stats.player.ports} / ${gs.ports.length}`;

    modal.classList.remove('hidden');
  }

  hideGameOverModal() {
    document.getElementById('gameover-modal').classList.add('hidden');
  }

  // ===== ログ =====

  addLog(message, type) {
    const logEl = document.getElementById('battle-log');
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}-log`;
    entry.textContent = message;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;

    // ログが多くなりすぎたら古いものを削除
    while (logEl.children.length > 50) {
      logEl.removeChild(logEl.firstChild);
    }
  }

  // ===== トースト通知 =====

  showToast(message, type = 'info') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
      pointer-events: none;
    `;

    if (type === 'error') {
      toast.style.background = 'rgba(200, 50, 50, 0.9)';
      toast.style.color = '#fff';
      toast.style.border = '1px solid rgba(255, 100, 100, 0.5)';
    } else if (type === 'success') {
      toast.style.background = 'rgba(50, 150, 80, 0.9)';
      toast.style.color = '#fff';
      toast.style.border = '1px solid rgba(100, 200, 100, 0.5)';
    } else {
      toast.style.background = 'rgba(26, 107, 154, 0.9)';
      toast.style.color = '#fff';
      toast.style.border = '1px solid rgba(74, 158, 255, 0.5)';
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 2500);
  }

  // ===== 全体更新 =====

  updateAll() {
    this.updateHeader();
    this.updateFactionInfo();
    this.updateInfoPanel();

    // ゲームオーバーチェック
    const modal = document.getElementById('gameover-modal');
    if (this.gameState.gameResult && this.gameState.phase === 'gameover' &&
        modal && modal.classList.contains('hidden')) {
      setTimeout(() => this.showGameOverModal(), 600);
    }
  }

  // ===== ボタン有効/無効 =====

  setEndTurnEnabled(enabled) {
    const btn = document.getElementById('btn-end-turn');
    if (btn) btn.disabled = !enabled;
  }
}
