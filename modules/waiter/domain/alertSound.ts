/** Avisos sonoros del mesero (más fuertes que el KDS). */

let ctx: AudioContext | null = null;
let unlocked = false;

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

export function isWaiterAudioUnlocked() {
  return unlocked;
}

export async function unlockWaiterAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    // Beep silencioso para “desbloquear” autoplay en iOS
    const osc = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.01);
    unlocked = c.state === "running";
    return unlocked;
  } catch {
    return false;
  }
}

function beep(
  frequency: number,
  durationMs: number,
  gain = 0.22,
  type: OscillatorType = "square",
) {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.connect(g);
  g.connect(c.destination);
  const now = c.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

/** Alarma clara: “hay que retirar de cocina”. */
export async function playWaiterPickupAlarm(): Promise<void> {
  const ok = await unlockWaiterAudio();
  if (!ok) return;

  const pattern = [
    { f: 880, d: 160, delay: 0 },
    { f: 1175, d: 160, delay: 180 },
    { f: 880, d: 160, delay: 360 },
    { f: 1319, d: 280, delay: 540 },
  ];
  for (const p of pattern) {
    window.setTimeout(() => beep(p.f, p.d, 0.25, "square"), p.delay);
  }
}

export function vibratePickup() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([250, 80, 250, 80, 400]);
    }
  } catch {
    /* ignore */
  }
}
