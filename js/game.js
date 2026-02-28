import { generateMap, TILE, COLS, ROWS } from './map.js';
import { Truck, Hunter, DIR } from './entities.js';
import { Renderer } from './renderer.js';

const canvas = document.getElementById('canvas');
const titleScreen = document.getElementById('title-screen');

const renderer = new Renderer(canvas);

const KEY_DIR_MAP = {
  ArrowRight: DIR.RIGHT, d: DIR.RIGHT, D: DIR.RIGHT,
  ArrowLeft:  DIR.LEFT,  a: DIR.LEFT,  A: DIR.LEFT,
  ArrowDown:  DIR.DOWN,  s: DIR.DOWN,  S: DIR.DOWN,
  ArrowUp:    DIR.UP,    w: DIR.UP,    W: DIR.UP,
};

let gameState = 'TITLE'; // 'TITLE' | 'PLAYING' | 'WIN'
let map, truck, hunter;
let elapsed = 0;         // ms since game start
let lastTime = null;

// Trapped win condition state
const TRAPPED_DURATION = 3000; // ms
let trappedTimer = null;       // null = not trapped, else ms remaining

// ─── Input ────────────────────────────────────────────────────────────────────

const heldKeys = []; // ordered by press-time; most recent = last element

window.addEventListener('keydown', e => {
  if (gameState === 'TITLE') { startGame(); return; }
  if (gameState === 'WIN') { if (e.key === 'r' || e.key === 'R') startGame(); return; }
  if (KEY_DIR_MAP[e.key]) {
    e.preventDefault();
    if (!heldKeys.includes(e.key)) heldKeys.push(e.key);
  }
});

window.addEventListener('keyup', e => {
  const i = heldKeys.indexOf(e.key);
  if (i !== -1) heldKeys.splice(i, 1);
});

// ─── Game lifecycle ────────────────────────────────────────────────────────────

function findRoadTile(excludeTile = null) {
  const candidates = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map.tiles[r][c] === 0) {
        if (excludeTile && excludeTile.x === c && excludeTile.y === r) continue;
        candidates.push({ x: c, y: r });
      }
    }
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function startGame() {
  map = generateMap();

  // Place truck at a random road tile, Hunter far away
  const truckPos = findRoadTile();
  truck = new Truck(truckPos.x, truckPos.y);

  // Find Hunter spawn at least 10 tiles (Chebyshev) from truck
  let hunterPos;
  let tries = 0;
  do {
    hunterPos = findRoadTile();
    tries++;
  } while (
    Math.max(Math.abs(hunterPos.x - truckPos.x), Math.abs(hunterPos.y - truckPos.y)) < 10
    && tries < 200
  );
  hunter = new Hunter(hunterPos.x, hunterPos.y);

  elapsed = 0;
  lastTime = null;
  trappedTimer = null;
  gameState = 'PLAYING';

  titleScreen.classList.add('hidden');
}

// ─── Win detection ─────────────────────────────────────────────────────────────

function checkWin(dt) {
  // Win 1 — overlap (truck pixel rect overlaps hunter pixel rect)
  const tc = truck.getCenterPx();
  const hc = hunter.getCenterPx();
  const HALF = 14; // half of sprite hitbox
  if (
    Math.abs(tc.x - hc.x) < HALF * 2 &&
    Math.abs(tc.y - hc.y) < HALF * 2
  ) {
    triggerWin();
    return;
  }

  // Win 2 — trapped: Hunter has no free neighbors
  const truckTile = { x: truck.tx, y: truck.ty };
  const freeNeighbors = hunter.countFreeNeighbors(map, truckTile);
  if (freeNeighbors === 0) {
    if (trappedTimer === null) {
      trappedTimer = TRAPPED_DURATION;
    } else {
      trappedTimer -= dt * 1000;
      if (trappedTimer <= 0) {
        triggerWin();
        return;
      }
    }
  } else {
    trappedTimer = null;
  }
}

function triggerWin() {
  gameState = 'WIN';
}

// ─── Game loop ─────────────────────────────────────────────────────────────────

function loop(timestamp) {
  requestAnimationFrame(loop);

  if (gameState === 'TITLE') {
    renderer.clear();
    return;
  }

  // Delta time
  if (lastTime === null) lastTime = timestamp;
  const rawDt = (timestamp - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.1); // cap at 100ms
  lastTime = timestamp;

  if (gameState === 'PLAYING') {
    elapsed += dt * 1000;

    // Queue direction from most-recently held key
    const activeKey = heldKeys[heldKeys.length - 1];
    if (activeKey) truck.queueDirection(KEY_DIR_MAP[activeKey]);

    truck.update(dt, map);
    hunter.update(dt, map, truck);

    checkWin(dt);
  }

  // Render
  renderer.clear();
  renderer.drawMap(map);
  renderer.drawTruck(truck);
  renderer.drawHunter(hunter);
  renderer.drawHUD({
    gameState,
    elapsed,
    trappedCountdown: trappedTimer,
    hunterFleeing: hunter.state === 'flee',
  });
}

requestAnimationFrame(loop);
