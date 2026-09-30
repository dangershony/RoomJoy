import type { RrPrivateState, RrPublicState } from './types';
import { TUTORIAL_COPY } from './types';
import { getAvatar } from '@roomjoy/protocol';

export function PhoneRailRush({
  phase,
  publicGame,
  privateState,
  isHost,
  onTutorialNext,
  onLaneLeft,
  onLaneRight,
  onStartRound,
  onPause,
  onEndRound,
  onReturnToLibrary,
}: {
  phase: string;
  publicGame: RrPublicState | null;
  privateState: RrPrivateState | null;
  isHost: boolean;
  onTutorialNext: () => void;
  onLaneLeft: () => void;
  onLaneRight: () => void;
  onStartRound: () => void;
  onPause: () => void;
  onEndRound: () => void;
  onReturnToLibrary: () => void;
}) {
  if (!publicGame) {
    return (
      <div>
        <h1>🛤️ Rail Rush</h1>
        <p className="tagline">Loading…</p>
      </div>
    );
  }

  if (phase === 'TUTORIAL') {
    const step = publicGame.tutorialStep ?? 'welcome';
    const copy = TUTORIAL_COPY[step] ?? TUTORIAL_COPY.welcome!;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="tagline" style={{ margin: 0 }}>
          Tutorial {publicGame.tutorialStepIndex + 1}/{publicGame.tutorialTotal}
        </p>
        <h1 style={{ margin: 0 }}>{copy.title}</h1>
        <p style={{ lineHeight: 1.4 }}>{copy.body}</p>
        <button type="button" style={{ minHeight: 52 }} onClick={onTutorialNext}>
          Next tip
        </button>
        {isHost ? (
          <button type="button" style={{ minHeight: 52 }} onClick={onStartRound}>
            Start round
          </button>
        ) : (
          <p className="tagline">Waiting for host to start…</p>
        )}
        {isHost ? (
          <button
            type="button"
            className="secondary"
            style={{ minHeight: 48 }}
            onClick={onReturnToLibrary}
          >
            Return to library
          </button>
        ) : null}
      </div>
    );
  }

  if (phase === 'RESULTS') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>🏁 Results</h1>
        <RankList rankings={publicGame.rankings} />
        {isHost ? (
          <button type="button" style={{ minHeight: 52 }} onClick={onReturnToLibrary}>
            Return to library
          </button>
        ) : (
          <p className="tagline">Waiting for host…</p>
        )}
      </div>
    );
  }

  // PLAYING
  const canSteer = !!privateState?.canSteer;
  const lane = privateState?.myLane;
  const alive = privateState?.alive ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h1 style={{ margin: 0 }}>🛤️ Rail Rush</h1>
      <p className="tagline" style={{ margin: 0 }}>
        {alive
          ? `Lane ${(lane ?? 0) + 1} · ${privateState?.myDistance ?? 0}m`
          : `Out · ${privateState?.myDistance ?? 0}m`}
        {' · '}
        {publicGame.aliveCount} still running
      </p>

      {!alive ? (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem' }}>
            You hit an obstacle!
          </p>
          <p className="tagline" style={{ margin: '0.5rem 0 0' }}>
            Watch the others on the TV.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginTop: '0.5rem',
          }}
        >
          <button
            type="button"
            disabled={!canSteer}
            onClick={onLaneLeft}
            style={{
              minHeight: 96,
              fontSize: '1.5rem',
              borderRadius: 24,
            }}
            aria-label="Move left"
          >
            ◀ Left
          </button>
          <button
            type="button"
            disabled={!canSteer}
            onClick={onLaneRight}
            style={{
              minHeight: 96,
              fontSize: '1.5rem',
              borderRadius: 24,
            }}
            aria-label="Move right"
          >
            Right ▶
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          marginTop: '0.25rem',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 28,
              height: 12,
              borderRadius: 6,
              background:
                lane === i ? 'var(--accent)' : 'var(--bg-elevated)',
              outline: '2px solid #2A3555',
            }}
          />
        ))}
      </div>

      <RankList rankings={publicGame.rankings} />

      {isHost ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginTop: '0.5rem',
          }}
        >
          <button
            type="button"
            className="secondary"
            style={{ minHeight: 48 }}
            onClick={onPause}
          >
            Pause
          </button>
          <button type="button" style={{ minHeight: 48 }} onClick={onEndRound}>
            End round → Results
          </button>
          <button
            type="button"
            className="secondary"
            style={{ minHeight: 48 }}
            onClick={onReturnToLibrary}
          >
            Return to library
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RankList({ rankings }: { rankings: RrPublicState['rankings'] }) {
  if (!rankings.length) return null;
  return (
    <div className="panel" style={{ marginTop: '0.25rem' }}>
      {rankings.slice(0, 8).map((r) => {
        const a = getAvatar(r.avatarId);
        return (
          <div
            key={r.playerId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              marginBottom: 4,
              opacity: r.alive ? 1 : 0.65,
            }}
          >
            <span>
              #{r.place} {a.symbol} {r.nickname}
            </span>
            <span>{r.distance}m</span>
          </div>
        );
      })}
    </div>
  );
}
