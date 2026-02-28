import { generateMap, TILE, COLS, ROWS } from './map.js';
import { Truck, Hunter, NPC, DIR } from './entities.js';
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
let npcs = [];
let elapsed = 0;
let lastTime = null;

// Trapped win condition state
const TRAPPED_DURATION = 3000; // ms
let trappedTimer = null;

// Electrical box lose condition
const BOX_DURATION = 15000; // ms Hunter must stay on box to summon Donny
let boxTimer = 0;

// ─── Traffic light ─────────────────────────────────────────────────────────────

const LIGHT_PHASES = [
  { name: 'EW_GREEN',  duration: 6000 },
  { name: 'EW_YELLOW', duration: 2000 },
  { name: 'NS_GREEN',  duration: 6000 },
  { name: 'NS_YELLOW', duration: 2000 },
];

const trafficLight = {
  phaseIndex: 0,
  phaseTimer: 0,  // ms elapsed in current phase

  get phase() { return LIGHT_PHASES[this.phaseIndex].name; },
  get phaseTimeLeft() { return LIGHT_PHASES[this.phaseIndex].duration - this.phaseTimer; },

  // Returns true if vehicles moving in direction (dx,dy) may enter the intersection
  canEnter(dx, dy) {
    if (dx !== 0) return this.phase === 'EW_GREEN';  // east-west
    if (dy !== 0) return this.phase === 'NS_GREEN';  // north-south
    return true;
  },

  update(dtMs) {
    this.phaseTimer += dtMs;
    if (this.phaseTimer >= LIGHT_PHASES[this.phaseIndex].duration) {
      this.phaseTimer -= LIGHT_PHASES[this.phaseIndex].duration;
      this.phaseIndex = (this.phaseIndex + 1) % LIGHT_PHASES.length;
    }
  },

  reset() {
    this.phaseIndex = 0;
    this.phaseTimer = 0;
  },
};

// ─── Input ────────────────────────────────────────────────────────────────────

const heldKeys = [];
let touchDir = null; // direction held via on-screen D-pad

window.addEventListener('keydown', e => {
  if (gameState === 'TITLE') { startGame(); return; }
  if (gameState === 'WIN' || gameState === 'LOSE') { if (e.key === 'r' || e.key === 'R') startGame(); return; }
  if (KEY_DIR_MAP[e.key]) {
    e.preventDefault();
    if (!heldKeys.includes(e.key)) heldKeys.push(e.key);
  }
});

window.addEventListener('keyup', e => {
  const i = heldKeys.indexOf(e.key);
  if (i !== -1) heldKeys.splice(i, 1);
});

// Tap anywhere to start / restart on touch devices
window.addEventListener('touchend', e => {
  if (gameState === 'TITLE') { e.preventDefault(); startGame(); return; }
  if (gameState === 'WIN' || gameState === 'LOSE') { e.preventDefault(); startGame(); return; }
}, { passive: false });

// On-screen D-pad — use native touch events for maximum iOS Safari compatibility
function setupDpad() {
  const buttons = [
    ['btn-up',    DIR.UP],
    ['btn-down',  DIR.DOWN],
    ['btn-left',  DIR.LEFT],
    ['btn-right', DIR.RIGHT],
  ];
  for (const [id, dir] of buttons) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    // Touch (mobile)
    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      touchDir = dir;
      btn.classList.add('pressed');
    }, { passive: false });

    const releaseTouch = e => {
      e.preventDefault();
      touchDir = null;
      btn.classList.remove('pressed');
    };
    btn.addEventListener('touchend',    releaseTouch, { passive: false });
    btn.addEventListener('touchcancel', releaseTouch, { passive: false });

    // Mouse (desktop fallback so D-pad is also clickable with a mouse)
    btn.addEventListener('mousedown', () => { touchDir = dir; btn.classList.add('pressed'); });
    const releaseMouse = () => { touchDir = null; btn.classList.remove('pressed'); };
    btn.addEventListener('mouseup',    releaseMouse);
    btn.addEventListener('mouseleave', releaseMouse);
  }
}
setupDpad();

// ─── Game lifecycle ────────────────────────────────────────────────────────────

// Finds a neighbourhood-only road tile (T.ROAD=0) for truck/hunter spawning
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

// Finds any passable tile (road + main road) within a bounding box
function findPassableInArea(rMin, rMax, cMin, cMax) {
  const candidates = [];
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      if (map.isRoad(c, r)) candidates.push({ x: c, y: r });
    }
  }
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

