// src/lib/sound.ts
let ctx: AudioContext | null = null;

function tone(
  freq: number, durS: number, gain = 0.08,
  type: OscillatorType = 'sine', startOffset = 0,
): void {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durS);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + durS);
}

export function coinClink(enabled: boolean): void {
  if (!enabled) return;
  try { tone(2400 * (0.9 + Math.random() * 0.2), 0.06, 0.05, 'triangle'); } catch { /* silent */ }
}

export function chaChing(enabled: boolean): void {
  if (!enabled) return;
  try {
    tone(1200, 0.1, 0.07, 'square');
    tone(1800, 0.18, 0.07, 'square', 0.09);
  } catch { /* silent */ }
}

export function errorBuzz(enabled: boolean): void {
  if (!enabled) return;
  try { tone(160, 0.2, 0.09, 'sawtooth'); } catch { /* silent */ }
}

let lastTick = 0;
export function tickTock(enabled: boolean): void {
  if (!enabled) return;
  const now = Date.now();
  if (now - lastTick < 1000) return; // max once per second
  lastTick = now;
  try { tone(880, 0.03, 0.04, 'square'); } catch { /* silent */ }
}
