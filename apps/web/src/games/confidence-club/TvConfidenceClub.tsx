import type { CcPublicState } from './types';
import { TUTORIAL_COPY } from './types';
import { Countdown } from './Countdown';
import { Scoreboard } from './Scoreboard';

export function TvConfidenceClub({
  phase,
  publicGame,
}: {
  phase: string;
  publicGame: CcPublicState | null;
}) {
  if (!publicGame) {
    return (
      <main className="app-shell" style={{ padding: '2rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--tv-title)' }}>🎯 Confidence Club</h1>
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
        {step === 'scoring' ? <ScoringLegend large /> : null}
      </main>
    );
  }

  if (phase === 'RESULTS') {
    return (
      <main
        className="app-shell"
        style={{ padding: '2rem', alignItems: 'center', gap: '1.5rem' }}
      >
        <h1 style={{ fontSize: 'var(--tv-title)', margin: 0 }}>Final scores</h1>
        <Scoreboard scores={publicGame.scores} large />
      </main>
    );
  }

  const q = publicGame.question;
  const roundPhase = publicGame.roundPhase;

  return (
    <main
      className="app-shell"
      style={{ padding: '1.5rem', gap: '1rem', alignItems: 'stretch' }}
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
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>🎯 Confidence Club</h1>
        <span className="tagline" style={{ fontSize: '1.25rem' }}>
          Q{(publicGame.questionIndex ?? 0) + 1}/{publicGame.totalQuestions} ·{' '}
          {phaseLabel(roundPhase)} · <Countdown endsAt={publicGame.phaseEndsAt} />
        </span>
      </header>

      {q ? (
        <section style={{ textAlign: 'center', margin: '0.5rem 0' }}>
          <p className="tagline" style={{ margin: 0, textTransform: 'capitalize' }}>
            {q.category.replace(/_/g, ' ')} · {q.difficulty}
          </p>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 3rem)',
              margin: '0.5rem auto',
              maxWidth: 1000,
              lineHeight: 1.2,
              fontWeight: 800,
            }}
          >
            {q.prompt}
          </h2>
        </section>
      ) : null}

      {q && roundPhase !== 'reveal' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            maxWidth: 1000,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {q.options.map((opt, i) => (
            <div
              key={i}
              className="panel"
              style={{
                fontSize: 'clamp(1.1rem, 2.2vw, 1.75rem)',
                fontWeight: 700,
                textAlign: 'left',
                padding: '1rem 1.25rem',
              }}
            >
              <span style={{ color: 'var(--accent)', marginRight: 8 }}>
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </div>
          ))}
        </div>
      ) : null}

      {roundPhase === 'revising' && publicGame.clue ? (
        <div
          className="panel"
          style={{
            maxWidth: 900,
            margin: '0 auto',
            borderLeft: '6px solid var(--warn)',
            fontSize: 'var(--tv-body)',
            fontWeight: 700,
          }}
        >
          💡 Clue: {publicGame.clue}
        </div>
      ) : null}

      {roundPhase === 'locked' ? (
        <p style={{ textAlign: 'center', fontSize: 'var(--tv-body)', fontWeight: 800 }}>
          Answers locked…
        </p>
      ) : null}

      {roundPhase === 'answering' ? (
        <p className="tagline" style={{ textAlign: 'center', fontSize: '1.25rem' }}>
          Submitted {publicGame.submittedCount}/{publicGame.playerCount}
        </p>
      ) : null}

      {roundPhase === 'reveal' && q ? (
        <section style={{ textAlign: 'center', gap: '1rem' }}>
          <p style={{ fontSize: 'var(--tv-body)', fontWeight: 800, color: 'var(--ok)' }}>
            Answer:{' '}
            {publicGame.correctIndex != null
              ? `${String.fromCharCode(65 + publicGame.correctIndex)}. ${q.options[publicGame.correctIndex]}`
              : '—'}
          </p>
          {publicGame.explanation ? (
            <p style={{ fontSize: '1.35rem', maxWidth: 900, margin: '0.5rem auto' }}>
              {publicGame.explanation}
            </p>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              justifyContent: 'center',
              marginTop: '1rem',
            }}
          >
            {(publicGame.revealResults ?? []).map((r) => (
              <div
                key={r.playerId}
                className="panel"
                style={{ minWidth: 160, textAlign: 'center' }}
              >
                <div style={{ fontWeight: 800 }}>{r.nickname}</div>
                <div className="tagline">
                  {r.missed
                    ? 'Missed'
                    : `${r.correct ? '✓' : '✗'} ${r.changed ? '(changed) ' : ''}conf ${r.confidence}`}
                </div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '1.5rem',
                    color: r.points < 0 ? 'var(--danger)' : 'var(--ok)',
                  }}
                >
                  {r.points > 0 ? `+${r.points}` : r.points}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div style={{ marginTop: 'auto' }}>
        <Scoreboard scores={publicGame.scores} large />
      </div>
    </main>
  );
}

function phaseLabel(p: CcPublicState['roundPhase']): string {
  switch (p) {
    case 'answering':
      return 'Answer + confidence';
    case 'locked':
      return 'Locked';
    case 'revising':
      return 'Clue — rethink';
    case 'reveal':
      return 'Reveal';
    default:
      return '';
  }
}

function ScoringLegend({ large }: { large?: boolean }) {
  const rows = [
    ['Correct, no change', 'confidence × 100'],
    ['Correct after change', 'confidence × 50'],
    ['Incorrect', '−confidence × 50'],
    ['Missed first submit', '0 pts (no revise)'],
  ];
  return (
    <div
      style={{
        display: 'grid',
        gap: '0.5rem',
        maxWidth: 720,
        width: '100%',
        fontSize: large ? '1.35rem' : '1rem',
      }}
    >
      {rows.map(([a, b]) => (
        <div
          key={a}
          className="panel"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            fontWeight: 700,
          }}
        >
          <span>{a}</span>
          <span style={{ color: 'var(--accent-2)' }}>{b}</span>
        </div>
      ))}
    </div>
  );
}
