import type { GameCatalogEntry } from '@roomjoy/protocol';

export function GameLibrary({
  games,
  selectedGameId,
  large,
}: {
  games: GameCatalogEntry[];
  selectedGameId: string | null;
  large?: boolean;
}) {
  if (games.length === 0) {
    return <p className="tagline">No games registered.</p>;
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: large
          ? 'repeat(auto-fit, minmax(220px, 1fr))'
          : '1fr',
        gap: large ? '1.25rem' : '0.75rem',
        width: '100%',
      }}
    >
      {games.map((g) => {
        const selected = g.id === selectedGameId;
        return (
          <article
            key={g.id}
            className="panel"
            style={{
              textAlign: 'left',
              outline: selected ? '3px solid var(--accent)' : undefined,
              transform: selected ? 'scale(1.02)' : undefined,
              transition: 'outline 0.15s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '0.5rem',
              }}
            >
              <div
                aria-hidden
                style={{
                  width: large ? 72 : 48,
                  height: large ? 72 : 48,
                  borderRadius: 16,
                  background: '#1A2340',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: large ? '2.25rem' : '1.5rem',
                }}
              >
                {g.thumbnail}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: large ? '1.5rem' : '1.1rem' }}>
                  {g.title}
                </h3>
                <p className="tagline" style={{ margin: 0, fontSize: '0.9rem' }}>
                  {g.minPlayers}–{g.maxPlayers} players · ~{g.estimatedDurationMinutes}{' '}
                  min
                </p>
              </div>
            </div>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.4 }}>
              {g.description}
            </p>
            {selected ? (
              <p
                style={{
                  margin: '0.75rem 0 0',
                  color: 'var(--ok)',
                  fontWeight: 800,
                }}
              >
                Selected
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
