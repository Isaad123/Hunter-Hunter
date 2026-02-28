import { TILE, COLS, ROWS, T } from './map.js';

const SPRITE_SIZE = 32; // rendered px (16 logical × 2 scale)
const SPRITE_HALF = SPRITE_SIZE / 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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
        if (map.tiles[r][c] === T.ROAD) {
          this._drawRoadTile(ctx, x, y);
        } else {
          this._drawBlockTile(ctx, x, y);
        }
      }
    }
  }

  _drawRoadTile(ctx, x, y) {
    // Road surface
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, TILE, TILE);

    // Subtle lane markings — dashed center lines
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(x, y + TILE / 2);
    ctx.lineTo(x + TILE, y + TILE / 2);
    ctx.stroke();

    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2, y);
    ctx.lineTo(x + TILE / 2, y + TILE);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  _drawBlockTile(ctx, x, y) {
    // Grass background
    ctx.fillStyle = '#3a7d44';
    ctx.fillRect(x, y, TILE, TILE);

    // House — brown rectangle
    const hx = x + 6;
    const hy = y + 6;
    const hw = TILE - 12;
    const hh = TILE - 12;
    ctx.fillStyle = '#8B5E3C';
    ctx.fillRect(hx, hy, hw, hh);

    // Roof highlight
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(hx, hy, hw, 5);

    // Door
    ctx.fillStyle = '#5a3010';
    const dw = 5, dh = 7;
    ctx.fillRect(hx + hw / 2 - dw / 2, hy + hh - dh, dw, dh);

    // Window
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(hx + 3, hy + 4, 5, 5);
    ctx.fillRect(hx + hw - 8, hy + 4, 5, 5);
  }

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
    // All drawn in local coords, centered at (0,0), facing right
    const s = 2; // scale factor (1 logical px = 2 rendered px)

    // Body — white rectangle
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-14, -8, 28, 16);

    // Cab / windshield — dark
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(4, -6, 8, 12);

    // Front bumper
    ctx.fillStyle = '#aaa';
    ctx.fillRect(12, -4, 3, 8);

    // Rear bed detail
    ctx.fillStyle = '#ccc';
    ctx.fillRect(-14, -6, 10, 12);

    // Axle lines
    ctx.fillStyle = '#444';
    ctx.fillRect(-10, -9, 2, 2);  // rear-left wheel
    ctx.fillRect(-10,  7, 2, 2);  // rear-right wheel
    ctx.fillRect( 6,  -9, 2, 2);  // front-left wheel
    ctx.fillRect( 6,   7, 2, 2);  // front-right wheel

    // Gray wheels
    ctx.fillStyle = '#333';
    // Rear axle
    ctx.fillRect(-12, -10, 6, 4);
    ctx.fillRect(-12,   6, 6, 4);
    // Front axle
    ctx.fillRect(  6, -10, 6, 4);
    ctx.fillRect(  6,   6, 6, 4);
  }

  drawHunter(hunter) {
    const ctx = this.ctx;
    const center = hunter.getCenterPx();
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(hunter.facing.angle);
    this._spriteHunter(ctx, hunter.state === 'flee');
    ctx.restore();
  }

  _spriteHunter(ctx, fleeing) {
    // Drawn facing right in local coords

    // Legs
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(-6, 4, 5, 8);
    ctx.fillRect( 1, 4, 5, 8);

    // Shirt body
    ctx.fillStyle = fleeing ? '#e05050' : '#e07820'; // red when fleeing, orange when wandering
    ctx.fillRect(-7, -4, 14, 10);

    // Arms
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(-11, -3, 5, 4);
    ctx.fillRect(  6, -3, 5, 4);

    // Head
    ctx.fillStyle = '#c8a070';
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (simple dots)
    ctx.fillStyle = '#333';
    ctx.fillRect(3, -12, 2, 2);
    ctx.fillRect(-4, -12, 2, 2);

    // Hair
    ctx.fillStyle = '#4a2800';
    ctx.fillRect(-5, -16, 10, 5);
  }

  drawHUD(state) {
    const ctx = this.ctx;
    const { gameState, elapsed, trappedCountdown } = state;

    // Timer
    if (gameState === 'PLAYING' || gameState === 'WIN') {
      const secs = Math.floor(elapsed / 1000);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(8, 8, 110, 28);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Courier New';
      ctx.fillText(`Time: ${secs}s`, 16, 28);
    }

    // Trapped countdown
    if (gameState === 'PLAYING' && trappedCountdown !== null) {
      const secs = (trappedCountdown / 1000).toFixed(1);
      ctx.fillStyle = 'rgba(200,50,50,0.8)';
      const W = this.canvas.width;
      const msg = `TRAPPED! ${secs}s`;
      ctx.font = 'bold 20px Courier New';
      const tw = ctx.measureText(msg).width;
      ctx.fillRect(W / 2 - tw / 2 - 10, 10, tw + 20, 32);
      ctx.fillStyle = '#fff';
      ctx.fillText(msg, W / 2 - tw / 2, 31);
    }

    // Win overlay
    if (gameState === 'WIN') {
      const W = this.canvas.width;
      const H = this.canvas.height;
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
      const blink = Math.floor(Date.now() / 500) % 2 === 0;
      if (blink) {
        ctx.fillText('Press R to play again', W / 2, H / 2 + 55);
      }

      ctx.textAlign = 'left';
    }

    // Hunter flee indicator (small icon near hunter state indicator in HUD)
    if (gameState === 'PLAYING' && state.hunterFleeing) {
      ctx.fillStyle = 'rgba(200,50,50,0.7)';
      ctx.fillRect(8, 42, 100, 22);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Courier New';
      ctx.fillText('HUNTER: FLEEING', 12, 57);
    }
  }
}
