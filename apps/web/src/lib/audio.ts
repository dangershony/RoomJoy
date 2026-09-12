/** Unlock audio on TV via Start gesture (user activation). */
let unlocked = false;
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (unlocked) return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
    void ctx.resume();
    unlocked = true;
  } catch {
    unlocked = true; // don't block UX
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function playBeep(freq = 440, ms = 80): void {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* ignore */
  }
}
