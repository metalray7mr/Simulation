const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const minimapCanvas = document.getElementById("minimap");
const minimapCtx = minimapCanvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const hud = document.getElementById("hud");
const successScreen = document.getElementById("success-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const touchControls = document.getElementById("touch-controls");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const successRestartBtn = document.getElementById("success-restart-btn");
const speedLabel = document.getElementById("speed-label");
const headingLabel = document.getElementById("heading-label");
const rudderLabel = document.getElementById("rudder-label");
const throttleLabel = document.getElementById("throttle-label");
const fuelLabel = document.getElementById("fuel-label");
const distanceLabel = document.getElementById("distance-label");
const missionLabel = document.getElementById("mission-label");
const scoreLabel = document.getElementById("score-label");
const warningLabel = document.getElementById("warning-label");
const fuelWarningLabel = document.getElementById("fuel-warning-label");
const chartPanel = document.getElementById("chart-panel");
const chartToggle = document.getElementById("chart-toggle");
const chartClose = document.getElementById("chart-close");
const chartSpeed = document.getElementById("chart-speed");
const chartDistance = document.getElementById("chart-distance");
const chartFuel = document.getElementById("chart-fuel");
const statTime = document.getElementById("stat-time");
const statDistance = document.getElementById("stat-distance");
const statFuelUsed = document.getElementById("stat-fuel-used");
const statAvgSpeed = document.getElementById("stat-avg-speed");
const successScore = document.getElementById("success-score");
const successTime = document.getElementById("success-time");
const gameoverTitle = document.getElementById("gameover-title");
const gameoverReason = document.getElementById("gameover-reason");
const rudderWheel = document.getElementById("rudder-wheel");
const rudderKnob = document.getElementById("rudder-knob");
const throttleSlider = document.getElementById("throttle-slider");
const throttleFill = document.getElementById("throttle-fill");
const throttleThumb = document.getElementById("throttle-thumb");

const WORLD_W = 4000;
const WORLD_H = 3000;
const MPS_TO_KNOTS = 1.94384;
const DEG = Math.PI / 180;
const MAX_DT = 1 / 30;

const SHIP_LENGTH = 130;
const SHIP_WIDTH = 30;
const SHIP_MASS = 85000;
const MAX_THRUST = 420000;
const MAX_RUDDER = 35 * DEG;
const RUDDER_RATE = 0.45 * DEG;
const THROTTLE_RATE = 0.35;
const BOW_THRUST = 180000;
const BOW_TORQUE = 80000;
const DRAG_FWD = 0.018;
const DRAG_LAT = 0.12;
const DRAG_ANG = 0.85;
const RUDDER_COEFF = 2.8e6;
const DOCK_SPEED_KN = 3;
const DOCK_ALIGN_DEG = 18;
const MAX_FUEL = 100;
const IDLE_FUEL_RATE = 0.06;
const THROTTLE_FUEL_RATE = 10;
const BOW_FUEL_RATE = 3.5;
const METERS_TO_NM = 1 / 1852;
const LOG_INTERVAL = 0.5;
const MAX_LOG_SAMPLES = 360;
const WARN_CHECK_INTERVAL = 0.2;
const HUD_UPDATE_INTERVAL = 0.1;
const CHART_UPDATE_INTERVAL = 0.25;

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;
let gameState = "start";
let missionTime = 0;
let score = 1000;
let collisionPenalty = 0;
let wavePhase = 0;
let wakeParticles = [];
let wakeCount = 0;
const WAKE_POOL_SIZE = 180;
let camera = { x: 0, y: 0, rot: 0 };
let fuel = MAX_FUEL;
let fuelUsed = 0;
let totalDistance = 0;
let voyageLog = [];
let lastLogTime = 0;
let lastWarnCheck = 0;
let lastHudUpdate = 0;
let lastChartUpdate = 0;
let collisionWarn = false;
let chartPanelOpen = false;
let prevShipX = 0;
let prevShipY = 0;
let gamepadEnabled = false;

const keys = {};
const helm = { throttle: 0, rudder: 0, bow: 0 };
let touchRudder = 0;
let touchThrottle = 0;
let touchBow = 0;

const waypoints = [
  { x: 520, y: 2100, label: "Depart pier" },
  { x: 900, y: 1750, label: "Enter channel" },
  { x: 1800, y: 1400, label: "Mid channel" },
  { x: 2800, y: 1050, label: "Approach dock" },
  { x: 3400, y: 820, label: "Dock at pier" },
];

const dockZone = { x: 3280, y: 720, w: 280, h: 200, heading: -25 * DEG };

const landPolygons = [
  // North mainland
  [
    { x: 0, y: 0 },
    { x: WORLD_W, y: 0 },
    { x: WORLD_W, y: 480 },
    { x: 2600, y: 520 },
    { x: 2200, y: 680 },
    { x: 1600, y: 720 },
    { x: 1100, y: 900 },
    { x: 600, y: 1100 },
    { x: 200, y: 1400 },
    { x: 0, y: 1800 },
  ],
  // South breakwater
  [
    { x: 0, y: WORLD_H },
    { x: WORLD_W, y: WORLD_H },
    { x: WORLD_W, y: 2200 },
    { x: 3000, y: 2150 },
    { x: 2400, y: 2000 },
    { x: 1800, y: 1900 },
    { x: 1200, y: 2050 },
    { x: 700, y: 2300 },
    { x: 0, y: 2500 },
  ],
  // East pier structure
  [
    { x: 3550, y: 600 },
    { x: WORLD_W, y: 580 },
    { x: WORLD_W, y: 950 },
    { x: 3520, y: 920 },
  ],
  // West dock wall
  [
    { x: 0, y: 1950 },
    { x: 350, y: 1920 },
    { x: 420, y: 2280 },
    { x: 0, y: 2320 },
  ],
];

const buoys = [
  { x: 700, y: 1880, color: "#ff4444" },
  { x: 1100, y: 1620, color: "#44ff66" },
  { x: 1500, y: 1380, color: "#ff4444" },
  { x: 2100, y: 1180, color: "#44ff66" },
  { x: 2600, y: 980, color: "#ff4444" },
  { x: 3100, y: 860, color: "#44ff66" },
];

let ship = null;
let aiShips = [];
let currentWaypoint = 0;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function headingDeg(h) {
  const d = ((90 - (h * 180) / Math.PI) % 360 + 360) % 360;
  return Math.round(d);
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function shipCorners(s) {
  const cos = Math.cos(s.heading);
  const sin = Math.sin(s.heading);
  const hl = SHIP_LENGTH * 0.5;
  const hw = SHIP_WIDTH * 0.5;
  const local = [
    { lx: hl, ly: -hw },
    { lx: hl, ly: hw },
    { lx: -hl, ly: hw },
    { lx: -hl, ly: -hw },
  ];
  return local.map((p) => ({
    x: s.x + p.lx * cos - p.ly * sin,
    y: s.y + p.lx * sin + p.ly * cos,
  }));
}

function polyCollision(corners, poly) {
  for (const c of corners) {
    if (pointInPoly(c.x, c.y, poly)) return true;
  }
  const cx = corners.reduce((s, p) => s + p.x, 0) / corners.length;
  const cy = corners.reduce((s, p) => s + p.y, 0) / corners.length;
  if (pointInPoly(cx, cy, poly)) return true;
  return false;
}

function shipsCollide(a, b) {
  const ca = shipCorners(a);
  const cb = shipCorners(b);
  const midAx = ca.reduce((s, p) => s + p.x, 0) / 4;
  const midAy = ca.reduce((s, p) => s + p.y, 0) / 4;
  const midBx = cb.reduce((s, p) => s + p.x, 0) / 4;
  const midBy = cb.reduce((s, p) => s + p.y, 0) / 4;
  return dist(midAx, midAy, midBx, midBy) < (SHIP_LENGTH + SHIP_LENGTH) * 0.45;
}

function createShip(x, y, heading) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    heading,
    omega: 0,
    throttle: 0,
    rudder: 0,
    bow: 0,
    isAI: false,
    pathIndex: 0,
    path: [],
    color: "#e8ecef",
  };
}

