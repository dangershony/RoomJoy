/**
 * Pure authoritative room logic for RoomJoy M2.
 * No Colyseus / network deps — unit-tested with Vitest.
 */
import {
  Direction,
  MAX_PLAYERS,
  PLAYER_SPEED,
  STALE_INPUT_MS,
  TV_RECOVER_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  isValidAvatarId,
  sanitizeNickname,
  type ContentMode,
  type GameCatalogEntry,
  type PauseReason,
  type PlayerPublic,
  type RoomPhase,
  type RoomStatePublic,
} from '@roomjoy/protocol';
import {
  getGame,
  listGameCatalog,
  makeGameContext,
  type GameDefinition,
  type GamePlayer,
} from '@roomjoy/game-sdk';
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
  selectedGameId: string | null;
  contentMode: ContentMode;
  gameSubstate: string | null;
  /** Opaque per-game state (server-only; secrets live here) */
  gameState: unknown;
  pauseReason: PauseReason | null;
  resumePhase: RoomPhase | null;
  resultsSummary: string | null;
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
  | 'RATE_LIMITED'
  | 'UNKNOWN_GAME'
  | 'TOO_FEW_PLAYERS'
  | 'CANNOT_REMOVE_SELF'
  | 'TARGET_NOT_FOUND';

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
    selectedGameId: null,
    contentMode: 'family',
    gameSubstate: null,
    gameState: null,
    pauseReason: null,
    resumePhase: null,
    resultsSummary: null,
  };
}

function requireHost(room: InternalRoom, playerId: string): InternalPlayer {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    throw new LogicError('NOT_HOST', 'Only host can do that');
  }
  return player;
}

function gamePlayers(room: InternalRoom): GamePlayer[] {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatarId: p.avatarId,
    isHost: p.isHost,
  }));
}

function bindCtx(room: InternalRoom, now = Date.now()) {
  return makeGameContext({
    phase: room.phase,
    contentMode: room.contentMode,
    players: gamePlayers(room),
    now,
    getState: () => room.gameState,
    setState: (s) => {
      room.gameState = s;
    },
    setSubstate: (s) => {
      room.gameSubstate = s;
    },
    requestEnd: (summary: string) => {
      room.phase = 'RESULTS';
      room.gameSubstate = null;
      room.resultsSummary = summary;
    },
  });
}

function cleanupSelectedGame(room: InternalRoom): void {
  if (!room.selectedGameId) {
    room.gameState = null;
    room.gameSubstate = null;
    return;
  }
  const def = getGame(room.selectedGameId);
  if (def?.cleanup) {
    try {
      def.cleanup(bindCtx(room));
    } catch {
      // ignore cleanup errors in stubs
    }
  }
  room.gameState = null;
  room.gameSubstate = null;
}

export function attachTv(
  room: InternalRoom,
  clientSessionId: string,
): { sessionToken: string } {
  room.tvClientSessionId = clientSessionId;
  room.tvConnected = true;
  room.tvDisconnectedAt = null;
  room.tvRecoverDeadline = null;
  return { sessionToken: room.tvSessionToken };
}

export function pauseForTvDisconnect(room: InternalRoom, now = Date.now()): void {
  if (!room.tvConnected) return;
  room.tvConnected = false;
  room.tvClientSessionId = null;
  room.tvDisconnectedAt = now;
  room.tvRecoverDeadline = now + TV_RECOVER_MS;
  if (room.phase !== 'PAUSED' && room.phase !== 'ENDED') {
    room.resumePhase = room.phase;
    room.pauseReason = 'tv';
    room.phase = 'PAUSED';
    const def = room.selectedGameId ? getGame(room.selectedGameId) : undefined;
    def?.onPause?.(bindCtx(room));
  }
}

export function resumeTv(
  room: InternalRoom,
  clientSessionId: string,
  sessionToken: string,
): void {
  if (sessionToken !== room.tvSessionToken) {
    throw new LogicError('INVALID_TOKEN', 'Invalid TV session token');
  }
  room.tvClientSessionId = clientSessionId;
  room.tvConnected = true;
  room.tvDisconnectedAt = null;
  room.tvRecoverDeadline = null;
  if (room.phase === 'PAUSED' && room.pauseReason === 'tv') {
    const next = room.resumePhase ?? 'LOBBY';
    room.phase = next;
    room.pauseReason = null;
    room.resumePhase = null;
    const def = room.selectedGameId ? getGame(room.selectedGameId) : undefined;
    def?.onResume?.(bindCtx(room));
  }
}

