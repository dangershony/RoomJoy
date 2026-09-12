import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_PLAYERS,
  STALE_INPUT_MS,
  PLAYER_SPEED,
} from '@roomjoy/protocol';
import {
  LogicError,
  applyInput,
  claimHost,
  createRoom,
  joinPhone,
  markPlayerDisconnected,
  setJoiningLocked,
  startGame,
  tickMovement,
  type InternalRoom,
} from './logic.js';

describe('join capacity', () => {
  let room: InternalRoom;

  beforeEach(() => {
    room = createRoom();
  });

  it(`allows up to ${MAX_PLAYERS} phones`, () => {
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = joinPhone(room, {
        nickname: `P${i}`,
        avatarId: 'fox',
        clientSessionId: `c${i}`,
      });
      expect(p.id).toBeTruthy();
    }
    expect(room.players.size).toBe(MAX_PLAYERS);
  });

  it('rejects the 9th phone with ROOM_FULL', () => {
    for (let i = 0; i < MAX_PLAYERS; i++) {
      joinPhone(room, {
        nickname: `P${i}`,
        avatarId: 'cat',
        clientSessionId: `c${i}`,
      });
    }
    expect(() =>
      joinPhone(room, {
        nickname: 'Overflow',
        avatarId: 'dog',
        clientSessionId: 'c9',
      }),
    ).toThrow(LogicError);

    try {
      joinPhone(room, {
        nickname: 'Overflow',
        avatarId: 'dog',
        clientSessionId: 'c9',
      });
    } catch (e) {
      expect((e as LogicError).code).toBe('ROOM_FULL');
    }
  });

  it('rejects join when locked', () => {
    const host = joinPhone(room, {
      nickname: 'Host',
      avatarId: 'owl',
      clientSessionId: 'h1',
    });
    claimHost(room, host.id, room.hostCode!);
    setJoiningLocked(room, host.id, true);
    expect(() =>
      joinPhone(room, {
        nickname: 'Late',
        avatarId: 'fox',
        clientSessionId: 'late',
      }),
    ).toThrowError(/locked/i);
  });
});

describe('host claim once', () => {
  it('claims host once and removes host code', () => {
    const room = createRoom();
    const code = room.hostCode!;
    expect(code).toBeTruthy();

    const a = joinPhone(room, {
      nickname: 'Alice',
      avatarId: 'fox',
      clientSessionId: 'a',
    });
    const b = joinPhone(room, {
      nickname: 'Bob',
      avatarId: 'cat',
      clientSessionId: 'b',
    });

    claimHost(room, a.id, code);
    expect(a.isHost).toBe(true);
    expect(room.hostClaimed).toBe(true);
    expect(room.hostCode).toBeNull();

    expect(() => claimHost(room, b.id, code)).toThrow(LogicError);
    try {
      claimHost(room, b.id, code);
    } catch (e) {
      expect((e as LogicError).code).toBe('HOST_ALREADY_CLAIMED');
    }
  });

  it('rejects wrong host code', () => {
    const room = createRoom();
    const p = joinPhone(room, {
      nickname: 'X',
      avatarId: 'bear',
      clientSessionId: 'x',
    });
    expect(() => claimHost(room, p.id, 'ZZZZ')).toThrowError(/Wrong host/i);
  });

  it('host is also a player in the roster', () => {
    const room = createRoom();
    const p = joinPhone(room, {
      nickname: 'Hosty',
      avatarId: 'unicorn',
      clientSessionId: 'h',
    });
    claimHost(room, p.id, room.hostCode!);
    expect(room.players.get(p.id)?.isHost).toBe(true);
    expect(room.players.size).toBe(1);
  });
});

describe('reconnect identity', () => {
  it('same player after reconnect; no duplicates', () => {
    const room = createRoom();
    const p = joinPhone(room, {
      nickname: 'Dana',
      avatarId: 'panda',
      clientSessionId: 's1',
    });
    const token = p.sessionToken;
    const id = p.id;

    markPlayerDisconnected(room, id);
    expect(room.players.get(id)?.connected).toBe(false);
    expect(room.players.size).toBe(1);

    const again = joinPhone(room, {
      nickname: 'Ignored',
      avatarId: 'fox',
      clientSessionId: 's2',
      sessionToken: token,
      playerId: id,
    });

    expect(again.id).toBe(id);
    expect(again.nickname).toBe('Dana');
    expect(again.connected).toBe(true);
    expect(room.players.size).toBe(1);
  });

  it('rejects bad reconnect token', () => {
    const room = createRoom();
    const p = joinPhone(room, {
      nickname: 'Eve',
      avatarId: 'frog',
      clientSessionId: 'e1',
    });
    markPlayerDisconnected(room, p.id);
    expect(() =>
      joinPhone(room, {
        nickname: 'Eve',
        avatarId: 'frog',
        clientSessionId: 'e2',
        sessionToken: 'not-a-real-token',
        playerId: p.id,
      }),
    ).toThrow(LogicError);
  });
});

describe('stale input', () => {
  it('stops movement when input is stale', () => {
    const room = createRoom();
    const p = joinPhone(room, {
      nickname: 'Mover',
      avatarId: 'dog',
      clientSessionId: 'm1',
    });
    claimHost(room, p.id, room.hostCode!);
    startGame(room, p.id);

    const t0 = 1_000_000;
    applyInput(room, p.id, 'right', 1, t0);
    const x0 = p.x;

    // Fresh tick — should move
    tickMovement(room, 100, t0 + 50);
    expect(p.x).toBeGreaterThan(x0);
    expect(p.direction).toBe('right');

    const x1 = p.x;
    // Stale: now past STALE_INPUT_MS since last input
    tickMovement(room, 100, t0 + STALE_INPUT_MS + 100);
    expect(p.direction).toBe('none');
    // No further movement after stop
    expect(p.x).toBe(x1);
  });

  it('moves at authoritative speed while input is fresh', () => {
    const room = createRoom();
    const p = joinPhone(room, {
      nickname: 'Speedy',
      avatarId: 'cat',
      clientSessionId: 'sp',
    });
    claimHost(room, p.id, room.hostCode!);
    startGame(room, p.id);

    const t0 = 2_000_000;
    p.x = 400;
    p.y = 200;
    applyInput(room, p.id, 'right', 1, t0);
    tickMovement(room, 1000, t0 + 10); // 1 second
    expect(p.x).toBeCloseTo(400 + PLAYER_SPEED, 0);
  });
});

describe('nickname sanitization via join', () => {
  it('escapes dangerous nickname characters', () => {
    const room = createRoom();
    const p = joinPhone(room, {
      nickname: '<script>alert(1)</script>',
      avatarId: 'fox',
      clientSessionId: 'bad',
    });
    expect(p.nickname).not.toContain('<');
    expect(p.nickname).not.toContain('>');
  });
});
