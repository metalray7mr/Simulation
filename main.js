const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const gameoverScreen = document.getElementById("gameover-screen");
const hud = document.getElementById("hud");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const scoreLabel = document.getElementById("score-label");
const sizeLabel = document.getElementById("size-label");
const finalScoreLabel = document.getElementById("final-score");
const controlHint = document.getElementById("control-hint");
const app = document.getElementById("app");
const minimapCanvas = document.getElementById("minimap");
const minimapCtx = minimapCanvas.getContext("2d");
const playersLabel = document.getElementById("players-label");
const mpStatus = document.getElementById("mp-status");
const playerNameInput = document.getElementById("player-name");

function getWebSocketUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("ws")) return params.get("ws");
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "ws://localhost:3001";
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${host}:3001`;
}

const WS_URL = getWebSocketUrl();

const WORLD_W = 3200;
const WORLD_H = 2400;
const EAT_RATIO = 1.05;
const TARGET_FISH = 20;
const MAX_PLAYER_SIZE = 4.5;

const FISH_COLORS = [
  "#3ecf6e",
  "#4da3ff",
  "#f59e42",
  "#e85d8f",
  "#a78bfa",
  "#fbbf24",
  "#34d399",
  "#fb7185",
];

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;
let gameState = "start";
let score = 0;
let invincibleUntil = 0;
let bubbles = [];
let caustics = [];
let remotePlayers = [];
let lastNetSend = 0;

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

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const mix = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const nr = Math.round(lerp(r, mix, t));
  const ng = Math.round(lerp(g, mix, t));
  const nb = Math.round(lerp(b, mix, t));
  return `rgb(${nr}, ${ng}, ${nb})`;
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
}

class InputManager {
  constructor() {
    this.keys = new Set();
    this.pointerActive = false;
    this.pointerX = 0;
    this.pointerY = 0;
    this.gyroActive = false;
    this.gyroX = 0;
    this.gyroY = 0;
    this.smoothGyroX = 0;
    this.smoothGyroY = 0;
    this.betaOffset = null;
    this.gammaOffset = null;
    this.motionOffsetX = null;
    this.motionOffsetY = null;
    this.useMotion = false;

    window.addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));

    const onPointer = (x, y, active) => {
      this.pointerX = x;
      this.pointerY = y;
      this.pointerActive = active;
    };

    const bindPointer = (target) => {
      target.addEventListener("pointerdown", (e) => {
        if (gameState !== "playing") return;
        target.setPointerCapture(e.pointerId);
        onPointer(e.clientX, e.clientY, true);
      });
      target.addEventListener("pointermove", (e) => {
        if (this.pointerActive) onPointer(e.clientX, e.clientY, true);
      });
      const endPointer = (e) => {
        if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
        this.pointerActive = false;
      };
      target.addEventListener("pointerup", endPointer);
      target.addEventListener("pointercancel", endPointer);
    };

    bindPointer(canvas);
    bindPointer(app);

    window.addEventListener("deviceorientation", (e) => this.onOrientation(e));
    window.addEventListener("devicemotion", (e) => this.onMotion(e));
  }

  async requestGyroPermission() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") return false;
      }
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        const result = await DeviceMotionEvent.requestPermission();
        if (result !== "granted") return false;
      }
    } catch (err) {
      console.warn("Motion permission error:", err);
      return false;
    }
    this.gyroActive = true;
    this.betaOffset = null;
    this.gammaOffset = null;
    this.motionOffsetX = null;
    this.motionOffsetY = null;
    return true;
  }

  onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    if (this.betaOffset == null) {
      this.betaOffset = e.beta;
      this.gammaOffset = e.gamma;
    }
    const beta = clamp(e.beta - this.betaOffset, -40, 40);
    const gamma = clamp(e.gamma - this.gammaOffset, -40, 40);
    this.gyroX = gamma / 40;
    this.gyroY = beta / 40;
    this.gyroActive = true;
    this.useMotion = false;
  }

  onMotion(e) {
    const accel = e.accelerationIncludingGravity;
    if (!accel || accel.x == null || accel.y == null) return;
    if (this.motionOffsetX == null) {
      this.motionOffsetX = accel.x;
      this.motionOffsetY = accel.y;
    }
    const tiltX = clamp(accel.x - this.motionOffsetX, -5, 5);
    const tiltY = clamp(accel.y - this.motionOffsetY, -5, 5);
    this.gyroX = tiltX / 5;
    this.gyroY = tiltY / 5;
    this.gyroActive = true;
    this.useMotion = true;
  }

  getSteering() {
    let sx = 0;
    let sy = 0;

    if (this.gyroActive) {
      this.smoothGyroX = lerp(this.smoothGyroX, this.gyroX, this.useMotion ? 0.18 : 0.14);
      this.smoothGyroY = lerp(this.smoothGyroY, this.gyroY, this.useMotion ? 0.18 : 0.14);
      sx += this.smoothGyroX;
      sy += this.smoothGyroY;
    }

    if (this.keys.has("arrowleft") || this.keys.has("a")) sx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) sx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) sy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) sy += 1;

    if (this.pointerActive) {
      const cx = width / 2;
      const cy = height / 2;
      const dx = this.pointerX - cx;
      const dy = this.pointerY - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const minDist = 18;
      const strength = len < minDist ? 0.35 : clamp(len / (Math.min(width, height) * 0.4), 0.35, 1);
      sx += (dx / len) * strength;
      sy += (dy / len) * strength;
    }

    const mag = Math.sqrt(sx * sx + sy * sy);
    if (mag > 1) {
      sx /= mag;
      sy /= mag;
    }
    return { x: sx, y: sy };
  }
}

class Fish {
  constructor({ x, y, size, color, isPlayer = false }) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color;
    this.isPlayer = isPlayer;
    this.vx = 0;
    this.vy = 0;
    this.heading = randomRange(0, Math.PI * 2);
    this.wanderAngle = randomRange(0, Math.PI * 2);
    this.wiggle = randomRange(0, Math.PI * 2);
    this.isRemote = false;
    this.remoteId = null;
    this.name = "";
    this.alive = true;
    this.targetX = x;
    this.targetY = y;
    this.targetHeading = this.heading;
    this.targetSize = size;
  }

  get radius() {
    return 14 * this.size;
  }

  getSpeed() {
    if (this.isPlayer) return isPlayerSpeed(this);
    return this.maxSpeedOverride ?? aiMaxSpeed(this.size);
  }

  update(dt, input, player, allFish) {
    if (this.isRemote) {
      this.x = lerp(this.x, this.targetX, 0.22);
      this.y = lerp(this.y, this.targetY, 0.22);
      this.size = lerp(this.size, this.targetSize, 0.15);
      this.heading = lerp(this.heading, this.targetHeading, 0.18);
      this.wiggle += dt * 6;
      return;
    }
    if (this.isPlayer) {
      this.updatePlayer(dt, input);
    } else {
      this.updateAI(dt, player, allFish);
    }
    this.applyBounds();
    this.wiggle += dt * 6;
  }

  updatePlayer(dt, input) {
    const steer = input.getSteering();
    const accel = 220;
    const maxSpd = this.getSpeed();

    this.vx += steer.x * accel * dt;
    this.vy += steer.y * accel * dt;

    const friction = 0.96;
    this.vx *= friction;
    this.vy *= friction;

    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > maxSpd) {
      this.vx = (this.vx / spd) * maxSpd;
      this.vy = (this.vy / spd) * maxSpd;
    }

    if (spd > 8) {
      this.heading = Math.atan2(this.vy, this.vx);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  updateAI(dt, player, allFish) {
    const wanderForce = 40;
    this.wanderAngle += randomRange(-1.2, 1.2) * dt;

    let ax = Math.cos(this.wanderAngle) * wanderForce;
    let ay = Math.sin(this.wanderAngle) * wanderForce;

    if (player) {
      const d = dist(this.x, this.y, player.x, player.y);
      if (player.size > this.size * EAT_RATIO && d < 220) {
        const fleeX = this.x - player.x;
        const fleeY = this.y - player.y;
        const fleeLen = Math.sqrt(fleeX * fleeX + fleeY * fleeY) || 1;
        const fleeStrength = (220 - d) / 220;
        ax += (fleeX / fleeLen) * 180 * fleeStrength;
        ay += (fleeY / fleeLen) * 180 * fleeStrength;
      } else if (this.size > player.size * EAT_RATIO && d < 160 && d > 30) {
        const chaseX = player.x - this.x;
        const chaseY = player.y - this.y;
        const chaseLen = Math.sqrt(chaseX * chaseX + chaseY * chaseY) || 1;
        ax += (chaseX / chaseLen) * 90;
        ay += (chaseY / chaseLen) * 90;
      }
    }

    for (const other of allFish) {
      if (other === this) continue;
      const d = dist(this.x, this.y, other.x, other.y);
      const minSep = this.radius + other.radius;
      if (d < minSep && d > 0) {
        const pushX = (this.x - other.x) / d;
        const pushY = (this.y - other.y) / d;
        const push = (minSep - d) / minSep;
        ax += pushX * 120 * push;
        ay += pushY * 120 * push;
      }
    }

    this.vx += ax * dt;
    this.vy += ay * dt;

    const friction = 0.96;
    this.vx *= friction;
    this.vy *= friction;

    const maxSpd = this.getSpeed();
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > maxSpd) {
      this.vx = (this.vx / spd) * maxSpd;
      this.vy = (this.vy / spd) * maxSpd;
    } else if (spd < maxSpd * 0.35) {
      this.vx += Math.cos(this.wanderAngle) * maxSpd * 0.4 * dt;
      this.vy += Math.sin(this.wanderAngle) * maxSpd * 0.4 * dt;
    }

    if (spd > 5) {
      this.heading = Math.atan2(this.vy, this.vx);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  applyBounds() {
    const pad = this.radius;
    if (this.x < pad) {
      this.x = pad;
      this.vx = Math.abs(this.vx) * 0.5;
    }
    if (this.x > WORLD_W - pad) {
      this.x = WORLD_W - pad;
      this.vx = -Math.abs(this.vx) * 0.5;
    }
    if (this.y < pad) {
      this.y = pad;
      this.vy = Math.abs(this.vy) * 0.5;
    }
    if (this.y > WORLD_H - pad) {
      this.y = WORLD_H - pad;
      this.vy = -Math.abs(this.vy) * 0.5;
    }
  }

  overlaps(other) {
    const d = dist(this.x, this.y, other.x, other.y);
    return d < this.radius + other.radius * 0.85;
  }

  canEat(other) {
    return this.size > other.size * EAT_RATIO;
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX + width / 2;
    const sy = this.y - camY + height / 2;

    if (sx < -80 || sx > width + 80 || sy < -80 || sy > height + 80) return;

    const r = this.radius;
    const tailWag = Math.sin(this.wiggle) * 0.15;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.heading);

    const bodyLen = r * 2.1;
    const bodyH = r * 0.9;

    ctx.fillStyle = shade(this.color, -0.3);
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.55, 0);
    ctx.lineTo(-bodyLen * 0.85, -bodyH * 0.7 + tailWag * r);
    ctx.lineTo(-bodyLen, 0);
    ctx.lineTo(-bodyLen * 0.85, bodyH * 0.7 - tailWag * r);
    ctx.closePath();
    ctx.fill();

    const grad = ctx.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, shade(this.color, -0.2));
    grad.addColorStop(0.5, this.color);
    grad.addColorStop(1, shade(this.color, 0.2));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen * 0.55, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = shade(this.color, 0.35);
    ctx.beginPath();
    ctx.ellipse(r * 0.1, bodyH * 0.25, bodyLen * 0.35, bodyH * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(bodyLen * 0.28, -bodyH * 0.18, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0a1628";
    ctx.beginPath();
    ctx.arc(bodyLen * 0.32, -bodyH * 0.18, r * 0.09, 0, Math.PI * 2);
    ctx.fill();

    if (this.isPlayer) {
      const invincible = performance.now() < invincibleUntil;
      ctx.strokeStyle = invincible ? "rgba(94, 234, 212, 0.75)" : "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = invincible ? 3 : 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyLen * 0.58, bodyH * 1.05, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.isRemote && this.name) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = `${Math.max(9, r * 0.45)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(this.name, 0, -bodyH - 6);
    }

    ctx.restore();
  }
}

