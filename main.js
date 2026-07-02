const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;
let dpr = 1;

const bubbles = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
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
  return {
    x: width * 0.42,
    y: height * 0.38,
  };
}

class Fish {
  constructor({ color, label, x, y }) {
    this.color = color;
    this.label = label;
    this.x = x;
    this.y = y;
    this.vx = randomRange(-40, 40);
    this.vy = randomRange(-20, 20);
    this.ax = 0;
    this.ay = 0;

    this.maxSpeed = randomRange(70, 95);
    this.cruiseSpeed = randomRange(42, 58);
    this.maxForce = randomRange(120, 160);
    this.maxTurnRate = randomRange(2.4, 3.2);

    this.heading = Math.atan2(this.vy, this.vx);
    this.targetX = x;
    this.targetY = y;
    this.pickNewTarget();

    this.tailPhase = Math.random() * Math.PI * 2;
    this.restTimer = randomRange(0, 1.5);
    this.burstTimer = randomRange(3, 7);
    this.size = width < 768 ? 22 : 28;
    this.personality = {
      curiosity: randomRange(0.3, 0.9),
      shyness: randomRange(0.2, 0.7),
    };
  }

  pickNewTarget() {
    const bounds = getBounds();
    this.targetX = randomRange(-bounds.x, bounds.x);
    this.targetY = randomRange(-bounds.y, bounds.y);
    this.restTimer = 0;
  }

  seek(tx, ty, weight = 1) {
    let dx = tx - this.x;
    let dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return { x: 0, y: 0 };

    dx /= dist;
    dy /= dist;

    let desiredSpeed = this.maxSpeed;
    if (dist < 120) {
      desiredSpeed = (dist / 120) * this.maxSpeed;
    }

    const steerX = dx * desiredSpeed - this.vx;
    const steerY = dy * desiredSpeed - this.vy;
    const mag = Math.hypot(steerX, steerY);
    const limit = this.maxForce * weight;
    if (mag > limit) {
      return { x: (steerX / mag) * limit, y: (steerY / mag) * limit };
    }
    return { x: steerX, y: steerY };
  }

  wander(dt) {
    this.wanderAngle = (this.wanderAngle || Math.random() * Math.PI * 2) + randomRange(-0.8, 0.8) * dt;
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const nx = this.vx / speed;
    const ny = this.vy / speed;
    const wx = this.x + nx * 60 + Math.cos(this.wanderAngle) * 50;
    const wy = this.y + ny * 60 + Math.sin(this.wanderAngle) * 50;
    return this.seek(wx, wy, 0.35);
  }

  avoidWalls() {
    const bounds = getBounds();
    const margin = 70;
    const strength = 180;
    let fx = 0;
    let fy = 0;

    if (this.x < -bounds.x + margin) fx += strength;
    if (this.x > bounds.x - margin) fx -= strength;
    if (this.y < -bounds.y + margin) fy += strength;
    if (this.y > bounds.y - margin) fy -= strength;

    return { x: fx, y: fy };
  }

  interact(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return { x: 0, y: 0 };

    let fx = 0;
    let fy = 0;
    const nx = dx / dist;
    const ny = dy / dist;

    if (dist < 55) {
      const push = (55 - dist) * 4 * this.personality.shyness;
      fx += nx * push;
      fy += ny * push;
    } else if (dist > 180 && dist < 280) {
      fx += other.vx * 0.08 * this.personality.curiosity;
      fy += other.vy * 0.08 * this.personality.curiosity;
    }

    return { x: fx, y: fy };
  }

  update(dt, other, time) {
    const bounds = getBounds();
    const toTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);

    if (toTarget < 30) {
      this.restTimer += dt;
      if (this.restTimer > randomRange(0.5, 1.5)) {
        this.pickNewTarget();
      }
    }

    this.burstTimer -= dt;
    if (this.burstTimer <= 0) {
      this.burstTimer = randomRange(4, 9);
      this.pickNewTarget();
    }

