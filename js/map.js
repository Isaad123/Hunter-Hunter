export const TILE = 36;
export const COLS = 25;
export const ROWS = 19;

// Center of the map — the two main roads cross here
export const MID_ROW = Math.floor(ROWS / 2); // 9
export const MID_COL = Math.floor(COLS / 2); // 12

export const T = {
  ROAD: 0,         // neighborhood road
  BLOCK: 1,        // building / block
  MAIN_ROAD: 2,    // arterial road (horizontal or vertical main road)
  INTERSECTION: 3, // the 4-way intersection tile
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
  // Start with all neighborhood road
  const tiles = Array.from({ length: ROWS }, () => new Array(COLS).fill(T.ROAD));

  // Place city blocks — 3×3 BLOCK rectangles at intervals with slight random offsets
  for (let row = 1; row < ROWS - 3; row += 4) {
    for (let col = 1; col < COLS - 3; col += 4) {
      const dr = Math.random() < 0.3 ? 1 : 0;
      const dc = Math.random() < 0.3 ? 1 : 0;
      const r0 = row + dr;
      const c0 = col + dc;
      for (let r = r0; r < r0 + 3 && r < ROWS - 1; r++) {
        for (let c = c0; c < c0 + 3 && c < COLS - 1; c++) {
          if (r > 0 && c > 0) {
            tiles[r][c] = T.BLOCK;
          }
        }
      }
    }
  }

  // Stamp main roads over any blocks placed there
  for (let c = 0; c < COLS; c++) tiles[MID_ROW][c] = T.MAIN_ROAD;
  for (let r = 0; r < ROWS; r++) tiles[r][MID_COL] = T.MAIN_ROAD;
  tiles[MID_ROW][MID_COL] = T.INTERSECTION;

  // Ensure border is always passable
  for (let c = 0; c < COLS; c++) {
    if (tiles[0][c] === T.BLOCK) tiles[0][c] = T.ROAD;
    if (tiles[ROWS - 1][c] === T.BLOCK) tiles[ROWS - 1][c] = T.ROAD;
  }
  for (let r = 0; r < ROWS; r++) {
    if (tiles[r][0] === T.BLOCK) tiles[r][0] = T.ROAD;
    if (tiles[r][COLS - 1] === T.BLOCK) tiles[r][COLS - 1] = T.ROAD;
  }

  const map = {
    tiles,
    stopSigns: new Set(), // "x,y" strings for tiles with stop signs
    mainRoadRow: MID_ROW,
    mainRoadCol: MID_COL,

    isRoad(x, y) {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      return tiles[y][x] !== T.BLOCK;
    },

    isMainRoad(x, y) {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      return tiles[y][x] === T.MAIN_ROAD || tiles[y][x] === T.INTERSECTION;
    },

    isIntersection(x, y) {
      return x === MID_COL && y === MID_ROW;
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

  addDeadEnds(tiles, map);
  addStopSigns(map);

  return map;
}

// Count passable (non-BLOCK) orthogonal neighbors
function countRoadNeighbors(tiles, x, y) {
  let count = 0;
  if (y > 0 && tiles[y - 1][x] !== T.BLOCK) count++;
  if (y < ROWS - 1 && tiles[y + 1][x] !== T.BLOCK) count++;
  if (x > 0 && tiles[y][x - 1] !== T.BLOCK) count++;
  if (x < COLS - 1 && tiles[y][x + 1] !== T.BLOCK) count++;
  return count;
}

function countDeadEnds(map) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Only neighbourhood road tiles can be dead ends (not main roads)
      if (map.tiles[r][c] === T.ROAD && countRoadNeighbors(map.tiles, c, r) === 1) {
        count++;
      }
    }
  }
  return count;
}

function addDeadEnds(tiles, map) {
  const TARGET = 6;
  let attempts = 0;

  while (countDeadEnds(map) < TARGET && attempts < 300) {
    attempts++;

    // Collect neighbourhood road tiles whose neighbour is a corridor tip
    // (a road tile with exactly 2 passable neighbours — blocking it creates a dead end)
    const candidates = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (tiles[r][c] !== T.ROAD) continue; // only neighbourhood tiles
        const neighbors = map.getNeighbors(c, r);
        for (const n of neighbors) {
          // Only block neighbourhood tiles, not main roads
          if (tiles[n.y][n.x] !== T.ROAD) continue;
          if (countRoadNeighbors(tiles, n.x, n.y) === 2) {
            candidates.push({ x: n.x, y: n.y });
            break;
          }
        }
      }
    }

    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];

    // Never block border tiles or main road axis tiles
    if (pick.x === 0 || pick.x === COLS - 1 || pick.y === 0 || pick.y === ROWS - 1) continue;
    if (pick.x === MID_COL || pick.y === MID_ROW) continue;
    if (tiles[pick.y][pick.x] !== T.ROAD) continue;

    tiles[pick.y][pick.x] = T.BLOCK;
    if (!isConnected(map)) {
      tiles[pick.y][pick.x] = T.ROAD;
    }
  }
}

// Place one stop sign per neighbourhood quadrant on a road tile with 3+ passable neighbours
function addStopSigns(map) {
  const { tiles, stopSigns } = map;

  const quadrants = [
    { rMin: 2, rMax: MID_ROW - 2, cMin: 2, cMax: MID_COL - 2 },
    { rMin: 2, rMax: MID_ROW - 2, cMin: MID_COL + 2, cMax: COLS - 3 },
    { rMin: MID_ROW + 2, rMax: ROWS - 3, cMin: 2, cMax: MID_COL - 2 },
    { rMin: MID_ROW + 2, rMax: ROWS - 3, cMin: MID_COL + 2, cMax: COLS - 3 },
  ];

  for (const q of quadrants) {
    const candidates = [];
    for (let r = q.rMin; r <= q.rMax; r++) {
      for (let c = q.cMin; c <= q.cMax; c++) {
        if (tiles[r][c] === T.ROAD && countRoadNeighbors(tiles, c, r) >= 3) {
          candidates.push({ x: c, y: r });
        }
      }
    }
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      stopSigns.add(`${pick.x},${pick.y}`);
    }
  }
}

function isConnected(map) {
  let start = null;
  let roadCount = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map.tiles[r][c] !== T.BLOCK) {
        roadCount++;
        if (!start) start = { x: c, y: r };
      }
    }
  }
  if (!start || roadCount === 0) return false;

  const visited = new Set();
  const queue = [start];
  const key = p => `${p.x},${p.y}`;
  visited.add(key(start));

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const n of map.getNeighbors(cur.x, cur.y)) {
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
    for (const n of map.getNeighbors(cur.x, cur.y)) {
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
