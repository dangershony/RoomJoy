import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, Room } from 'colyseus.js';
import type {
  ClientRole,
  ContentMode,
  Direction,
  RoomStatePublic,
  ServerMessage,
} from '@roomjoy/protocol';
import { getServerHttpUrl, getServerUrl } from '../lib/serverUrl';
import { clearCreds, loadCreds, saveCreds } from '../lib/storage';

export type ConnStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'ended';

export interface RoomConnection {
  status: ConnStatus;
  error: string | null;
  role: ClientRole | null;
  playerId: string | null;
  sessionToken: string | null;
  roomCode: string | null;
  hostCode: string | null;
  state: RoomStatePublic | null;
  /** Own private payload only — never other players' secrets */
  privateState: unknown;
  createTv: () => Promise<void>;
  joinPhone: (opts: {
    roomCode: string;
    nickname: string;
    avatarId: string;
  }) => Promise<void>;
  claimHost: (hostCode: string) => void;
  lockJoining: (locked: boolean) => void;
  selectGame: (gameId: string) => void;
  setContentSettings: (contentMode: ContentMode) => void;
  startTutorial: () => void;
  startRound: () => void;
  pause: () => void;
  resume: () => void;
  removePlayer: (targetPlayerId: string) => void;
  transferHost: (targetPlayerId: string) => void;
  returnToLibrary: () => void;
  endRound: () => void;
  startGame: () => void;
  sendInput: (direction: Direction) => void;
  tryReconnect: () => Promise<boolean>;
  disconnect: () => void;
}

