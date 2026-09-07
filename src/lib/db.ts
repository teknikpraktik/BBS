/**
 * IndexedDB is the immediate source of truth during a workout. Everything is
 * written locally first; the backend is only ever a mirror.
 */

import type { ActiveWorkout, CompletedWorkout, CurrentWeight, Installation } from './types.ts';
import { EXERCISES, clampWeight, exercise, type ExerciseId } from './exercises.ts';

const DB_NAME = 'bbs';
const DB_VERSION = 1;

const STORE_META = 'meta';
const STORE_WEIGHTS = 'current_weights';
const STORE_WORKOUTS = 'workouts';

const KEY_INSTALLATION = 'installation';
const KEY_ACTIVE_WORKOUT = 'active_workout';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
      if (!db.objectStoreNames.contains(STORE_WEIGHTS)) {
        db.createObjectStore(STORE_WEIGHTS, { keyPath: 'exercise_id' });
      }
      if (!db.objectStoreNames.contains(STORE_WORKOUTS)) {
        const workouts = db.createObjectStore(STORE_WORKOUTS, { keyPath: 'workout_id' });
        workouts.createIndex('completed_at', 'completed_at');
        workouts.createIndex('sync_status', 'sync_status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  run: (stores: IDBObjectStore[]) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        const transaction = db.transaction(names, mode);
        const stores = names.map((n) => transaction.objectStore(n));
        let result: T;
        const outcome = run(stores);
        if (outcome instanceof Promise) {
          outcome.then((v) => (result = v), reject);
        } else {
          outcome.onsuccess = () => (result = outcome.result);
          outcome.onerror = () => reject(outcome.error);
        }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }),
  );
}

function requestOf(store: IDBObjectStore | undefined): asserts store is IDBObjectStore {
  if (!store) throw new Error('Missing object store');
}

/* -------------------------------------------------------------------------- */
/* Installation                                                               */
/* -------------------------------------------------------------------------- */

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createInstallation(): Installation {
  return {
    installation_id: newId(),
    created_at: new Date().toISOString(),
    appearance: 'system',
    sound_enabled: true,
    haptics_enabled: true,
  };
}

export async function getInstallation(): Promise<Installation> {
  const existing = await tx<Installation | undefined>(STORE_META, 'readonly', ([meta]) => {
    requestOf(meta);
    return meta.get(KEY_INSTALLATION);
  });
  if (existing) return existing;

  // First run: an anonymous id is minted locally. No account, no sign-in.
  const fresh = createInstallation();
  await putInstallation(fresh);
  return fresh;
}

export function putInstallation(installation: Installation): Promise<void> {
  return tx(STORE_META, 'readwrite', ([meta]) => {
    requestOf(meta);
    return meta.put(installation, KEY_INSTALLATION) as unknown as IDBRequest<void>;
  });
}

/* -------------------------------------------------------------------------- */
/* Current weights                                                            */
/* -------------------------------------------------------------------------- */

/** Defaults to 0 kg for every exercise until a workout has been completed. */
export async function getCurrentWeights(): Promise<Record<ExerciseId, number>> {
  const rows = await tx<CurrentWeight[]>(STORE_WEIGHTS, 'readonly', ([weights]) => {
    requestOf(weights);
    return weights.getAll() as IDBRequest<CurrentWeight[]>;
  });
  const byId = new Map(rows.map((r) => [r.exercise_id, r.current_weight_kg]));
  const result = {} as Record<ExerciseId, number>;
  for (const e of EXERCISES) result[e.id] = byId.get(e.id) ?? 0;
  return result;
}

export function putCurrentWeights(weights: Record<ExerciseId, number>): Promise<void> {
  const updated_at = new Date().toISOString();
  return tx(STORE_WEIGHTS, 'readwrite', ([store]) => {
    requestOf(store);
    let last: IDBRequest<IDBValidKey> | null = null;
    for (const e of EXERCISES) {
      last = store.put({ exercise_id: e.id, current_weight_kg: weights[e.id], updated_at });
    }
    return last as unknown as IDBRequest<void>;
  });
}

/* -------------------------------------------------------------------------- */
/* Completed workouts                                                         */
/* -------------------------------------------------------------------------- */

