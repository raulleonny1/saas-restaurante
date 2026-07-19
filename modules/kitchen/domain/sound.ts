/** Lightweight Web Audio cues for the KDS — no external assets. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export async function unlockKitchenAudio(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") await c.resume();
}

function tone(
  frequency: number,
  durationMs: number,
  gain = 0.08,
  type: OscillatorType = "sine",
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(c.destination);
  const now = c.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export function playNewTicketSound() {
  tone(880, 120, 0.09, "triangle");
  window.setTimeout(() => tone(1175, 140, 0.07, "triangle"), 130);
}

export function playReadySound() {
  tone(523, 100, 0.08, "sine");
  window.setTimeout(() => tone(659, 100, 0.08, "sine"), 110);
  window.setTimeout(() => tone(784, 160, 0.09, "sine"), 220);
}

export function playUrgentSound() {
  tone(440, 90, 0.1, "square");
  window.setTimeout(() => tone(440, 90, 0.1, "square"), 140);
}
