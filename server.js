const http = require("http");
const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.PORT) || 3001;
const WORLD_W = 3200;
const WORLD_H = 2400;
const EAT_RATIO = 1.05;
const MAX_PLAYER_SIZE = 4.5;
const BROADCAST_MS = 50;

const PLAYER_COLORS = [
  "#4da3ff",
  "#f59e42",
  "#e85d8f",
  "#a78bfa",
  "#fbbf24",
  "#34d399",
  "#fb7185",
  "#38bdf8",
];

const players = new Map();
let colorIndex = 0;

function pickColor() {
  const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  colorIndex += 1;
  return color;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function overlapRadius(sizeA, sizeB) {
  return 14 * sizeA + 14 * sizeB * 0.85;
}

function serializePlayers() {
  return [...players.values()].map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    size: p.size,
    heading: p.heading,
    color: p.color,
    score: p.score,
    alive: p.alive,
    name: p.name,
  }));
}

function broadcast(wss, payload, exceptId = null) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.playerId !== exceptId) {
      client.send(data);
    }
  }
}

function broadcastAll(wss, payload) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Ocean Feast multiplayer server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const id = randomUUID();
  ws.playerId = id;

  players.set(id, {
    id,
    x: WORLD_W / 2 + (Math.random() - 0.5) * 200,
    y: WORLD_H / 2 + (Math.random() - 0.5) * 200,
    size: 1,
    heading: 0,
    color: pickColor(),
    score: 0,
    alive: true,
    name: `Fish ${id.slice(0, 4)}`,
  });

  ws.send(
    JSON.stringify({
      type: "welcome",
      id,
      world: { w: WORLD_W, h: WORLD_H },
      players: serializePlayers(),
    }),
  );

  broadcast(wss, { type: "players", players: serializePlayers() }, id);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const player = players.get(id);
    if (!player) return;

    if (msg.type === "update" && player.alive && msg.state) {
      const s = msg.state;
      player.x = clamp(Number(s.x) || player.x, 0, WORLD_W);
      player.y = clamp(Number(s.y) || player.y, 0, WORLD_H);
      player.size = clamp(Number(s.size) || player.size, 1, MAX_PLAYER_SIZE);
      player.heading = Number(s.heading) || player.heading;
      player.score = Number(s.score) || player.score;
      if (typeof s.name === "string" && s.name.trim()) {
        player.name = s.name.trim().slice(0, 16);
      }
    }

    if (msg.type === "eatPlayer" && player.alive) {
      const target = players.get(msg.targetId);
      if (!target || !target.alive || target.id === id) return;
      const sep = dist(player, target);
      if (player.size > target.size * EAT_RATIO && sep < overlapRadius(player.size, target.size)) {
        target.alive = false;
        player.score += 2;
        player.size = clamp(player.size + target.size * 0.12, 1, MAX_PLAYER_SIZE);
        broadcastAll(wss, {
          type: "playerEaten",
          eaterId: id,
          targetId: target.id,
          eater: { id: player.id, size: player.size, score: player.score },
          players: serializePlayers(),
        });
      }
    }

    if (msg.type === "died") {
      player.alive = false;
      broadcastAll(wss, { type: "players", players: serializePlayers() });
    }

    if (msg.type === "respawn" && msg.state) {
      player.alive = true;
      player.x = clamp(Number(msg.state.x) || WORLD_W / 2, 60, WORLD_W - 60);
      player.y = clamp(Number(msg.state.y) || WORLD_H / 2, 60, WORLD_H - 60);
      player.size = 1;
      player.score = 0;
      player.heading = 0;
      broadcastAll(wss, { type: "players", players: serializePlayers() });
    }
  });

  ws.on("close", () => {
    players.delete(id);
    broadcastAll(wss, { type: "players", players: serializePlayers() });
  });
});

setInterval(() => {
  if (players.size === 0) return;
  broadcastAll(wss, { type: "players", players: serializePlayers() });
}, BROADCAST_MS);

server.listen(PORT, () => {
  console.log(`Ocean Feast server on port ${PORT}`);
});
