/**
 * Background sync of completed workouts.
 *
 * Rules this module exists to enforce:
 *  - It never blocks the workout flow. Every call is fire-and-forget.
 *  - It is idempotent: the workout_id is the server-side key, so retrying the
 *    same workout any number of times produces exactly one row.
 *  - A missing or unreachable backend is a normal condition, not an error the
 *    user needs to see. The workout is already safe in IndexedDB.
 *
 * The endpoint is configured with VITE_SYNC_ENDPOINT. When it is unset, sync is
 * disabled and workouts simply stay marked "pending".
 */

import { getInstallation, getPendingWorkouts, putWorkout } from './db.ts';
import type { CompletedWorkout } from './types.ts';

const ENDPOINT: string = (import.meta.env.VITE_SYNC_ENDPOINT ?? '').replace(/\/$/, '');

export function syncEnabled(): boolean {
  return ENDPOINT.length > 0;
}

let running = false;
let rerun = false;

async function pushWorkout(workout: CompletedWorkout): Promise<boolean> {
  const { sync_status: _ignored, ...payload } = workout;
  const response = await fetch(`${ENDPOINT}/workouts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  });
  // 409 means the server already has this workout_id. That is success for an
  // idempotent upsert, not a failure to retry forever.
  return response.ok || response.status === 409;
}

/**
 * Attempts to push every pending workout. Safe to call at any time and from
 * several places at once; overlapping calls collapse into one pass.
 */
export async function syncNow(): Promise<void> {
  if (!syncEnabled()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    const pending = await getPendingWorkouts();
    if (pending.length === 0) return;
    // Ensure the anonymous identity exists before it is used as a foreign key.
    const installation = await getInstallation();
    for (const workout of pending) {
      try {
        const ok = await pushWorkout({ ...workout, installation_id: installation.installation_id });
        if (ok) await putWorkout({ ...workout, sync_status: 'synced' });
        else break; // Server-side trouble: stop and try again later.
      } catch {
        break; // Offline or unreachable. Stay pending, retry on reconnect.
      }
    }
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      void syncNow();
    }
  }
}

/**
 * Tells the backend about a workout deleted here. Best effort and nothing more:
 * unlike a push there is no local record left to retry from, so a deletion made
 * offline is simply not mirrored, and the row upstream is left behind. That is
 * harmless today — nothing is ever read back from the backend — but it is the
 * reason deletion is described as local.
 */
export async function deleteRemoteWorkout(workoutId: string): Promise<void> {
  if (!syncEnabled()) return;
  try {
    await fetch(`${ENDPOINT}/workouts/${encodeURIComponent(workoutId)}`, {
      method: 'DELETE',
      keepalive: true,
    });
  } catch {
    /* Offline or unreachable. The local delete already stands. */
  }
}

/** Retries whenever the network comes back or the app returns to the foreground. */
export function startSyncWatcher(): () => void {
  if (!syncEnabled()) return () => undefined;
  const attempt = (): void => void syncNow();
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') attempt();
  };
  window.addEventListener('online', attempt);
  document.addEventListener('visibilitychange', onVisible);
  attempt();
  return () => {
    window.removeEventListener('online', attempt);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