function isPlayerSpeed(fish) {
  return lerp(90, 130, clamp((fish.size - 1) / (MAX_PLAYER_SIZE - 1), 0, 1));
}

function aiMaxSpeed(size) {
  return lerp(55, 100, clamp(size / 3, 0, 1));
}

function pickFishColor() {
  return FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];
}

function randomWorldPoint(margin = 80) {
  return {
    x: randomRange(margin, WORLD_W - margin),
    y: randomRange(margin, WORLD_H - margin),
  };
}

function spawnPointOffscreen(camX, camY, margin = 120, minSize = 0, maxSize = Infinity) {
  const side = Math.floor(Math.random() * 4);
  const viewPad = 80;
  let x;
  let y;
  if (side === 0) {
    x = camX - width / 2 - margin;
    y = randomRange(camY - height / 2 - viewPad, camY + height / 2 + viewPad);
  } else if (side === 1) {
    x = camX + width / 2 + margin;
    y = randomRange(camY - height / 2 - viewPad, camY + height / 2 + viewPad);
  } else if (side === 2) {
    x = randomRange(camX - width / 2 - viewPad, camX + width / 2 + viewPad);
    y = camY - height / 2 - margin;
  } else {
    x = randomRange(camX - width / 2 - viewPad, camX + width / 2 + viewPad);
    y = camY + height / 2 + margin;
  }
  return {
    x: clamp(x, 60, WORLD_W - 60),
    y: clamp(y, 60, WORLD_H - 60),
    size: clamp(randomFishSize(), minSize, maxSize),
  };
}

