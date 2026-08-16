/**
 * Best-effort screen wake lock, held only while a workout is in progress.
 * The app never assumes the browser or OS honours it — the timer is driven by
 * wall-clock time and pauses itself when the app leaves the foreground.
 */

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  if (!wanted || sentinel) return;
  if (!('wakeLock' in navigator)) return;
  if (document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // Denied, unsupported, or the tab lost focus mid-request. Not an error.
    sentinel = null;
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') void acquire();
}

export function requestWakeLock(): void {
  if (wanted) return;
  wanted = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  void acquire();
}

export function releaseWakeLock(): void {
  wanted = false;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  const held = sentinel;
  sentinel = null;
  if (held) void held.release().catch(() => undefined);
}
