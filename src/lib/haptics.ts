/** Fire-and-forget vibration; silently unsupported on desktop. */
export function vibrate(ms: number, enabled: boolean): void {
  if (!enabled) return;
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