function randomFishSize() {
  const roll = Math.random();
  if (roll < 0.45) return randomRange(0.5, 0.9);
  if (roll < 0.8) return randomRange(0.9, 1.5);
  if (roll < 0.95) return randomRange(1.5, 2.4);
  return randomRange(2.4, 3.5);
}

function createAIFish(camX, camY, sizeOverride, options = {}) {
  const { margin = 120, minSize = 0, maxSize = Infinity } = options;
  const spawn = spawnPointOffscreen(camX, camY, margin, minSize, maxSize);
  const size = sizeOverride ?? spawn.size;
  const fish = new Fish({
    x: spawn.x,
    y: spawn.y,
    size,
    color: pickFishColor(),
    isPlayer: false,
  });
  fish.maxSpeedOverride = aiMaxSpeed(size);
  return fish;
}

const input = new InputManager();
let player = null;
let aiFish = [];

class MultiplayerClient {
  constructor() {
    this.ws = null;
    this.id = null;
    this.connected = false;
    this.playerCount = 1;
    this.reconnectDelay = 1500;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(WS_URL);
    } catch (err) {
      this.setStatus("Multiplayer offline (solo mode)");
      return;
    }

    this.setStatus("Connecting to server...");

    this.ws.addEventListener("open", () => {
      this.connected = true;
      this.setStatus("Multiplayer connected");
    });

