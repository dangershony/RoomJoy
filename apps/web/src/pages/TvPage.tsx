import { useMemo } from 'react';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { unlockAudio, playBeep } from '../lib/audio';
import { joinUrl } from '../lib/serverUrl';
import { QrJoin } from '../components/QrJoin';
import { PlayerList } from '../components/PlayerList';
import { GameCanvas } from '../components/GameCanvas';
import { GameLibrary } from '../components/GameLibrary';
import { PhaseStub } from '../components/PhaseStub';
import { TvConfidenceClub } from '../games/confidence-club/TvConfidenceClub';
import type { CcPublicState } from '../games/confidence-club/types';

export function TvPage() {
  const conn = useRoomConnection();

  const url = useMemo(
    () => (conn.roomCode ? joinUrl(conn.roomCode) : ''),
    [conn.roomCode],
  );

  const selectedMeta = useMemo(() => {
    const id = conn.state?.selectedGameId;
    if (!id) return null;
    return conn.state?.games.find((g) => g.id === id) ?? null;
  }, [conn.state]);

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
  const games = conn.state?.games ?? [];

  if (phase === 'PAUSED') {
    const deadline = conn.state?.tvRecoverDeadline;
    const reason = conn.state?.pauseReason;
    const secs =
      reason === 'tv' && deadline
        ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        : null;
    return (
      <TvFrame title="Paused">
        <p style={{ fontSize: 'var(--tv-body)' }}>
          {reason === 'tv'
            ? `TV disconnected — recovering (${secs ?? 60}s)…`
            : 'Host paused the game'}
        </p>
      </TvFrame>
    );
  }

  if (phase === 'TUTORIAL') {
    if (conn.state?.selectedGameId === 'confidence-club') {
      return (
        <TvConfidenceClub
          phase={phase}
          publicGame={(conn.state.publicGameState as CcPublicState | null) ?? null}
        />
      );
    }
    return (
      <main className="app-shell" style={{ padding: '2rem', alignItems: 'center', justifyContent: 'center' }}>
        <PhaseStub
          title="Tutorial"
          subtitle="Learn the basics — placeholder"
          gameTitle={selectedMeta?.title}
          gameThumb={selectedMeta?.thumbnail}
          extra={
            <p className="tagline">
              Substate: {conn.state?.gameSubstate ?? '—'} · Content:{' '}
              {conn.state?.contentMode}
            </p>
          }
        />
        <div style={{ marginTop: '2rem', width: '100%', maxWidth: 720 }}>
          <PlayerList players={conn.state?.players ?? []} large />
        </div>
      </main>
    );
  }

  if (phase === 'PLAYING') {
    if (conn.state?.selectedGameId === 'confidence-club') {
      return (
        <TvConfidenceClub
          phase={phase}
          publicGame={(conn.state.publicGameState as CcPublicState | null) ?? null}
        />
      );
    }
    // Snack Chase / legacy demo (no catalog game) still shows movement canvas
    const showCanvas =
      !conn.state?.selectedGameId || conn.state.selectedGameId === 'snack-chase';
    return (
      <main className="app-shell" style={{ padding: '1rem', gap: '0.75rem' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>
            {selectedMeta
              ? `${selectedMeta.thumbnail} ${selectedMeta.title}`
              : 'RoomJoy Demo'}
          </h1>
          <span className="tagline">
            Room {conn.roomCode}
            {conn.state?.gameSubstate ? ` · ${conn.state.gameSubstate}` : ''}
          </span>
        </header>
        {showCanvas ? (
          <GameCanvas
            players={conn.state?.players ?? []}
            tick={conn.state?.tick ?? 0}
          />
        ) : (
          <PhaseStub
            title="Playing"
            subtitle="Gameplay stub — full rules coming later"
            gameTitle={selectedMeta?.title}
            gameThumb={selectedMeta?.thumbnail}
          />
        )}
        <PlayerList players={conn.state?.players ?? []} />
      </main>
    );
  }

  if (phase === 'RESULTS') {
    if (conn.state?.selectedGameId === 'confidence-club') {
      return (
        <main className="app-shell" style={{ padding: '2rem', gap: '1rem' }}>
          <TvConfidenceClub
            phase={phase}
            publicGame={(conn.state.publicGameState as CcPublicState | null) ?? null}
          />
          <p className="tagline" style={{ textAlign: 'center' }}>
            {conn.state?.resultsSummary}
          </p>
          <p className="tagline" style={{ textAlign: 'center' }}>
            Waiting for host to return to the library…
          </p>
        </main>
      );
    }
    return (
      <main
        className="app-shell"
        style={{
          padding: '2rem',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        <PhaseStub
          title="Results"
          subtitle={conn.state?.resultsSummary ?? 'Round complete'}
          gameTitle={selectedMeta?.title}
          gameThumb={selectedMeta?.thumbnail}
        />
        <PlayerList players={conn.state?.players ?? []} large />
        <p className="tagline">Waiting for host to return to the library…</p>
      </main>
    );
  }

  // LOBBY — library + join panel
  return (
    <main
      className="app-shell"
      style={{
        padding: '1.25rem',
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.2fr)',
        gap: '1.25rem',
        alignItems: 'start',
      }}
    >
      <section style={{ textAlign: 'center' }}>
        <h1 className="brand" style={{ fontSize: 'var(--tv-title)', margin: '0 0 0.25rem' }}>
          RoomJoy
        </h1>
        <p className="tagline" style={{ marginTop: 0 }}>
          {conn.state?.joiningLocked
            ? 'Joining locked'
            : 'Scan to join · room code stays visible while unlocked'}
        </p>
        {!conn.state?.joiningLocked && url ? <QrJoin url={url} size={240} /> : null}
        <div
          style={{
            fontSize: 'var(--tv-code)',
            fontWeight: 800,
            letterSpacing: '0.2em',
            lineHeight: 1.1,
            marginTop: '0.5rem',
          }}
          aria-label={`Room code ${conn.roomCode}`}
        >
          {conn.roomCode}
        </div>
        {conn.hostCode ? (
          <div className="panel" style={{ marginTop: '1rem', display: 'inline-block' }}>
            <p className="tagline" style={{ margin: 0 }}>
              Host claim code (once)
            </p>
            <div
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 3rem)',
                fontWeight: 800,
                letterSpacing: '0.15em',
                color: 'var(--warn)',
              }}
            >
              {conn.hostCode}
            </div>
          </div>
        ) : (
          <p style={{ marginTop: '0.75rem', color: 'var(--ok)', fontWeight: 800 }}>
            Host claimed ✓
          </p>
        )}
        <div style={{ marginTop: '1rem' }}>
          <p className="tagline">
            Players ({conn.state?.players.length ?? 0}/{conn.state?.capacity ?? 8})
            {conn.state?.joiningLocked ? ' · Locked' : ''}
          </p>
          <PlayerList players={conn.state?.players ?? []} large />
        </div>
      </section>

      <section>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.75rem' }}>
          {conn.state?.selectedGameId ? 'Selected game' : 'Game library'}
        </h2>
        <p className="tagline" style={{ marginTop: 0 }}>
          Host picks a game on their phone — TV reflects the selection.
        </p>
        <GameLibrary
          games={games}
          selectedGameId={conn.state?.selectedGameId ?? null}
          large
        />
        {conn.state?.selectedGameId ? (
          <p style={{ marginTop: '1rem', fontWeight: 700 }}>
            Content: {conn.state.contentMode === 'adult' ? 'Adult' : 'Family'} · Waiting
            for host to start tutorial…
          </p>
        ) : null}
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
