import * as THREE from "three";

const canvas = document.getElementById("scene");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a1628, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1628, 0.016);

const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
camera.position.set(0, 6, 24);

scene.add(new THREE.AmbientLight(0x8ec8ff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.position.set(8, 18, 10);
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x08101c, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -5;
scene.add(floor);

const BOUNDS = { x: 18, y: 4, z: 14 };
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function createFishMesh(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.12,
    emissive: color,
    emissiveIntensity: 0.1,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), mat);
  body.scale.set(1.9, 0.78, 0.72);
  group.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 8), mat);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -1.1;
  group.add(tail);

  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), mat);
  dorsal.rotation.x = -Math.PI / 2;
  dorsal.position.set(0, 0.42, 0);
  group.add(dorsal);

  const leftFin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 6), mat);
  leftFin.rotation.z = Math.PI / 2;
  leftFin.position.set(0.15, -0.08, 0.32);
  group.add(leftFin);

  const rightFin = leftFin.clone();
  rightFin.position.z = -0.32;
  group.add(rightFin);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
  const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.72, 0.12, 0.22);
  group.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.z = -0.22;
  group.add(rightEye);

  group.userData.parts = { tail, dorsal, leftFin, rightFin };
  return group;
}

class Fish {
  constructor({ color, label, start }) {
    this.mesh = createFishMesh(color);
    this.mesh.scale.setScalar(1.4);
    this.label = label;

    this.position = new THREE.Vector3(...start);
    this.velocity = new THREE.Vector3(randomRange(-1, 1), 0, randomRange(-1, 1));
    this.acceleration = new THREE.Vector3();

    this.maxSpeed = randomRange(2.4, 3.2);
    this.cruiseSpeed = randomRange(1.4, 2.0);
    this.maxForce = randomRange(2.8, 3.6);
    this.maxTurnRate = randomRange(1.8, 2.4);

    this.target = new THREE.Vector3();
    this.pickNewTarget();

    this.wanderAngle = Math.random() * Math.PI * 2;
    this.tailPhase = Math.random() * Math.PI * 2;
    this.restTimer = randomRange(0, 2);
    this.burstTimer = randomRange(3, 7);
    this.personality = {
      curiosity: randomRange(0.3, 0.9),
      shyness: randomRange(0.2, 0.7),
    };

    this.heading = Math.atan2(this.velocity.z, this.velocity.x);
    this.pitch = 0;
    this.bank = 0;
  }

  pickNewTarget() {
    this.target.set(
      randomRange(-BOUNDS.x * 0.75, BOUNDS.x * 0.75),
      randomRange(-BOUNDS.y * 0.6, BOUNDS.y * 0.85),
      randomRange(-BOUNDS.z * 0.75, BOUNDS.z * 0.75)
    );
    this.restTimer = 0;
  }

  seek(destination, weight = 1) {
    tempVec.copy(destination).sub(this.position);
    const distance = tempVec.length();

    if (distance < 0.001) return new THREE.Vector3();

    tempVec.normalize();
    let desiredSpeed = this.maxSpeed;
    if (distance < 6) {
      desiredSpeed = THREE.MathUtils.mapLinear(distance, 0, 6, 0.3, this.maxSpeed);
    }

    tempVec.multiplyScalar(desiredSpeed);
    tempVec.sub(this.velocity);
    tempVec.clampLength(0, this.maxForce * weight);
    return tempVec;
  }

  wander(dt) {
    this.wanderAngle += randomRange(-0.6, 0.6) * dt;
    const ahead = tempVec.copy(this.velocity);
    if (ahead.lengthSq() < 0.01) {
      ahead.set(Math.cos(this.wanderAngle), 0, Math.sin(this.wanderAngle));
    }
    ahead.normalize().multiplyScalar(2.5);
    ahead.add(this.position);

    ahead.x += Math.cos(this.wanderAngle) * 2.2;
    ahead.y += Math.sin(this.wanderAngle * 0.7) * 0.6;
    ahead.z += Math.sin(this.wanderAngle) * 2.2;

    return this.seek(ahead, 0.35);
  }

  avoidWalls() {
    const force = new THREE.Vector3();
    const margin = 4;
    const strength = 2.2;

    if (this.position.x < -BOUNDS.x + margin) force.x += strength;
    if (this.position.x > BOUNDS.x - margin) force.x -= strength;
    if (this.position.y < -BOUNDS.y + margin) force.y += strength;
    if (this.position.y > BOUNDS.y - margin) force.y -= strength;
    if (this.position.z < -BOUNDS.z + margin) force.z += strength;
    if (this.position.z > BOUNDS.z - margin) force.z -= strength;

    return force;
  }

  interact(other) {
    const force = new THREE.Vector3();
    tempVec.copy(this.position).sub(other.position);
    const distance = tempVec.length();
    if (distance < 0.001) return force;

    tempVec.normalize();

    if (distance < 2.2) {
      tempVec.multiplyScalar((2.2 - distance) * 3.5 * this.personality.shyness);
      force.add(tempVec);
    } else if (distance > 9 && distance < 14) {
      tempVec2.copy(other.velocity).multiplyScalar(0.12 * this.personality.curiosity);
      force.add(tempVec2);
    }

    return force;
  }