function createAIShips() {
  return [
    {
      ...createShip(2000, 1250, -0.4),
      isAI: true,
      color: "#c8a86e",
      path: [
        { x: 2000, y: 1250 },
        { x: 2400, y: 1100 },
        { x: 2900, y: 950 },
        { x: 3200, y: 880 },
      ],
      pathIndex: 0,
      throttle: 0.35,
    },
    {
      ...createShip(1400, 1550, 0.6),
      isAI: true,
      color: "#8eb4c8",
      path: [
        { x: 1400, y: 1550 },
        { x: 1000, y: 1700 },
        { x: 650, y: 1950 },
      ],
      pathIndex: 0,
      throttle: 0.28,
    },
  ];
}

function getSpeedKn(s = ship) {
  if (!s) return 0;
  return Math.sqrt(s.vx * s.vx + s.vy * s.vy) * MPS_TO_KNOTS;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function resetGame() {
  ship = createShip(480, 2180, -Math.PI / 2);
  ship.throttle = 0;
  aiShips = createAIShips();
  currentWaypoint = 0;
  missionTime = 0;
  score = 1000;
  collisionPenalty = 0;
  wakeCount = 0;
  wakeParticles.length = WAKE_POOL_SIZE;
  for (let i = 0; i < WAKE_POOL_SIZE; i++) wakeParticles[i] = { x: 0, y: 0, life: 0, size: 0 };
  helm.throttle = 0;
  helm.rudder = 0;
  helm.bow = 0;
  touchRudder = 0;
  touchThrottle = 0;
  touchBow = 0;
  fuel = MAX_FUEL;
  fuelUsed = 0;
  totalDistance = 0;
  voyageLog = [];
  lastLogTime = 0;
  lastWarnCheck = 0;
  lastHudUpdate = 0;
  lastChartUpdate = 0;
  collisionWarn = false;
  prevShipX = ship.x;
  prevShipY = ship.y;
  camera.x = ship.x;
  camera.y = ship.y;
  camera.rot = ship.heading;
  voyageLog.push({ t: 0, speed: 0, distance: 0, fuel: MAX_FUEL });
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const isMobile = width < 768;
  touchControls.classList.toggle("hidden", gameState !== "playing" || !isMobile);
  updateChartVisibility();
}

function updateChartVisibility() {
  const isMobile = width < 768;
  chartToggle.classList.toggle("hidden", gameState !== "playing" || !isMobile);
  if (gameState !== "playing") {
    chartPanel.classList.add("hidden");
    return;
  }
  if (isMobile) {
    chartPanel.classList.toggle("hidden", !chartPanelOpen);
  } else {
    chartPanel.classList.remove("hidden");
  }
}

function getEffectiveHelm() {
  let throttle = helm.throttle;
  let rudder = helm.rudder;
  let bow = helm.bow;

  if (width < 768 && gameState === "playing") {
    throttle = touchThrottle;
    rudder = touchRudder;
    bow = touchBow;
  }

  const pads = gamepadEnabled && navigator.getGamepads ? navigator.getGamepads() : [];
  try {
    for (const pad of pads) {
      if (!pad) continue;
      const stickX = pad.axes[0] || 0;
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      if (Math.abs(stickX) > 0.15) rudder = stickX * MAX_RUDDER;
      if (rt > 0.1 || lt > 0.1) throttle = rt - lt;
      break;
    }
  } catch (_) {
    gamepadEnabled = false;
  }

  return { throttle, rudder, bow };
}

function updateHelmFromKeyboard(dt) {
  if (keys["w"] || keys["arrowup"]) helm.throttle = clamp(helm.throttle + THROTTLE_RATE * dt, -1, 1);
  if (keys["s"] || keys["arrowdown"]) helm.throttle = clamp(helm.throttle - THROTTLE_RATE * dt, -1, 1);
  if (keys["a"] || keys["arrowleft"]) helm.rudder = clamp(helm.rudder - RUDDER_RATE * dt * 60, -MAX_RUDDER, MAX_RUDDER);
  if (keys["d"] || keys["arrowright"]) helm.rudder = clamp(helm.rudder + RUDDER_RATE * dt * 60, -MAX_RUDDER, MAX_RUDDER);
  if (keys["q"]) helm.bow = -1;
  else if (keys["e"]) helm.bow = 1;
  else if (!touchBow) helm.bow = 0;
  if (keys[" "]) helm.rudder = lerp(helm.rudder, 0, clamp(dt * 8, 0, 1));
}

function applyPhysics(s, input, dt) {
  s.throttle = input.throttle;
  s.rudder = input.rudder;
  s.bow = input.bow;

  const cos = Math.cos(s.heading);
  const sin = Math.sin(s.heading);
  const fwdSpeed = s.vx * cos + s.vy * sin;
  const latSpeed = -s.vx * sin + s.vy * cos;

  const thrust = s.throttle * MAX_THRUST;
  const fx = cos * thrust;
  const fy = sin * thrust;

  const bowForce = s.bow * BOW_THRUST;
  const bfx = -sin * bowForce;
  const bfy = cos * bowForce;

  const windBase = 1200;
  const gust = Math.sin(wavePhase * 0.7) * 400;
  const windX = windBase + gust;
  const windY = 600 + Math.cos(wavePhase * 0.5) * 250;
  const currentX = 800;
  const currentY = 300;

  const waveDriftX = Math.sin(wavePhase * 1.3 + s.x * 0.002) * 80;
  const waveDriftY = Math.cos(wavePhase * 1.1 + s.y * 0.002) * 80;

  const dragFx = -fwdSpeed * Math.abs(fwdSpeed) * DRAG_FWD - latSpeed * DRAG_LAT * cos;
  const dragFy = -fwdSpeed * Math.abs(fwdSpeed) * DRAG_FWD * sin - latSpeed * DRAG_LAT * sin;

  const totalFx = fx + bfx + windX + currentX + waveDriftX + dragFx * (s.isAI ? 0.6 : 1);
  const totalFy = fy + bfy + windY + currentY + waveDriftY + dragFy * (s.isAI ? 0.6 : 1);

  const ax = totalFx / SHIP_MASS;
  const ay = totalFy / SHIP_MASS;

  s.vx += ax * dt;
  s.vy += ay * dt;

  const rudderTorque = s.rudder * fwdSpeed * fwdSpeed * RUDDER_COEFF;
  const bowTorque = s.bow * BOW_TORQUE;
  const angDrag = -s.omega * Math.abs(s.omega) * DRAG_ANG - s.omega * 0.5;
  s.omega += ((rudderTorque + bowTorque) / SHIP_MASS + angDrag) * dt;

  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.heading += s.omega * dt;
  s.heading = normalizeAngle(s.heading);

  s.x = clamp(s.x, SHIP_LENGTH, WORLD_W - SHIP_LENGTH);
  s.y = clamp(s.y, SHIP_LENGTH, WORLD_H - SHIP_LENGTH);
}

function updateAI(s, dt) {
  if (!s.path.length) return;
  const target = s.path[s.pathIndex];
  const dx = target.x - s.x;
  const dy = target.y - s.y;
  const desired = Math.atan2(dy, dx);
  let diff = normalizeAngle(desired - s.heading);
  s.rudder = clamp(diff * 1.2, -MAX_RUDDER * 0.7, MAX_RUDDER * 0.7);
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 80 && s.pathIndex < s.path.length - 1) s.pathIndex++;
  s.throttle = s.throttle || 0.3;
  applyPhysics(s, { throttle: s.throttle, rudder: s.rudder, bow: 0 }, dt);
}

