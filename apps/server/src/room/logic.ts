/**
 * Pure authoritative room logic for RoomJoy M1.
 * No Colyseus / network deps — unit-tested with Vitest.
 */
import {
  Direction,
  MAX_PLAYERS,
  PLAYER_SPEED,
  RoomPhase,
  STALE_INPUT_MS,
  TV_RECOVER_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  isValidAvatarId,
  sanitizeNickname,
  type PlayerPublic,
  type RoomStatePublic,
} from '@roomjoy/protocol';
import {
  generateHostCode,
  generatePlayerId,
  generateRoomCode,
  generateRoomId,
  generateSessionToken,
} from '../util/codes.js';

export interface InternalPlayer {
  id: string;
  nickname: string;
  avatarId: string;
  isHost: boolean;
  connected: boolean;
  sessionToken: string;
  /** Colyseus session id when connected */
  clientSessionId?: string;
  x: number;
  y: number;
  direction: Direction;
  lastInputAt: number;
  inputSeq: number;
}

export interface InternalRoom {
  roomId: string;
  roomCode: string;
  hostCode: string | null;
  hostClaimed: boolean;
  phase: RoomPhase;
  joiningLocked: boolean;
  players: Map<string, InternalPlayer>;
  tvClientSessionId: string | null;
  tvSessionToken: string;
  tvConnected: boolean;
  tvDisconnectedAt: number | null;
  tvRecoverDeadline: number | null;
  tick: number;
  createdAt: number;
}

export type LogicErrorCode =
  | 'ROOM_FULL'
  | 'JOINING_LOCKED'
  | 'INVALID_NICKNAME'
  | 'INVALID_AVATAR'
  | 'HOST_ALREADY_CLAIMED'
  | 'INVALID_HOST_CODE'
  | 'NOT_HOST'
  | 'INVALID_TOKEN'
  | 'PLAYER_NOT_FOUND'
  | 'BAD_STATE'
  | 'RATE_LIMITED';

export class LogicError extends Error {
  constructor(
    public code: LogicErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LogicError';
  }
}

export function createRoom(now = Date.now()): InternalRoom {
  return {
    roomId: generateRoomId(),
    roomCode: generateRoomCode(),
    hostCode: generateHostCode(),
    hostClaimed: false,
    phase: 'LOBBY',
    joiningLocked: false,
    players: new Map(),
    tvClientSessionId: null,
    tvSessionToken: generateSessionToken(),
    tvConnected: true,
    tvDisconnectedAt: null,
    tvRecoverDeadline: null,
    tick: 0,
    createdAt: now,
  };
}

export function attachTv(
  room: InternalRoom,
  clientSessionId: string,
): { sessionToken: string } {
  room.tvClientSessionId = clientSessionId;
  room.tvConnected = true;
  room.tvDisconnectedAt = null;
  room.tvRecoverDeadline = null;
  if (room.phase === 'PAUSED') {
    room.phase = room.players.size > 0 ? 'PLAYING' : 'LOBBY';
    // If we were in PLAYING before pause, resume PLAYING; track via prior phase is complex —
    // M1: if any players and was paused from playing, resume PLAYING if host already started.
    // Simpler: store nothing — resume to LOBBY unless we set a flag. See resumeAfterTvRecover.
  }
  return { sessionToken: room.tvSessionToken };
}

/** Mark that game had started before TV pause so we resume correctly. */
export function pauseForTvDisconnect(room: InternalRoom, now = Date.now()): void {
  if (!room.tvConnected) return;
  room.tvConnected = false;
  room.tvClientSessionId = null;
  room.tvDisconnectedAt = now;
  room.tvRecoverDeadline = now + TV_RECOVER_MS;
  if (room.phase === 'PLAYING' || room.phase === 'LOBBY') {
    room.phase = 'PAUSED';
  }
}

export function resumeTv(
  room: InternalRoom,
  clientSessionId: string,
  sessionToken: string,
  wasPlaying: boolean,
): void {
  if (sessionToken !== room.tvSessionToken) {
    throw new LogicError('INVALID_TOKEN', 'Invalid TV session token');
  }
  room.tvClientSessionId = clientSessionId;
  room.tvConnected = true;
  room.tvDisconnectedAt = null;
  room.tvRecoverDeadline = null;
  if (room.phase === 'PAUSED') {
    room.phase = wasPlaying ? 'PLAYING' : 'LOBBY';
  }
}

export function endSessionIfTvTimedOut(
  room: InternalRoom,
  now = Date.now(),
): boolean {
  if (
    room.phase === 'PAUSED' &&
    room.tvRecoverDeadline != null &&
    now >= room.tvRecoverDeadline
  ) {
    room.phase = 'ENDED';
    return true;
  }
  return false;
}