    this.ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handleMessage(msg);
    });

    this.ws.addEventListener("close", () => {
      this.connected = false;
      this.id = null;
      remotePlayers = [];
      this.playerCount = 1;
      updateHUD();
      this.setStatus("Multiplayer offline (solo mode)");
      setTimeout(() => this.connect(), this.reconnectDelay);
    });

    this.ws.addEventListener("error", () => {
      this.setStatus("Multiplayer offline (solo mode)");
    });
  }

  setStatus(text) {
    if (mpStatus) mpStatus.textContent = text;
  }

  handleMessage(msg) {
    if (msg.type === "welcome") {
      this.id = msg.id;
      this.syncPlayers(msg.players || []);
      return;
    }
    if (msg.type === "players") {
      this.syncPlayers(msg.players || []);
      return;
    }
    if (msg.type === "playerEaten") {
      if (msg.targetId === this.id && gameState === "playing") {
        finalScoreLabel.textContent = `Score: ${score}`;
        setState("gameover");
      }
      if (msg.eater && msg.eater.id === this.id && player) {
        player.size = clamp(msg.eater.size, 1, MAX_PLAYER_SIZE);
        score = msg.eater.score;
        updateHUD();
      }
      if (msg.players) {
        this.syncPlayers(msg.players);
      } else {
        remotePlayers = remotePlayers.filter((f) => f.remoteId !== msg.targetId);
      }
    }
  }

  syncPlayers(list) {
    const alive = list.filter((p) => p.id !== this.id && p.alive);
    this.playerCount = list.filter((p) => p.alive).length;

    const existing = new Map(remotePlayers.map((f) => [f.remoteId, f]));
    remotePlayers = alive.map((data) => {
      let fish = existing.get(data.id);
      if (!fish) {
        fish = new Fish({
          x: data.x,
          y: data.y,
          size: data.size,
          color: data.color,
          isPlayer: false,
        });
        fish.isRemote = true;
        fish.remoteId = data.id;
        fish.name = data.name || "";
      }
      fish.targetX = data.x;
      fish.targetY = data.y;
      fish.targetSize = data.size;
      fish.targetHeading = data.heading || 0;
      fish.color = data.color;
      fish.name = data.name || fish.name;
      fish.alive = true;
      return fish;
    });
    updateHUD();
  }

  send(type, payload = {}) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  sendPlayerUpdate(now) {
    if (!player || gameState !== "playing" || now - lastNetSend < 80) return;
    lastNetSend = now;
    this.send("update", {
      state: {
        x: player.x,
        y: player.y,
        size: player.size,
        heading: player.heading,
        score,
        name: getPlayerName(),
      },
    });
  }

  notifyDeath() {
    this.send("died");
  }

  notifyRespawn() {
    if (!player) return;
    this.send("respawn", {
      state: { x: player.x, y: player.y },
    });
    this.send("update", {
      state: {
        x: player.x,
        y: player.y,
        size: player.size,
        heading: player.heading,
        score,
        name: getPlayerName(),
      },
    });
  }

  tryEatPlayer(targetId) {
    this.send("eatPlayer", { targetId });
  }
}

