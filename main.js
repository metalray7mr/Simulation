import * as THREE from "three";

const canvas = document.getElementById("scene");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a1628, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1628, 0.018);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
camera.position.set(0, 8, 28);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0x8ec8ff, 0.55);
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(10, 20, 12);
scene.add(ambient, sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({
    color: 0x08101c,
    roughness: 1,
    metalness: 0,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -6;
scene.add(floor);

function createFishMesh(color) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: color === null ? 0.05 : 0.15,
    emissive: color === null ? 0x000000 : color,
    emissiveIntensity: color === null ? 0 : 0.12,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), bodyMat);
  body.scale.set(1.8, 0.75, 0.7);
  group.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 8), bodyMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -1.05;
  group.add(tail);

  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), bodyMat);
  fin.rotation.x = Math.PI / 2;
  fin.position.set(0.1, 0.35, 0);
  group.add(fin);

  group.userData.tail = tail;
  group.userData.fin = fin;

  return group;
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function createFish({ color = null, scale = 1, role = "school" }) {
  const mesh = createFishMesh(color);
  mesh.scale.setScalar(scale);

  const radius = role === "hero" ? randomInRange(10, 16) : randomInRange(6, 22);
  const speed = role === "hero" ? randomInRange(0.35, 0.55) : randomInRange(0.25, 0.7);
  const phase = Math.random() * Math.PI * 2;
  const height = randomInRange(-2.5, 3.5);
  const wobble = randomInRange(0.4, 1.1);

  mesh.position.set(
    Math.cos(phase) * radius,
    height,
    Math.sin(phase) * radius
  );

  return {
    mesh,
    role,
    radius,
    speed,
    phase,
    height,
    wobble,
    drift: randomInRange(-0.4, 0.4),
    label: role === "hero" ? (color === 0x3ecf6e ? "A" : "B") : null,
  };
}

const fishes = [];
const schoolCount = window.innerWidth < 768 ? 48 : 72;

for (let i = 0; i < schoolCount; i += 1) {
  fishes.push(createFish({ color: 0x9aa3ad, scale: randomInRange(0.75, 1.05) }));
}

fishes.push(createFish({ color: 0x3ecf6e, scale: 1.35, role: "hero" }));
fishes.push(createFish({ color: 0x4da3ff, scale: 1.35, role: "hero" }));

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

fishes
  .filter((fish) => fish.label)
  .forEach((fish) => {
    const el = document.createElement("span");
    el.className = `fish-label fish-label-${fish.label.toLowerCase()}`;
    el.textContent = fish.label;
    labelLayer.appendChild(el);
    labels.set(fish, el);
  });

const clock = new THREE.Clock();
const tempVector = new THREE.Vector3();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function updateFish(fish, time) {
  const angle = fish.phase + time * fish.speed;
  const x = Math.cos(angle) * fish.radius;
  const z = Math.sin(angle) * fish.radius;
  const y = fish.height + Math.sin(time * fish.wobble + fish.phase) * 0.8;

  fish.mesh.position.set(x, y, z);

  const nextX = Math.cos(angle + 0.05) * fish.radius;
  const nextZ = Math.sin(angle + 0.05) * fish.radius;
  fish.mesh.lookAt(nextX, y + fish.drift * 0.2, nextZ);

  const wiggle = Math.sin(time * 6 + fish.phase) * 0.35;
  fish.mesh.userData.tail.rotation.y = wiggle;
  fish.mesh.userData.fin.rotation.z = wiggle * 0.5;
}

function updateLabels() {
  labels.forEach((el, fish) => {
    tempVector.copy(fish.mesh.position);
    tempVector.y += 1.1;
    tempVector.project(camera);

    const x = (tempVector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tempVector.y * 0.5 + 0.5) * window.innerHeight;
    const visible = tempVector.z > -1 && tempVector.z < 1;

    el.style.display = visible ? "grid" : "none";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });
}

function animate() {
  const time = clock.getElapsedTime();

  fishes.forEach((fish) => updateFish(fish, time));

  camera.position.x = Math.sin(time * 0.08) * 3;
  camera.position.z = 28 + Math.cos(time * 0.06) * 2;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(animate);
}

window.addEventListener("resize", resize);
resize();
animate();
