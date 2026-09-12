import { Room, Client } from '@colyseus/core';
import {
  JOIN_RATE_LIMIT_MAX,
  JOIN_RATE_LIMIT_WINDOW_MS,
  TICK_RATE_HZ,
  type ClientMessage,
  type Direction,
  type ServerMessage,
} from '@roomjoy/protocol';
import {
  JoinRateLimiter,
  LogicError,
  applyInput,
  attachTv,
  claimHost,
  createRoom,
  endSessionIfTvTimedOut,
  joinPhone,
  markPlayerDisconnected,
  pauseForTvDisconnect,
  resumeTv,
  setJoiningLocked,
  startGame,
  tickMovement,
  toPublicState,
  type InternalRoom,
} from './logic.js';

interface ClientMeta {
  role: 'tv' | 'phone';
  playerId?: string;
}

const joinLimiter = new JoinRateLimiter(
  JOIN_RATE_LIMIT_WINDOW_MS,
  JOIN_RATE_LIMIT_MAX,
);

/** Track rooms by short code for phone join lookups. */
export const roomsByCode = new Map<string, RoomJoyRoom>();

export class RoomJoyRoom extends Room {
  maxClients = 9; // 8 phones + 1 TV
  private logic!: InternalRoom;
  private wasPlayingBeforePause = false;
  private tickInterval?: ReturnType<typeof setInterval>;
  private recoverInterval?: ReturnType<typeof setInterval>;

  onCreate(): void {
    this.autoDispose = false; // keep alive during TV 60s recover
    this.logic = createRoom();
    roomsByCode.set(this.logic.roomCode.toUpperCase(), this);
    this.setMetadata({ roomCode: this.logic.roomCode });

    this.onMessage('*', (client, type, message) => {
      this.handleMessage(client, { ...(message as object), type } as ClientMessage);
    });

    // Also accept typed messages without wildcard
    this.onMessage('create_tv', (client) =>
      this.handleMessage(client, { type: 'create_tv' }),
    );
    this.onMessage('join_phone', (client, msg) =>
      this.handleMessage(client, { type: 'join_phone', ...(msg as object) } as ClientMessage),
    );
    this.onMessage('claim_host', (client, msg) =>
      this.handleMessage(client, { type: 'claim_host', ...(msg as object) } as ClientMessage),
    );
    this.onMessage('lock_joining', (client, msg) =>
      this.handleMessage(client, { type: 'lock_joining', ...(msg as object) } as ClientMessage),
    );
    this.onMessage('start_game', (client) =>
      this.handleMessage(client, { type: 'start_game' }),
    );
    this.onMessage('input', (client, msg) =>
      this.handleMessage(client, { type: 'input', ...(msg as object) } as ClientMessage),
    );
    this.onMessage('reconnect', (client, msg) =>
      this.handleMessage(client, { type: 'reconnect', ...(msg as object) } as ClientMessage),
    );

    const tickMs = 1000 / TICK_RATE_HZ;
    this.tickInterval = setInterval(() => {
      tickMovement(this.logic, tickMs);
      if (this.logic.phase === 'PLAYING') {
        this.broadcastState();
      }
    }, tickMs);

    this.recoverInterval = setInterval(() => {
      if (endSessionIfTvTimedOut(this.logic)) {
        this.broadcastMessage({
          type: 'session_ended',
          reason: 'TV disconnected too long',
        });
        this.broadcastState();
        void this.disconnect();
      }
    }, 1000);
  }

  async onAuth(_client: Client, options: Record<string, unknown>): Promise<boolean> {
    const role = options?.role as string | undefined;
    if (role === 'phone') {
      const ip = String(options?.ip ?? _client.sessionId);
      if (!joinLimiter.check(ip)) {
        throw new Error('RATE_LIMITED');
      }
    }
    return true;
  }

