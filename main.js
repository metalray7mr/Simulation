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

    this.segmentCount = 14;
    this.segmentSpacing = width < 768 ? 4.2 : 5.2;
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
    this.size = width < 768 ? 1 : 1.15;

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
    this.drawBodyPath(13 * s);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.8;
    for (let i = 2; i < this.spine.length - 2; i += 3) {
      const p = this.spine[i];
      const a = Math.atan2(this.spine[i + 1].y - this.spine[i - 1].y, this.spine[i + 1].x - this.spine[i - 1].x);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2 * s, a - 0.8, a + 0.8);
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
    ctx.ellipse(eyeX, eyeY, 3.2 * s, 2.6 * s, heading, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(eyeX + Math.cos(heading) * 1.2, eyeY + Math.sin(heading) * 1.2, 1 * s, 0, Math.PI * 2);
    ctx.fill();

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

let fishA;
let fishB;
let lastTime = performance.now();

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
}

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const time = now / 1000;

  drawBackground(time);
  fishA.update(dt, fishB, time);
  fishB.update(dt, fishA, time);
  fishA.draw();
  fishB.draw();

  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  resize();
  initFish();
  initBubbles();
});

resize();
initFish();
initBubbles();
initCaustics();
requestAnimationFrame(animate);