/** Newest first, which is the order History renders. */
export async function getWorkouts(): Promise<CompletedWorkout[]> {
  const rows = await tx<CompletedWorkout[]>(STORE_WORKOUTS, 'readonly', ([store]) => {
    requestOf(store);
    return store.getAll() as IDBRequest<CompletedWorkout[]>;
  });
  return rows.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
}

export function getWorkout(workoutId: string): Promise<CompletedWorkout | undefined> {
  return tx(STORE_WORKOUTS, 'readonly', ([store]) => {
    requestOf(store);
    return store.get(workoutId) as IDBRequest<CompletedWorkout | undefined>;
  });
}

export function putWorkout(workout: CompletedWorkout): Promise<void> {
  return tx(STORE_WORKOUTS, 'readwrite', ([store]) => {
    requestOf(store);
    return store.put(workout) as unknown as IDBRequest<void>;
  });
}

export async function getPendingWorkouts(): Promise<CompletedWorkout[]> {
  const all = await getWorkouts();
  return all.filter((w) => w.sync_status === 'pending');
}

/** Removes a completed workout for good. Local only; see sync.ts. */
export async function deleteWorkout(workoutId: string): Promise<void> {
  await tx(STORE_WORKOUTS, 'readwrite', ([store]) => {
    requestOf(store);
    return store.delete(workoutId) as unknown as IDBRequest<void>;
  });
  // Deleting the newest workout hands the starting weights back to the one
  // before it, rather than leaving them pointing at a workout that is gone.
  await refreshCurrentWeightsFromHistory();
}

/**
 * Corrects one weight on a workout that is already saved.
 *
 * This is an edit of the existing row and nothing else: the workout_id, the
 * date, the other four weights and every other field are carried over
 * untouched, so no second workout and no second log can come out of it. The
 * record goes back to "pending" because the mirror upstream now disagrees with
 * it; the push is an upsert on workout_id, so the correction replaces the row
 * there rather than adding one.
 *
 * @returns the updated record, or undefined if the workout is gone.
 */
export async function setWorkoutWeight(
  workoutId: string,
  exerciseId: ExerciseId,
  kg: number,
): Promise<CompletedWorkout | undefined> {
  const existing = await getWorkout(workoutId);
  if (!existing) return undefined;
  const { column } = exercise(exerciseId);
  const value = clampWeight(exerciseId, kg);
  if (existing[column] === value) return existing;
  const updated: CompletedWorkout = { ...existing, [column]: value, sync_status: 'pending' };
  await putWorkout(updated);
  await refreshCurrentWeightsFromHistory();
  return updated;
}

/**
 * Re-derives the starting weights from history.
 *
 * The rule the app has always followed is that next time starts where last
 * time finished, so current_weights is a cache of the newest completed
 * workout. Correcting or deleting that workout has to move the cache with it,
 * or the next workout would open on a number the user has just said was wrong.
 * Older workouts are not consulted: only the newest one has ever decided this.
 *
 * With no workouts left there is nothing to derive from, and the stored
 * weights are left alone rather than reset to zero — a starting weight is
 * still the best guess available, and losing it helps nobody.
 */
export async function refreshCurrentWeightsFromHistory(): Promise<void> {
  const [newest] = await getWorkouts();
  if (!newest) return;
  const weights = {} as Record<ExerciseId, number>;
  for (const e of EXERCISES) weights[e.id] = newest[e.column];
  await putCurrentWeights(weights);
}

/* -------------------------------------------------------------------------- */
/* Active workout (temporary state)                                           */
/* -------------------------------------------------------------------------- */

export function getActiveWorkout(): Promise<ActiveWorkout | undefined> {
  return tx(STORE_META, 'readonly', ([meta]) => {
    requestOf(meta);
    return meta.get(KEY_ACTIVE_WORKOUT) as IDBRequest<ActiveWorkout | undefined>;
  });
}

export function putActiveWorkout(active: ActiveWorkout): Promise<void> {
  return tx(STORE_META, 'readwrite', ([meta]) => {
    requestOf(meta);
    return meta.put(active, KEY_ACTIVE_WORKOUT) as unknown as IDBRequest<void>;
  });
}

export function clearActiveWorkout(): Promise<void> {
  return tx(STORE_META, 'readwrite', ([meta]) => {
    requestOf(meta);
    return meta.delete(KEY_ACTIVE_WORKOUT) as unknown as IDBRequest<void>;
  });
}

export { newId };