  update(dt, other, time) {
    this.acceleration.set(0, 0, 0);

    const toTarget = this.position.distanceTo(this.target);
    if (toTarget < 1.8) {
      this.restTimer += dt;
      if (this.restTimer > randomRange(0.6, 1.8)) {
        this.pickNewTarget();
      }
    }

    this.burstTimer -= dt;
    if (this.burstTimer <= 0) {
      this.burstTimer = randomRange(4, 9);
      this.pickNewTarget();
    }

    const seeking = this.seek(this.target, 1);
    const wandering = this.wander(dt);
    const walls = this.avoidWalls();
    const social = this.interact(other);

    this.acceleration.add(seeking);
    this.acceleration.add(wandering);
    this.acceleration.add(walls);
    this.acceleration.add(social);

    const buoyancy = Math.sin(time * 0.7 + this.tailPhase) * 0.18;
    this.acceleration.y += buoyancy;

    if (this.restTimer > 0 && this.restTimer < 0.8) {
      this.acceleration.multiplyScalar(0.25);
      this.velocity.multiplyScalar(0.96);
    }

    this.velocity.addScaledVector(this.acceleration, dt);

    const speed = this.velocity.length();
    const targetSpeed = this.restTimer > 0 && this.restTimer < 0.8 ? 0.4 : this.cruiseSpeed;
    if (speed > 0.001) {
      const adjusted = THREE.MathUtils.lerp(speed, targetSpeed, 0.04);
      this.velocity.setLength(clamp(adjusted, 0.2, this.maxSpeed));
    }

    this.position.addScaledVector(this.velocity, dt);
    this.position.x = clamp(this.position.x, -BOUNDS.x, BOUNDS.x);
    this.position.y = clamp(this.position.y, -BOUNDS.y, BOUNDS.y);
    this.position.z = clamp(this.position.z, -BOUNDS.z, BOUNDS.z);

    this.mesh.position.copy(this.position);

    if (this.velocity.lengthSq() > 0.01) {
      const desiredHeading = Math.atan2(this.velocity.z, this.velocity.x);
      let headingDiff = desiredHeading - this.heading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

      this.heading += clamp(headingDiff, -this.maxTurnRate * dt, this.maxTurnRate * dt);

      const desiredPitch = Math.atan2(
        this.velocity.y,
        Math.hypot(this.velocity.x, this.velocity.z)
      );
      this.pitch = THREE.MathUtils.lerp(this.pitch, desiredPitch * 0.45, 0.08);
      this.bank = THREE.MathUtils.lerp(this.bank, clamp(-headingDiff * 1.4, -0.42, 0.42), 0.1);

      this.mesh.rotation.set(this.pitch, this.heading - Math.PI / 2, this.bank);
    }

    const swimSpeed = this.velocity.length();
    const beatFreq = 4 + swimSpeed * 1.6;
    this.tailPhase += dt * beatFreq;
    const tailSwing = Math.sin(this.tailPhase) * (0.25 + swimSpeed * 0.12);

    const { tail, dorsal, leftFin, rightFin } = this.mesh.userData.parts;
    tail.rotation.y = tailSwing;
    dorsal.rotation.z = Math.sin(this.tailPhase * 0.5) * 0.08;
    leftFin.rotation.y = 0.35 + Math.sin(this.tailPhase * 0.5) * 0.15;
    rightFin.rotation.y = -0.35 - Math.sin(this.tailPhase * 0.5) * 0.15;
  }
}

const fishes = [
  new Fish({ color: 0x3ecf6e, label: "A", start: [-6, 0.5, 2] }),
  new Fish({ color: 0x4da3ff, label: "B", start: [5, -0.5, -3] }),
];

fishes.forEach((fish) => scene.add(fish.mesh));

const labels = new Map();
const labelLayer = document.createElement("div");
labelLayer.className = "fish-labels";
document.getElementById("app").appendChild(labelLayer);

const labelStyle = document.createElement("style");
labelStyle.textContent = `
  .fish-labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .fish-label {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: #041018;
    border: 2px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  }
  .fish-label-a { background: #3ecf6e; }
  .fish-label-b { background: #4da3ff; }
`;
document.head.appendChild(labelStyle);

fishes.forEach((fish) => {
  const el = document.createElement("span");
  el.className = `fish-label fish-label-${fish.label.toLowerCase()}`;
  el.textContent = fish.label;
  labelLayer.appendChild(el);
  labels.set(fish, el);
});

const clock = new THREE.Clock();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function updateLabels() {
  labels.forEach((el, fish) => {
    tempVec.copy(fish.position);
    tempVec.y += 1.2;
    tempVec.project(camera);

    const visible = tempVec.z > -1 && tempVec.z < 1;
    el.style.display = visible ? "grid" : "none";
    el.style.left = `${(tempVec.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-tempVec.y * 0.5 + 0.5) * window.innerHeight}px`;
  });
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  fishes[0].update(dt, fishes[1], time);
  fishes[1].update(dt, fishes[0], time);

  const mid = tempVec.copy(fishes[0].position).add(fishes[1].position).multiplyScalar(0.5);
  camera.position.x = mid.x + Math.sin(time * 0.12) * 4;
  camera.position.y = 5 + Math.sin(time * 0.08) * 1.2;
  camera.position.z = 24 + Math.cos(time * 0.1) * 2;
  camera.lookAt(mid.x, mid.y * 0.5, mid.z);

  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resize);
resize();
animate();
