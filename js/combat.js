/**
 * combat.js - 戦闘解決システム
 */

'use strict';

const Combat = {
  /**
   * 戦闘を解決する
   * @param {Fleet} attacker - 攻撃側艦隊
   * @param {Fleet} defender - 防御側艦隊
   * @returns {Object} 戦闘結果
   */
  resolve(attacker, defender) {
    const log = [];
    const randomFactor = GameData.config.combat.randomFactor;

    log.push(`⚔️ ${attacker.name} vs ${defender.name} 海戦開始！`);
    log.push(`攻撃側: ${attacker.name} HP ${attacker.hp}/${attacker.maxHp} | 攻撃力 ${attacker.attack}`);
    log.push(`防御側: ${defender.name} HP ${defender.hp}/${defender.maxHp} | 攻撃力 ${defender.attack}`);

    let round = 1;
    const maxRounds = 10;

    // 先制攻撃判定（移動力が高い方が先攻）
    let first = attacker;
    let second = defender;
    if (defender.movement > attacker.movement) {
      first = defender;
      second = attacker;
    }

    while (first.hp > 0 && second.hp > 0 && round <= maxRounds) {
      log.push(`--- 第${round}ラウンド ---`);

      // 先攻の攻撃
      const dmg1 = this.calcDamage(first, second, randomFactor);
      const sunk1 = second.takeDamage(dmg1);
      log.push(`${first.name} → ${second.name}: ${dmg1}ダメージ (残HP: ${second.hp})`);

      if (sunk1) {
        log.push(`💥 ${second.name} 撃沈！`);
        break;
      }

      // 後攻の攻撃
      const dmg2 = this.calcDamage(second, first, randomFactor);
      const sunk2 = first.takeDamage(dmg2);
      log.push(`${second.name} → ${first.name}: ${dmg2}ダメージ (残HP: ${first.hp})`);

      if (sunk2) {
        log.push(`💥 ${first.name} 撃沈！`);
        break;
      }

      round++;
    }

    // 勝者判定
    let winner = null;
    let loser = null;

    if (attacker.hp <= 0 && defender.hp <= 0) {
      log.push('⚡ 相討ち！双方撃沈。');
      winner = null;
    } else if (attacker.hp <= 0) {
      winner = defender;
      loser = attacker;
      log.push(`🏆 ${defender.name} の勝利！`);
    } else if (defender.hp <= 0) {
      winner = attacker;
      loser = defender;
      log.push(`🏆 ${attacker.name} の勝利！`);
    } else {
      // 最大ラウンド到達 → HPが多い方が勝利
      if (attacker.hp >= defender.hp) {
        winner = attacker;
        loser = defender;
        log.push(`⏱️ 時間切れ。${attacker.name} の判定勝利！`);
        // 判定負けは撃沈ではなく大破（HP1で残す）
        loser.hp = 1;
      } else {
        winner = defender;
        loser = attacker;
        log.push(`⏱️ 時間切れ。${defender.name} の判定勝利！`);
        loser.hp = 1;
      }
    }

    return {
      winner,
      loser,
      log,
      attackerSurvived: attacker.hp > 0,
      defenderSurvived: defender.hp > 0,
      rounds: round
    };
  },

  /**
   * ダメージ計算
   * 攻撃力 × (1 ± randomFactor) - 防御力 = ダメージ（最低1）
   */
  calcDamage(attacker, defender, randomFactor) {
    const randomMult = 1 + Utils.randomFloat(-randomFactor, randomFactor);
    const rawDamage = attacker.attack * randomMult - defender.defense;
    return Math.max(1, Math.round(rawDamage));
  },

  /**
   * 戦闘シミュレーション（実際に状態を変えずに結果を予測）
   */
  simulate(attacker, defender) {
    const atkCopy = new Fleet(attacker.serialize());
    const defCopy = new Fleet(defender.serialize());
    return this.resolve(atkCopy, defCopy);
  },

  /**
   * 勝率推定（簡易）
   * @returns {number} 0〜1の勝率
   */
  estimateWinRate(attacker, defender) {
    let wins = 0;
    const trials = 20;
    for (let i = 0; i < trials; i++) {
      const result = this.simulate(attacker, defender);
      if (result.winner && result.winner.owner === attacker.owner) {
        wins++;
      }
    }
    return wins / trials;
  }
};