function checkCollisions() {
  const corners = shipCorners(ship);
  for (const poly of landPolygons) {
    if (polyCollision(corners, poly)) {
      return { type: "ground", message: "Your vessel struck land." };
    }
  }
  for (const ai of aiShips) {
    if (shipsCollide(ship, ai)) {
      return { type: "collision", message: "Collision with another vessel." };
    }
  }
  return null;
}

function checkWaypoint() {
  const wp = waypoints[currentWaypoint];
  if (!wp) return;
  const d = dist(ship.x, ship.y, wp.x, wp.y);
  if (d < 120) {
    if (currentWaypoint < waypoints.length - 1) {
      currentWaypoint++;
      score += 50;
    }
  }
}

function checkDocking() {
  if (currentWaypoint < waypoints.length - 1) return false;
  const cx = dockZone.x + dockZone.w / 2;
  const cy = dockZone.y + dockZone.h / 2;
  const inZone =
    ship.x > dockZone.x &&
    ship.x < dockZone.x + dockZone.w &&
    ship.y > dockZone.y &&
    ship.y < dockZone.y + dockZone.h;
  if (!inZone) return false;

  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy) * MPS_TO_KNOTS;
  const align = Math.abs(normalizeAngle(ship.heading - dockZone.heading));
  if (speed < DOCK_SPEED_KN && align < DOCK_ALIGN_DEG * DEG) {
    return true;
  }
  return false;
}

