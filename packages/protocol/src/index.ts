/** RoomJoy shared protocol — Milestone 1 */

export const PROTOCOL_VERSION = 1;

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

export type RoomPhase = 'LOBBY' | 'PLAYING' | 'PAUSED' | 'ENDED';

export type ClientRole = 'tv' | 'phone';

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

/** Client → Server messages */
export interface MsgCreateTv {
  type: 'create_tv';
}

export interface MsgJoinPhone {
  type: 'join_phone';
  roomCode: string;
  nickname: string;
  avatarId: string;
  /** Reconnect with prior credentials */
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

export type ClientMessage =
  | MsgCreateTv
  | MsgJoinPhone
  | MsgClaimHost
  | MsgLockJoining
  | MsgStartGame
  | MsgInput
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
