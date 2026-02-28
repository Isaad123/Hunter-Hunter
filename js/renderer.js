import { TILE, COLS, ROWS, T, MID_ROW, MID_COL } from './map.js';

const SPRITE_SIZE = 32;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hunterImage = null;
    const img = new Image();
    img.onload = () => { this.hunterImage = img; };
    img.src = 'Hunter%208%20bit.png';
  }

  clear() {
    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMap(map) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE;
        const y = r * TILE;
        const tile = map.tiles[r][c];
        if (tile === T.BLOCK) {
          this._drawBlockTile(ctx, x, y);
        } else if (tile === T.INTERSECTION) {
          this._drawIntersectionTile(ctx, x, y);
        } else if (tile === T.MAIN_ROAD) {
          this._drawMainRoadTile(ctx, x, y, c, r);
        } else {
          const hasSign = map.stopSigns && map.stopSigns.has(`${c},${r}`);
          this._drawRoadTile(ctx, x, y, hasSign);
        }
      }
    }
  }

  _drawRoadTile(ctx, x, y, hasStopSign) {
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, TILE, TILE);

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y + TILE / 2);
    ctx.lineTo(x + TILE, y + TILE / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2, y);
    ctx.lineTo(x + TILE / 2, y + TILE);
    ctx.stroke();
    ctx.setLineDash([]);

    if (hasStopSign) {
      this._drawStopSign(ctx, x + TILE - 11, y + 2);
    }
  }

  _drawStopSign(ctx, sx, sy) {
    // Red octagon
    const r = 7;
    const cx = sx + r;
    const cy = sy + r;
    ctx.fillStyle = '#cc0000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI / 4) - Math.PI / 8;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // "STOP" text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 4px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STOP', cx, cy + 1.5);
    ctx.textAlign = 'left';
  }

  _drawMainRoadTile(ctx, x, y, col, row) {
    // Slightly darker asphalt for arterial roads
    ctx.fillStyle = '#484848';
    ctx.fillRect(x, y, TILE, TILE);

    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);

    if (row === MID_ROW) {
      // Horizontal main road — yellow centre line
      ctx.strokeStyle = '#e8c200';
      ctx.beginPath();
      ctx.moveTo(x, y + TILE / 2);
      ctx.lineTo(x + TILE, y + TILE / 2);
      ctx.stroke();
    }

    if (col === MID_COL) {
      // Vertical main road — yellow centre line
      ctx.strokeStyle = '#e8c200';
      ctx.beginPath();
      ctx.moveTo(x + TILE / 2, y);
      ctx.lineTo(x + TILE / 2, y + TILE);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }

  _drawIntersectionTile(ctx, x, y) {
    ctx.fillStyle = '#484848';
    ctx.fillRect(x, y, TILE, TILE);

    // Faint crosswalk marks on all 4 edges
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const stripe = 4;
    const gap = 3;
    // Bottom edge (NS crosswalk)
    for (let i = 2; i < TILE - 2; i += stripe + gap) {
      ctx.fillRect(x + i, y + TILE - 5, stripe, 4);
      ctx.fillRect(x + i, y + 1, stripe, 4);
    }
    // Right edge (EW crosswalk)
    for (let i = 2; i < TILE - 2; i += stripe + gap) {
      ctx.fillRect(x + TILE - 5, y + i, 4, stripe);
      ctx.fillRect(x + 1, y + i, 4, stripe);
    }
  }

  _drawBlockTile(ctx, x, y) {
    ctx.fillStyle = '#3a7d44';
    ctx.fillRect(x, y, TILE, TILE);

    const hx = x + 6, hy = y + 6;
    const hw = TILE - 12, hh = TILE - 12;
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(hx, hy, hw, 5);
    ctx.fillStyle = '#5a3010';
    ctx.fillRect(hx + hw / 2 - 2.5, hy + hh - 7, 5, 7);
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(hx + 3, hy + 4, 5, 5);
    ctx.fillRect(hx + hw - 8, hy + 4, 5, 5);
  }

  // ─── Traffic lights ──────────────────────────────────────────────────────────

  drawTrafficLights(map, trafficLight) {
    const ctx = this.ctx;
    const phase = trafficLight.phase;

    const ewGreen  = phase === 'EW_GREEN';
    const ewYellow = phase === 'EW_YELLOW';
    const ewRed    = !ewGreen && !ewYellow;

    const nsGreen  = phase === 'NS_GREEN';
    const nsYellow = phase === 'NS_YELLOW';
    const nsRed    = !nsGreen && !nsYellow;

    const ix = map.mainRoadCol * TILE;
    const iy = map.mainRoadRow * TILE;

    // West approach — EW traffic going east, light on right edge of tile to left
    this._drawLightHead(ctx, ix - 4,        iy + TILE / 2, ewRed, ewYellow, ewGreen);
    // East approach — EW traffic going west, light on left edge of tile to right
    this._drawLightHead(ctx, ix + TILE + 4,  iy + TILE / 2, ewRed, ewYellow, ewGreen);
    // North approach — NS traffic going south, light on bottom edge of tile above
    this._drawLightHead(ctx, ix + TILE / 2,  iy - 4,        nsRed, nsYellow, nsGreen);
    // South approach — NS traffic going north, light on top edge of tile below
    this._drawLightHead(ctx, ix + TILE / 2,  iy + TILE + 4, nsRed, nsYellow, nsGreen);
  }

  // Draw a small vertical traffic light head centred at (cx, cy) — cy is the bottom of the housing
  _drawLightHead(ctx, cx, cy) {
    // Allow passing colour booleans as extra args
    const isRed    = arguments[3];
    const isYellow = arguments[4];
    const isGreen  = arguments[5];

    // Pole
    ctx.fillStyle = '#444';
    ctx.fillRect(cx - 1, cy - 22, 2, 22);

    // Housing
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 6, cy - 22, 12, 20);

    // Red
    ctx.fillStyle = isRed    ? '#ff3333' : '#3a0000';
    ctx.beginPath(); ctx.arc(cx, cy - 18, 3.5, 0, Math.PI * 2); ctx.fill();

    // Yellow
    ctx.fillStyle = isYellow ? '#ffcc00' : '#3a3000';
    ctx.beginPath(); ctx.arc(cx, cy - 12, 3.5, 0, Math.PI * 2); ctx.fill();

    // Green
    ctx.fillStyle = isGreen  ? '#33ff66' : '#003a10';
    ctx.beginPath(); ctx.arc(cx, cy - 6,  3.5, 0, Math.PI * 2); ctx.fill();
  }

  // ─── NPC cars ────────────────────────────────────────────────────────────────

  drawNPCs(npcs) {
    for (const npc of npcs) {
      const ctx = this.ctx;
      const center = npc.getCenterPx();
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(npc.facing.angle);
      this._spriteNPC(ctx, npc.color);
      ctx.restore();
    }
  }

  _spriteNPC(ctx, color) {
    // Body — full tile-width colored rectangle (easy to see)
    ctx.fillStyle = color;
    ctx.fillRect(-15, -9, 30, 18);
    // Dark outline so it reads against any road colour
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-15, -9, 30, 18);
    // Cab
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(4, -7, 9, 14);
    // Bumper
    ctx.fillStyle = '#aaa';
    ctx.fillRect(13, -5, 3, 10);
    // Wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(-13, -12, 7, 5);
    ctx.fillRect(-13,   7, 7, 5);
    ctx.fillRect(  5, -12, 7, 5);
    ctx.fillRect(  5,   7, 7, 5);
    ctx.lineWidth = 1;
  }

  // ─── Entities ────────────────────────────────────────────────────────────────

  drawTruck(truck) {
    const ctx = this.ctx;
    const center = truck.getCenterPx();
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(truck.facing.angle);
    this._spriteTruck(ctx);
    ctx.restore();
  }

  _spriteTruck(ctx) {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-14, -8, 28, 16);
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(4, -6, 8, 12);
    ctx.fillStyle = '#aaa';
    ctx.fillRect(12, -4, 3, 8);
    ctx.fillStyle = '#ccc';
    ctx.fillRect(-14, -6, 10, 12);
    ctx.fillStyle = '#333';
    ctx.fillRect(-12, -10, 6, 4);
    ctx.fillRect(-12,   6, 6, 4);
    ctx.fillRect(  6, -10, 6, 4);
    ctx.fillRect(  6,   6, 6, 4);
  }

  drawHunter(hunter) {
    const ctx = this.ctx;
    const center = hunter.getCenterPx();
    ctx.save();
    ctx.translate(center.x, center.y);

    if (this.hunterImage) {
      const W = 24, H = 38;
      ctx.drawImage(this.hunterImage, -W / 2, -H / 2 - 2, W, H);
      if (hunter.state === 'flee') {
        ctx.fillStyle = 'rgba(224,80,80,0.6)';
        ctx.beginPath();
        ctx.ellipse(0, H / 2 - 4, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.rotate(hunter.facing.angle);
      this._spriteHunter(ctx, hunter.state === 'flee');
    }

    ctx.restore();
  }

  _spriteHunter(ctx, fleeing) {
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(-6, 4, 5, 8);
    ctx.fillRect( 1, 4, 5, 8);
    ctx.fillStyle = fleeing ? '#e05050' : '#e07820';
    ctx.fillRect(-7, -4, 14, 10);
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(-11, -3, 5, 4);
    ctx.fillRect(  6, -3, 5, 4);
    ctx.fillStyle = '#c8a070';
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(3, -12, 2, 2);
    ctx.fillRect(-4, -12, 2, 2);
    ctx.fillStyle = '#4a2800';
    ctx.fillRect(-5, -16, 10, 5);
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────────

  drawHUD(state) {
    const ctx = this.ctx;
    const { gameState, elapsed, trappedCountdown, truckStall, trafficLight, npcCount } = state;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // NPC car count (top-right corner)
    if (gameState === 'PLAYING' && npcCount !== undefined) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W - 100, 8, 92, 22);
      ctx.fillStyle = '#e8a020';
      ctx.font = '13px Courier New';
      ctx.textAlign = 'right';
      ctx.fillText(`CARS: ${npcCount}`, W - 12, 23);
      ctx.textAlign = 'left';
    }

    // Elapsed timer
    if (gameState === 'PLAYING' || gameState === 'WIN') {
      const secs = Math.floor(elapsed / 1000);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(8, 8, 110, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Courier New';
      ctx.fillText(`Time: ${secs}s`, 16, 28);
    }

    // Traffic light phase indicator
    if (gameState === 'PLAYING' && trafficLight) {
      const phase = trafficLight.phase;
      const secs = (trafficLight.phaseTimeLeft / 1000).toFixed(1);
      const label = phase.replace('_', ' ');
      const colour =
        phase.includes('GREEN')  ? '#33ff66' :
        phase.includes('YELLOW') ? '#ffcc00' : '#ff4444';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(8, 40, 150, 22);
      ctx.fillStyle = colour;
      ctx.font = '13px Courier New';
      ctx.fillText(`${label}: ${secs}s`, 12, 55);
    }

    // Hunter flee indicator
    if (gameState === 'PLAYING' && state.hunterFleeing) {
      ctx.fillStyle = 'rgba(200,50,50,0.7)';
      ctx.fillRect(8, 66, 130, 22);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Courier New';
      ctx.fillText('HUNTER: FLEEING', 12, 81);
    }

    // Trapped countdown
    if (gameState === 'PLAYING' && trappedCountdown !== null) {
      const secs = (trappedCountdown / 1000).toFixed(1);
      ctx.fillStyle = 'rgba(200,50,50,0.8)';
      const msg = `TRAPPED! ${secs}s`;
      ctx.font = 'bold 20px Courier New';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(msg).width;
      ctx.fillRect(W / 2 - tw / 2 - 10, 10, tw + 20, 32);
      ctx.fillStyle = '#fff';
      ctx.fillText(msg, W / 2, 31);
      ctx.textAlign = 'left';
    }

    // Stop sign stall countdown
    if (gameState === 'PLAYING' && truckStall > 0) {
      const secs = (truckStall / 1000).toFixed(1);
      const msg = `STOP SIGN  ${secs}s`;
      ctx.font = 'bold 18px Courier New';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(msg).width;
      ctx.fillStyle = 'rgba(180,0,0,0.85)';
      ctx.fillRect(W / 2 - tw / 2 - 12, H - 44, tw + 24, 30);
      ctx.fillStyle = '#fff';
      ctx.fillText(msg, W / 2, H - 24);
      ctx.textAlign = 'left';
    }

    // Win overlay
    if (gameState === 'WIN') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 48px Courier New';
      ctx.fillText('YOU CAUGHT HUNTER', W / 2, H / 2 - 40);
      const secs = (elapsed / 1000).toFixed(1);
      ctx.fillStyle = '#fff';
      ctx.font = '24px Courier New';
      ctx.fillText(`Time: ${secs} seconds`, W / 2, H / 2 + 10);
      ctx.fillStyle = '#aaa';
      ctx.font = '18px Courier New';
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillText('Press R to play again', W / 2, H / 2 + 55);
      }
      ctx.textAlign = 'left';
    }
  }
}
