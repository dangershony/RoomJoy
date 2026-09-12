import { useEffect, useState } from 'react';

export function Countdown({ endsAt }: { endsAt: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (endsAt == null) return null;
  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 800,
        color: left <= 5 ? 'var(--warn)' : 'var(--muted)',
      }}
    >
      {left}s
    </span>
  );
}