async function findRoomIdByCode(roomCode: string): Promise<string | null> {
  const res = await fetch(
    `${getServerHttpUrl()}/api/rooms/${encodeURIComponent(roomCode.toUpperCase())}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { roomId: string };
  return data.roomId;
}

export function useRoomConnection(): RoomConnection {
  const [status, setStatus] = useState<ConnStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<ClientRole | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [state, setState] = useState<RoomStatePublic | null>(null);
  const [privateState, setPrivateState] = useState<unknown>(null);

  const clientRef = useRef<Client | null>(null);
  const roomRef = useRef<Room | null>(null);
  const seqRef = useRef(0);
  const intentionalLeave = useRef(false);
  const playerIdRef = useRef<string | null>(null);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome':
        setRole(msg.role);
        setPlayerId(msg.playerId ?? null);
        setSessionToken(msg.sessionToken);
        setRoomCode(msg.roomCode);
        setHostCode(msg.hostCode ?? null);
        setState(msg.state);
        setPrivateState(msg.privateState ?? null);
        setStatus('connected');
        setError(null);
        saveCreds({
          roomId: msg.roomId,
          roomCode: msg.roomCode,
          playerId: msg.playerId,
          sessionToken: msg.sessionToken,
          role: msg.role,
        });
        break;
      case 'state':
        setState(msg.state);
        if (msg.state.hostCode !== undefined) {
          setHostCode(msg.state.hostCode ?? null);
        } else if (msg.state.hostClaimed) {
          setHostCode(null);
        }
        if (msg.state.phase === 'ENDED') {
          setStatus('ended');
          clearCreds();
        }
        break;
      case 'private_state':
        // Only accept if addressed to us (defense in depth)
        if (msg.playerId === playerIdRef.current) {
          setPrivateState(msg.payload);
        }
        break;
      case 'error':
        setError(`${msg.code}: ${msg.message}`);
        break;
      case 'session_ended':
        setStatus('ended');
        setError(msg.reason);
        clearCreds();
        break;
    }
  }, []);

  const wireRoom = useCallback(
    (room: Room) => {
      roomRef.current = room;
      room.onMessage('message', (msg: ServerMessage) => handleServerMessage(msg));
      room.onLeave((code) => {
        roomRef.current = null;
        if (intentionalLeave.current) return;
        if (code === 1000) return;
        setStatus('reconnecting');
      });
      room.onError((_code, message) => {
        setError(message ?? 'Room error');
        setStatus('error');
      });
    },
    [handleServerMessage],
  );

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new Client(getServerUrl());
    }
    return clientRef.current;
  }, []);

  const createTv = useCallback(async () => {
    intentionalLeave.current = false;
    setStatus('connecting');
    setError(null);
    try {
      const client = getClient();
      const room = await client.create('roomjoy', { role: 'tv' });
      wireRoom(room);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [getClient, wireRoom]);

  const joinPhone = useCallback(
    async (opts: { roomCode: string; nickname: string; avatarId: string }) => {
      intentionalLeave.current = false;
      setStatus('connecting');
      setError(null);
      try {
        const roomId = await findRoomIdByCode(opts.roomCode);
        if (!roomId) {
          throw new Error('Room not found. Check the code on the TV.');
        }
        const client = getClient();
        const creds = loadCreds();
        const options: Record<string, unknown> = {
          role: 'phone',
          nickname: opts.nickname,
          avatarId: opts.avatarId,
        };
        if (
          creds?.role === 'phone' &&
          creds.roomCode.toUpperCase() === opts.roomCode.toUpperCase() &&
          creds.sessionToken &&
          creds.playerId
        ) {
          options.sessionToken = creds.sessionToken;
          options.playerId = creds.playerId;
        }
        const room = await client.joinById(roomId, options);
        wireRoom(room);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [getClient, wireRoom],
  );

  const tryReconnect = useCallback(async (): Promise<boolean> => {
    const creds = loadCreds();
    if (!creds) return false;
    setStatus('reconnecting');
    try {
      const roomId = await findRoomIdByCode(creds.roomCode);
      if (!roomId) {
        setStatus('ended');
        clearCreds();
        return false;
      }
      const client = getClient();
      if (creds.role === 'tv') {
        const room = await client.joinById(roomId, {
          role: 'tv',
          sessionToken: creds.sessionToken,
        });
        wireRoom(room);
        return true;
      }
      const room = await client.joinById(roomId, {
        role: 'phone',
        nickname: 'Player',
        avatarId: 'fox',
        sessionToken: creds.sessionToken,
        playerId: creds.playerId,
      });
      wireRoom(room);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      return false;
    }
  }, [getClient, wireRoom]);

  const send = useCallback((type: string, payload: object = {}) => {
    roomRef.current?.send(type, payload);
  }, []);

  const claimHost = useCallback(
    (code: string) => send('claim_host', { hostCode: code }),
    [send],
  );
  const lockJoining = useCallback(
    (locked: boolean) => send('lock_joining', { locked }),
    [send],
  );
  const selectGame = useCallback(
    (gameId: string) => send('select_game', { gameId }),
    [send],
  );
  const setContentSettings = useCallback(
    (contentMode: ContentMode) =>
      send('set_content_settings', { contentMode }),
    [send],
  );
  const startTutorial = useCallback(() => send('start_tutorial'), [send]);
  const startRound = useCallback(() => send('start_round'), [send]);
  const pause = useCallback(() => send('pause'), [send]);
  const resume = useCallback(() => send('resume'), [send]);
  const removePlayer = useCallback(
    (targetPlayerId: string) => send('remove_player', { targetPlayerId }),
    [send],
  );
  const transferHost = useCallback(
    (targetPlayerId: string) => send('transfer_host', { targetPlayerId }),
    [send],
  );
  const returnToLibrary = useCallback(() => send('return_to_library'), [send]);
  const endRound = useCallback(() => send('end_round'), [send]);
  const startGame = useCallback(() => send('start_game'), [send]);

  const sendInput = useCallback((direction: Direction) => {
    seqRef.current += 1;
    roomRef.current?.send('input', { direction, seq: seqRef.current });
  }, []);

  const disconnect = useCallback(() => {
    intentionalLeave.current = true;
    void roomRef.current?.leave();
    roomRef.current = null;
    clearCreds();
    setStatus('idle');
    setState(null);
    setPrivateState(null);
  }, []);

  useEffect(() => {
    const creds = loadCreds();
    if (creds && status === 'idle') {
      void tryReconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'reconnecting') return;
    const t = setTimeout(() => {
      void tryReconnect();
    }, 800);
    return () => clearTimeout(t);
  }, [status, tryReconnect]);

  return {
    status,
    error,
    role,
    playerId,
    sessionToken,
    roomCode,
    hostCode,
    state,
    privateState,
    createTv,
    joinPhone,
    claimHost,
    lockJoining,
    selectGame,
    setContentSettings,
    startTutorial,
    startRound,
    pause,
    resume,
    removePlayer,
    transferHost,
    returnToLibrary,
    endRound,
    startGame,
    sendInput,
    tryReconnect,
    disconnect,
  };
}
