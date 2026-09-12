/** Placeholder screens for TUTORIAL / PLAYING / RESULTS per game. */

export function PhaseStub({
  title,
  subtitle,
  gameTitle,
  gameThumb,
  extra,
  children,
}: {
  title: string;
  subtitle?: string;
  gameTitle?: string | null;
  gameThumb?: string | null;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', width: '100%' }}>
      {gameThumb ? (
        <div style={{ fontSize: '4rem', lineHeight: 1 }}>{gameThumb}</div>
      ) : null}
      {gameTitle ? (
        <p className="tagline" style={{ marginBottom: 0 }}>
          {gameTitle}
        </p>
      ) : null}
      <h1 style={{ margin: '0.25rem 0', fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}>
        {title}
      </h1>
      {subtitle ? (
        <p className="tagline" style={{ fontSize: '1.1rem' }}>
          {subtitle}
        </p>
      ) : null}
      {extra}
      {children}
    </div>
  );
}
