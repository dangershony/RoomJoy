import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AVATAR_PRESETS } from '@roomjoy/protocol';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { PlayerList } from '../components/PlayerList';
import type { Direction } from '@roomjoy/protocol';

export function JoinPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const conn = useRoomConnection();

  const [roomCode, setRoomCode] = useState((codeParam ?? '').toUpperCase());
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(AVATAR_PRESETS[0]!.id);
  const [hostInput, setHostInput] = useState('');

  const me = useMemo(
    () => conn.state?.players.find((p) => p.id === conn.playerId),
    [conn.state, conn.playerId],
  );

  if (conn.status === 'reconnecting') {
    return (
      <PhoneShell>
        <div className="reconnecting-banner">Reconnecting…</div>
        <h1>Reconnecting</h1>
        <p className="tagline">Restoring your seat…</p>
      </PhoneShell>
    );
  }

  if (conn.status === 'ended') {
    return (
      <PhoneShell>
        <h1>Session ended</h1>
        <p>{conn.error}</p>
        <button type="button" onClick={() => { conn.disconnect(); navigate('/'); }}>
          Home
        </button>
      </PhoneShell>
    );
  }

  if (conn.status === 'connected' && conn.state) {
    const phase = conn.state.phase;

    if (phase === 'PLAYING') {
      return (
        <PhoneShell>
          <h1 style={{ marginBottom: 0 }}>Play!</h1>
          <p className="tagline">Hold a direction — release to stop</p>
          <Dpad
            onDir={(d) => conn.sendInput(d)}
            onStop={() => conn.sendInput('none')}
          />
          <PlayerList players={conn.state.players} />
        </PhoneShell>
      );
    }

    if (phase === 'PAUSED') {
      return (
        <PhoneShell>
          <h1>Paused</h1>
          <p className="tagline">Waiting for the TV to reconnect…</p>
        </PhoneShell>
      );
    }

    // Lobby
    return (
      <PhoneShell>
        <h1>Lobby · {conn.roomCode}</h1>
        <p className="tagline">
          You are <strong>{me?.nickname ?? '…'}</strong>
          {me?.isHost ? ' (Host)' : ''}
        </p>
        <PlayerList players={conn.state.players} />

        {!conn.state.hostClaimed ? (
          <div className="panel" style={{ marginTop: '1rem' }}>
            <label className="tagline">Host claim code</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="CODE"
                style={inputStyle}
              />
              <button type="button" onClick={() => conn.claimHost(hostInput)}>
                Claim
              </button>
            </div>
          </div>
        ) : null}

        {me?.isHost ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => conn.lockJoining(!conn.state!.joiningLocked)}
            >
              {conn.state.joiningLocked ? 'Unlock joining' : 'Lock joining'}
            </button>
            <button type="button" onClick={() => conn.startGame()}>
              Start demo game
            </button>
          </div>
        ) : (
          <p className="tagline" style={{ marginTop: '1rem' }}>
            Waiting for host to start…
          </p>
        )}

        {conn.error ? (
          <p style={{ color: 'var(--danger)' }}>{conn.error}</p>
        ) : null}
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <h1>Join RoomJoy</h1>
      <label className="tagline">Room code</label>
      <input
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        maxLength={4}
        placeholder="ABCD"
        style={{ ...inputStyle, fontSize: '1.75rem', letterSpacing: '0.2em', textAlign: 'center' }}
      />
      <label className="tagline" style={{ marginTop: '0.75rem' }}>
        Nickname
      </label>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={16}
        placeholder="Your name"
        style={inputStyle}
      />
      <p className="tagline" style={{ marginTop: '0.75rem' }}>
        Avatar
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {AVATAR_PRESETS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={avatarId === a.id ? '' : 'secondary'}
            onClick={() => setAvatarId(a.id)}
            style={{
              background: avatarId === a.id ? a.color : undefined,
              color: avatarId === a.id ? '#0B1020' : undefined,
              padding: '0.5rem 0.75rem',
            }}
            aria-label={a.label}
          >
            {a.symbol} {a.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        style={{ marginTop: '1.25rem', width: '100%' }}
        disabled={!roomCode || !nickname || conn.status === 'connecting'}
        onClick={() => void conn.joinPhone({ roomCode, nickname, avatarId })}
      >
        {conn.status === 'connecting' ? 'Joining…' : 'Join'}
      </button>
      {conn.error ? (
        <p style={{ color: 'var(--danger)' }}>{conn.error}</p>
      ) : null}
    </PhoneShell>
  );
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="app-shell"
      style={{ padding: '1.25rem', gap: '0.5rem', maxWidth: 480, margin: '0 auto' }}
    >
      {children}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.85rem 1rem',
  borderRadius: 12,
  border: '2px solid #2A3555',
  background: '#0B1020',
  color: '#F4F7FF',
  marginTop: '0.35rem',
};

function Dpad({
  onDir,
  onStop,
}: {
  onDir: (d: Direction) => void;
  onStop: () => void;
}) {
  const bind = (d: Direction) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onDir(d);
    },
    onPointerUp: () => onStop(),
    onPointerCancel: () => onStop(),
  });

  const btn: React.CSSProperties = {
    width: 72,
    height: 72,
    borderRadius: 16,
    fontSize: '1.5rem',
    touchAction: 'none',
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '72px 72px 72px',
        gridTemplateRows: '72px 72px 72px',
        gap: 8,
        justifyContent: 'center',
        margin: '1.5rem 0',
        userSelect: 'none',
      }}
    >
      <div />
      <button type="button" style={btn} {...bind('up')} aria-label="Up">
        ▲
      </button>
      <div />
      <button type="button" style={btn} {...bind('left')} aria-label="Left">
        ◀
      </button>
      <button type="button" className="secondary" style={btn} onClick={() => onStop()}>
        ●
      </button>
      <button type="button" style={btn} {...bind('right')} aria-label="Right">
        ▶
      </button>
      <div />
      <button type="button" style={btn} {...bind('down')} aria-label="Down">
        ▼
      </button>
      <div />
    </div>
  );
}
