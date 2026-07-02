const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let dpr = 1;
const bubbles = [];
const caustics = [];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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

function getBounds() {
  return { x: width * 0.42, y: height * 0.38 };
}

class Fish {
  constructor({ color, label, x, y }) {
    this.color = color;
    this.dark = shade(color, -0.35);
    this.light = shade(color, 0.28);
    this.belly = shade(color, 0.45);
    this.label = label;

    this.segmentCount = 18;
    this.segmentSpacing = width < 768 ? 5.4 : 6.4;
    this.spine = [];
    for (let i = 0; i < this.segmentCount; i += 1) {
      this.spine.push({ x, y });
    }

    this.vx = randomRange(-30, 30);
    this.vy = randomRange(-15, 15);
    this.ax = 0;
    this.ay = 0;

    this.maxSpeed = randomRange(88, 115);
    this.cruiseSpeed = randomRange(38, 52);
    this.maxForce = randomRange(140, 190);
    this.maxTurnRate = randomRange(2.8, 3.8);

    this.heading = Math.atan2(this.vy, this.vx);
    this.targetX = x;
    this.targetY = y;
    this.pickNewTarget();

    this.tailPhase = Math.random() * Math.PI * 2;
    this.finPhase = Math.random() * Math.PI * 2;
    this.gillPhase = Math.random() * Math.PI * 2;
    this.restTimer = randomRange(0, 2);
    this.burstTimer = randomRange(4, 9);
    this.dartTimer = 0;
    this.state = "cruise";
    this.size = width < 768 ? 1.65 : 2.05;

    this.personality = {
      curiosity: randomRange(0.35, 0.9),
      shyness: randomRange(0.25, 0.75),
      boldness: randomRange(0.2, 0.6),
    };
  }

  get head() {
    return this.spine[0];
  }

  pickNewTarget() {
    const b = getBounds();
    this.targetX = randomRange(-b.x * 0.85, b.x * 0.85);
    this.targetY = randomRange(-b.y * 0.85, b.y * 0.85);
    this.restTimer = 0;
    this.state = "cruise";
  }

  startle(fromX, fromY) {
    if (this.dartTimer > 0) return;
    this.state = "dart";
    this.dartTimer = randomRange(0.35, 0.7);
    const dx = this.head.x - fromX;
    const dy = this.head.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    this.vx = (dx / dist) * this.maxSpeed * 1.35;
    this.vy = (dy / dist) * this.maxSpeed * 1.35;
    this.targetX = this.head.x + (dx / dist) * 180;
    this.targetY = this.head.y + (dy / dist) * 180;
  }

  seek(tx, ty, weight = 1) {
    let dx = tx - this.head.x;
    let dy = ty - this.head.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return { x: 0, y: 0 };

    dx /= dist;
    dy /= dist;

    let desired = this.state === "dart" ? this.maxSpeed * 1.2 : this.maxSpeed;
    if (this.state === "hover") desired = 8;
    else if (dist < 130) desired = (dist / 130) * this.maxSpeed;

    const sx = dx * desired - this.vx;
    const sy = dy * desired - this.vy;
    const mag = Math.hypot(sx, sy);
    const limit = this.maxForce * weight;
    if (mag > limit) return { x: (sx / mag) * limit, y: (sy / mag) * limit };
    return { x: sx, y: sy };
  }

  wander(dt) {
    this.wanderAngle = (this.wanderAngle || Math.random() * Math.PI * 2) + randomRange(-0.7, 0.7) * dt;
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const wx = this.head.x + (this.vx / speed) * 70 + Math.cos(this.wanderAngle) * 55;
    const wy = this.head.y + (this.vy / speed) * 70 + Math.sin(this.wanderAngle) * 55;
    return this.seek(wx, wy, 0.28);
  }