// Spawn NPCs: guarantee one per quadrant, fill remaining randomly (2–10 total)
function spawnNPCs(count) {
  const mr = map.mainRoadRow;
  const mc = map.mainRoadCol;
  const quadrants = [
    [0,      mr - 1, 0,      mc - 1],
    [0,      mr - 1, mc + 1, COLS - 1],
    [mr + 1, ROWS-1, 0,      mc - 1],
    [mr + 1, ROWS-1, mc + 1, COLS - 1],
  ];
  const result = [];
  for (let i = 0; i < Math.min(count, 4); i++) {
    const [rMin, rMax, cMin, cMax] = quadrants[i];
    const pos = findPassableInArea(rMin, rMax, cMin, cMax);
    if (pos) result.push(new NPC(pos.x, pos.y, i));
  }
  for (let i = 4; i < count; i++) {
    const pos = findPassableInArea(0, ROWS - 1, 0, COLS - 1);
    if (pos) result.push(new NPC(pos.x, pos.y, i));
  }
  return result;
}

function startGame() {
  map = generateMap();
  trafficLight.reset();

  const truckPos = findRoadTile();
  truck = new Truck(truckPos.x, truckPos.y);

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

  // Spawn 2–10 NPC traffic cars, at least one per quadrant
  const npcCount = 2 + Math.floor(Math.random() * 9);
  npcs = spawnNPCs(npcCount);

  elapsed = 0;
  lastTime = null;
  trappedTimer = null;
  boxTimer = 0;
  gameState = 'PLAYING';

  titleScreen.classList.add('hidden');
}

// ─── Win detection ─────────────────────────────────────────────────────────────

function checkWin(dt) {
  const tc = truck.getCenterPx();
  const hc = hunter.getCenterPx();
  const HALF = 14;
  if (
    Math.abs(tc.x - hc.x) < HALF * 2 &&
    Math.abs(tc.y - hc.y) < HALF * 2
  ) {
    gameState = 'WIN';
    return;
  }

  const truckTile = { x: truck.tx, y: truck.ty };
  const freeNeighbors = hunter.countFreeNeighbors(map, truckTile);
  if (freeNeighbors === 0) {
    if (trappedTimer === null) {
      trappedTimer = TRAPPED_DURATION;
    } else {
      trappedTimer -= dt * 1000;
      if (trappedTimer <= 0) {
        gameState = 'WIN';
        return;
      }
    }
  } else {
    trappedTimer = null;
  }
}

// ─── Electrical box check ──────────────────────────────────────────────────────

function checkBox(dt) {
  if (hunter.state === 'hacking') {
    boxTimer += dt * 1000;
    if (boxTimer >= BOX_DURATION) {
      gameState = 'LOSE';
    }
  } else {
    boxTimer = 0;
  }
}

// ─── Game loop ─────────────────────────────────────────────────────────────────

function loop(timestamp) {
  requestAnimationFrame(loop);

  if (gameState === 'TITLE') {
    renderer.clear();
    return;
  }

  if (lastTime === null) lastTime = timestamp;
  const rawDt = (timestamp - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.1);
  lastTime = timestamp;

  if (gameState === 'PLAYING') {
    elapsed += dt * 1000;
    trafficLight.update(dt * 1000);

    const activeKey = heldKeys[heldKeys.length - 1];
    const activeDir = activeKey ? KEY_DIR_MAP[activeKey] : touchDir;
    if (activeDir) truck.queueDirection(activeDir);

    for (const npc of npcs) npc.update(dt, map);
    truck.update(dt, map, trafficLight, npcs);
    hunter.update(dt, map, truck, map.electricalBox);

    checkWin(dt);
    if (gameState === 'PLAYING') checkBox(dt);
  }

  renderer.clear();
  renderer.drawMap(map);
  renderer.drawTrafficLights(map, trafficLight);
  renderer.drawElectricalBox(map, boxTimer, BOX_DURATION);
  renderer.drawNPCs(npcs);
  renderer.drawTruck(truck);
  renderer.drawHunter(hunter);
  renderer.drawHUD({
    gameState,
    elapsed,
    trappedCountdown: trappedTimer,
    hunterFleeing: hunter.state === 'flee',
    truckStall: truck.stallTimer,
    trafficLight,
    boxTimer,
    boxDuration: BOX_DURATION,
  });
}

requestAnimationFrame(loop);
