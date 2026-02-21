/**
 * mapRenderer.js - Canvasによるマップ描画
 */

'use strict';

class MapRenderer {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gameState = gameState;
    this.cellSize = GameData.map.cellSize;
    this.mapWidth = GameData.map.width;
    this.mapHeight = GameData.map.height;

    // Canvasサイズ設定
    this.canvas.width = this.mapWidth * this.cellSize;
    this.canvas.height = this.mapHeight * this.cellSize;

    // ハイライト状態
    this.highlightCells = [];
    this.selectedFleet = null;
    this.selectedPort = null;

    // アニメーション
    this.animationFrame = null;
    this.tick = 0;
  }

  /**
   * 全体を再描画
   */
  render() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 背景
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // グリッド描画
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        this.drawCell(x, y);
      }
    }

    // ハイライト描画
    this.drawHighlights();

    // 港描画
    this.drawPorts();

    // 艦隊描画
    this.drawFleets();

    // グリッド線
    this.drawGrid();

    // 選択枠
    this.drawSelection();

    this.tick++;
  }

  /**
   * セルの地形を描画
   */
  drawCell(x, y) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const terrain = GameData.map.grid[y][x];
    const px = x * cs;
    const py = y * cs;

    if (terrain === 0) {
      // 海：グラデーション
      const gradient = ctx.createLinearGradient(px, py, px + cs, py + cs);
      gradient.addColorStop(0, '#0a2a4a');
      gradient.addColorStop(1, '#0d3560');
      ctx.fillStyle = gradient;
      ctx.fillRect(px, py, cs, cs);

      // 波紋エフェクト（軽量）
      const waveOffset = (this.tick * 0.02 + x * 0.3 + y * 0.5) % (Math.PI * 2);
      const waveAlpha = (Math.sin(waveOffset) + 1) * 0.03;
      ctx.fillStyle = `rgba(100, 180, 255, ${waveAlpha})`;
      ctx.fillRect(px, py, cs, cs);

    } else if (terrain === 1) {
      // 港：緑系
      ctx.fillStyle = '#0d2a18';
      ctx.fillRect(px, py, cs, cs);

    } else if (terrain === 2) {
      // 浅瀬
      ctx.fillStyle = '#1a1a0a';
      ctx.fillRect(px, py, cs, cs);

      // 浅瀬テクスチャ
      ctx.fillStyle = 'rgba(100, 80, 20, 0.3)';
      for (let i = 0; i < 3; i++) {
        const tx = px + (x * 7 + i * 13) % (cs - 8);
        const ty = py + (y * 11 + i * 7) % (cs - 8);
        ctx.fillRect(tx, ty, 4, 2);
      }
    }
  }

  /**
   * ハイライト描画
   */
  drawHighlights() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    for (const cell of this.highlightCells) {
      const px = cell.x * cs;
      const py = cell.y * cs;

      if (cell.type === 'move') {
        ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = 'rgba(74, 158, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
      } else if (cell.type === 'attack') {
        ctx.fillStyle = 'rgba(255, 74, 74, 0.3)';
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = 'rgba(255, 74, 74, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
      } else if (cell.type === 'port') {
        ctx.fillStyle = 'rgba(200, 168, 75, 0.3)';
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = 'rgba(200, 168, 75, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
      }
    }
  }

  /**
   * 港描画
   */
  drawPorts() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    for (const port of this.gameState.ports) {
      const px = port.x * cs;
      const py = port.y * cs;
      const cx = px + cs / 2;
      const cy = py + cs / 2;

      // 港の背景色（勢力に応じて）
      let bgColor, borderColor;
      if (port.owner === 'player') {
        bgColor = 'rgba(74, 158, 255, 0.15)';
        borderColor = 'rgba(74, 158, 255, 0.6)';
      } else if (port.owner === 'enemy') {
        bgColor = 'rgba(255, 74, 74, 0.15)';
        borderColor = 'rgba(255, 74, 74, 0.6)';
      } else {
        bgColor = 'rgba(170, 170, 170, 0.1)';
        borderColor = 'rgba(170, 170, 170, 0.4)';
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(px, py, cs, cs);

      // 港のアイコン（錨マーク）
      ctx.save();
      ctx.translate(cx, cy);

      // 建物シルエット
      const bw = cs * 0.5;
      const bh = cs * 0.35;
      ctx.fillStyle = borderColor;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

      // 屋根
      ctx.beginPath();
      ctx.moveTo(-bw / 2 - 4, -bh / 2);
      ctx.lineTo(0, -bh / 2 - 10);
      ctx.lineTo(bw / 2 + 4, -bh / 2);
      ctx.closePath();
      ctx.fillStyle = borderColor;
      ctx.fill();

      // 旗
      const flagColor = port.owner === 'player' ? '#4a9eff' :
                        port.owner === 'enemy' ? '#ff4a4a' : '#aaaaaa';
      ctx.fillStyle = flagColor;
      ctx.fillRect(bw / 2 - 2, -bh / 2 - 18, 2, 14);
      ctx.beginPath();
      ctx.moveTo(bw / 2, -bh / 2 - 18);
      ctx.lineTo(bw / 2 + 10, -bh / 2 - 12);
      ctx.lineTo(bw / 2, -bh / 2 - 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // 港名
      ctx.fillStyle = 'rgba(220, 220, 220, 0.8)';
      ctx.font = `bold 9px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(port.name, cx, py + cs - 3);

      // 枠線
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
    }
  }

  /**
   * 艦隊描画
   */
  drawFleets() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    for (const fleet of this.gameState.fleets) {
      if (fleet.hp <= 0) continue;

      const px = fleet.x * cs;
      const py = fleet.y * cs;
      const cx = px + cs / 2;
      const cy = py + cs / 2;

      const shipType = GameData.shipTypes[fleet.type];
      const faction = GameData.factions[fleet.owner];
      const isSelected = this.selectedFleet && this.selectedFleet.id === fleet.id;
      const hasMoved = fleet.hasMoved;

      // 艦隊の影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(cx + 2, cy + 3, cs * 0.3, cs * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 艦体（船型）
      const shipSize = cs * (shipType.size || 0.6);
      const shipW = shipSize;
      const shipH = shipSize * 0.45;

      ctx.save();
      ctx.translate(cx, cy);

      // 移動済みは暗く
      const alpha = hasMoved ? 0.5 : 1.0;
      ctx.globalAlpha = alpha;

      // 艦体
      ctx.beginPath();
      ctx.moveTo(shipW / 2, 0);
      ctx.lineTo(shipW * 0.3, -shipH / 2);
      ctx.lineTo(-shipW / 2, -shipH / 2);
      ctx.lineTo(-shipW * 0.6, 0);
      ctx.lineTo(-shipW / 2, shipH / 2);
      ctx.lineTo(shipW * 0.3, shipH / 2);
      ctx.closePath();

      // 艦体グラデーション
      const bodyGrad = ctx.createLinearGradient(0, -shipH / 2, 0, shipH / 2);
      bodyGrad.addColorStop(0, faction.color);
      bodyGrad.addColorStop(0.5, faction.darkColor);
      bodyGrad.addColorStop(1, faction.color);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // 艦種シンボル
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(shipSize * 0.28)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shipType.symbol, 0, 0);

      ctx.globalAlpha = 1.0;
      ctx.restore();

      // 選択時の発光エフェクト
      if (isSelected) {
        const glowRadius = cs * 0.45;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        glow.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 点滅する選択枠
        const blinkAlpha = (Math.sin(this.tick * 0.1) + 1) * 0.4 + 0.2;
        ctx.strokeStyle = `rgba(255, 255, 255, ${blinkAlpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
      }

      // HPバー
      const hpRatio = fleet.hp / fleet.maxHp;
      const barW = cs * 0.75;
      const barH = 5;
      const barX = cx - barW / 2;
      const barY = py + cs - 12;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barW, barH);

      const hpColor = hpRatio > 0.6 ? '#4caf50' :
                      hpRatio > 0.3 ? '#ff9800' : '#f44336';
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      // 移動済みインジケーター
      if (hasMoved) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('済', cx, py + 10);
      }
    }
  }

  /**
   * グリッド線描画
   */
  drawGrid() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.strokeStyle = 'rgba(100, 160, 220, 0.12)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= this.mapWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cs, 0);
      ctx.lineTo(x * cs, this.mapHeight * cs);
      ctx.stroke();
    }

    for (let y = 0; y <= this.mapHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cs);
      ctx.lineTo(this.mapWidth * cs, y * cs);
      ctx.stroke();
    }

    // 座標ラベル（端のみ）
    ctx.fillStyle = 'rgba(100, 160, 220, 0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = 0; x < this.mapWidth; x++) {
      ctx.fillText(x, x * cs + cs / 2, 2);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < this.mapHeight; y++) {
      ctx.fillText(y, cs - 2, y * cs + cs / 2);
    }
  }

  /**
   * 選択枠描画
   */
  drawSelection() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    if (this.selectedPort) {
      const port = this.selectedPort;
      const px = port.x * cs;
      const py = port.y * cs;
      const blinkAlpha = (Math.sin(this.tick * 0.08) + 1) * 0.3 + 0.3;
      ctx.strokeStyle = `rgba(200, 168, 75, ${blinkAlpha})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
    }
  }

  /**
   * ハイライトを設定
   */
  setHighlights(cells) {
    this.highlightCells = cells;
  }

  /**
   * ハイライトをクリア
   */
  clearHighlights() {
    this.highlightCells = [];
  }

  /**
   * 選択中の艦隊を設定
   */
  setSelectedFleet(fleet) {
    this.selectedFleet = fleet;
    this.selectedPort = null;
  }

  /**
   * 選択中の港を設定
   */
  setSelectedPort(port) {
    this.selectedPort = port;
    this.selectedFleet = null;
  }

  /**
   * 選択をクリア
   */
  clearSelection() {
    this.selectedFleet = null;
    this.selectedPort = null;
    this.highlightCells = [];
  }

  /**
   * マウス座標からグリッド座標を取得
   */
  getCellFromMouse(mouseX, mouseY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const canvasX = (mouseX - rect.left) * scaleX;
    const canvasY = (mouseY - rect.top) * scaleY;
    const x = Math.floor(canvasX / this.cellSize);
    const y = Math.floor(canvasY / this.cellSize);
    if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
      return { x, y };
    }
    return null;
  }

  /**
   * アニメーションループ開始
   */
  startAnimation() {
    const loop = () => {
      this.render();
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * アニメーションループ停止
   */
  stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
}
