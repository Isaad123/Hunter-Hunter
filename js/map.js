export const TILE = 36;
export const COLS = 25;
export const ROWS = 19;

export const T = {
  ROAD: 0,
  BLOCK: 1,
};

export function generateMap() {
  let map;
  let attempts = 0;
  do {
    map = tryGenerate();
    attempts++;
  } while (!isConnected(map) && attempts < 100);
  return map;
}

function tryGenerate() {
  // Start with all road
  const tiles = Array.from({ length: ROWS }, () => new Array(COLS).fill(T.ROAD));

  // Place city blocks — 3×3 BLOCK rectangles at intervals with slight random offsets
  // Block grid: every 4 tiles starting at col 1, row 1 (leaving 1-tile road corridors)
  for (let row = 1; row < ROWS - 3; row += 4) {
    for (let col = 1; col < COLS - 3; col += 4) {
      // Slight random offset: -0 or +1 (only shift if room)
      const dr = Math.random() < 0.3 ? 1 : 0;
      const dc = Math.random() < 0.3 ? 1 : 0;
      const r0 = row + dr;
      const c0 = col + dc;
      // Place 3×3 block, skip if too close to edge
      for (let r = r0; r < r0 + 3 && r < ROWS - 1; r++) {
        for (let c = c0; c < c0 + 3 && c < COLS - 1; c++) {
          if (r > 0 && c > 0) {
            tiles[r][c] = T.BLOCK;
          }
        }
      }
    }
  }

  // Ensure border is all road (so map boundary is always reachable)
  for (let c = 0; c < COLS; c++) {
    tiles[0][c] = T.ROAD;
    tiles[ROWS - 1][c] = T.ROAD;
  }
  for (let r = 0; r < ROWS; r++) {
    tiles[r][0] = T.ROAD;
    tiles[r][COLS - 1] = T.ROAD;
  }

  const map = {
    tiles,
    isRoad(x, y) {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      return tiles[y][x] === T.ROAD;
    },
    getNeighbors(x, y) {
      const dirs = [
        { x: 1, y: 0 }, { x: -1, y: 0 },
        { x: 0, y: 1 }, { x: 0, y: -1 },
      ];
      return dirs
        .map(d => ({ x: x + d.x, y: y + d.y, dx: d.x, dy: d.y }))
        .filter(n => this.isRoad(n.x, n.y));
    },
  };

  return map;
}

function isConnected(map) {
  // Find first road tile
  let start = null;
  let roadCount = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map.tiles[r][c] === T.ROAD) {
        roadCount++;
        if (!start) start = { x: c, y: r };
      }
    }
  }
  if (!start || roadCount === 0) return false;

  // BFS from start
  const visited = new Set();
  const queue = [start];
  const key = p => `${p.x},${p.y}`;
  visited.add(key(start));

  while (queue.length > 0) {
    const cur = queue.shift();
    const neighbors = map.getNeighbors(cur.x, cur.y);
    for (const n of neighbors) {
      const k = key(n);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(n);
      }
    }
  }

  return visited.size === roadCount;
}

/**
 * BFS from (sx, sy) on the map, optionally blocking a tile (for Hunter flee logic).
 * Returns a Map of "x,y" -> distance.
 */
export function bfsDistances(map, sx, sy, blockTile = null) {
  const dist = new Map();
  const key = (x, y) => `${x},${y}`;
  const startKey = key(sx, sy);
  dist.set(startKey, 0);
  const queue = [{ x: sx, y: sy }];

  while (queue.length > 0) {
    const cur = queue.shift();
    const neighbors = map.getNeighbors(cur.x, cur.y);
    for (const n of neighbors) {
      if (blockTile && n.x === blockTile.x && n.y === blockTile.y) continue;
      const k = key(n.x, n.y);
      if (!dist.has(k)) {
        dist.set(k, dist.get(key(cur.x, cur.y)) + 1);
        queue.push(n);
      }
    }
  }

  return dist;
}