const multiplayer = new MultiplayerClient();

function getPlayerName() {
  const name = playerNameInput?.value?.trim();
  return name || "Fish";
}

function drawMinimap(camX, camY) {
  const size = 112;
  const radius = 46;
  const cx = size / 2;
  const cy = size / 2;
  const scale = (radius * 1.85) / Math.max(WORLD_W, WORLD_H);

  minimapCtx.clearRect(0, 0, size, size);

  minimapCtx.save();
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  minimapCtx.clip();

  const ocean = minimapCtx.createRadialGradient(cx, cy, 4, cx, cy, radius);
  ocean.addColorStop(0, "#134e7a");
  ocean.addColorStop(1, "#071521");
  minimapCtx.fillStyle = ocean;
  minimapCtx.fillRect(0, 0, size, size);

  const worldLeft = cx - (WORLD_W / 2) * scale;
  const worldTop = cy - (WORLD_H / 2) * scale;
  minimapCtx.strokeStyle = "rgba(140, 200, 240, 0.35)";
  minimapCtx.lineWidth = 1.5;
  minimapCtx.strokeRect(worldLeft, worldTop, WORLD_W * scale, WORLD_H * scale);

  const drawDot = (wx, wy, dotRadius, color, alpha = 1) => {
    const mx = cx + (wx - WORLD_W / 2) * scale;
    const my = cy + (wy - WORLD_H / 2) * scale;
    minimapCtx.globalAlpha = alpha;
    minimapCtx.fillStyle = color;
    minimapCtx.beginPath();
    minimapCtx.arc(mx, my, dotRadius, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.globalAlpha = 1;
  };

  aiFish.forEach((fish) => {
    drawDot(fish.x, fish.y, Math.max(1.2, fish.size * 1.1), fish.color, 0.55);
  });

  remotePlayers.forEach((fish) => {
    drawDot(fish.x, fish.y, Math.max(2, fish.size * 1.6), fish.color, 0.95);
  });

  if (player) {
    drawDot(player.x, player.y, Math.max(2.4, player.size * 1.8), "#5eead4", 1);
  }

  const viewW = width * scale;
  const viewH = height * scale;
  const viewX = cx + (camX - WORLD_W / 2) * scale - viewW / 2;
  const viewY = cy + (camY - WORLD_H / 2) * scale - viewH / 2;
  minimapCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  minimapCtx.lineWidth = 1.25;
  minimapCtx.strokeRect(viewX, viewY, viewW, viewH);

  minimapCtx.restore();

  minimapCtx.strokeStyle = "rgba(180, 230, 255, 0.85)";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  minimapCtx.stroke();
}

function initBubbles() {
  bubbles = [];
  const count = width < 768 ? 28 : 44;
  for (let i = 0; i < count; i += 1) {
    bubbles.push({
      x: randomRange(0, WORLD_W),
      y: randomRange(0, WORLD_H),
      r: randomRange(1.5, 5),
      speed: randomRange(12, 28),
      wobble: randomRange(0, Math.PI * 2),
      alpha: randomRange(0.04, 0.14),
    });
  }
}

function initCaustics() {
  caustics = [];
  for (let i = 0; i < 5; i += 1) {
    caustics.push({ offset: randomRange(0, Math.PI * 2), speed: randomRange(0.2, 0.5) });
  }
}

function resetGame() {
  score = 0;
  invincibleUntil = performance.now() + 3000;
  const start = randomWorldPoint(200);
  player = new Fish({
    x: start.x,
    y: start.y,
    size: 1,
    color: "#3ecf6e",
    isPlayer: true,
  });
  aiFish = [];
  for (let i = 0; i < 12; i += 1) {
    aiFish.push(createAIFish(player.x, player.y, randomRange(0.45, 0.85)));
  }
  for (let i = 0; i < 8; i += 1) {
    aiFish.push(createAIFish(player.x, player.y, undefined, { margin: 220, maxSize: 1.4 }));
  }
  updateHUD();
}

function updateHUD() {
  scoreLabel.textContent = `Score: ${score}`;
  sizeLabel.textContent = `Size: ${player.size.toFixed(1)}`;
  playersLabel.textContent = `Players: ${multiplayer.playerCount}`;
}

function showOverlay(overlay) {
  [startScreen, hud, gameoverScreen].forEach((el) => {
    const show = el === overlay;
    el.classList.toggle("hidden", !show);
    el.setAttribute("aria-hidden", show ? "false" : "true");
  });
}

function setState(state) {
  gameState = state;
  if (state === "start") {
    showOverlay(startScreen);
    minimapCanvas.classList.add("hidden");
  } else if (state === "playing") {
    showOverlay(hud);
    minimapCanvas.classList.remove("hidden");
  } else if (state === "gameover") {
    showOverlay(gameoverScreen);
    minimapCanvas.classList.add("hidden");
    multiplayer.notifyDeath();
  }
}

function maintainPopulation(camX, camY) {
  const despawnDist = Math.max(width, height) * 0.9;
  aiFish = aiFish.filter((f) => dist(f.x, f.y, camX, camY) < despawnDist + 200);

  while (aiFish.length < TARGET_FISH) {
    const far = aiFish.length > 14;
    aiFish.push(
      createAIFish(camX, camY, undefined, {
        margin: far ? 220 : 140,
        maxSize: far ? 3.5 : 1.8,
      }),
    );
  }
}

function handleCollisions(now) {
  const invincible = now < invincibleUntil;
  for (let i = aiFish.length - 1; i >= 0; i -= 1) {
    const fish = aiFish[i];
    if (!player.overlaps(fish)) continue;

    if (player.canEat(fish)) {
      score += 1;
      player.size = clamp(player.size + fish.size * 0.08, 1, MAX_PLAYER_SIZE);
      aiFish.splice(i, 1);
      aiFish.push(createAIFish(player.x, player.y, randomRange(0.5, Math.min(player.size * 0.85, 2.5))));
      updateHUD();
    } else if (!invincible && fish.canEat(player)) {
      finalScoreLabel.textContent = `Score: ${score}`;
      setState("gameover");
      return;
    }
  }

  for (const remote of remotePlayers) {
    if (!remote.alive) continue;
    if (!player.overlaps(remote)) continue;

    if (player.canEat(remote)) {
      multiplayer.tryEatPlayer(remote.remoteId);
      score += 2;
      player.size = clamp(player.size + remote.size * 0.12, 1, MAX_PLAYER_SIZE);
      remote.alive = false;
      updateHUD();
    } else if (!invincible && remote.canEat(player)) {
      finalScoreLabel.textContent = `Score: ${score}`;
      setState("gameover");
      return;
    }
  }
}

function drawBackground(time, camX, camY) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#103a5e");
  g.addColorStop(0.55, "#0a2238");
  g.addColorStop(1, "#050d14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#9fdfff";
  caustics.forEach((c, i) => {
    const y = height * (0.12 + i * 0.15) + Math.sin(time * c.speed + c.offset) * 10;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 30) {
      const wave = Math.sin(x * 0.012 + time * 0.7 + c.offset) * 16;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();

  bubbles.forEach((b) => {
    b.y -= b.speed * 0.016;
    b.x += Math.sin(time * 0.75 + b.wobble) * 0.4;
    if (b.y < 0) {
      b.y = WORLD_H;
      b.x = randomRange(0, WORLD_W);
    }

    const sx = b.x - camX + width / 2;
    const sy = b.y - camY + height / 2;
    if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) return;

    ctx.fillStyle = `rgba(220, 245, 255, ${b.alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, b.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawWorldBounds(camX, camY) {
  const left = 0 - camX + width / 2;
  const top = 0 - camY + height / 2;
  ctx.strokeStyle = "rgba(140, 200, 240, 0.12)";
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, WORLD_W, WORLD_H);
}

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const time = now / 1000;

  if (gameState === "playing" && player) {
    player.update(dt, input, player, aiFish);
    aiFish.forEach((f) => f.update(dt, input, player, aiFish));

    const camX = clamp(player.x, width / 2, WORLD_W - width / 2);
    const camY = clamp(player.y, height / 2, WORLD_H - height / 2);

    handleCollisions(now);
    if (gameState === "playing") {
      maintainPopulation(camX, camY);
    }

    drawBackground(time, camX, camY);
    drawWorldBounds(camX, camY);

    const sorted = [...aiFish].sort((a, b) => a.size - b.size);
    sorted.forEach((f) => f.draw(ctx, camX, camY));
    remotePlayers.forEach((f) => {
      f.update(dt, input, player, aiFish);
      f.draw(ctx, camX, camY);
    });
    player.draw(ctx, camX, camY);
    drawMinimap(camX, camY);
    multiplayer.sendPlayerUpdate(now);
  } else {
    drawBackground(time, WORLD_W / 2, WORLD_H / 2);
    if (player) {
      const camX = player.x;
      const camY = player.y;
      aiFish.forEach((f) => f.draw(ctx, camX, camY));
      player.draw(ctx, camX, camY);
    }
  }

  requestAnimationFrame(animate);
}

startBtn.addEventListener("click", async () => {
  try {
    await input.requestGyroPermission();
  } catch (err) {
    console.warn("Could not enable motion controls:", err);
  }
  resetGame();
  multiplayer.notifyRespawn();
  setState("playing");
});

restartBtn.addEventListener("click", async () => {
  try {
    if (!input.gyroActive) await input.requestGyroPermission();
  } catch (err) {
    console.warn("Could not enable motion controls:", err);
  }
  resetGame();
  multiplayer.notifyRespawn();
  setState("playing");
});

window.addEventListener("resize", () => {
  resize();
  initBubbles();
});

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    resize();
    initBubbles();
  }, 100);
});

resize();
initBubbles();
initCaustics();
resetGame();
setState("start");
minimapCanvas.classList.add("hidden");
multiplayer.connect();
requestAnimationFrame(animate);
