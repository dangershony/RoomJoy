import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { listGameCatalog } from '@roomjoy/game-sdk';
import { RoomJoyRoom, roomsByCode } from './room/RoomJoyRoom.js';

// Register game modules (side-effect registerGame)
import '@roomjoy/confidence-club';
import '@roomjoy/mixed-signals';
import '@roomjoy/snack-chase';

const PORT = Number(process.env.PORT ?? 2567);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'roomjoy-server', version: '0.2.0' });
});

app.get('/api/games', (_req, res) => {
  res.json({ games: listGameCatalog() });
});

/** Resolve short room code → Colyseus room id (for phone join). */
app.get('/api/rooms/:code', (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  const room = roomsByCode.get(code);
  if (!room) {
    res.status(404).json({ error: 'ROOM_NOT_FOUND' });
    return;
  }
  res.json({
    roomId: room.roomId,
    roomCode: room.getRoomCode(),
  });
});

app.get('/api/rooms', (_req, res) => {
  const list = [...roomsByCode.entries()].map(([roomCode, room]) => ({
    roomCode,
    roomId: room.roomId,
  }));
  res.json({ rooms: list });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

gameServer.define('roomjoy', RoomJoyRoom);

void gameServer.listen(PORT, HOST).then(() => {
  console.log(`RoomJoy server listening on http://${HOST}:${PORT}`);
  console.log(`  Colyseus room: "roomjoy"`);
  console.log(`  Games: ${listGameCatalog().map((g) => g.id).join(', ')}`);
  console.log(`  Health: GET /health`);
  console.log(`  Lookup: GET /api/rooms/:code`);
  console.log(`  Catalog: GET /api/games`);
});