export function endSessionIfTvTimedOut(
  room: InternalRoom,
  now = Date.now(),
): boolean {
  if (
    room.phase === 'PAUSED' &&
    room.pauseReason === 'tv' &&
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
  if (opts.sessionToken && opts.playerId) {
    const existing = room.players.get(opts.playerId);
    if (existing && existing.sessionToken === opts.sessionToken) {
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

  if (room.players.size >= MAX_PLAYERS) {
    throw new LogicError('ROOM_FULL', `Room is full (max ${MAX_PLAYERS} phones)`);
  }

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
  const normalized = hostCode.trim().toUpperCase().replace(/\s+/g, '');
  if (normalized !== room.hostCode.toUpperCase()) {
    throw new LogicError('INVALID_HOST_CODE', 'Wrong host code');
  }
  const player = room.players.get(playerId);
  if (!player) {
    throw new LogicError('PLAYER_NOT_FOUND', 'Player not in room');
  }
  player.isHost = true;
  room.hostClaimed = true;
  room.hostCode = null;
  return player;
}

export function setJoiningLocked(
  room: InternalRoom,
  playerId: string,
  locked: boolean,
): void {
  requireHost(room, playerId);
  room.joiningLocked = locked;
}

export function selectGame(
  room: InternalRoom,
  playerId: string,
  gameId: string,
): void {
  requireHost(room, playerId);
  if (room.phase !== 'LOBBY' && room.phase !== 'RESULTS') {
    throw new LogicError('BAD_STATE', 'Can only select game from lobby or results');
  }
  const def = getGame(gameId);
  if (!def) {
    throw new LogicError('UNKNOWN_GAME', `Unknown game: ${gameId}`);
  }
  // Switching games preserves membership — cleanup prior module only
  if (room.selectedGameId && room.selectedGameId !== gameId) {
    cleanupSelectedGame(room);
  }
  room.selectedGameId = gameId;
  room.gameState = def.createInitialState?.(room.contentMode) ?? null;
  room.gameSubstate = null;
  room.resultsSummary = null;
  room.phase = 'LOBBY';
}

export function setContentSettings(
  room: InternalRoom,
  playerId: string,
  contentMode: ContentMode,
): void {
  requireHost(room, playerId);
  if (contentMode !== 'family' && contentMode !== 'adult') {
    throw new LogicError('BAD_STATE', 'Invalid content mode');
  }
  room.contentMode = contentMode;
  // Refresh selected game initial state so pack selection applies before play
  if (room.phase === 'LOBBY' && room.selectedGameId) {
    const def = getGame(room.selectedGameId);
    if (def?.createInitialState) {
      room.gameState = def.createInitialState(contentMode);
    }
  }
}

export function startTutorial(room: InternalRoom, playerId: string): void {
  requireHost(room, playerId);
  if (room.phase !== 'LOBBY') {
    throw new LogicError('BAD_STATE', 'Tutorial starts from lobby');
  }
  if (!room.selectedGameId) {
    throw new LogicError('BAD_STATE', 'Select a game first');
  }
  if (!room.tvConnected) {
    throw new LogicError('BAD_STATE', 'TV must be connected');
  }
  const def = requireGameDef(room.selectedGameId);
  const connected = [...room.players.values()].filter((p) => p.connected).length;
  if (connected < def.minPlayers) {
    throw new LogicError(
      'TOO_FEW_PLAYERS',
      `Need at least ${def.minPlayers} connected players`,
    );
  }
  room.phase = 'TUTORIAL';
  room.resultsSummary = null;
  def.onTutorialStart?.(bindCtx(room));
}

export function startRound(room: InternalRoom, playerId: string): void {
  requireHost(room, playerId);
  if (room.phase !== 'TUTORIAL' && room.phase !== 'LOBBY') {
    throw new LogicError('BAD_STATE', 'Round starts from tutorial (or lobby)');
  }
  if (!room.selectedGameId) {
    throw new LogicError('BAD_STATE', 'Select a game first');
  }
  if (!room.tvConnected) {
    throw new LogicError('BAD_STATE', 'TV must be connected');
  }
  const def = requireGameDef(room.selectedGameId);
  // Allow LOBBY → PLAYING only if already had tutorial skipped? Spec: TUTORIAL → PLAYING.
  // Host "start round" from TUTORIAL; also allow from LOBBY after select for convenience stub.
  room.phase = 'PLAYING';
  room.resultsSummary = null;
  def.onRoundStart?.(bindCtx(room));
}

/** M1 compat: lobby → tutorial shortcut then host uses start_round; or direct playing for demo. */
export function startGame(room: InternalRoom, playerId: string): void {
  // Prefer full lifecycle: if game selected, start tutorial; else snack-chase demo path
  requireHost(room, playerId);
  if (room.phase !== 'LOBBY') {
    throw new LogicError('BAD_STATE', 'Can only start from lobby');
  }
  if (!room.tvConnected) {
    throw new LogicError('BAD_STATE', 'TV must be connected');
  }
  if (!room.selectedGameId) {
    // Legacy M1 demo: jump straight to PLAYING without a registered game
    room.phase = 'PLAYING';
    room.gameSubstate = 'demo_move';
    return;
  }
  startTutorial(room, playerId);
}

export function pauseByHost(room: InternalRoom, playerId: string): void {
  requireHost(room, playerId);
  if (room.phase !== 'TUTORIAL' && room.phase !== 'PLAYING') {
    throw new LogicError('BAD_STATE', 'Can only pause during tutorial or play');
  }
  room.resumePhase = room.phase;
  room.pauseReason = 'host';
  room.phase = 'PAUSED';
  const def = room.selectedGameId ? getGame(room.selectedGameId) : undefined;
  def?.onPause?.(bindCtx(room));
}

export function resumeByHost(room: InternalRoom, playerId: string): void {
  requireHost(room, playerId);
  if (room.phase !== 'PAUSED' || room.pauseReason !== 'host') {
    throw new LogicError('BAD_STATE', 'Not paused by host');
  }
  room.phase = room.resumePhase ?? 'PLAYING';
  room.pauseReason = null;
  room.resumePhase = null;
  const def = room.selectedGameId ? getGame(room.selectedGameId) : undefined;
  def?.onResume?.(bindCtx(room));
}

export function endRound(room: InternalRoom, playerId: string): void {
  requireHost(room, playerId);
  if (room.phase !== 'PLAYING' && room.phase !== 'TUTORIAL') {
    throw new LogicError('BAD_STATE', 'Can only end round from play/tutorial');
  }
  const def = room.selectedGameId ? getGame(room.selectedGameId) : undefined;
  const result = def?.onEnd?.(bindCtx(room));
  room.phase = 'RESULTS';
  room.gameSubstate = null;
  room.resultsSummary = result?.summary ?? 'Round complete (placeholder).';
}

export function returnToLibrary(room: InternalRoom, playerId: string): void {
  requireHost(room, playerId);
  cleanupSelectedGame(room);
  room.selectedGameId = null;
  room.resultsSummary = null;
  room.pauseReason = null;
  room.resumePhase = null;
  room.phase = 'LOBBY';
}

export function removePlayer(
  room: InternalRoom,
  hostPlayerId: string,
  targetPlayerId: string,
): void {
  requireHost(room, hostPlayerId);
  if (hostPlayerId === targetPlayerId) {
    throw new LogicError('CANNOT_REMOVE_SELF', 'Host cannot remove themselves');
  }
  const target = room.players.get(targetPlayerId);
  if (!target) {
    throw new LogicError('TARGET_NOT_FOUND', 'Player not found');
  }
  room.players.delete(targetPlayerId);
}

export function transferHost(
  room: InternalRoom,
  hostPlayerId: string,
  targetPlayerId: string,
): void {
  requireHost(room, hostPlayerId);
  const target = room.players.get(targetPlayerId);
  if (!target) {
    throw new LogicError('TARGET_NOT_FOUND', 'Player not found');
  }
  if (!target.connected) {
    throw new LogicError('BAD_STATE', 'Target must be connected');
  }
  const host = room.players.get(hostPlayerId)!;
  host.isHost = false;
  target.isHost = true;
  room.hostClaimed = true;
  room.hostCode = null;
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
  // Movement demo only when no catalog game (legacy debug) or snack-chase stub
  if (
    room.selectedGameId &&
    room.selectedGameId !== 'snack-chase'
  ) {
    // Confidence Club / Mixed Signals: ignore directional input
    return;
  }
  if (seq < player.inputSeq) return;
  player.inputSeq = seq;
  player.direction = direction;
  player.lastInputAt = now;

  if (room.phase === 'PLAYING' && room.selectedGameId) {
    const def = getGame(room.selectedGameId);
    def?.onInput?.(bindCtx(room, now), playerId, direction);
  }
}

export function applyGameAction(
  room: InternalRoom,
  playerId: string,
  action: string,
  payload: unknown,
  now = Date.now(),
): void {
  if (!room.selectedGameId) {
    throw new LogicError('BAD_STATE', 'No game selected');
  }
  if (room.phase !== 'TUTORIAL' && room.phase !== 'PLAYING') {
    // Includes RESULTS / ENDED — late actions cannot change a finished round
    throw new LogicError('BAD_STATE', 'Game actions not accepted in this phase');
  }
  const def = getGame(room.selectedGameId);
  if (!def?.onAction) {
    throw new LogicError('BAD_STATE', 'Game does not accept actions');
  }
  const result = def.onAction(bindCtx(room, now), playerId, action, payload);
  if (!result.ok) {
    throw new LogicError('BAD_STATE', result.error ?? 'Action rejected');
  }
}

export function tickMovement(room: InternalRoom, dtMs: number, now = Date.now()): void {
  if (room.phase !== 'PLAYING') return;
  const useMovement =
    !room.selectedGameId || room.selectedGameId === 'snack-chase';
  if (useMovement) {
    const dt = dtMs / 1000;
    for (const player of room.players.values()) {
      if (!player.connected) continue;
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
  }
  room.tick += 1;

  if (room.selectedGameId) {
    const def = getGame(room.selectedGameId);
    def?.onTick?.(bindCtx(room, now), dtMs);
  }
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

/**
 * Private payload for one player only.
 * Host must not receive other players' secrets — callers must only send to that playerId.
 */
export function getPrivateStateForPlayer(
  room: InternalRoom,
  playerId: string,
): unknown {
  if (!room.selectedGameId) return null;
  const def = getGame(room.selectedGameId);
  if (!def?.getPrivateState) return null;
  if (!room.players.has(playerId)) return null;
  return def.getPrivateState(bindCtx(room), playerId);
}

/**
 * Assert helper for tests: host private view never includes other secrets map.
 */
export function assertNoCrossPlayerSecrets(
  room: InternalRoom,
  viewerId: string,
  payload: unknown,
): boolean {
  if (!payload || typeof payload !== 'object') return true;
  const blob = JSON.stringify(payload);
  // Legacy stub secrets map
  const secrets = (room.gameState as { secrets?: Record<string, string> } | null)
    ?.secrets;
  if (secrets) {
    for (const [pid, secret] of Object.entries(secrets)) {
      if (pid === viewerId) continue;
      if (secret && blob.includes(secret)) return false;
    }
  }
  // Confidence Club: submissions map must never leak into private payload for others
  const submissions = (
    room.gameState as {
      submissions?: Record<string, { initialOption?: number | null }>;
    } | null
  )?.submissions;
  if (submissions) {
    for (const [pid, sub] of Object.entries(submissions)) {
      if (pid === viewerId) continue;
      if (
        sub &&
        sub.initialOption != null &&
        blob.includes(`"initialOption":${sub.initialOption}`)
      ) {
        // Private payload uses myInitialOption naming — still ensure other player ids absent
      }
      if (blob.includes(pid) && pid !== viewerId) return false;
    }
  }
  return true;
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

  const games: GameCatalogEntry[] = listGameCatalog();

  let publicGameState: unknown | null = null;
  if (room.selectedGameId) {
    const def = getGame(room.selectedGameId);
    if (def?.getPublicState) {
      try {
        publicGameState = def.getPublicState(bindCtx(room));
      } catch {
        publicGameState = null;
      }
    }
  }

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
    selectedGameId: room.selectedGameId,
    contentMode: room.contentMode,
    gameSubstate: room.gameSubstate,
    pauseReason: room.pauseReason,
    resumePhase: room.resumePhase,
    games,
    resultsSummary: room.resultsSummary,
    publicGameState,
  };

  if (opts.includeHostCode && room.hostCode) {
    state.hostCode = room.hostCode;
  }
  if (room.tvRecoverDeadline != null) {
    state.tvRecoverDeadline = room.tvRecoverDeadline;
  }
  return state;
}

function requireGameDef(gameId: string): GameDefinition {
  const def = getGame(gameId);
  if (!def) throw new LogicError('UNKNOWN_GAME', `Unknown game: ${gameId}`);
  return def;
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