function updateWake(dt) {
  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
  if (speed > 2) {
    const cos = Math.cos(ship.heading);
    const sin = Math.sin(ship.heading);
    const p = wakeParticles[wakeCount % WAKE_POOL_SIZE];
    p.x = ship.x - cos * SHIP_LENGTH * 0.45;
    p.y = ship.y - sin * SHIP_LENGTH * 0.45;
    p.life = 1;
    p.size = 4 + speed * 0.08;
    wakeCount++;
  }
  for (let i = 0; i < WAKE_POOL_SIZE; i++) {
    const p = wakeParticles[i];
    if (p.life <= 0) continue;
    p.life -= dt * 0.5;
    p.size += dt * 2;
  }
}

function updateCamera(dt) {
  const lookX = ship.x + ship.vx * 0.8;
  const lookY = ship.y + ship.vy * 0.8;
  camera.x = lerp(camera.x, lookX, clamp(dt * 3, 0, 1));
  camera.y = lerp(camera.y, lookY, clamp(dt * 3, 0, 1));
  camera.rot = lerp(camera.rot, ship.heading, clamp(dt * 4, 0, 1));
}

function checkCollisionWarning() {
  const corners = shipCorners(ship);
  for (const ai of aiShips) {
    if (dist(ship.x, ship.y, ai.x, ai.y) < SHIP_LENGTH * 1.5) return true;
  }
  for (const c of corners) {
    for (const poly of landPolygons) {
      if (pointInPoly(c.x, c.y, poly)) return true;
      for (let i = 0; i < poly.length; i++) {
        if (dist(c.x, c.y, poly[i].x, poly[i].y) < 90) return true;
      }
    }
  }
  return false;
}

