/**
 * main.js - ゲームのエントリーポイント
 * 各モジュールを統合し、イベントリスナーを設定する
 */

'use strict';

// ===== グローバル変数 =====
let gameState = null;
let renderer = null;
let ui = null;

// ===== 初期化 =====

window.addEventListener('DOMContentLoaded', () => {
  initGame();
  setupTitleScreen();
  setupHowToScreen();
});

/**
 * ゲームシステムを初期化
 */
function initGame() {
  const canvas = document.getElementById('game-canvas');
  gameState = new GameState();
  renderer = new MapRenderer(canvas, gameState);
  ui = new UI(gameState, renderer);

  // コールバック設定
  gameState.onStateChange = () => {
    ui.updateAll();
    ui.setEndTurnEnabled(gameState.phase === 'player');
  };

  gameState.onLogAdd = (message, type) => {
    ui.addLog(message, type);
  };

  gameState.onBattleResolve = (attacker, defender, result) => {
    ui.showBattleModal(attacker, defender, result);
  };

  // Canvasクリックイベント
  canvas.addEventListener('click', (e) => {
    const cell = renderer.getCellFromMouse(e.clientX, e.clientY);
    if (cell) {
      ui.handleMapClick(cell.x, cell.y);
    }
  });

  // ゲーム内ボタン
  document.getElementById('btn-end-turn').addEventListener('click', () => {
    if (gameState.phase === 'player') {
      ui.clearSelection();
      gameState.endPlayerTurn();
    }
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    if (gameState.save()) {
      ui.showToast('セーブしました', 'success');
    } else {
      ui.showToast('セーブに失敗しました', 'error');
    }
  });

  document.getElementById('btn-title').addEventListener('click', () => {
    if (confirm('タイトルに戻りますか？（未セーブのデータは失われます）')) {
      renderer.stopAnimation();
      ui.showScreen('title-screen');
      updateTitleButtons();
    }
  });

  // 建造モーダル
  document.getElementById('btn-build-cancel').addEventListener('click', () => {
    ui.hideBuildModal();
  });

  // 戦闘モーダル
  document.getElementById('btn-battle-close').addEventListener('click', () => {
    ui.hideBattleModal();
    ui.updateAll();
  });

  // ゲームオーバーモーダル
  document.getElementById('btn-restart').addEventListener('click', () => {
    ui.hideGameOverModal();
    startNewGame();
  });

  document.getElementById('btn-gameover-title').addEventListener('click', () => {
    ui.hideGameOverModal();
    renderer.stopAnimation();
    ui.showScreen('title-screen');
    updateTitleButtons();
  });
}

/**
 * タイトル画面のセットアップ
 */
function setupTitleScreen() {
  document.getElementById('btn-new-game').addEventListener('click', () => {
    startNewGame();
  });

  document.getElementById('btn-load-game').addEventListener('click', () => {
    loadGame();
  });

  document.getElementById('btn-how-to-play').addEventListener('click', () => {
    ui.showScreen('howto-screen');
  });

  updateTitleButtons();
}

/**
 * タイトルボタンの状態更新
 */
function updateTitleButtons() {
  const loadBtn = document.getElementById('btn-load-game');
  if (loadBtn) {
    loadBtn.disabled = !gameState.hasSaveData();
    loadBtn.title = gameState.hasSaveData() ? 'セーブデータを読み込む' : 'セーブデータがありません';
  }
}

/**
 * 遊び方画面のセットアップ
 */
function setupHowToScreen() {
  document.getElementById('btn-back-to-title').addEventListener('click', () => {
    ui.showScreen('title-screen');
  });
}

/**
 * 新規ゲーム開始
 */
function startNewGame() {
  renderer.stopAnimation();
  gameState.initialize();
  ui.clearSelection();

  // ログをクリア
  const logEl = document.getElementById('battle-log');
  if (logEl) logEl.innerHTML = '';

  ui.showScreen('game-screen');
  renderer.startAnimation();
  ui.updateAll();
  ui.setEndTurnEnabled(true);
}

/**
 * セーブデータからロード
 */
function loadGame() {
  renderer.stopAnimation();
  const success = gameState.load();

  if (success) {
    ui.clearSelection();
    ui.showScreen('game-screen');
    renderer.startAnimation();
    ui.updateAll();
    ui.setEndTurnEnabled(gameState.phase === 'player');
    ui.showToast('セーブデータを読み込みました', 'success');
    gameState.addLog('セーブデータを読み込みました', 'info');
  } else {
    ui.showToast('セーブデータの読み込みに失敗しました', 'error');
  }
}
