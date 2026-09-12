export function Scoreboard({
  scores,
  large,
}: {
  scores: { playerId: string; nickname: string; score: number }[];
  large?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: large ? '0.75rem' : '0.5rem',
        justifyContent: 'center',
      }}
    >
      {scores.map((s, i) => (
        <div
          key={s.playerId}
          className="panel"
          style={{
            padding: large ? '0.75rem 1.25rem' : '0.5rem 0.85rem',
            minWidth: large ? 140 : 100,
            textAlign: 'center',
          }}
        >
          <div className="tagline" style={{ fontSize: large ? '1rem' : '0.75rem', margin: 0 }}>
            #{i + 1}
          </div>
          <div style={{ fontWeight: 800, fontSize: large ? '1.35rem' : '1rem' }}>
            {s.nickname}
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: large ? '1.5rem' : '1.1rem',
              color: s.score < 0 ? 'var(--danger)' : 'var(--ok)',
            }}
          >
            {s.score}
          </div>
        </div>
      ))}
    </div>
  );
}