function updateFuel(input, dt) {
  const throttleUse = Math.abs(input.throttle) * THROTTLE_FUEL_RATE * dt;
  const bowUse = Math.abs(input.bow) * BOW_FUEL_RATE * dt;
  const idleUse = IDLE_FUEL_RATE * dt;
  const used = throttleUse + bowUse + idleUse;
  fuel = Math.max(0, fuel - used);
  fuelUsed += used;
}

function recordVoyageSample() {
  voyageLog.push({
    t: missionTime,
    speed: getSpeedKn(),
    distance: totalDistance,
    fuel,
  });
  if (voyageLog.length > MAX_LOG_SAMPLES) voyageLog.shift();
}

function drawLineChart(canvas, samples, key, color, yMin, yMax) {
  if (!canvas) return;
  const c = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);

  c.strokeStyle = "rgba(100,180,255,0.15)";
  c.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gy = (h / 4) * i;
    c.beginPath();
    c.moveTo(0, gy);
    c.lineTo(w, gy);
    c.stroke();
  }

  if (samples.length < 2) return;

  const t0 = samples[0].t;
  const t1 = samples[samples.length - 1].t || 1;
  const tRange = Math.max(t1 - t0, 1);

  let minV = yMin;
  let maxV = yMax;
  if (minV === undefined || maxV === undefined) {
    minV = Infinity;
    maxV = -Infinity;
    for (const s of samples) {
      minV = Math.min(minV, s[key]);
      maxV = Math.max(maxV, s[key]);
    }
    if (maxV - minV < 0.01) maxV = minV + 1;
    minV = Math.max(0, minV * 0.95);
    maxV *= 1.05;
  }

  c.strokeStyle = color;
  c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = ((s.t - t0) / tRange) * (w - 8) + 4;
    const y = h - 4 - ((s[key] - minV) / (maxV - minV)) * (h - 8);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();

  c.fillStyle = color.startsWith("#")
    ? color + "20"
    : color.replace(")", ",0.12)").replace("rgb", "rgba");
  c.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = ((s.t - t0) / tRange) * (w - 8) + 4;
    const y = h - 4 - ((s[key] - minV) / (maxV - minV)) * (h - 8);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.lineTo(((samples[samples.length - 1].t - t0) / tRange) * (w - 8) + 4, h);
  c.lineTo(4, h);
  c.closePath();
  c.fill();

  c.fillStyle = "rgba(200,220,255,0.6)";
  c.font = "9px system-ui";
  c.fillText(maxV.toFixed(1), 4, 10);
  c.fillText(minV.toFixed(1), 4, h - 4);
}

function updateCharts() {
  drawLineChart(chartSpeed, voyageLog, "speed", "#6ecfff", 0);
  drawLineChart(chartDistance, voyageLog, "distance", "#44dd88", 0);
  drawLineChart(chartFuel, voyageLog, "fuel", "#f0a030", 0, 100);

  statTime.textContent = `Time: ${formatTime(missionTime)}`;
  statDistance.textContent = `Distance: ${totalDistance.toFixed(2)} nm`;
  statFuelUsed.textContent = `Fuel used: ${fuelUsed.toFixed(1)}%`;
  const avgSpeed = missionTime > 0 ? totalDistance / (missionTime / 3600) : 0;
  statAvgSpeed.textContent = `Avg speed: ${avgSpeed.toFixed(1)} kn`;
}

function updateHUD() {
  const speed = getSpeedKn();
  const h = getEffectiveHelm();
  speedLabel.textContent = `${speed.toFixed(1)} kn`;
  headingLabel.textContent = `${String(headingDeg(ship.heading)).padStart(3, "0")}°`;
  rudderLabel.textContent = `${Math.round((h.rudder / MAX_RUDDER) * 35)}°`;
  throttleLabel.textContent = `${Math.round(h.throttle * 100)}%`;
  fuelLabel.textContent = `${fuel.toFixed(0)}%`;
  distanceLabel.textContent = `${totalDistance.toFixed(2)} nm`;
  const wp = waypoints[currentWaypoint];
  missionLabel.textContent = `Mission: ${wp ? wp.label : "Complete"}`;
  scoreLabel.textContent = `Score: ${Math.max(0, Math.round(score - collisionPenalty))}`;
  warningLabel.classList.toggle("hidden", !collisionWarn);
  fuelWarningLabel.classList.toggle("hidden", fuel > 15);
}

