import { useEffect, useRef } from 'react';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getAvatar,
  type PlayerPublic,
} from '@roomjoy/protocol';

/** TV interpolates between authoritative snapshots for smooth display. */
export function GameCanvas({
  players,
  tick,
}: {
  players: PlayerPublic[];
  tick: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const targetRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const playersRef = useRef(players);
  playersRef.current = players;

  useEffect(() => {
    for (const p of players) {
      targetRef.current.set(p.id, { x: p.x, y: p.y });
      if (!displayRef.current.has(p.id)) {
        displayRef.current.set(p.id, { x: p.x, y: p.y });
      }
    }
  }, [players, tick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loop = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#0E1530';
      ctx.fillRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = '#1A2448';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const sx = w / WORLD_WIDTH;
      const sy = h / WORLD_HEIGHT;

      for (const [id, target] of targetRef.current) {
        let disp = displayRef.current.get(id);
        if (!disp) {
          disp = { ...target };
          displayRef.current.set(id, disp);
        }
        if (reduced) {
          disp.x = target.x;
          disp.y = target.y;
        } else {
          disp.x += (target.x - disp.x) * 0.25;
          disp.y += (target.y - disp.y) * 0.25;
        }

        const p = playersRef.current.find((pl) => pl.id === id);
        if (!p || !p.connected) continue;
        const avatar = getAvatar(p.avatarId);
        const px = disp.x * sx;
        const py = disp.y * sy;

        ctx.beginPath();
        ctx.fillStyle = avatar.color;
        ctx.arc(px, py, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(avatar.symbol, px, py);
        ctx.fillStyle = '#F4F7FF';
        ctx.font = '600 14px Nunito, sans-serif';
        ctx.fillText(p.nickname, px, py + 34);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={540}
      style={{
        width: '100%',
        maxWidth: 960,
        aspectRatio: '16 / 9',
        borderRadius: 16,
        outline: '2px solid #243055',
      }}
      aria-label="Game playfield"
    />
  );
}
