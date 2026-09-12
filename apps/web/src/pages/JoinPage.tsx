import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AVATAR_PRESETS, type Direction } from '@roomjoy/protocol';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { PlayerList } from '../components/PlayerList';
import { GameLibrary } from '../components/GameLibrary';
import { PhaseStub } from '../components/PhaseStub';
import { getAvatar } from '@roomjoy/protocol';
import { PhoneConfidenceClub } from '../games/confidence-club/PhoneConfidenceClub';
import type { CcPrivateState, CcPublicState } from '../games/confidence-club/types';

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

  const selectedMeta = useMemo(() => {
    const id = conn.state?.selectedGameId;
    if (!id) return null;
    return conn.state?.games.find((g) => g.id === id) ?? null;
  }, [conn.state]);

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
        <button
          type="button"
          onClick={() => {
            conn.disconnect();
            navigate('/');
          }}
        >
          Home
        </button>
      </PhoneShell>
    );
  }

  if (conn.status === 'connected' && conn.state) {
    const phase = conn.state.phase;
    const isHost = !!me?.isHost;
    const isCC = conn.state.selectedGameId === 'confidence-club';

    if (isCC && (phase === 'TUTORIAL' || phase === 'PLAYING' || phase === 'RESULTS')) {
      return (
        <PhoneShell>
          <PhoneConfidenceClub
            phase={phase}
            publicGame={(conn.state.publicGameState as CcPublicState | null) ?? null}
            privateState={(conn.privateState as CcPrivateState | null) ?? null}
            isHost={isHost}
            onTutorialNext={() => conn.sendGameAction('tutorial_next')}
            onAdvance={() => conn.sendGameAction('advance')}
            onSubmitAnswer={(optionIndex, confidence) =>
              conn.sendGameAction('submit_answer', { optionIndex, confidence })
            }
            onReviseAnswer={(optionIndex) =>
              conn.sendGameAction('revise_answer', { optionIndex })
            }
            onStartRound={() => conn.startRound()}
            onPause={() => conn.pause()}
            onReturnToLibrary={() => conn.returnToLibrary()}
          />
          {isHost && phase !== 'RESULTS' ? <HostPlayerAdmin conn={conn} /> : null}
        </PhoneShell>
      );
    }

    if (phase === 'TUTORIAL') {
      return (
        <PhoneShell>
          <PhaseStub
            title="Tutorial"
            subtitle="Placeholder — follow along on the TV"
            gameTitle={selectedMeta?.title}
            gameThumb={selectedMeta?.thumbnail}
          />
          <PrivateHint privateState={conn.privateState} />
          {isHost ? (
            <HostLifecycleControls conn={conn} phase={phase} />
          ) : (
            <p className="tagline">Waiting for host…</p>
          )}
        </PhoneShell>
      );
    }

    if (phase === 'PLAYING') {
      // Demo / snack-chase: D-pad. No demo path when a non-movement game is selected.
      const showDpad =
        !conn.state.selectedGameId || conn.state.selectedGameId === 'snack-chase';
      return (
        <PhoneShell>
          <h1 style={{ marginBottom: 0 }}>
            {selectedMeta ? selectedMeta.title : 'Play!'}
          </h1>
          <p className="tagline">
            {conn.state.gameSubstate
              ? `Substate: ${conn.state.gameSubstate}`
              : 'Hold a direction — release to stop'}
          </p>
          <PrivateHint privateState={conn.privateState} />
          {showDpad ? (
            <Dpad
              onDir={(d) => conn.sendInput(d)}
              onStop={() => conn.sendInput('none')}
            />
          ) : (
            <p className="tagline">Follow the TV — phone controls coming later.</p>
          )}
          {isHost ? <HostLifecycleControls conn={conn} phase={phase} /> : null}
          <PlayerList players={conn.state.players} />
        </PhoneShell>
      );
    }

    if (phase === 'RESULTS') {
      return (
        <PhoneShell>
          <PhaseStub
            title="Results"
            subtitle={conn.state.resultsSummary ?? 'Round complete'}
            gameTitle={selectedMeta?.title}
            gameThumb={selectedMeta?.thumbnail}
          />
          <PlayerList players={conn.state.players} />
          {isHost ? (
            <button
              type="button"
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={() => conn.returnToLibrary()}
            >
              Return to library
            </button>
          ) : (
            <p className="tagline">Waiting for host…</p>
          )}
        </PhoneShell>
      );
    }

    if (phase === 'PAUSED') {
      return (
        <PhoneShell>
          <h1>Paused</h1>
          <p className="tagline">
            {conn.state.pauseReason === 'tv'
              ? 'Waiting for the TV to reconnect…'
              : 'Host paused'}
          </p>
          {isHost && conn.state.pauseReason === 'host' ? (
            <button type="button" onClick={() => conn.resume()}>
              Resume
            </button>
          ) : null}
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
        <p className="tagline">
          Players {conn.state.players.length}/{conn.state.capacity}
          {conn.state.joiningLocked ? ' · Joining locked' : ''}
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

        {isHost ? (
          <HostLobbyControls conn={conn} />
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <p className="tagline">Game library (host selects)</p>
            <GameLibrary
              games={conn.state.games}
              selectedGameId={conn.state.selectedGameId}
            />
            <p className="tagline" style={{ marginTop: '1rem' }}>
              Waiting for host…
            </p>
          </div>
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
        style={{
          ...inputStyle,
          fontSize: '1.75rem',
          letterSpacing: '0.2em',
          textAlign: 'center',
        }}
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

function PrivateHint({ privateState }: { privateState: unknown }) {
  if (!privateState || typeof privateState !== 'object') return null;
  const secret = (privateState as { secret?: string }).secret;
  if (!secret) return null;
  return (
    <div
      className="panel"
      style={{ margin: '0.75rem 0', borderLeft: '4px solid var(--accent-2)' }}
    >
      <p className="tagline" style={{ margin: 0, fontSize: '0.85rem' }}>
        Your private tip (only you see this)
      </p>
      <p style={{ margin: '0.25rem 0 0', fontWeight: 700 }}>{secret}</p>
    </div>
  );
}

function HostLobbyControls({
  conn,
}: {
  conn: ReturnType<typeof useRoomConnection>;
}) {
  const state = conn.state!;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
      <p className="tagline" style={{ margin: 0 }}>
        Select a game
      </p>
      {state.games.map((g) => (
        <button
          key={g.id}
          type="button"
          className={state.selectedGameId === g.id ? '' : 'secondary'}
          onClick={() => conn.selectGame(g.id)}
          style={{ textAlign: 'left', borderRadius: 16 }}
        >
          <span style={{ fontSize: '1.25rem', marginRight: 8 }}>{g.thumbnail}</span>
          <strong>{g.title}</strong>
          <span className="tagline" style={{ display: 'block', fontWeight: 600 }}>
            {g.minPlayers}–{g.maxPlayers} · ~{g.estimatedDurationMinutes} min
          </span>
        </button>
      ))}

      <div className="panel">
        <p className="tagline" style={{ margin: '0 0 0.5rem' }}>
          Content settings
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={state.contentMode === 'family' ? '' : 'secondary'}
            onClick={() => conn.setContentSettings('family')}
          >
            Family
          </button>
          <button
            type="button"
            className={state.contentMode === 'adult' ? '' : 'secondary'}
            onClick={() => conn.setContentSettings('adult')}
          >
            Adult
          </button>
        </div>
      </div>

      <button
        type="button"
        className="secondary"
        onClick={() => conn.lockJoining(!state.joiningLocked)}
      >
        {state.joiningLocked ? 'Unlock joining' : 'Lock joining'}
      </button>

      <button
        type="button"
        disabled={!state.selectedGameId}
        onClick={() => conn.startTutorial()}
      >
        Start tutorial
      </button>

      {state.selectedGameId ? (
        <button
          type="button"
          className="secondary"
          onClick={() => conn.returnToLibrary()}
        >
          Clear selection / library
        </button>
      ) : null}

      <HostPlayerAdmin conn={conn} />
    </div>
  );
}

function HostLifecycleControls({
  conn,
  phase,
}: {
  conn: ReturnType<typeof useRoomConnection>;
  phase: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
      {phase === 'TUTORIAL' ? (
        <button type="button" onClick={() => conn.startRound()}>
          Start round
        </button>
      ) : null}
      {phase === 'PLAYING' ? (
        <>
          <button type="button" className="secondary" onClick={() => conn.pause()}>
            Pause
          </button>
          <button type="button" onClick={() => conn.endRound()}>
            End round → Results
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="secondary"
        onClick={() => conn.returnToLibrary()}
      >
        Return to library
      </button>
      <HostPlayerAdmin conn={conn} />
    </div>
  );
}

function HostPlayerAdmin({
  conn,
}: {
  conn: ReturnType<typeof useRoomConnection>;
}) {
  const others =
    conn.state?.players.filter((p) => p.id !== conn.playerId) ?? [];
  if (others.length === 0) return null;
  return (
    <div className="panel" style={{ marginTop: '0.5rem' }}>
      <p className="tagline" style={{ margin: '0 0 0.5rem' }}>
        Players (host)
      </p>
      {others.map((p) => {
        const a = getAvatar(p.avatarId);
        return (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <span>
              {a.symbol} {p.nickname}
              {!p.connected ? ' (away)' : ''}
            </span>
            <button
              type="button"
              className="secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              disabled={!p.connected}
              onClick={() => conn.transferHost(p.id)}
            >
              Make host
            </button>
            <button
              type="button"
              className="danger"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => conn.removePlayer(p.id)}
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
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
