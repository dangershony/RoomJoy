export function getServerUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:2567';
}

/** HTTP origin for REST helpers (derived from WS URL). */
export function getServerHttpUrl(): string {
  const ws = getServerUrl();
  return ws.replace(/^ws/i, 'http');
}

export function getPublicWebUrl(): string {
  return (
    import.meta.env.VITE_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  );
}

export function joinUrl(roomCode: string): string {
  const base = getPublicWebUrl().replace(/\/$/, '');
  return `${base}/join/${roomCode}`;
}