  avoidWalls() {
    const b = getBounds();
    const margin = 80;
    const strength = 220;
    let fx = 0;
    let fy = 0;
    if (this.head.x < -b.x + margin) fx += strength;
    if (this.head.x > b.x - margin) fx -= strength;
    if (this.head.y < -b.y + margin) fy += strength;
    if (this.head.y > b.y - margin) fy -= strength;
    return { x: fx, y: fy };
  }

  interact(other, dt) {
    const dx = this.head.x - other.head.x;
    const dy = this.head.y - other.head.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return { x: 0, y: 0 };

    const nx = dx / dist;
    const ny = dy / dist;
    let fx = 0;
    let fy = 0;

    const relVx = other.vx - this.vx;
    const relVy = other.vy - this.vy;
    const approach = -(relVx * nx + relVy * ny);

    if (dist < 48 && approach > 40) {
      this.startle(other.head.x, other.head.y);
    }

    if (dist < 62) {
      const push = ((62 - dist) / 62) * 5.5 * this.personality.shyness;
      fx += nx * push;
      fy += ny * push;
    } else if (dist > 160 && dist < 260 && this.state === "cruise") {
      const align = 0.12 * this.personality.curiosity;
      fx += other.vx * align;
      fy += other.vy * align;
      fx += (other.head.x - this.head.x) * 0.004 * this.personality.curiosity;
      fy += (other.head.y - this.head.y) * 0.004 * this.personality.curiosity;
    }

    return { x: fx, y: fy };
  }

  updateSpine(dt) {
    const speed = Math.hypot(this.vx, this.vy);
    const waveAmp = this.state === "hover" ? 0.08 : 0.14 + speed * 0.0018;
    const waveFreq = this.state === "hover" ? 2.2 : 4.5 + speed * 0.04;
    this.tailPhase += dt * waveFreq;

    this.head.x += this.vx * dt;
    this.head.y += this.vy * dt;

    for (let i = 1; i < this.spine.length; i += 1) {
      const prev = this.spine[i - 1];
      const seg = this.spine[i];
      const dx = prev.x - seg.x;
      const dy = prev.y - seg.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const t = clamp(dist / this.segmentSpacing, 0, 1);
      const follow = 0.22 + (i / this.spine.length) * 0.18;

      let tx = prev.x - (dx / dist) * this.segmentSpacing;
      let ty = prev.y - (dy / dist) * this.segmentSpacing;

      const wave = Math.sin(this.tailPhase - i * 0.55) * waveAmp * i * this.segmentSpacing;
      const angle = Math.atan2(dy, dx);
      tx += Math.cos(angle + Math.PI / 2) * wave;
      ty += Math.sin(angle + Math.PI / 2) * wave;

      seg.x = lerp(seg.x, tx, follow + (1 - t) * 0.2);
      seg.y = lerp(seg.y, ty, follow + (1 - t) * 0.2);
    }
  }