    const seeking = this.seek(this.targetX, this.targetY, 1);
    const wandering = this.wander(dt);
    const walls = this.avoidWalls();
    const social = this.interact(other);

    this.ax = seeking.x + wandering.x + walls.x + social.x;
    this.ay = seeking.y + wandering.y + walls.y + social.y + Math.sin(time * 0.9 + this.tailPhase) * 12;

    if (this.restTimer > 0 && this.restTimer < 0.7) {
      this.ax *= 0.25;
      this.ay *= 0.25;
      this.vx *= 0.94;
      this.vy *= 0.94;
    }

    this.vx += this.ax * dt;
    this.vy += this.ay * dt;

    const speed = Math.hypot(this.vx, this.vy);
    const targetSpeed = this.restTimer > 0 && this.restTimer < 0.7 ? 12 : this.cruiseSpeed;
    if (speed > 0.001) {
      const adjusted = speed + (targetSpeed - speed) * 0.05;
      this.vx = (this.vx / speed) * clamp(adjusted, 8, this.maxSpeed);
      this.vy = (this.vy / speed) * clamp(adjusted, 8, this.maxSpeed);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, -bounds.x, bounds.x);
    this.y = clamp(this.y, -bounds.y, bounds.y);

    const desiredHeading = Math.atan2(this.vy, this.vx);
    let diff = desiredHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += clamp(diff, -this.maxTurnRate * dt, this.maxTurnRate * dt);

    const swimSpeed = Math.hypot(this.vx, this.vy);
    this.tailPhase += dt * (5 + swimSpeed * 0.06);
  }

  draw() {
    const tailSwing = Math.sin(this.tailPhase) * (0.35 + Math.hypot(this.vx, this.vy) * 0.004);
    const s = this.size;

    ctx.save();
    ctx.translate(width / 2 + this.x, height / 2 + this.y);
    ctx.rotate(this.heading);

    ctx.fillStyle = this.color;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(s * 1.1, 0);
    ctx.quadraticCurveTo(0, -s * 0.55, -s * 0.95, 0);
    ctx.quadraticCurveTo(0, s * 0.55, s * 1.1, 0);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-s * 0.95, 0);
    ctx.lineTo(-s * 1.55, -s * 0.45 + tailSwing * s);
    ctx.lineTo(-s * 1.55, s * 0.45 + tailSwing * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -s * 0.2);
    ctx.lineTo(-s * 0.3, -s * 0.75);
    ctx.lineTo(s * 0.15, -s * 0.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(s * 0.45, -s * 0.12, s * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${s * 0.42}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, 0, s * 0.05);

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
  const count = width < 768 ? 18 : 30;
  for (let i = 0; i < count; i += 1) {
    bubbles.push({
      x: randomRange(-width * 0.5, width * 0.5),
      y: randomRange(-height * 0.5, height * 0.5),
      r: randomRange(2, 6),
      speed: randomRange(12, 28),
      wobble: randomRange(0, Math.PI * 2),
    });
  }
}

function drawBackground(time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#0d2845");
  gradient.addColorStop(1, "#061018");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  bubbles.forEach((bubble) => {
    bubble.y -= bubble.speed * 0.016;
    bubble.x += Math.sin(time * 0.8 + bubble.wobble) * 0.3;
    if (bubble.y < -height * 0.55) {
      bubble.y = height * 0.55;
      bubble.x = randomRange(-width * 0.5, width * 0.5);
    }
    ctx.beginPath();
    ctx.arc(width / 2 + bubble.x, height / 2 + bubble.y, bubble.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = "rgba(120, 180, 220, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const y = height * 0.2 + i * height * 0.12 + Math.sin(time * 0.3 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 40) {
      ctx.lineTo(x, y + Math.sin(x * 0.01 + time + i) * 6);
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
requestAnimationFrame(animate);