  onJoin(client: Client, options: Record<string, unknown>): void {
    const role = (options?.role as string) ?? 'phone';
    const meta: ClientMeta = { role: role === 'tv' ? 'tv' : 'phone' };
    (client as Client & { meta: ClientMeta }).meta = meta;

    if (meta.role === 'tv') {
      // Fresh TV create OR reconnect
      const token = options?.sessionToken as string | undefined;
      if (token && token === this.logic.tvSessionToken) {
        resumeTv(
          this.logic,
          client.sessionId,
          token,
          this.wasPlayingBeforePause,
        );
        this.wasPlayingBeforePause = false;
        this.sendWelcome(client, 'tv', undefined, this.logic.tvSessionToken);
        this.broadcastState();
        return;
      }
      attachTv(this.logic, client.sessionId);
      this.sendWelcome(client, 'tv', undefined, this.logic.tvSessionToken);
      this.broadcastState();
      return;
    }

    // Phone join
    try {
      const player = joinPhone(this.logic, {
        nickname: String(options?.nickname ?? 'Player'),
        avatarId: String(options?.avatarId ?? 'fox'),
        clientSessionId: client.sessionId,
        sessionToken: options?.sessionToken as string | undefined,
        playerId: options?.playerId as string | undefined,
      });
      meta.playerId = player.id;
      this.sendWelcome(client, 'phone', player.id, player.sessionToken);
      this.broadcastState();
    } catch (e) {
      const err = e as LogicError;
      this.sendError(client, err.code ?? 'BAD_STATE', err.message);
      // Kick after short delay so error is delivered
      setTimeout(() => client.leave(4000), 50);
    }
  }

  onLeave(client: Client): void {
    const meta = (client as Client & { meta?: ClientMeta }).meta;
    if (!meta) return;

    if (meta.role === 'tv') {
      this.wasPlayingBeforePause = this.logic.phase === 'PLAYING';
      pauseForTvDisconnect(this.logic);
      this.broadcastState();
      return;
    }

    if (meta.playerId) {
      markPlayerDisconnected(this.logic, meta.playerId);
      this.broadcastState();
    }
  }

  onDispose(): void {
    roomsByCode.delete(this.logic.roomCode.toUpperCase());
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.recoverInterval) clearInterval(this.recoverInterval);
  }

  private handleMessage(client: Client, msg: ClientMessage): void {
    const meta = (client as Client & { meta?: ClientMeta }).meta;
    if (!meta) return;

    try {
      switch (msg.type) {
        case 'claim_host': {
          if (!meta.playerId) return;
          claimHost(this.logic, meta.playerId, msg.hostCode);
          this.broadcastState();
          break;
        }
        case 'lock_joining': {
          if (!meta.playerId) return;
          setJoiningLocked(this.logic, meta.playerId, msg.locked);
          this.broadcastState();
          break;
        }
        case 'start_game': {
          if (!meta.playerId) return;
          startGame(this.logic, meta.playerId);
          this.broadcastState();
          break;
        }
        case 'input': {
          if (!meta.playerId) return;
          applyInput(
            this.logic,
            meta.playerId,
            msg.direction as Direction,
            msg.seq,
          );
          break;
        }
        case 'reconnect': {
          // Handled primarily via onJoin options; acknowledge
          break;
        }
        default:
          break;
      }
    } catch (e) {
      const err = e as LogicError;
      this.sendError(client, err.code ?? 'BAD_STATE', err.message);
    }
  }

  private sendWelcome(
    client: Client,
    role: 'tv' | 'phone',
    playerId: string | undefined,
    sessionToken: string,
  ): void {
    const includeHostCode = role === 'tv' && !this.logic.hostClaimed;
    const welcome: ServerMessage = {
      type: 'welcome',
      role,
      roomId: this.logic.roomId,
      playerId,
      sessionToken,
      roomCode: this.logic.roomCode,
      hostCode: includeHostCode ? this.logic.hostCode ?? undefined : undefined,
      state: toPublicState(this.logic, { includeHostCode }),
    };
    client.send('message', welcome);
  }

  private sendError(client: Client, code: string, message: string): void {
    const err: ServerMessage = { type: 'error', code, message };
    client.send('message', err);
  }

  private broadcastMessage(msg: ServerMessage): void {
    this.broadcast('message', msg);
  }

  private broadcastState(): void {
    for (const client of this.clients) {
      const meta = (client as Client & { meta?: ClientMeta }).meta;
      const includeHostCode =
        meta?.role === 'tv' && !this.logic.hostClaimed;
      const stateMsg: ServerMessage = {
        type: 'state',
        state: toPublicState(this.logic, { includeHostCode }),
      };
      client.send('message', stateMsg);
    }
  }

  getRoomCode(): string {
    return this.logic.roomCode;
  }
}