function drawOcean() {
  const pad = Math.max(width, height) * 1.5;
  ctx.fillStyle = "#0e3458";
  ctx.fillRect(camera.x - pad, camera.y - pad, pad * 2, pad * 2);

  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = "#5ecfff";
  ctx.lineWidth = 2;
  const startX = Math.floor((camera.x - width) / 80) * 80;
  const endX = camera.x + width;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    const phase = wavePhase + i * 1.2;
    const baseY = camera.y + Math.sin(phase) * 30 - height * 0.25 + i * 70;
    for (let x = startX; x < endX; x += 80) {
      const y = baseY + Math.sin(x * 0.004 + phase * 2) * 8;
      if (x === startX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLand() {
  for (const poly of landPolygons) {
    ctx.fillStyle = "#2a4a32";
    ctx.strokeStyle = "#4a7a52";
    ctx.lineWidth = 2;
    ctx.beginPath();
    poly.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = "#5a6a78";
  ctx.fillRect(dockZone.x, dockZone.y, dockZone.w, dockZone.h);
  ctx.strokeStyle = "#8aa0b0";
  ctx.lineWidth = 2;
  ctx.strokeRect(dockZone.x, dockZone.y, dockZone.w, dockZone.h);
  ctx.fillStyle = "rgba(100,200,255,0.2)";
  ctx.font = "14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("DOCK", dockZone.x + dockZone.w / 2, dockZone.y + dockZone.h / 2);
}

function drawBuoys() {
  for (const b of buoys) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(b.x, b.y - 14, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWaypoints() {
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const active = i === currentWaypoint;
    ctx.strokeStyle = active ? "#6ecfff" : "rgba(110,207,255,0.35)";
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.setLineDash(active ? [] : [8, 8]);
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, active ? 28 : 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (active) {
      ctx.fillStyle = "rgba(110,207,255,0.25)";
      ctx.fill();
    }
  }
  if (currentWaypoint > 0) {
    const prev = waypoints[currentWaypoint - 1];
    const curr = waypoints[currentWaypoint];
    if (prev && curr) {
      ctx.strokeStyle = "rgba(110,207,255,0.2)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawWake() {
  for (let i = 0; i < WAKE_POOL_SIZE; i++) {
    const p = wakeParticles[i];
    if (p.life <= 0) continue;
    ctx.fillStyle = `rgba(180, 220, 255, ${p.life * 0.35})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShip(s, isPlayer) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.heading);

  const len = SHIP_LENGTH;
  const hw = SHIP_WIDTH * 0.5;

  ctx.fillStyle = isPlayer ? "#f0f4f8" : s.color;
  ctx.strokeStyle = isPlayer ? "#8899aa" : "#666";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(len * 0.5, 0);
  ctx.lineTo(len * 0.15, -hw);
  ctx.lineTo(-len * 0.42, -hw);
  ctx.lineTo(-len * 0.48, -hw * 0.6);
  ctx.lineTo(-len * 0.48, hw * 0.6);
  ctx.lineTo(-len * 0.42, hw);
  ctx.lineTo(len * 0.15, hw);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#d0dae4";
  ctx.fillRect(-len * 0.1, -hw * 0.7, len * 0.35, hw * 1.4);
  ctx.fillRect(len * 0.05, -hw * 0.5, len * 0.2, hw);

  ctx.fillStyle = "#cc4444";
  ctx.fillRect(-len * 0.25, -4, 12, 8);

  if (isPlayer) {
    ctx.strokeStyle = "#6ecfff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.5, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWorld() {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-camera.rot + Math.PI / 2);
  ctx.translate(-camera.x, -camera.y);

  drawOcean();
  drawLand();
  drawBuoys();
  drawWaypoints();
  drawWake();

  for (const ai of aiShips) drawShip(ai, false);
  drawShip(ship, true);

  ctx.restore();
}

function drawMinimap() {
  const mw = minimapCanvas.width;
  const mh = minimapCanvas.height;
  const scale = Math.min(mw / WORLD_W, mh / WORLD_H) * 0.88;
  const ox = mw / 2;
  const oy = mh / 2;

  minimapCtx.clearRect(0, 0, mw, mh);
  minimapCtx.fillStyle = "#0a2840";
  minimapCtx.beginPath();
  minimapCtx.arc(mw / 2, mh / 2, mw / 2 - 2, 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.save();
  minimapCtx.translate(ox, oy);
  minimapCtx.scale(scale, scale);
  minimapCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

  minimapCtx.fillStyle = "#2a4a32";
  for (const poly of landPolygons) {
    minimapCtx.beginPath();
    poly.forEach((p, i) => {
      if (i === 0) minimapCtx.moveTo(p.x, p.y);
      else minimapCtx.lineTo(p.x, p.y);
    });
    minimapCtx.closePath();
    minimapCtx.fill();
  }

  minimapCtx.strokeStyle = "rgba(110,207,255,0.5)";
  minimapCtx.fillStyle = "rgba(110,207,255,0.3)";
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    minimapCtx.beginPath();
    minimapCtx.arc(wp.x, wp.y, i === currentWaypoint ? 20 : 12, 0, Math.PI * 2);
    if (i === currentWaypoint) minimapCtx.fill();
    minimapCtx.stroke();
  }

  minimapCtx.fillStyle = "#6a8a9a";
  for (const ai of aiShips) {
    minimapCtx.fillRect(ai.x - 15, ai.y - 5, 30, 10);
  }

  minimapCtx.fillStyle = "#6ecfff";
  minimapCtx.beginPath();
  minimapCtx.arc(ship.x, ship.y, 10, 0, Math.PI * 2);
  minimapCtx.fill();

  minimapCtx.strokeStyle = "rgba(255,255,255,0.6)";
  minimapCtx.lineWidth = 2 / scale;
  const vx = Math.cos(ship.heading) * 30;
  const vy = Math.sin(ship.heading) * 30;
  minimapCtx.beginPath();
  minimapCtx.moveTo(ship.x, ship.y);
  minimapCtx.lineTo(ship.x + vx, ship.y + vy);
  minimapCtx.stroke();

  minimapCtx.restore();

  minimapCtx.strokeStyle = "rgba(110,207,255,0.4)";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.arc(mw / 2, mh / 2, mw / 2 - 2, 0, Math.PI * 2);
  minimapCtx.stroke();
}

function endGame(type, message) {
  gameState = type;
  hud.classList.add("hidden");
  touchControls.classList.add("hidden");
  chartToggle.classList.add("hidden");
  if (width < 768) chartPanel.classList.add("hidden");
  updateCharts();
  if (type === "success") {
    const finalScore = Math.max(0, Math.round(score - collisionPenalty));
    successScore.textContent = `Score: ${finalScore}`;
    successTime.textContent = `Time: ${formatTime(missionTime)} | Fuel left: ${fuel.toFixed(0)}%`;
    successScreen.classList.remove("hidden");
  } else {
    gameoverTitle.textContent =
      type === "ground" ? "Grounded!" : type === "fuel" ? "Out of Fuel!" : "Collision!";
    gameoverReason.textContent = message;
    gameoverScreen.classList.remove("hidden");
  }
}

function update(dt) {
  if (gameState !== "playing") return;

  missionTime += dt;
  wavePhase += dt;
  score = Math.max(0, score - dt * 2);

  updateHelmFromKeyboard(dt);
  const input = getEffectiveHelm();
  helm.throttle = input.throttle;
  applyPhysics(ship, input, dt);
  updateFuel(input, dt);

  const dx = ship.x - prevShipX;
  const dy = ship.y - prevShipY;
  totalDistance += Math.sqrt(dx * dx + dy * dy) * METERS_TO_NM;
  prevShipX = ship.x;
  prevShipY = ship.y;

  for (const ai of aiShips) updateAI(ai, dt);

  if (fuel <= 0) {
    endGame("fuel", "You ran out of fuel. Use throttle sparingly.");
    return;
  }

  const hit = checkCollisions();
  if (hit) {
    endGame(hit.type, hit.message);
    return;
  }

  checkWaypoint();
  if (checkDocking()) {
    score += 300;
    score += Math.round(fuel * 2);
    endGame("success", "");
    return;
  }

  updateWake(dt);
  updateCamera(dt);

  if (missionTime - lastLogTime >= LOG_INTERVAL) {
    lastLogTime = missionTime;
    recordVoyageSample();
  }

  if (missionTime - lastWarnCheck >= WARN_CHECK_INTERVAL) {
    lastWarnCheck = missionTime;
    collisionWarn = checkCollisionWarning();
  }

  if (missionTime - lastHudUpdate >= HUD_UPDATE_INTERVAL) {
    lastHudUpdate = missionTime;
    updateHUD();
  }

  if (missionTime - lastChartUpdate >= CHART_UPDATE_INTERVAL) {
    lastChartUpdate = missionTime;
    updateCharts();
  }
}

function render() {
  ctx.clearRect(0, 0, width, height);
  if (gameState !== "start") {
    drawWorld();
    drawMinimap();
  }
}

function loop(now) {
  try {
    const dt = Math.min(Math.max((now - lastTime) / 1000, 0), MAX_DT);
    lastTime = now;
    update(dt);
    render();
  } catch (err) {
    console.error("Game loop error:", err);
    resetClock();
  }
  requestAnimationFrame(loop);
}

function resetClock() {
  lastTime = performance.now();
}

function startGame() {
  resetGame();
  gameState = "playing";
  startScreen.classList.add("hidden");
  gameoverScreen.classList.add("hidden");
  successScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  chartPanelOpen = width < 768 ? false : true;
  updateChartVisibility();
  updateHUD();
  updateCharts();
  if (width < 768) touchControls.classList.remove("hidden");
  resetClock();
}

function setupInput() {
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === " " && gameState === "playing") e.preventDefault();
    if (e.key.toLowerCase() === "r" && (gameState === "playing" || gameState === "ground" || gameState === "collision" || gameState === "success" || gameState === "fuel")) {
      startGame();
    }
    if (e.key.toLowerCase() === "m" && gameState === "playing" && width < 768) {
      chartPanelOpen = !chartPanelOpen;
      updateChartVisibility();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);
  successRestartBtn.addEventListener("click", startGame);

  chartToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    chartPanelOpen = !chartPanelOpen;
    updateChartVisibility();
  });
  chartClose.addEventListener("click", (e) => {
    e.stopPropagation();
    chartPanelOpen = false;
    updateChartVisibility();
  });

  function enableGamepad() {
    gamepadEnabled = true;
  }
  window.addEventListener("pointerdown", enableGamepad, { passive: true });
  window.addEventListener("keydown", enableGamepad);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resetClock();
  });
  window.addEventListener("focus", resetClock);
  window.addEventListener("blur", resetClock);

  document.querySelectorAll(".touch-btn").forEach((btn) => {
    const action = btn.dataset.action;
    const setBow = (v) => {
      touchBow = v;
      btn.classList.toggle("active", v !== 0);
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (action === "bow-port") setBow(-1);
      if (action === "bow-starboard") setBow(1);
    });
    btn.addEventListener("pointerup", () => setBow(0));
    btn.addEventListener("pointerleave", () => setBow(0));
  });

  let rudderDrag = false;
  rudderWheel.addEventListener("pointerdown", (e) => {
    rudderDrag = true;
    rudderWheel.setPointerCapture(e.pointerId);
    updateRudderTouch(e);
  });
  rudderWheel.addEventListener("pointermove", (e) => {
    if (rudderDrag) updateRudderTouch(e);
  });
  rudderWheel.addEventListener("pointerup", (e) => {
    rudderDrag = false;
    if (rudderWheel.hasPointerCapture(e.pointerId)) rudderWheel.releasePointerCapture(e.pointerId);
  });
  rudderWheel.addEventListener("pointercancel", () => {
    rudderDrag = false;
  });

  function updateRudderTouch(e) {
    const rect = rudderWheel.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) + Math.PI / 2;
    touchRudder = clamp(angle, -MAX_RUDDER, MAX_RUDDER);
    const deg = (touchRudder / MAX_RUDDER) * 90;
    rudderKnob.style.transform = `rotate(${deg}deg)`;
  }

  let throttleDrag = false;
  throttleSlider.addEventListener("pointerdown", (e) => {
    throttleDrag = true;
    throttleSlider.setPointerCapture(e.pointerId);
    updateThrottleTouch(e);
  });
  throttleSlider.addEventListener("pointermove", (e) => {
    if (throttleDrag) updateThrottleTouch(e);
  });
  throttleSlider.addEventListener("pointerup", (e) => {
    throttleDrag = false;
    if (throttleSlider.hasPointerCapture(e.pointerId)) throttleSlider.releasePointerCapture(e.pointerId);
  });
  throttleSlider.addEventListener("pointercancel", () => {
    throttleDrag = false;
  });

  function updateThrottleTouch(e) {
    const track = throttleSlider.querySelector(".throttle-track");
    const rect = track.getBoundingClientRect();
    const t = 1 - clamp((e.clientY - rect.top) / rect.height, 0, 1);
    touchThrottle = t * 2 - 1;
    throttleThumb.style.top = `${(1 - (touchThrottle + 1) / 2) * 100}%`;
    throttleThumb.style.transform = "translateY(-50%)";
    throttleFill.style.height = `${((touchThrottle + 1) / 2) * 100}%`;
  }
}

window.addEventListener("resize", resize);
setupInput();
resize();
resetGame();
wakeParticles.length = WAKE_POOL_SIZE;
for (let i = 0; i < WAKE_POOL_SIZE; i++) wakeParticles[i] = { x: 0, y: 0, life: 0, size: 0 };
requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(loop);
});
