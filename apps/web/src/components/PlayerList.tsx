import type { PlayerPublic } from '@roomjoy/protocol';
import { AvatarBadge } from './AvatarBadge';

export function PlayerList({
  players,
  large,
}: {
  players: PlayerPublic[];
  large?: boolean;
}) {
  if (players.length === 0) {
    return <p className="tagline">Waiting for players…</p>;
  }
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: large ? '1rem' : '0.5rem',
        justifyContent: large ? 'center' : 'flex-start',
      }}
    >
      {players.map((p) => (
        <AvatarBadge
          key={p.id}
          avatarId={p.avatarId}
          nickname={p.nickname}
          isHost={p.isHost}
          dimmed={!p.connected}
          large={large}
        />
      ))}
    </div>
  );
}
