/**
 * gameData.js - ゲームデータ定義（艦種・マップ・設定）
 * JSONファイルの代わりにJSオブジェクトとして定義（静的サイト対応）
 */

'use strict';

const GameData = {
  // ===== 艦種定義 =====
  shipTypes: {
    destroyer: {
      id: 'destroyer',
      name: '駆逐艦',
      symbol: 'DD',
      hp: 30,
      attack: 15,
      defense: 5,
      movement: 4,
      cost: { fuel: 20, steel: 15 },
      description: '高速・低コスト。偵察や拠点確保に向く。',
      color: '#7ec8e3',
      size: 0.55
    },
    cruiser: {
      id: 'cruiser',
      name: '巡洋艦',
      symbol: 'CA',
      hp: 60,
      attack: 25,
      defense: 10,
      movement: 3,
      cost: { fuel: 35, steel: 30 },
      description: 'バランス型。主力として活躍する。',
      color: '#90caf9',
      size: 0.65
    },
    battleship: {
      id: 'battleship',
      name: '戦艦',
      symbol: 'BB',
      hp: 120,
      attack: 45,
      defense: 20,
      movement: 2,
      cost: { fuel: 60, steel: 80 },
      description: '最強の攻撃力と耐久力。移動は遅い。',
      color: '#b0bec5',
      size: 0.78
    }
  },

  // ===== マップ定義 =====
  map: {
    width: 12,
    height: 8,
    cellSize: 64,
    // 地形: 0=海, 1=港, 2=浅瀬
    grid: [
      [0,0,0,2,0,0,0,0,0,0,0,0],
      [0,1,0,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,2,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,2,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,0,0,0,0,0,0,0,0,1,0],
      [0,0,0,0,0,0,0,0,0,2,0,0]
    ],
    terrainColors: {
      0: '#0a2a4a',  // 海
      1: '#1a4a2a',  // 港（緑系）
      2: '#2a2a1a'   // 浅瀬
    }
  },

  // ===== 港定義 =====
  ports: [
    {
      id: 'port_alba',
      x: 1, y: 1,
      name: 'アルバ港',
      owner: 'player',
      income: { fuel: 10, steel: 8 }
    },
    {
      id: 'port_nord',
      x: 10, y: 1,
      name: 'ノルド港',
      owner: 'enemy',
      income: { fuel: 10, steel: 8 }
    },
    {
      id: 'port_south',
      x: 1, y: 6,
      name: 'サウス基地',
      owner: 'player',
      income: { fuel: 8, steel: 6 }
    },
    {
      id: 'port_east',
      x: 10, y: 6,
      name: 'イースト要塞',
      owner: 'enemy',
      income: { fuel: 8, steel: 6 }
    },
    {
      id: 'port_center',
      x: 5, y: 3,
      name: '中央泊地',
      owner: 'neutral',
      income: { fuel: 12, steel: 10 }
    },
    {
      id: 'port_west',
      x: 7, y: 4,
      name: '西方海峡港',
      owner: 'neutral',
      income: { fuel: 10, steel: 8 }
    }
  ],

  // ===== 初期艦隊 =====
  initialFleets: {
    player: [
      { type: 'cruiser', x: 2, y: 1, name: '第一艦隊' },
      { type: 'destroyer', x: 2, y: 6, name: '第二艦隊' }
    ],
    enemy: [
      { type: 'cruiser', x: 9, y: 1, name: '敵第一艦隊' },
      { type: 'destroyer', x: 9, y: 6, name: '敵第二艦隊' }
    ]
  },

  // ===== ゲーム設定 =====
  config: {
    maxTurns: 30,
    victoryPorts: 4,
    initialResources: {
      player: { fuel: 80, steel: 60 },
      enemy: { fuel: 80, steel: 60 }
    },
    combat: {
      randomFactor: 0.3
    },
    ai: {
      buildThreshold: { fuel: 40, steel: 35 },
      preferredBuildTypes: ['destroyer', 'cruiser'],
      aggressionLevel: 0.6
    }
  },

  // ===== 勢力定義 =====
  factions: {
    player: {
      id: 'player',
      name: '連合艦隊',
      color: '#4a9eff',
      darkColor: '#1a4a8a'
    },
    enemy: {
      id: 'enemy',
      name: '帝国艦隊',
      color: '#ff4a4a',
      darkColor: '#8a1a1a'
    },
    neutral: {
      id: 'neutral',
      name: '中立',
      color: '#aaaaaa',
      darkColor: '#444444'
    }
  }
};
