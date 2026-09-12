import { getAvatar } from '@roomjoy/protocol';

export function AvatarBadge({
  avatarId,
  nickname,
  large,
  isHost,
  dimmed,
}: {
  avatarId: string;
  nickname: string;
  large?: boolean;
  isHost?: boolean;
  dimmed?: boolean;
}) {
  const a = getAvatar(avatarId);
  return (
    <div
      className="avatar-chip"
      style={{
        background: a.color,
        fontSize: large ? '1.4rem' : '1rem',
        opacity: dimmed ? 0.45 : 1,
        outline: isHost ? '3px solid #FFC857' : undefined,
      }}
      title={`${a.label}${isHost ? ' (Host)' : ''}`}
    >
      <span aria-hidden>{a.symbol}</span>
      <span>{nickname}</span>
      {isHost ? <span aria-label="host">★</span> : null}
    </div>
  );
}
