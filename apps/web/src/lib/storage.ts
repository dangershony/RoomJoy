const PREFIX = 'roomjoy.m1.';

export interface StoredCreds {
  roomId: string;
  roomCode: string;
  playerId?: string;
  sessionToken: string;
  role: 'tv' | 'phone';
}

export function saveCreds(creds: StoredCreds): void {
  try {
    localStorage.setItem(PREFIX + 'creds', JSON.stringify(creds));
  } catch {
    /* ignore */
  }
}

export function loadCreds(): StoredCreds | null {
  try {
    const raw = localStorage.getItem(PREFIX + 'creds');
    if (!raw) return null;
    return JSON.parse(raw) as StoredCreds;
  } catch {
    return null;
  }
}

export function clearCreds(): void {
  try {
    localStorage.removeItem(PREFIX + 'creds');
  } catch {
    /* ignore */
  }
}
