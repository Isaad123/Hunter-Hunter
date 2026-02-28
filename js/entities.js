import { TILE, bfsDistances } from './map.js';

const SPEED = 3.5; // tiles per second

// Direction constants
export const DIR = {
  RIGHT: { x: 1, y: 0, angle: 0 },
  LEFT:  { x: -1, y: 0, angle: Math.PI },
  DOWN:  { x: 0, y: 1, angle: Math.PI / 2 },
  UP:    { x: 0, y: -1, angle: -Math.PI / 2 },
};

const ALL_DIRS = [DIR.RIGHT, DIR.LEFT, DIR.DOWN, DIR.UP];

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export class Truck {
  constructor(tx, ty) {
    this.tx = tx;          // current tile x (integer)
    this.ty = ty;          // current tile y
    this.px = tx * TILE;   // pixel x (for rendering)
    this.py = ty * TILE;   // pixel y
    this.moveProgress = 0; // 0→1 interpolation to next tile
    this.moving = false;
    this.facing = DIR.RIGHT;
    this.nextDir = null;   // queued direction
    // Target tile (while moving)
    this.targetTx = tx;
    this.targetTy = ty;
  }

  queueDirection(dir) {
    this.nextDir = dir;
  }

  update(dt, map) {
    if (this.moving) {
      this.moveProgress += SPEED * dt;
      if (this.moveProgress >= 1) {
        // Arrived at target tile
        this.tx = this.targetTx;
        this.ty = this.targetTy;
        this.moveProgress = 0;
        this.moving = false;
        this.px = this.tx * TILE;
        this.py = this.ty * TILE;
      } else {
        this.px = (this.tx + this.facing.x * this.moveProgress) * TILE;
        this.py = (this.ty + this.facing.y * this.moveProgress) * TILE;
      }
    }

    if (!this.moving) {
      // Try queued direction first
      let moved = false;
      if (this.nextDir) {
        const nx = this.tx + this.nextDir.x;
        const ny = this.ty + this.nextDir.y;
        if (map.isRoad(nx, ny)) {
          this.facing = this.nextDir;
          this.targetTx = nx;
          this.targetTy = ny;
          this.moving = true;
          moved = true;
        }
        this.nextDir = null;
      }
    }
  }

  /** Returns the interpolated center pixel position */
  getCenterPx() {
    if (this.moving) {
      return {
        x: (this.tx + this.facing.x * this.moveProgress) * TILE + TILE / 2,
        y: (this.ty + this.facing.y * this.moveProgress) * TILE + TILE / 2,
      };
    }
    return { x: this.tx * TILE + TILE / 2, y: this.ty * TILE + TILE / 2 };
  }
}

export class Hunter {
  constructor(tx, ty) {
    this.tx = tx;
    this.ty = ty;
    this.px = tx * TILE;
    this.py = ty * TILE;
    this.moveProgress = 0;
    this.moving = false;
    this.facing = DIR.DOWN;
    this.targetTx = tx;
    this.targetTy = ty;
    this.state = 'wander'; // 'wander' | 'flee'
    this.lastDir = null;
  }

  update(dt, map, truck) {
    if (this.moving) {
      this.moveProgress += SPEED * dt;
      if (this.moveProgress >= 1) {
        this.tx = this.targetTx;
        this.ty = this.targetTy;
        this.moveProgress = 0;
        this.moving = false;
        this.px = this.tx * TILE;
        this.py = this.ty * TILE;
      } else {
        this.px = (this.tx + this.facing.x * this.moveProgress) * TILE;
        this.py = (this.ty + this.facing.y * this.moveProgress) * TILE;
      }
    }

    if (!this.moving) {
      // Update AI state
      const dist = chebyshev(this.tx, this.ty, truck.tx, truck.ty);
      if (dist <= 3) {
        this.state = 'flee';
      } else if (dist > 5) {
        this.state = 'wander';
      }

      this._chooseNextMove(map, truck);
    }
  }

  _chooseNextMove(map, truck) {
    const neighbors = map.getNeighbors(this.tx, this.ty);
    if (neighbors.length === 0) return;

    let chosen = null;

    if (this.state === 'flee') {
      // BFS from truck position to score escape options
      const truckDists = bfsDistances(map, truck.tx, truck.ty, null);
      const key = (x, y) => `${x},${y}`;

      // Score each neighbor by BFS distance from truck (higher = safer)
      let best = -1;
      const candidates = [];
      for (const n of neighbors) {
        const d = truckDists.get(key(n.x, n.y)) ?? 999;
        if (d > best) {
          best = d;
          candidates.length = 0;
          candidates.push(n);
        } else if (d === best) {
          candidates.push(n);
        }
      }
      // Pick randomly among best candidates
      chosen = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      // Wander: pick a random valid neighbor, prefer not reversing
      const notReverse = neighbors.filter(n => {
        if (!this.lastDir) return true;
        return !(n.dx === -this.lastDir.x && n.dy === -this.lastDir.y);
      });
      const pool = notReverse.length > 0 ? notReverse : neighbors;
      chosen = pool[Math.floor(Math.random() * pool.length)];
    }

    if (chosen) {
      const dx = chosen.x - this.tx;
      const dy = chosen.y - this.ty;
      this.facing = ALL_DIRS.find(d => d.x === dx && d.y === dy) || DIR.DOWN;
      this.lastDir = { x: dx, y: dy };
      this.targetTx = chosen.x;
      this.targetTy = chosen.y;
      this.moving = true;
    }
  }

  getCenterPx() {
    if (this.moving) {
      return {
        x: (this.tx + this.facing.x * this.moveProgress) * TILE + TILE / 2,
        y: (this.ty + this.facing.y * this.moveProgress) * TILE + TILE / 2,
      };
    }
    return { x: this.tx * TILE + TILE / 2, y: this.ty * TILE + TILE / 2 };
  }

  /** Count valid road neighbors (used for "trapped" win condition) */
  countFreeNeighbors(map, truckTile) {
    const neighbors = map.getNeighbors(this.tx, this.ty);
    return neighbors.filter(n => !(n.x === truckTile.x && n.y === truckTile.y)).length;
  }
}
