/** Best-effort vibration patterns for mobile browsers. No-ops on desktop. */

const canVibrate = () =>
  typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function hapticLight(): void {
  try { if (canVibrate()) navigator.vibrate(10); } catch {}
}

export function hapticMedium(): void {
  try { if (canVibrate()) navigator.vibrate(18); } catch {}
}

export function hapticDelete(): void {
  try { if (canVibrate()) navigator.vibrate([12, 30, 12]); } catch {}
}

export function hapticSuccess(): void {
  try { if (canVibrate()) navigator.vibrate([8, 40, 8]); } catch {}
}

export function hapticPr(): void {
  try { if (canVibrate()) navigator.vibrate([20, 40, 20, 40, 40]); } catch {}
}
