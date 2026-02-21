/**
 * fleet.js - 艦隊クラス定義
 */

'use strict';

class Fleet {
  constructor(config) {
    this.id = config.id || Utils.generateId();
    this.name = config.name || '艦隊';
    this.type = config.type || 'destroyer';
    this.owner = config.owner || 'player';
    this.x = config.x || 0;
    this.y = config.y || 0;

    // 艦種データから基本ステータスを取得
    const shipData = GameData.shipTypes[this.type];
    this.maxHp = config.maxHp || shipData.hp;
    this.hp = config.hp !== undefined ? config.hp : this.maxHp;
    this.attack = config.attack || shipData.attack;
    this.defense = config.defense || shipData.defense;
    this.movement = config.movement || shipData.movement;

    // 行動状態
    this.hasMoved = config.hasMoved || false;
    this.remainingMove = config.remainingMove !== undefined ? config.remainingMove : this.movement;
  }

  /**
   * ターン開始時にリセット
   */
  resetTurn() {
    this.hasMoved = false;
    this.remainingMove = this.movement;
  }

  /**
   * 指定座標に移動
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
    this.hasMoved = true;
    this.remainingMove = 0;
  }

  /**
   * ダメージを受ける
   * @returns {boolean} 撃沈したか
   */
  takeDamage(damage) {
    this.hp = Math.max(0, this.hp - damage);
    return this.hp <= 0;
  }

  /**
   * 撃沈済みか
   */
  isDestroyed() {
    return this.hp <= 0;
  }

  /**
   * HP割合（0〜1）
   */
  getHpRatio() {
    return this.hp / this.maxHp;
  }

  /**
   * シリアライズ（セーブ用）
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      owner: this.owner,
      x: this.x,
      y: this.y,
      maxHp: this.maxHp,
      hp: this.hp,
      attack: this.attack,
      defense: this.defense,
      movement: this.movement,
      hasMoved: this.hasMoved,
      remainingMove: this.remainingMove
    };
  }

  /**
   * デシリアライズ（ロード用）
   */
  static deserialize(data) {
    return new Fleet(data);
  }
}