  update(dt, other, time) {
    const b = getBounds();
    const toTarget = Math.hypot(this.targetX - this.head.x, this.targetY - this.head.y);

    this.dartTimer = Math.max(0, this.dartTimer - dt);
    if (this.dartTimer <= 0 && this.state === "dart") {
      this.state = "cruise";
    }

    if (toTarget < 35 && this.state === "cruise") {
      this.restTimer += dt;
      if (this.restTimer > randomRange(0.8, 2.2)) {
        if (Math.random() < 0.45) {
          this.state = "hover";
          this.restTimer = 0;
          this.hoverDuration = randomRange(1.2, 2.8);
        } else {
          this.pickNewTarget();
        }
      }
    }

    if (this.state === "hover") {
      this.restTimer += dt;
      if (this.restTimer > this.hoverDuration) {
        this.pickNewTarget();
      }
    }

    this.burstTimer -= dt;
    if (this.burstTimer <= 0 && this.state === "cruise") {
      this.burstTimer = randomRange(5, 11);
      this.pickNewTarget();
    }

    const seeking = this.seek(this.targetX, this.targetY, this.state === "hover" ? 0.4 : 1);
    const wandering = this.state === "cruise" ? this.wander(dt) : { x: 0, y: 0 };
    const walls = this.avoidWalls();
    const social = this.interact(other, dt);

    this.ax = seeking.x + wandering.x + walls.x + social.x;
    this.ay = seeking.y + wandering.y + walls.y + social.y;

    if (this.state === "hover") {
      this.ax += Math.sin(time * 1.1 + this.finPhase) * 18;
      this.ay += Math.cos(time * 0.9 + this.finPhase) * 14;
      this.vx *= 0.92;
      this.vy *= 0.92;
    } else {
      this.ay += Math.sin(time * 0.7 + this.tailPhase) * 8;
    }

    const drag = this.state === "hover" ? 0.9 : 0.965;
    this.vx += this.ax * dt;
    this.vy += this.ay * dt;
    this.vx *= drag;
    this.vy *= drag;

    const speed = Math.hypot(this.vx, this.vy);
    let targetSpeed = this.cruiseSpeed;
    if (this.state === "hover") targetSpeed = 6;
    if (this.state === "dart") targetSpeed = this.maxSpeed;

    if (speed > 0.001) {
      const adjusted = lerp(speed, targetSpeed, 0.06);
      this.vx = (this.vx / speed) * clamp(adjusted, 4, this.maxSpeed * 1.3);
      this.vy = (this.vy / speed) * clamp(adjusted, 4, this.maxSpeed * 1.3);
    }

    this.head.x = clamp(this.head.x, -b.x, b.x);
    this.head.y = clamp(this.head.y, -b.y, b.y);

    const desiredHeading = Math.atan2(this.vy, this.vx);
    let diff = desiredHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnLimit = this.maxTurnRate * (0.5 + Math.min(speed, 60) / 120);
    this.heading += clamp(diff, -turnLimit * dt, turnLimit * dt);

    this.finPhase += dt * (this.state === "hover" ? 6 : 3 + speed * 0.03);
    this.gillPhase += dt * (1.5 + speed * 0.01);
    this.updateSpine(dt);
  }