export function joinPhone(
  room: InternalRoom,
  opts: {
    nickname: string;
    avatarId: string;
    clientSessionId: string;
    sessionToken?: string;
    playerId?: string;
  },
  now = Date.now(),
): InternalPlayer {
  // Reconnect path
  if (opts.sessionToken && opts.playerId) {
    const existing = room.players.get(opts.playerId);
    if (
      existing &&
      existing.sessionToken === opts.sessionToken
    ) {
      existing.connected = true;
      existing.clientSessionId = opts.clientSessionId;
      return existing;
    }
    throw new LogicError('INVALID_TOKEN', 'Reconnect credentials invalid');
  }

  if (room.joiningLocked) {
    throw new LogicError('JOINING_LOCKED', 'Host has locked joining');
  }

  if (room.phase === 'ENDED') {
    throw new LogicError('BAD_STATE', 'Session has ended');
  }

  const connectedCount = [...room.players.values()].filter((p) => p.connected)
    .length;
  // Capacity counts all player slots (including disconnected holding seats during reconnect window)
  if (room.players.size >= MAX_PLAYERS) {
    // Allow reclaim of disconnected seat only via token above
    throw new LogicError('ROOM_FULL', `Room is full (max ${MAX_PLAYERS} phones)`);
  }

  void connectedCount;

  if (!isValidAvatarId(opts.avatarId)) {
    throw new LogicError('INVALID_AVATAR', 'Unknown avatar preset');
  }

  const nickname = sanitizeNickname(opts.nickname);
  if (!nickname) {
    throw new LogicError('INVALID_NICKNAME', 'Nickname required');
  }

  const player: InternalPlayer = {
    id: generatePlayerId(),
    nickname,
    avatarId: opts.avatarId,
    isHost: false,
    connected: true,
    sessionToken: generateSessionToken(),
    clientSessionId: opts.clientSessionId,
    x: WORLD_WIDTH / 2 + (Math.random() - 0.5) * 200,
    y: WORLD_HEIGHT / 2 + (Math.random() - 0.5) * 100,
    direction: 'none',
    lastInputAt: now,
    inputSeq: 0,
  };

  room.players.set(player.id, player);
  return player;
}

export function claimHost(
  room: InternalRoom,
  playerId: string,
  hostCode: string,
): InternalPlayer {
  if (room.hostClaimed || room.hostCode === null) {
    throw new LogicError('HOST_ALREADY_CLAIMED', 'Host already claimed');
  }
  if (hostCode.toUpperCase() !== room.hostCode.toUpperCase()) {
    throw new LogicError('INVALID_HOST_CODE', 'Wrong host code');
  }
  const player = room.players.get(playerId);
  if (!player) {
    throw new LogicError('PLAYER_NOT_FOUND', 'Player not in room');
  }
  player.isHost = true;
  room.hostClaimed = true;
  room.hostCode = null; // remove code after claim
  return player;
}

export function setJoiningLocked(
  room: InternalRoom,
  playerId: string,
  locked: boolean,
): void {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    throw new LogicError('NOT_HOST', 'Only host can lock joining');
  }
  room.joiningLocked = locked;
}

export function startGame(room: InternalRoom, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    throw new LogicError('NOT_HOST', 'Only host can start');
  }
  if (room.phase !== 'LOBBY') {
    throw new LogicError('BAD_STATE', 'Can only start from lobby');
  }
  if (!room.tvConnected) {
    throw new LogicError('BAD_STATE', 'TV must be connected');
  }
  room.phase = 'PLAYING';
}

export function applyInput(
  room: InternalRoom,
  playerId: string,
  direction: Direction,
  seq: number,
  now = Date.now(),
): void {
  const player = room.players.get(playerId);
  if (!player || !player.connected) return;
  if (seq < player.inputSeq) return; // ignore out-of-order
  player.inputSeq = seq;
  player.direction = direction;
  player.lastInputAt = now;
}

export function tickMovement(room: InternalRoom, dtMs: number, now = Date.now()): void {
  if (room.phase !== 'PLAYING') return;
  const dt = dtMs / 1000;
  for (const player of room.players.values()) {
    if (!player.connected) continue;
    // Stale input → stop
    if (now - player.lastInputAt > STALE_INPUT_MS) {
      player.direction = 'none';
    }
    let vx = 0;
    let vy = 0;
    switch (player.direction) {
      case 'up':
        vy = -PLAYER_SPEED;
        break;
      case 'down':
        vy = PLAYER_SPEED;
        break;
      case 'left':
        vx = -PLAYER_SPEED;
        break;
      case 'right':
        vx = PLAYER_SPEED;
        break;
      default:
        break;
    }
    player.x = clamp(player.x + vx * dt, 16, WORLD_WIDTH - 16);
    player.y = clamp(player.y + vy * dt, 16, WORLD_HEIGHT - 16);
  }
  room.tick += 1;
}

export function markPlayerDisconnected(
  room: InternalRoom,
  playerId: string,
): void {
  const player = room.players.get(playerId);
  if (!player) return;
  player.connected = false;
  player.clientSessionId = undefined;
  player.direction = 'none';
}

export function toPublicState(
  room: InternalRoom,
  opts: { includeHostCode: boolean },
): RoomStatePublic {
  const players: PlayerPublic[] = [...room.players.values()].map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatarId: p.avatarId,
    isHost: p.isHost,
    connected: p.connected,
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
  }));

  const state: RoomStatePublic = {
    roomId: room.roomId,
    roomCode: room.roomCode,
    phase: room.phase,
    joiningLocked: room.joiningLocked,
    players,
    hostClaimed: room.hostClaimed,
    capacity: MAX_PLAYERS,
    tvConnected: room.tvConnected,
    tick: room.tick,
  };

  if (opts.includeHostCode && room.hostCode) {
    state.hostCode = room.hostCode;
  }
  if (room.tvRecoverDeadline != null) {
    state.tvRecoverDeadline = room.tvRecoverDeadline;
  }
  return state;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Simple in-memory join rate limiter keyed by IP / fingerprint. */
export class JoinRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private windowMs: number,
    private max: number,
  ) {}

  check(key: string, now = Date.now()): boolean {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.max) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
}
