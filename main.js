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
let bubbles = [];
let caustics = [];

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

    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      onPointer(e.clientX, e.clientY, true);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.pointerActive) onPointer(e.clientX, e.clientY, true);
    });
    const endPointer = (e) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      this.pointerActive = false;
    };
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    window.addEventListener("deviceorientation", (e) => this.onOrientation(e));
  }

  async requestGyroPermission() {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") return false;
    }
    this.gyroActive = true;
    this.betaOffset = null;
    this.gammaOffset = null;
    return true;
  }

  onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    if (this.betaOffset == null) {
      this.betaOffset = e.beta;
      this.gammaOffset = e.gamma;
    }
    const beta = clamp(e.beta - this.betaOffset, -45, 45);
    const gamma = clamp(e.gamma - this.gammaOffset, -45, 45);
    this.gyroX = gamma / 45;
    this.gyroY = beta / 45;
    this.gyroActive = true;
  }

  getSteering() {
    let sx = 0;
    let sy = 0;

    if (this.gyroActive) {
      this.smoothGyroX = lerp(this.smoothGyroX, this.gyroX, 0.12);
      this.smoothGyroY = lerp(this.smoothGyroY, this.gyroY, 0.12);
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
      const maxDist = Math.min(width, height) * 0.35;
      const strength = clamp(len / maxDist, 0, 1);
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
  }

  get radius() {
    return 14 * this.size;
  }

  getSpeed() {
    if (this.isPlayer) return isPlayerSpeed(this);
    return this.maxSpeedOverride ?? aiMaxSpeed(this.size);
  }

  update(dt, input, player, allFish) {
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

    const friction = 0.92;
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
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyLen * 0.58, bodyH * 1.05, 0, 0, Math.PI * 2);
      ctx.stroke();
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

function spawnPointOffscreen(camX, camY, margin = 120) {
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
  };
}

function randomFishSize() {
  const roll = Math.random();
  if (roll < 0.45) return randomRange(0.5, 0.9);
  if (roll < 0.8) return randomRange(0.9, 1.5);
  if (roll < 0.95) return randomRange(1.5, 2.4);
  return randomRange(2.4, 3.5);
}

function createAIFish(camX, camY, sizeOverride) {
  const size = sizeOverride ?? randomFishSize();
  const pos = spawnPointOffscreen(camX, camY);
  const fish = new Fish({
    x: pos.x,
    y: pos.y,
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
  const start = randomWorldPoint(200);
  player = new Fish({
    x: start.x,
    y: start.y,
    size: 1,
    color: "#3ecf6e",
    isPlayer: true,
  });
  aiFish = [];
  for (let i = 0; i < TARGET_FISH; i += 1) {
    aiFish.push(createAIFish(player.x, player.y));
  }
  updateHUD();
}

function updateHUD() {
  scoreLabel.textContent = `Score: ${score}`;
  sizeLabel.textContent = `Size: ${player.size.toFixed(1)}`;
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
  if (state === "start") showOverlay(startScreen);
  else if (state === "playing") showOverlay(hud);
  else if (state === "gameover") showOverlay(gameoverScreen);
}

function maintainPopulation(camX, camY) {
  const despawnDist = Math.max(width, height) * 0.9;
  aiFish = aiFish.filter((f) => dist(f.x, f.y, camX, camY) < despawnDist + 200);

  while (aiFish.length < TARGET_FISH) {
    aiFish.push(createAIFish(camX, camY));
  }
}

function handleCollisions() {
  for (let i = aiFish.length - 1; i >= 0; i -= 1) {
    const fish = aiFish[i];
    if (!player.overlaps(fish)) continue;

    if (player.canEat(fish)) {
      score += 1;
      player.size = clamp(player.size + fish.size * 0.08, 1, MAX_PLAYER_SIZE);
      aiFish.splice(i, 1);
      aiFish.push(createAIFish(player.x, player.y, randomRange(0.5, Math.min(player.size * 0.85, 2.5))));
      updateHUD();
    } else if (fish.canEat(player)) {
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

    handleCollisions();
    if (gameState === "playing") {
      maintainPopulation(camX, camY);
    }

    drawBackground(time, camX, camY);
    drawWorldBounds(camX, camY);

    const sorted = [...aiFish].sort((a, b) => a.size - b.size);
    sorted.forEach((f) => f.draw(ctx, camX, camY));
    player.draw(ctx, camX, camY);
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
  await input.requestGyroPermission();
  resetGame();
  setState("playing");
});

restartBtn.addEventListener("click", () => {
  resetGame();
  setState("playing");
});

window.addEventListener("resize", () => {
  resize();
  initBubbles();
});

resize();
initBubbles();
initCaustics();
resetGame();
setState("start");
requestAnimationFrame(animate);
