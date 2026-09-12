import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_PLAYERS,
  STALE_INPUT_MS,
  PLAYER_SPEED,
} from '@roomjoy/protocol';
import { listGameCatalog } from '@roomjoy/game-sdk';
import {
  LogicError,
  applyGameAction,
  applyInput,
  assertNoCrossPlayerSecrets,
  claimHost,
  createRoom,
  endRound,
  getPrivateStateForPlayer,
  joinPhone,
  markPlayerDisconnected,
  pauseByHost,
  removePlayer,
  resumeByHost,
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

function hostAndPlayers(n = 2) {
  const room = createRoom();
  const players = [];
  for (let i = 0; i < n; i++) {
    players.push(
      joinPhone(room, {
        nickname: `P${i}`,
        avatarId: 'fox',
        clientSessionId: `c${i}`,
      }),
    );
  }
  claimHost(room, players[0]!.id, room.hostCode!);
  return { room, host: players[0]!, players };
}

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

    tickMovement(room, 100, t0 + 50);
    expect(p.x).toBeGreaterThan(x0);

    const x1 = p.x;
    tickMovement(room, 100, t0 + STALE_INPUT_MS + 100);
    expect(p.direction).toBe('none');
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
    tickMovement(room, 1000, t0 + 10);
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

describe('lifecycle transitions', () => {
  it('LOBBY → TUTORIAL → PLAYING → RESULTS → LOBBY', () => {
    const { room, host } = hostAndPlayers(3);
    selectGame(room, host.id, 'confidence-club');
    expect(room.phase).toBe('LOBBY');
    expect(room.selectedGameId).toBe('confidence-club');

    startTutorial(room, host.id);
    expect(room.phase).toBe('TUTORIAL');

    startRound(room, host.id);
    expect(room.phase).toBe('PLAYING');
    expect(room.gameSubstate).toBeTruthy();

    endRound(room, host.id);
    expect(room.phase).toBe('RESULTS');
    expect(room.resultsSummary).toMatch(/Confidence Club/i);

    returnToLibrary(room, host.id);
    expect(room.phase).toBe('LOBBY');
    expect(room.selectedGameId).toBeNull();
  });

  it('host pause / resume during PLAYING', () => {
    const { room, host } = hostAndPlayers(3);
    selectGame(room, host.id, 'snack-chase');
    startTutorial(room, host.id);
    startRound(room, host.id);
    pauseByHost(room, host.id);
    expect(room.phase).toBe('PAUSED');
    expect(room.pauseReason).toBe('host');
    resumeByHost(room, host.id);
    expect(room.phase).toBe('PLAYING');
  });
});

describe('host-only actions', () => {
  it('non-host cannot select game, lock, start, pause, remove, transfer', () => {
    const { room, players } = hostAndPlayers(2);
    const guest = players[1]!;

    expect(() => selectGame(room, guest.id, 'mixed-signals')).toThrow(LogicError);
    expect(() => setJoiningLocked(room, guest.id, true)).toThrow(LogicError);
    expect(() => setContentSettings(room, guest.id, 'adult')).toThrow(LogicError);

    selectGame(room, players[0]!.id, 'mixed-signals');
    expect(() => startTutorial(room, guest.id)).toThrow(LogicError);

    startTutorial(room, players[0]!.id);
    expect(() => startRound(room, guest.id)).toThrow(LogicError);
    startRound(room, players[0]!.id);
    expect(() => pauseByHost(room, guest.id)).toThrow(LogicError);
    expect(() => removePlayer(room, guest.id, players[0]!.id)).toThrow(LogicError);
    expect(() => transferHost(room, guest.id, players[0]!.id)).toThrow(LogicError);
    expect(() => returnToLibrary(room, guest.id)).toThrow(LogicError);
  });
});

describe('transfer host', () => {
  it('moves host flag to target', () => {
    const { room, host, players } = hostAndPlayers(2);
    const other = players[1]!;
    transferHost(room, host.id, other.id);
    expect(host.isHost).toBe(false);
    expect(other.isHost).toBe(true);
    expect(room.hostClaimed).toBe(true);
  });
});

describe('remove player', () => {
  it('host removes another player; membership shrinks', () => {
    const { room, host, players } = hostAndPlayers(3);
    const victim = players[2]!;
    removePlayer(room, host.id, victim.id);
    expect(room.players.has(victim.id)).toBe(false);
    expect(room.players.size).toBe(2);
  });

  it('host cannot remove self', () => {
    const { room, host } = hostAndPlayers(2);
    expect(() => removePlayer(room, host.id, host.id)).toThrow(LogicError);
  });
});

describe('lock join', () => {
  it('blocks new joins while unlocked allows', () => {
    const { room, host } = hostAndPlayers(1);
    setJoiningLocked(room, host.id, true);
    expect(room.joiningLocked).toBe(true);
    expect(() =>
      joinPhone(room, {
        nickname: 'Nope',
        avatarId: 'cat',
        clientSessionId: 'x',
      }),
    ).toThrow(LogicError);

    setJoiningLocked(room, host.id, false);
    const late = joinPhone(room, {
      nickname: 'Late',
      avatarId: 'cat',
      clientSessionId: 'late',
    });
    expect(late.id).toBeTruthy();
  });
});

describe('game switch preserves membership', () => {
  it('switching modules keeps the same players', () => {
    const { room, host, players } = hostAndPlayers(3);
    const ids = players.map((p) => p.id).sort();
    selectGame(room, host.id, 'confidence-club');
    startTutorial(room, host.id);
    returnToLibrary(room, host.id);
    selectGame(room, host.id, 'snack-chase');
    expect([...room.players.keys()].sort()).toEqual(ids);
    expect(room.selectedGameId).toBe('snack-chase');
    expect(room.phase).toBe('LOBBY');
  });
});

describe('private state channel', () => {
  it('each player only sees own CC answers; host does not get others', () => {
    const { room, host, players } = hostAndPlayers(3);
    selectGame(room, host.id, 'confidence-club');
    startTutorial(room, host.id);
    startRound(room, host.id);

    applyGameAction(room, players[0]!.id, 'submit_answer', {
      optionIndex: 0,
      confidence: 2,
    });
    applyGameAction(room, players[1]!.id, 'submit_answer', {
      optionIndex: 3,
      confidence: 1,
    });

    for (const p of players) {
      const priv = getPrivateStateForPlayer(room, p.id) as {
        gameId: string;
        myInitialOption: number | null;
      };
      expect(priv.gameId).toBe('confidence-club');
      expect(assertNoCrossPlayerSecrets(room, p.id, priv)).toBe(true);
    }

    const hostPriv = getPrivateStateForPlayer(room, host.id) as {
      myInitialOption: number | null;
    };
    const guestPriv = getPrivateStateForPlayer(room, players[1]!.id) as {
      myInitialOption: number | null;
    };
    expect(hostPriv.myInitialOption).toBe(0);
    expect(guestPriv.myInitialOption).toBe(3);
    expect(hostPriv.myInitialOption).not.toBe(guestPriv.myInitialOption);
  });
});

describe('game catalog', () => {
  it('registers three games', () => {
    const catalog = listGameCatalog();
    const ids = catalog.map((g) => g.id).sort();
    expect(ids).toEqual([
      'confidence-club',
      'mixed-signals',
      'snack-chase',
    ]);
    for (const g of catalog) {
      expect(g.title).toBeTruthy();
      expect(g.description).toBeTruthy();
      expect(g.thumbnail).toBeTruthy();
      expect(g.estimatedDurationMinutes).toBeGreaterThan(0);
    }
  });
});

describe('confidence club actions', () => {
  it('rejects late actions after results', () => {
    const { room, host, players } = hostAndPlayers(2);
    selectGame(room, host.id, 'confidence-club');
    startTutorial(room, host.id);
    startRound(room, host.id);
    endRound(room, host.id);
    expect(room.phase).toBe('RESULTS');
    expect(() =>
      applyGameAction(room, players[0]!.id, 'submit_answer', {
        optionIndex: 1,
        confidence: 2,
      }),
    ).toThrow(LogicError);
  });

  it('public state omits correctIndex until reveal', () => {
    const { room, host } = hostAndPlayers(2);
    selectGame(room, host.id, 'confidence-club');
    startTutorial(room, host.id);
    startRound(room, host.id);
    const state = toPublicState(room, { includeHostCode: false });
    const gs = state.publicGameState as {
      correctIndex: number | null;
      question: { prompt: string } | null;
    };
    expect(gs.question?.prompt).toBeTruthy();
    expect(gs.correctIndex).toBeNull();
  });
});
