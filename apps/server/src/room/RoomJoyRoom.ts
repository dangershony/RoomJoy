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
  endRound,
  endSessionIfTvTimedOut,
  getPrivateStateForPlayer,
  joinPhone,
  markPlayerDisconnected,
  pauseByHost,
  pauseForTvDisconnect,
  removePlayer,
  resumeByHost,
  resumeTv,
  returnToLibrary,
  selectGame,
  setContentSettings,
  setJoiningLocked,
  startGame,
  startRound,
  startTutorial,
  tickMovement,
  toPublicState,
  transferHost,
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
  private tickInterval?: ReturnType<typeof setInterval>;
  private recoverInterval?: ReturnType<typeof setInterval>;

  onCreate(): void {
    this.autoDispose = false;
    this.logic = createRoom();
    roomsByCode.set(this.logic.roomCode.toUpperCase(), this);
    this.setMetadata({ roomCode: this.logic.roomCode });

    this.onMessage('*', (client, type, message) => {
      this.handleMessage(client, { ...(message as object), type } as ClientMessage);
    });

    const handlers: Array<[string, boolean]> = [
      ['create_tv', false],
      ['join_phone', true],
      ['claim_host', true],
      ['lock_joining', true],
      ['select_game', true],
      ['set_content_settings', true],
      ['start_tutorial', false],
      ['start_round', false],
      ['pause', false],
      ['resume', false],
      ['remove_player', true],
      ['transfer_host', true],
      ['return_to_library', false],
      ['end_round', false],
      ['start_game', false],
      ['input', true],
      ['reconnect', true],
    ];
    for (const [name, hasPayload] of handlers) {
      this.onMessage(name, (client, msg) =>
        this.handleMessage(
          client,
          (hasPayload
            ? { type: name, ...(msg as object) }
            : { type: name }) as ClientMessage,
        ),
      );
    }

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
      const token = options?.sessionToken as string | undefined;
      if (token && token === this.logic.tvSessionToken) {
        resumeTv(this.logic, client.sessionId, token);
        this.sendWelcome(client, 'tv', undefined, this.logic.tvSessionToken);
        this.broadcastState();
        return;
      }
      attachTv(this.logic, client.sessionId);
      this.sendWelcome(client, 'tv', undefined, this.logic.tvSessionToken);
      this.broadcastState();
      return;
    }

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
      this.sendPrivateToPlayer(player.id);
    } catch (e) {
      const err = e as LogicError;
      this.sendError(client, err.code ?? 'BAD_STATE', err.message);
      setTimeout(() => client.leave(4000), 50);
    }
  }

  onLeave(client: Client): void {
    const meta = (client as Client & { meta?: ClientMeta }).meta;
    if (!meta) return;

    if (meta.role === 'tv') {
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
        case 'select_game': {
          if (!meta.playerId) return;
          selectGame(this.logic, meta.playerId, msg.gameId);
          this.broadcastState();
          this.broadcastPrivateStates();
          break;
        }
        case 'set_content_settings': {
          if (!meta.playerId) return;
          setContentSettings(this.logic, meta.playerId, msg.contentMode);
          this.broadcastState();
          break;
        }
        case 'start_tutorial': {
          if (!meta.playerId) return;
          startTutorial(this.logic, meta.playerId);
          this.broadcastState();
          this.broadcastPrivateStates();
          break;
        }
        case 'start_round': {
          if (!meta.playerId) return;
          startRound(this.logic, meta.playerId);
          this.broadcastState();
          this.broadcastPrivateStates();
          break;
        }
        case 'start_game': {
          if (!meta.playerId) return;
          startGame(this.logic, meta.playerId);
          this.broadcastState();
          this.broadcastPrivateStates();
          break;
        }
        case 'pause': {
          if (!meta.playerId) return;
          pauseByHost(this.logic, meta.playerId);
          this.broadcastState();
          break;
        }
        case 'resume': {
          if (!meta.playerId) return;
          resumeByHost(this.logic, meta.playerId);
          this.broadcastState();
          break;
        }
        case 'remove_player': {
          if (!meta.playerId) return;
          const targetId = msg.targetPlayerId;
          removePlayer(this.logic, meta.playerId, targetId);
          // Kick target client if connected
          for (const c of this.clients) {
            const m = (c as Client & { meta?: ClientMeta }).meta;
            if (m?.playerId === targetId) {
              c.send('message', {
                type: 'session_ended',
                reason: 'Removed by host',
              } satisfies ServerMessage);
              setTimeout(() => c.leave(4001), 50);
            }
          }
          this.broadcastState();
          break;
        }
        case 'transfer_host': {
          if (!meta.playerId) return;
          transferHost(this.logic, meta.playerId, msg.targetPlayerId);
          this.broadcastState();
          break;
        }
        case 'return_to_library': {
          if (!meta.playerId) return;
          returnToLibrary(this.logic, meta.playerId);
          this.broadcastState();
          break;
        }
        case 'end_round': {
          if (!meta.playerId) return;
          endRound(this.logic, meta.playerId);
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
        case 'reconnect':
          break;
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
    const privateState =
      role === 'phone' && playerId
        ? getPrivateStateForPlayer(this.logic, playerId)
        : undefined;
    const welcome: ServerMessage = {
      type: 'welcome',
      role,
      roomId: this.logic.roomId,
      playerId,
      sessionToken,
      roomCode: this.logic.roomCode,
      hostCode: includeHostCode ? this.logic.hostCode ?? undefined : undefined,
      state: toPublicState(this.logic, { includeHostCode }),
      privateState: privateState ?? undefined,
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

  /** Public state only — never embed other players' secrets. */
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

  /** Deliver private payloads only to the owning phone client. */
  private sendPrivateToPlayer(playerId: string): void {
    const payload = getPrivateStateForPlayer(this.logic, playerId);
    if (payload == null) return;
    for (const client of this.clients) {
      const meta = (client as Client & { meta?: ClientMeta }).meta;
      if (meta?.role === 'phone' && meta.playerId === playerId) {
        const msg: ServerMessage = {
          type: 'private_state',
          playerId,
          payload,
        };
        client.send('message', msg);
      }
    }
  }

  private broadcastPrivateStates(): void {
    for (const p of this.logic.players.values()) {
      if (p.connected) this.sendPrivateToPlayer(p.id);
    }
  }

  getRoomCode(): string {
    return this.logic.roomCode;
  }
}