  drawBodyPath(halfWidth) {
    const pts = this.spine;
    const top = [];
    const bot = [];

    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      const t = i / (pts.length - 1);
      const w = halfWidth * (1 - t * 0.75) * (1 - Math.pow(t, 1.6) * 0.35);
      let angle;

      if (i === 0) angle = Math.atan2(pts[1].y - p.y, pts[1].x - p.x);
      else if (i === pts.length - 1) angle = Math.atan2(p.y - pts[i - 1].y, p.x - pts[i - 1].x);
      else angle = Math.atan2(pts[i + 1].y - pts[i - 1].y, pts[i + 1].x - pts[i - 1].x);

      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      top.push({ x: p.x + nx * w, y: p.y + ny * w });
      bot.push({ x: p.x - nx * w, y: p.y - ny * w });
    }

    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < top.length; i += 1) {
      const mx = (top[i - 1].x + top[i].x) / 2;
      const my = (top[i - 1].y + top[i].y) / 2;
      ctx.quadraticCurveTo(top[i - 1].x, top[i - 1].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    for (let i = bot.length - 1; i >= 0; i -= 1) {
      if (i === bot.length - 1) ctx.lineTo(bot[i].x, bot[i].y);
      else {
        const mx = (bot[i + 1].x + bot[i].x) / 2;
        const my = (bot[i + 1].y + bot[i].y) / 2;
        ctx.quadraticCurveTo(bot[i + 1].x, bot[i + 1].y, mx, my);
      }
    }
    ctx.closePath();
  }

  draw() {
    const cx = width / 2;
    const cy = height / 2;
    const s = this.size;
    const head = this.spine[0];
    const neck = this.spine[2];
    const tail = this.spine[this.spine.length - 1];
    const tailBase = this.spine[this.spine.length - 3];
    const heading = Math.atan2(neck.y - head.y, neck.x - head.x);
    const tailAngle = Math.atan2(tail.y - tailBase.y, tail.x - tailBase.x);
    const tailSwing = Math.sin(this.tailPhase) * (0.35 + Math.hypot(this.vx, this.vy) * 0.003);
    const finFlutter = Math.sin(this.finPhase) * 0.35;

    ctx.save();
    ctx.translate(cx, cy);

    const grad = ctx.createLinearGradient(head.x, head.y - 20, head.x, head.y + 20);
    grad.addColorStop(0, this.light);
    grad.addColorStop(0.45, this.color);
    grad.addColorStop(1, this.belly);

    ctx.fillStyle = grad;
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawBodyPath(16 * s);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(head.x + 2, head.y + 8 * s, 14 * s, 4 * s, heading, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 0.8;
    for (let i = 2; i < this.spine.length - 2; i += 3) {
      const p = this.spine[i];
      const a = Math.atan2(this.spine[i + 1].y - this.spine[i - 1].y, this.spine[i + 1].x - this.spine[i - 1].x);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.8 * s, a - 0.9, a + 0.9);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 3; i < this.spine.length - 4; i += 2) {
      const p = this.spine[i];
      const a = Math.atan2(this.spine[i + 1].y - this.spine[i - 1].y, this.spine[i + 1].x - this.spine[i - 1].x);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - Math.cos(a) * 8 * s, p.y - Math.sin(a) * 8 * s);
      ctx.stroke();
    }

    const drawFin = (px, py, angle, len, spread, alpha) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.dark;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-len * 0.4, -spread + finFlutter * spread, -len, -spread * 0.2);
      ctx.quadraticCurveTo(-len * 0.35, spread - finFlutter * spread, 0, 0);
      ctx.fill();
      ctx.restore();
    };

    drawFin(head.x + Math.cos(heading) * 8, head.y + Math.sin(heading) * 8, heading + 1.4, 12 * s, 7 * s, 0.85);
    drawFin(head.x + Math.cos(heading) * 8, head.y + Math.sin(heading) * 8, heading - 1.4, 12 * s, 7 * s, 0.85);

    const dorsalBase = this.spine[5];
    const dorsalAngle = Math.atan2(this.spine[6].y - this.spine[4].y, this.spine[6].x - this.spine[4].x) - Math.PI / 2;
    drawFin(dorsalBase.x, dorsalBase.y, dorsalAngle, 16 * s, 5 * s, 0.75);

    ctx.save();
    ctx.translate(tail.x, tail.y);
    ctx.rotate(tailAngle);
    ctx.fillStyle = this.dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-16 * s, (-10 + tailSwing * 8) * s);
    ctx.lineTo(-8 * s, 0);
    ctx.lineTo(-16 * s, (10 + tailSwing * 8) * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const eyeX = head.x + Math.cos(heading) * 10 * s;
    const eyeY = head.y + Math.sin(heading) * 10 * s;
    ctx.fillStyle = "#0a0f14";
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 3.8 * s, 3 * s, heading, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a6741";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(eyeX + Math.cos(heading) * 1.4, eyeY + Math.sin(heading) * 1.4, 1.2 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(head.x + Math.cos(heading) * 14 * s, head.y + Math.sin(heading) * 14 * s, 4 * s, heading + 0.3, heading + 1.2);
    ctx.stroke();

    const gillOpen = 0.5 + Math.sin(this.gillPhase) * 0.2;
    ctx.strokeStyle = `rgba(0,0,0,${0.18 * gillOpen})`;
    ctx.lineWidth = 1;
    for (let g = 0; g < 3; g += 1) {
      const gx = head.x - Math.cos(heading) * (4 + g * 2.5) * s;
      const gy = head.y - Math.sin(heading) * (4 + g * 2.5) * s;
      ctx.beginPath();
      ctx.arc(gx, gy, 3 * s, heading - 0.5, heading + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `bold ${11 * s}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, head.x - Math.cos(heading) * 2, head.y - Math.sin(heading) * 2);

    ctx.restore();
  }
}

const CREATURE_TYPES = [
  "jellyfish", "minnow", "seahorse", "turtle", "shrimp", "starfish",
  "crab", "octopus", "eel", "ray", "squid", "clownfish",
];
const creaturePalette = [
  "#c7a7ff", "#ff9ecf", "#8ed8ff", "#ffd28e", "#b5f0c8",
  "#f0a6a6", "#d4c4a8", "#ff7e67", "#7ec8e3", "#e8d5b5",
];
const scenery = [];

class SeaCreature {
  constructor(type = null) {
    const b = getBounds();
    this.type = type || CREATURE_TYPES[Math.floor(Math.random() * CREATURE_TYPES.length)];
    this.x = randomRange(-b.x, b.x);
    this.y = randomRange(-b.y, b.y);
    this.vx = randomRange(-18, 18);
    this.vy = randomRange(-12, 12);
    this.phase = Math.random() * Math.PI * 2;
    this.scale = randomRange(0.95, 1.75);
    this.depth = randomRange(0.55, 1);
    this.alpha = lerp(0.62, 0.95, this.depth);
    this.color = creaturePalette[Math.floor(Math.random() * creaturePalette.length)];
    this.dark = shade(this.color, -0.3);
    this.facing = Math.random() < 0.5 ? 1 : -1;
    this.targetTimer = randomRange(2, 6);
    this.tx = this.x;
    this.ty = this.y;

    if (this.type === "minnow") {
      this.scale *= 0.7;
      this.vx = randomRange(35, 65) * this.facing;
      this.alpha = 0.8;
    }
    if (this.type === "turtle") this.scale *= 1.5;
    if (this.type === "ray") this.scale *= 1.4;
    if (this.type === "eel") this.scale *= 1.2;
    if (this.type === "squid") this.scale *= 1.15;
    if (this.type === "starfish" || this.type === "crab") {
      this.y = b.y * randomRange(0.55, 0.92);
      this.vy = 0;
    }
    if (this.type === "jellyfish") {
      this.vy = randomRange(-10, -5);
      this.vx *= 0.35;
    }
    if (this.type === "eel") {
      this.vx = randomRange(20, 40) * this.facing;
    }
    if (this.type === "ray") {
      this.vy = randomRange(-6, 6);
    }
  }

  pickTarget() {
    const b = getBounds();
    this.tx = randomRange(-b.x, b.x);
    this.ty = randomRange(-b.y, b.y);
    if (this.type === "starfish" || this.type === "crab") {
      this.ty = b.y * randomRange(0.55, 0.92);
    }
    if (this.type === "jellyfish") {
      this.ty = randomRange(-b.y * 0.5, b.y * 0.3);
    }
    this.targetTimer = randomRange(2, 7);
  }

  update(dt, time) {
    const b = getBounds();
    this.phase += dt * randomRange(1.2, 2.4);
    this.targetTimer -= dt;
    if (this.targetTimer <= 0) this.pickTarget();

    let ax = 0;
    let ay = 0;
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const pull = this.type === "shrimp" ? 2.2 : this.type === "turtle" ? 0.35 : 0.9;
      ax += (dx / dist) * pull * 20;
      ay += (dy / dist) * pull * 20;
    }

    if (this.type === "jellyfish") {
      ay += Math.sin(time * 0.8 + this.phase) * 6 - 4;
      ax += Math.sin(time * 0.5 + this.phase) * 8;
    }
    if (this.type === "seahorse") {
      ay += Math.sin(time * 1.4 + this.phase) * 10;
      this.vx *= 0.96;
    }
    if (this.type === "octopus") {
      ax += Math.sin(time * 0.35 + this.phase) * 12;
      ay += Math.cos(time * 0.28 + this.phase) * 10;
    }
    if (this.type === "starfish") {
      ax += Math.sin(time * 0.2 + this.phase) * 4;
    }
    if (this.type === "crab") {
      if (Math.abs(dx) > 20) {
        this.facing = dx > 0 ? 1 : -1;
        ax += this.facing * 16;
      }
    }
    if (this.type === "eel") {
      ax += Math.sin(time * 0.6 + this.phase) * 14;
      ay += Math.cos(time * 0.45 + this.phase) * 10;
    }
    if (this.type === "ray") {
      ay += Math.sin(time * 0.5 + this.phase) * 8;
      ax += Math.cos(time * 0.35 + this.phase) * 6;
    }
    if (this.type === "squid") {
      ay += Math.sin(time * 0.9 + this.phase) * 12 - 3;
    }
    if (this.type === "clownfish") {
      ax += Math.sin(time * 0.7 + this.phase) * 10;
    }

    const maxSpeed = {
      jellyfish: 18,
      minnow: 80,
      seahorse: 16,
      turtle: 26,
      shrimp: 52,
      starfish: 7,
      crab: 20,
      octopus: 24,
      eel: 55,
      ray: 28,
      squid: 32,
      clownfish: 42,
    }[this.type];

    this.vx += ax * dt;
    this.vy += ay * dt;
    this.vx *= 0.985;
    this.vy *= 0.985;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, -b.x, b.x);
    this.y = clamp(this.y, -b.y, b.y);

    if (this.vx > 2) this.facing = 1;
    if (this.vx < -2) this.facing = -1;
  }

  draw(cx, cy) {
    ctx.save();
    ctx.translate(cx + this.x, cy + this.y);
    ctx.scale(this.facing * this.scale, this.scale);
    ctx.globalAlpha = this.alpha;

  const drawers = {
      jellyfish: () => this.drawJellyfish(),
      minnow: () => this.drawMinnow(),
      seahorse: () => this.drawSeahorse(),
      turtle: () => this.drawTurtle(),
      shrimp: () => this.drawShrimp(),
      starfish: () => this.drawStarfish(),
      crab: () => this.drawCrab(),
      octopus: () => this.drawOctopus(),
      eel: () => this.drawEel(),
      ray: () => this.drawRay(),
      squid: () => this.drawSquid(),
      clownfish: () => this.drawClownfish(),
    };
    drawers[this.type]();
    ctx.restore();
  }

  drawJellyfish() {
    const pulse = 1 + Math.sin(this.phase * 2) * 0.12;
    const g = ctx.createRadialGradient(0, -4, 2, 0, -4, 16);
    g.addColorStop(0, shade(this.color, 0.35));
    g.addColorStop(1, this.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -4, 12 * pulse, Math.PI, 0);
    ctx.quadraticCurveTo(14, 2, 0, 6);
    ctx.quadraticCurveTo(-14, 2, 0, -4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 3, 6);
      for (let t = 0; t <= 1; t += 0.2) {
        const y = 6 + t * 18;
        const x = i * 3 + Math.sin(this.phase * 3 + t * 6 + i) * 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawMinnow() {
    ctx.fillStyle = "#b8c7d4";
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-14, -3 + Math.sin(this.phase * 4) * 2);
    ctx.lineTo(-14, 3 - Math.sin(this.phase * 4) * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(5, -1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSeahorse() {
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.quadraticCurveTo(0, 0, -2, -14);
    ctx.quadraticCurveTo(-4, -20, 2, -24);
    ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(6, 8, 5, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, -24, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(4, -23, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTurtle() {
    ctx.fillStyle = this.dark;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 6, Math.sin(a) * 4, 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    const flip = Math.sin(this.phase * 3) * 0.5;
    ctx.fillStyle = this.dark;
    [["-14", flip], ["14", -flip], ["-8", "-10"], ["8", "-10"]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.ellipse(Number(x), Number(y), 6, 3, Number(y) * 0.08, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(12, -4, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShrimp() {
    const curl = Math.sin(this.phase * 2) * 0.2;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 4.5, curl, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-14, -6, -10, -10);
    ctx.lineTo(-8, -4);
    ctx.fill();
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-2 + i * 3, 2);
      ctx.lineTo(-4 + i * 3 + Math.sin(this.phase * 5 + i), 8);
      ctx.stroke();
    }
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(7, -1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawStarfish() {
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const wiggle = Math.sin(this.phase + i) * 0.15;
      const x = Math.cos(a) * (10 + wiggle * 3);
      const y = Math.sin(a) * (10 + wiggle * 3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawCrab() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.dark;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.ellipse(i * 12, -2, 4, 3, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i += 1) {
      const side = i < 2 ? -1 : 1;
      const offset = i % 2 === 0 ? -6 : 4;
      ctx.beginPath();
      ctx.moveTo(side * 8, offset);
      for (let s = 0; s <= 1; s += 0.25) {
        ctx.lineTo(
          side * (8 + s * 10),
          offset + Math.sin(this.phase * 4 + s * 4 + i) * 3
        );
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-3, -3, 1.2, 0, Math.PI * 2);
    ctx.arc(3, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawOctopus() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, -4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(-3, -5, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const spread = (i - 2.5) * 0.35;
      ctx.beginPath();
      ctx.moveTo(spread * 4, 4);
      for (let t = 0; t <= 1; t += 0.2) {
        const y = 4 + t * 16;
        const x = spread * 4 + Math.sin(this.phase * 3 + t * 5 + i) * 5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawEel() {
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      const x = -20 + t * 40;
      const y = Math.sin(this.phase * 2 + t * 5) * 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = this.dark;
    ctx.beginPath();
    ctx.arc(18, Math.sin(this.phase * 2 + 5) * 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffee55";
    ctx.beginPath();
    ctx.arc(19, Math.sin(this.phase * 2 + 5) * 2 - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRay() {
    const flap = Math.sin(this.phase * 3) * 0.25;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(0, -14 - flap * 10, 16, 0);
    ctx.quadraticCurveTo(0, 8, -16, 0);
    ctx.fill();
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = this.dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-3, 20);
    ctx.lineTo(3, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(10, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSquid() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(0, -10, 14, 0);
    ctx.quadraticCurveTo(0, 8, -12, 0);
    ctx.fill();
    ctx.fillStyle = this.dark;
    ctx.beginPath();
    ctx.ellipse(8, -1, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(10, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.dark;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const spread = (i - 2) * 0.4;
      ctx.beginPath();
      ctx.moveTo(-8, 2);
      for (let t = 0; t <= 1; t += 0.15) {
        const y = 2 + t * 18;
        const x = -8 + spread * t * 12 + Math.sin(this.phase * 4 + t * 6 + i) * 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawClownfish() {
    const w = Math.sin(this.phase * 4) * 2;
    ctx.fillStyle = "#ff6b35";
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-2, -6, 4, 12);
    ctx.fillRect(4, -5, 3, 10);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, -6, 2, 12);
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-17, -4 + w);
    ctx.lineTo(-17, 4 - w);
    ctx.closePath();
    ctx.fillStyle = "#ff6b35";
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(7, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff6b35";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(2, -10);
    ctx.stroke();
  }
}

let fishA;
let fishB;
let creatures = [];
let lastTime = performance.now();

function initCreatures() {
  creatures = [];
  CREATURE_TYPES.forEach((type) => {
    creatures.push(new SeaCreature(type));
    creatures.push(new SeaCreature(type));
  });

  const extra = width < 768 ? 18 : 30;
  for (let i = 0; i < extra; i += 1) {
    creatures.push(new SeaCreature());
  }

  const schools = width < 768 ? 5 : 9;
  for (let s = 0; s < schools; s += 1) {
    const baseX = randomRange(-getBounds().x * 0.7, getBounds().x * 0.7);
    const baseY = randomRange(-getBounds().y * 0.7, getBounds().y * 0.7);
    for (let i = 0; i < 6; i += 1) {
      const m = new SeaCreature("minnow");
      m.x = baseX + randomRange(-35, 35);
      m.y = baseY + randomRange(-25, 25);
      creatures.push(m);
    }
  }

  creatures.sort((a, b) => a.depth - b.depth);
}

function initScenery() {
  scenery.length = 0;
  const b = getBounds();
  const count = width < 768 ? 10 : 18;
  for (let i = 0; i < count; i += 1) {
    scenery.push({
      x: randomRange(-b.x, b.x),
      type: Math.random() < 0.55 ? "seaweed" : "coral",
      height: randomRange(50, 120),
      color: creaturePalette[Math.floor(Math.random() * creaturePalette.length)],
      phase: randomRange(0, Math.PI * 2),
    });
  }
}

function initFish() {
  fishA = new Fish({ color: "#3ecf6e", label: "A", x: -120, y: 30 });
  fishB = new Fish({ color: "#4da3ff", label: "B", x: 100, y: -40 });
}

function initBubbles() {
  bubbles.length = 0;
  const count = width < 768 ? 22 : 36;
  for (let i = 0; i < count; i += 1) {
    bubbles.push({
      x: randomRange(-width * 0.5, width * 0.5),
      y: randomRange(-height * 0.5, height * 0.5),
      r: randomRange(1.5, 5),
      speed: randomRange(10, 24),
      wobble: randomRange(0, Math.PI * 2),
      alpha: randomRange(0.04, 0.12),
    });
  }
}

function initCaustics() {
  caustics.length = 0;
  for (let i = 0; i < 5; i += 1) {
    caustics.push({ offset: randomRange(0, Math.PI * 2), speed: randomRange(0.2, 0.5) });
  }
}

function drawBackground(time) {
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
    const y = height * (0.15 + i * 0.14) + Math.sin(time * c.speed + c.offset) * 12;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 30) {
      const wave = Math.sin(x * 0.012 + time * 0.7 + c.offset) * 18;
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
    b.x += Math.sin(time * 0.75 + b.wobble) * 0.35;
    if (b.y < -height * 0.55) {
      b.y = height * 0.55;
      b.x = randomRange(-width * 0.5, width * 0.5);
    }
    ctx.fillStyle = `rgba(220, 245, 255, ${b.alpha})`;
    ctx.beginPath();
    ctx.arc(width / 2 + b.x, height / 2 + b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = "rgba(140, 200, 240, 0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = height * 0.18 + i * height * 0.13;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 36) {
      ctx.lineTo(x, y + Math.sin(x * 0.008 + time * 0.35 + i) * 5);
    }
    ctx.stroke();
  }

  const floorY = height / 2 + getBounds().y * 0.88;
  scenery.forEach((item) => {
    const x = width / 2 + item.x;
    ctx.save();
    if (item.type === "seaweed") {
      ctx.strokeStyle = shade(item.color, -0.25);
      ctx.lineWidth = 3;
      for (let s = -1; s <= 1; s += 1) {
        ctx.beginPath();
        ctx.moveTo(x + s * 8, floorY);
        for (let t = 0; t <= 1; t += 0.1) {
          const y = floorY - t * item.height;
          const wave = Math.sin(time * 1.2 + item.phase + t * 4 + s) * (8 + t * 10);
          ctx.lineTo(x + s * 8 + wave, y);
        }
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.75;
      for (let b = 0; b < 4; b += 1) {
        ctx.beginPath();
        ctx.arc(x + (b - 1.5) * 12, floorY - 8 - b * 6, 8 + b * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });
}

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const time = now / 1000;

  drawBackground(time);

  creatures.forEach((creature) => {
    creature.update(dt, time);
    creature.draw(width / 2, height / 2);
  });

  fishA.update(dt, fishB, time);
  fishB.update(dt, fishA, time);
  fishA.draw();
  fishB.draw();

  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  resize();
  initFish();
  initCreatures();
  initScenery();
  initBubbles();
});

resize();
initFish();
initCreatures();
initScenery();
initBubbles();
initCaustics();
requestAnimationFrame(animate);
