import { useMemo } from 'react';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { unlockAudio, playBeep } from '../lib/audio';
import { joinUrl } from '../lib/serverUrl';
import { QrJoin } from '../components/QrJoin';
import { PlayerList } from '../components/PlayerList';
import { GameCanvas } from '../components/GameCanvas';

export function TvPage() {
  const conn = useRoomConnection();

  const url = useMemo(
    () => (conn.roomCode ? joinUrl(conn.roomCode) : ''),
    [conn.roomCode],
  );

  const onStart = async () => {
    unlockAudio();
    playBeep(523, 100);
    await conn.createTv();
  };

  if (conn.status === 'reconnecting') {
    return (
      <>
        <div className="reconnecting-banner">Reconnecting to session…</div>
        <TvFrame title="Reconnecting" />
      </>
    );
  }

  if (conn.status === 'ended') {
    return (
      <TvFrame title="Session ended">
        <p style={{ fontSize: 'var(--tv-body)' }}>
          {conn.error ?? 'The TV was disconnected too long.'}
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Restart
        </button>
      </TvFrame>
    );
  }

  if (conn.status === 'idle' || conn.status === 'connecting' || conn.status === 'error') {
    return (
      <TvFrame title="RoomJoy">
        <p className="tagline" style={{ fontSize: 'var(--tv-body)' }}>
          Good company. Clever games.
        </p>
        <button
          type="button"
          onClick={() => void onStart()}
          disabled={conn.status === 'connecting'}
          style={{ fontSize: '1.5rem', padding: '1.2rem 2.4rem', marginTop: '1rem' }}
        >
          {conn.status === 'connecting' ? 'Starting…' : 'Start'}
        </button>
        {conn.error ? (
          <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{conn.error}</p>
        ) : null}
      </TvFrame>
    );
  }

  const phase = conn.state?.phase ?? 'LOBBY';

  if (phase === 'PAUSED') {
    const deadline = conn.state?.tvRecoverDeadline;
    const secs = deadline
      ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      : 60;
    return (
      <TvFrame title="Paused">
        <p style={{ fontSize: 'var(--tv-body)' }}>
          TV disconnected — recovering ({secs}s)…
        </p>
      </TvFrame>
    );
  }

  if (phase === 'PLAYING') {
    return (
      <main className="app-shell" style={{ padding: '1rem', gap: '0.75rem' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>RoomJoy Demo</h1>
          <span className="tagline">Room {conn.roomCode}</span>
        </header>
        <GameCanvas
          players={conn.state?.players ?? []}
          tick={conn.state?.tick ?? 0}
        />
        <PlayerList players={conn.state?.players ?? []} />
      </main>
    );
  }

  // LOBBY
  return (
    <main
      className="app-shell"
      style={{
        padding: '1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
        alignItems: 'center',
      }}
    >
      <section style={{ textAlign: 'center' }}>
        <h1 className="brand" style={{ fontSize: 'var(--tv-title)', margin: '0 0 0.5rem' }}>
          RoomJoy
        </h1>
        <p className="tagline" style={{ fontSize: 'var(--tv-body)', marginTop: 0 }}>
          Scan to join
        </p>
        {url ? <QrJoin url={url} size={300} /> : null}
        <p style={{ fontSize: '1rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
          {url}
        </p>
      </section>
      <section style={{ textAlign: 'center' }}>
        <p className="tagline" style={{ marginBottom: 0 }}>
          Room code
        </p>
        <div
          style={{
            fontSize: 'var(--tv-code)',
            fontWeight: 800,
            letterSpacing: '0.2em',
            lineHeight: 1.1,
          }}
          aria-label={`Room code ${conn.roomCode}`}
        >
          {conn.roomCode}
        </div>
        {conn.hostCode ? (
          <div className="panel" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
            <p className="tagline" style={{ margin: 0 }}>
              Host claim code (once)
            </p>
            <div
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 800,
                letterSpacing: '0.15em',
                color: 'var(--warn)',
              }}
            >
              {conn.hostCode}
            </div>
            <p className="tagline" style={{ margin: '0.5rem 0 0', fontSize: '0.95rem' }}>
              Enter on your phone to become host
            </p>
          </div>
        ) : (
          <p style={{ marginTop: '1rem', color: 'var(--ok)', fontWeight: 800 }}>
            Host claimed ✓
          </p>
        )}
        <div style={{ marginTop: '1.5rem' }}>
          <p className="tagline">
            Players ({conn.state?.players.length ?? 0}/{conn.state?.capacity ?? 8})
            {conn.state?.joiningLocked ? ' · Locked' : ''}
          </p>
          <PlayerList players={conn.state?.players ?? []} large />
        </div>
      </section>
    </main>
  );
}

function TvFrame({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      className="app-shell"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: 'var(--tv-title)', margin: 0 }}>{title}</h1>
      {children}
    </main>
  );
}
