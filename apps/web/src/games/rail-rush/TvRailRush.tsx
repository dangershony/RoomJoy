import { getAvatar } from '@roomjoy/protocol';
import type { RrPublicState } from './types';
import { TUTORIAL_COPY } from './types';

const LANE_COUNT = 3;
const VIEW_DEPTH = 620;

export function TvRailRush({
  phase,
  publicGame,
}: {
  phase: string;
  publicGame: RrPublicState | null;
}) {
  if (!publicGame) {
    return (
      <main className="app-shell" style={{ padding: '2rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--tv-title)' }}>🛤️ Rail Rush</h1>
        <p className="tagline" style={{ fontSize: 'var(--tv-body)' }}>
          Loading…
        </p>
      </main>
    );
  }

  if (phase === 'TUTORIAL') {
    const step = publicGame.tutorialStep ?? 'welcome';
    const copy = TUTORIAL_COPY[step] ?? TUTORIAL_COPY.welcome!;
    return (
      <main
        className="app-shell"
        style={{
          padding: '2rem',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '1.25rem',
        }}
      >
        <p className="tagline" style={{ fontSize: '1.25rem', margin: 0 }}>
          Tutorial {publicGame.tutorialStepIndex + 1}/{publicGame.tutorialTotal}
        </p>
        <h1 style={{ fontSize: 'var(--tv-title)', margin: 0 }}>{copy.title}</h1>
        <p style={{ fontSize: 'var(--tv-body)', maxWidth: 900, lineHeight: 1.35 }}>
          {copy.body}
        </p>
        <TrackPreview lanes={LANE_COUNT} />
      </main>
    );
  }

  if (phase === 'RESULTS') {
    return (
      <main
        className="app-shell"
        style={{ padding: '2rem', alignItems: 'center', gap: '1.5rem' }}
      >
        <h1 style={{ fontSize: 'var(--tv-title)', margin: 0 }}>🏁 Results</h1>
        <RankingBoard rankings={publicGame.rankings} large />
      </main>
    );
  }

  const scroll = publicGame.scroll;
  const maxStagger = Math.max(0, ...publicGame.runners.map((r) => r.stagger));

  return (
    <main
      className="app-shell"
      style={{ padding: '1rem 1.5rem', gap: '0.75rem', alignItems: 'stretch' }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>🛤️ Rail Rush</h1>
        <span className="tagline" style={{ fontSize: '1.25rem' }}>
          {Math.floor(scroll)}m · {publicGame.aliveCount} alive ·{' '}
          {Math.round(publicGame.speed)} u/s
          {publicGame.flavor ? ` · ${publicGame.flavor}` : ''}
        </span>
      </header>

      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 360,
          borderRadius: 20,
          overflow: 'hidden',
          background:
            'linear-gradient(180deg, #1a2744 0%, #0d1528 55%, #121a2e 100%)',
          outline: '2px solid #2A3555',
        }}
      >
        {/* vanishing-point rails */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${LANE_COUNT}, 1fr)`,
            gap: 8,
            padding: '12px 10% 12px',
          }}
        >
          {Array.from({ length: LANE_COUNT }, (_, lane) => (
            <div
              key={lane}
              style={{
                position: 'relative',
                borderRadius: 16,
                background:
                  'linear-gradient(180deg, rgba(91,140,255,0.12), rgba(61,220,151,0.08))',
                outline: '2px dashed rgba(168,179,209,0.35)',
              }}
            />
          ))}
        </div>

        {/* obstacles */}
        {publicGame.obstacles.map((o) => {
          const rel = o.z - scroll;
          const t = 1 - Math.min(1, Math.max(0, rel / VIEW_DEPTH));
          const topPct = 8 + t * 78;
          const scale = 0.45 + t * 0.7;
          const leftPct = ((o.lane + 0.5) / LANE_COUNT) * 100;
          return (
            <div
              key={o.id}
              title="Obstacle"
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                width: 56,
                height: 56,
                borderRadius: 12,
                background: 'linear-gradient(145deg, #FF6B9D, #FF5C5C)',
                boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.6rem',
                fontWeight: 900,
                zIndex: Math.round(10 + t * 40),
              }}
            >
              🚧
            </div>
          );
        })}

        {/* runners — staggered: higher stagger = further up (ahead) */}
        {publicGame.runners.map((r) => {
          const ahead = maxStagger > 0 ? r.stagger / (maxStagger + 1) : 0;
          // Base near bottom; ahead runners sit slightly higher on screen
          const topPct = 78 - ahead * 18 - (r.alive ? 0 : 0);
          const leftPct = ((r.lane + 0.5) / LANE_COUNT) * 100;
          const avatar = getAvatar(r.avatarId);
          return (
            <div
              key={r.playerId}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: 'translate(-50%, -50%)',
                opacity: r.alive ? 1 : 0.35,
                filter: r.alive ? undefined : 'grayscale(1)',
                zIndex: 50 + Math.round(r.stagger),
                textAlign: 'center',
                transition: 'left 0.12s ease-out',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: avatar.color,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '2rem',
                  outline: r.alive ? '3px solid #fff' : '3px solid #666',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                }}
              >
                {avatar.symbol}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  textShadow: '0 2px 6px #000',
                }}
              >
                {r.nickname}
                {!r.alive ? ' ✕' : ''}
              </div>
              <div className="tagline" style={{ fontSize: '0.85rem' }}>
                {r.distance}m
              </div>
            </div>
          );
        })}
      </div>

      <RankingBoard rankings={publicGame.rankings} />
    </main>
  );
}

function TrackPreview({ lanes }: { lanes: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${lanes}, 1fr)`,
        gap: 12,
        width: 'min(640px, 90%)',
        marginTop: '1rem',
      }}
    >
      {Array.from({ length: lanes }, (_, i) => (
        <div
          key={i}
          className="panel"
          style={{
            textAlign: 'center',
            padding: '1.5rem 0.5rem',
            fontWeight: 800,
          }}
        >
          Lane {i + 1}
        </div>
      ))}
    </div>
  );
}

function RankingBoard({
  rankings,
  large,
}: {
  rankings: RrPublicState['rankings'];
  large?: boolean;
}) {
  if (!rankings.length) return null;
  return (
    <div
      className="panel"
      style={{
        width: large ? 'min(720px, 100%)' : '100%',
        display: 'grid',
        gap: large ? '0.75rem' : '0.35rem',
      }}
    >
      {rankings.map((r) => {
        const a = getAvatar(r.avatarId);
        return (
          <div
            key={r.playerId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              fontSize: large ? '1.5rem' : '1rem',
              fontWeight: 800,
              opacity: r.alive ? 1 : 0.7,
            }}
          >
            <span>
              #{r.place} {a.symbol} {r.nickname}
              {!r.alive ? ' (out)' : ''}
            </span>
            <span style={{ color: 'var(--ok)' }}>{r.distance}m</span>
          </div>
        );
      })}
    </div>
  );
}
