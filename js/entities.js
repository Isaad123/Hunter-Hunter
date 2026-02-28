import { TILE, bfsDistances } from './map.js';

const TRUCK_SPEED  = 4.5; // tiles per second — slightly faster than Hunter
const HUNTER_SPEED = 3.0; // tiles per second

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
    this.tx = tx;
    this.ty = ty;
    this.px = tx * TILE;
    this.py = ty * TILE;
    this.moveProgress = 0;
    this.moving = false;
    this.facing = DIR.RIGHT;
    this.nextDir = null;
    this.targetTx = tx;
    this.targetTy = ty;
    this.stallTimer = 0; // ms remaining in stop-sign stall
  }

  queueDirection(dir) {
    this.nextDir = dir;
  }

  // trafficLight may be null during non-playing states
  update(dt, map, trafficLight) {
    const dtMs = dt * 1000;

    // Interpolate movement toward target tile
    if (this.moving) {
      this.moveProgress += TRUCK_SPEED * dt;
      if (this.moveProgress >= 1) {
        // Arrived at target tile
        this.tx = this.targetTx;
        this.ty = this.targetTy;
        this.moveProgress = 0;
        this.moving = false;
        this.px = this.tx * TILE;
        this.py = this.ty * TILE;

        // Stop sign: stall the truck for 2 seconds
        if (map.stopSigns && map.stopSigns.has(`${this.tx},${this.ty}`)) {
          this.stallTimer = 2000;
        }
      } else {
        this.px = (this.tx + this.facing.x * this.moveProgress) * TILE;
        this.py = (this.ty + this.facing.y * this.moveProgress) * TILE;
      }
    }

    // Count down stop-sign stall
    if (this.stallTimer > 0) {
      this.stallTimer -= dtMs;
      return; // don't start new movement while stalled
    }

    // Try to start movement in queued direction
    if (!this.moving && this.nextDir) {
      const nx = this.tx + this.nextDir.x;
      const ny = this.ty + this.nextDir.y;
      if (map.isRoad(nx, ny)) {
        this.facing = this.nextDir;

        // Red / yellow light blocks entry into the intersection
        const blockedByLight =
          trafficLight &&
          map.isIntersection(nx, ny) &&
          !trafficLight.canEnter(this.nextDir.x, this.nextDir.y);

        if (!blockedByLight) {
          this.targetTx = nx;
          this.targetTy = ny;
          this.moving = true;
        }
      }
      this.nextDir = null;
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
      this.moveProgress += HUNTER_SPEED * dt;
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
      const truckDists = bfsDistances(map, truck.tx, truck.ty, null);
      const key = (x, y) => `${x},${y}`;

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
      chosen = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
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

  countFreeNeighbors(map, truckTile) {
    const neighbors = map.getNeighbors(this.tx, this.ty);
    return neighbors.filter(n => !(n.x === truckTile.x && n.y === truckTile.y)).length;
  }
}
