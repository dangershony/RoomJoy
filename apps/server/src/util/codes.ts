import { customAlphabet } from 'nanoid';
import {
  HOST_CODE_LENGTH,
  ROOM_CODE_LENGTH,
} from '@roomjoy/protocol';

const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hostAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const tokenAlphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const genRoom = customAlphabet(roomAlphabet, ROOM_CODE_LENGTH);
const genHost = customAlphabet(hostAlphabet, HOST_CODE_LENGTH);
const genToken = customAlphabet(tokenAlphabet, 32);
const genId = customAlphabet(tokenAlphabet, 16);

export function generateRoomCode(): string {
  return genRoom();
}

export function generateHostCode(): string {
  return genHost();
}

/** Cryptographically random session token — not derivable from room code. */
export function generateSessionToken(): string {
  return genToken();
}

export function generatePlayerId(): string {
  return genId();
}

export function generateRoomId(): string {
  return genId();
}
