import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main
      className="app-shell"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 className="brand" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', margin: 0 }}>
          RoomJoy
        </h1>
        <p className="tagline" style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>
          Good company. Clever games.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/tv">
          <button type="button" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
            TV — Start a room
          </button>
        </Link>
        <Link to="/join">
          <button type="button" className="secondary" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
            Phone — Join
          </button>
        </Link>
      </div>
      <p className="tagline" style={{ maxWidth: 420 }}>
        Milestone 1 prototype: lobby, host claim, reconnect, and a moving demo character.
      </p>
    </main>
  );
}
