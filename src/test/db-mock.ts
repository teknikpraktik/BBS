/**
 * An in-memory stand-in for lib/db.ts, for tests about the workout state
 * machine rather than about storage. It is a working implementation, not a set
 * of stubs: what the provider writes is what the provider reads back, so a
 * restore or a reload can be exercised the same way it happens in the app.
 *
 * Storage itself is tested against a real IndexedDB in lib/db.test.ts.
 */
import type { ActiveWorkout, CompletedWorkout, Installation } from '../lib/types.ts';
import { EXERCISES, type ExerciseId } from '../lib/exercises.ts';

export interface Store {
  activeWorkout: ActiveWorkout | undefined;
  currentWeights: Record<ExerciseId, number>;
  workouts: CompletedWorkout[];
  installation: Installation;
  /** Every ActiveWorkout ever committed, in order. */
  writes: ActiveWorkout[];
}

function blankWeights(): Record<ExerciseId, number> {
  const weights = {} as Record<ExerciseId, number>;
  for (const e of EXERCISES) weights[e.id] = 0;
  return weights;
}

export const store: Store = {
  activeWorkout: undefined,
  currentWeights: blankWeights(),
  workouts: [],
  installation: {
    installation_id: 'test-installation',
    created_at: '2026-01-01T00:00:00.000Z',
    appearance: 'system',
    sound_enabled: true,
    haptics_enabled: true,
  },
  writes: [],
};

export function resetStore(): void {
  store.activeWorkout = undefined;
  store.currentWeights = blankWeights();
  store.workouts = [];
  store.writes = [];
}

let counter = 0;

export const dbMock = {
  newId: (): string => `id-${++counter}`,
  getInstallation: async (): Promise<Installation> => store.installation,
  putInstallation: async (installation: Installation): Promise<void> => {
    store.installation = installation;
  },
  getCurrentWeights: async (): Promise<Record<ExerciseId, number>> => ({ ...store.currentWeights }),
  putCurrentWeights: async (weights: Record<ExerciseId, number>): Promise<void> => {
    store.currentWeights = { ...weights };
  },
  getWorkouts: async (): Promise<CompletedWorkout[]> => [...store.workouts],
  getWorkout: async (id: string): Promise<CompletedWorkout | undefined> =>
    store.workouts.find((w) => w.workout_id === id),
  putWorkout: async (workout: CompletedWorkout): Promise<void> => {
    const at = store.workouts.findIndex((w) => w.workout_id === workout.workout_id);
    if (at >= 0) store.workouts[at] = workout;
    else store.workouts.push(workout);
  },
  getPendingWorkouts: async (): Promise<CompletedWorkout[]> =>
    store.workouts.filter((w) => w.sync_status === 'pending'),
  deleteWorkout: async (id: string): Promise<void> => {
    store.workouts = store.workouts.filter((w) => w.workout_id !== id);
  },
  getActiveWorkout: async (): Promise<ActiveWorkout | undefined> => store.activeWorkout,
  putActiveWorkout: async (active: ActiveWorkout): Promise<void> => {
    store.activeWorkout = active;
    store.writes.push(active);
  },
  clearActiveWorkout: async (): Promise<void> => {
    store.activeWorkout = undefined;
  },
};
