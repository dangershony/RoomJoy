/** RoomJoy shared protocol — Milestone 2 */

export const PROTOCOL_VERSION = 3;

export const MAX_PLAYERS = 8;
export const MAX_NICKNAME_LENGTH = 16;
export const ROOM_CODE_LENGTH = 4;
export const HOST_CODE_LENGTH = 4;
export const TV_RECOVER_MS = 60_000;
export const STALE_INPUT_MS = 200;
export const JOIN_RATE_LIMIT_WINDOW_MS = 10_000;
export const JOIN_RATE_LIMIT_MAX = 20;
export const TICK_RATE_HZ = 20;
export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 450;
export const PLAYER_SPEED = 180; // units per second

/** Full room lifecycle phases (plus PAUSED / ENDED for recovery). */
export type RoomPhase =
  | 'LOBBY'
  | 'TUTORIAL'
  | 'PLAYING'
  | 'RESULTS'
  | 'PAUSED'
  | 'ENDED';

export type ContentMode = 'family' | 'adult';

export type ClientRole = 'tv' | 'phone';

/** Permission lens for state delivery */
export type ViewPermission = 'display' | 'host' | 'player';

export interface AvatarPreset {
  id: string;
  symbol: string;
  color: string;
  label: string;
}

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'fox', symbol: '🦊', color: '#E67E22', label: 'Fox' },
  { id: 'owl', symbol: '🦉', color: '#8E44AD', label: 'Owl' },
  { id: 'cat', symbol: '🐱', color: '#E74C3C', label: 'Cat' },
  { id: 'dog', symbol: '🐶', color: '#3498DB', label: 'Dog' },
  { id: 'frog', symbol: '🐸', color: '#27AE60', label: 'Frog' },
  { id: 'bear', symbol: '🐻', color: '#D35400', label: 'Bear' },
  { id: 'panda', symbol: '🐼', color: '#2C3E50', label: 'Panda' },
  { id: 'unicorn', symbol: '🦄', color: '#9B59B6', label: 'Unicorn' },
] as const;

export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

export type PauseReason = 'tv' | 'host';

/** Client → Server messages */
export interface MsgCreateTv {
  type: 'create_tv';
}

export interface MsgJoinPhone {
  type: 'join_phone';
  roomCode: string;
  nickname: string;
  avatarId: string;
  sessionToken?: string;
  playerId?: string;
}

export interface MsgClaimHost {
  type: 'claim_host';
  hostCode: string;
}

export interface MsgLockJoining {
  type: 'lock_joining';
  locked: boolean;
}

export interface MsgSelectGame {
  type: 'select_game';
  gameId: string;
}

export interface MsgSetContentSettings {
  type: 'set_content_settings';
  contentMode: ContentMode;
}

export interface MsgStartTutorial {
  type: 'start_tutorial';
}

export interface MsgStartRound {
  type: 'start_round';
}

export interface MsgPause {
  type: 'pause';
}

export interface MsgResume {
  type: 'resume';
}

export interface MsgRemovePlayer {
  type: 'remove_player';
  targetPlayerId: string;
}

export interface MsgTransferHost {
  type: 'transfer_host';
  targetPlayerId: string;
}

export interface MsgReturnToLibrary {
  type: 'return_to_library';
}

export interface MsgEndRound {
  type: 'end_round';
}

/** @deprecated M1 — prefer start_tutorial / start_round */
export interface MsgStartGame {
  type: 'start_game';
}

export interface MsgInput {
  type: 'input';
  direction: Direction;
  seq: number;
}

export interface MsgReconnect {
  type: 'reconnect';
  roomId: string;
  playerId: string;
  sessionToken: string;
  role: ClientRole;
}

/** Game-module action (answers, tutorial advance, host skip, etc.) */
export interface MsgGameAction {
  type: 'game_action';
  action: string;
  payload?: unknown;
}

export type ClientMessage =
  | MsgCreateTv
  | MsgJoinPhone
  | MsgClaimHost
  | MsgLockJoining
  | MsgSelectGame
  | MsgSetContentSettings
  | MsgStartTutorial
  | MsgStartRound
  | MsgPause
  | MsgResume
  | MsgRemovePlayer
  | MsgTransferHost
  | MsgReturnToLibrary
  | MsgEndRound
  | MsgStartGame
  | MsgInput
  | MsgGameAction
  | MsgReconnect;

/** Server → Client messages / state snapshots */
export interface PlayerPublic {
  id: string;
  nickname: string;
  avatarId: string;
  isHost: boolean;
  connected: boolean;
  x: number;
  y: number;
}

export interface GameCatalogEntry {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedDurationMinutes: number;
}

export interface RoomStatePublic {
  roomId: string;
  roomCode: string;
  /** Only sent to TV until host is claimed */
  hostCode?: string;
  phase: RoomPhase;
  joiningLocked: boolean;
  players: PlayerPublic[];
  hostClaimed: boolean;
  capacity: number;
  tvConnected: boolean;
  tvRecoverDeadline?: number;
  tick: number;
  /** Selected game module id, or null in library */
  selectedGameId: string | null;
  contentMode: ContentMode;
  /** Game-defined substate inside PLAYING (stub string) */
  gameSubstate: string | null;
  pauseReason: PauseReason | null;
  /** Phase to resume into after PAUSED */
  resumePhase: RoomPhase | null;
  /** Catalog snapshot for TV library (always public) */
  games: GameCatalogEntry[];
  /** Stub results payload when in RESULTS */
  resultsSummary: string | null;
  /** Sanitized per-game public snapshot (no unrevealed private answers) */
  publicGameState: unknown | null;
}

/** Per-player private channel — never broadcast; never sent to host for others */
export interface MsgPrivateState {
  type: 'private_state';
  playerId: string;
  payload: unknown;
}

export interface MsgWelcome {
  type: 'welcome';
  role: ClientRole;
  roomId: string;
  playerId?: string;
  sessionToken: string;
  roomCode: string;
  hostCode?: string;
  state: RoomStatePublic;
  /** Own private payload only (phones) */
  privateState?: unknown;
}

export interface MsgState {
  type: 'state';
  state: RoomStatePublic;
}

export interface MsgError {
  type: 'error';
  code: string;
  message: string;
}

export interface MsgSessionEnded {
  type: 'session_ended';
  reason: string;
}

export type ServerMessage =
  | MsgWelcome
  | MsgState
  | MsgPrivateState
  | MsgError
  | MsgSessionEnded;

/** Escape / sanitize nickname for display */
export function sanitizeNickname(raw: string): string {
  const stripped = raw
    .replace(/[<>&"'`\\/]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_NICKNAME_LENGTH);
  return stripped.length > 0 ? stripped : 'Player';
}

export function isValidAvatarId(id: string): boolean {
  return AVATAR_PRESETS.some((a) => a.id === id);
}

export function getAvatar(id: string): AvatarPreset {
  return AVATAR_PRESETS.find((a) => a.id === id) ?? AVATAR_PRESETS[0]!;
}
