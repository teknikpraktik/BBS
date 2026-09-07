import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteWorkout,
  getCurrentWeights,
  getWorkout,
  getWorkouts,
  putCurrentWeights,
  putWorkout,
  refreshCurrentWeightsFromHistory,
  setWorkoutWeight,
} from './db.ts';
import type { CompletedWorkout } from './types.ts';

/**
 * Runs against a real IndexedDB (fake-indexeddb), so these are tests of the
 * store the app actually writes to rather than of a mock standing in for it.
 */

function workout(id: string, completedAt: string, weights: Partial<CompletedWorkout> = {}): CompletedWorkout {
  return {
    workout_id: id,
    installation_id: 'installation-1',
    completed_at: completedAt,
    seated_row_kg: 40,
    chest_press_kg: 45,
    pulldown_kg: 50,
    overhead_press_kg: 25,
    leg_press_kg: 100,
    sync_status: 'synced',
    ...weights,
  };
}

beforeEach(async () => {
  for (const existing of await getWorkouts()) {
    await deleteWorkout(existing.workout_id);
  }
  await putCurrentWeights({
    seated_row: 0,
    chest_press: 0,
    pulldown: 0,
    overhead_press: 0,
    leg_press: 0,
  });
});

describe('correcting a saved weight', () => {
  it('updates the existing record and creates no second one', async () => {
    await putWorkout(workout('w1', '2026-08-16T10:00:00.000Z'));

    const updated = await setWorkoutWeight('w1', 'pulldown', 57.5);

    expect(updated?.pulldown_kg).toBe(57.5);
    const all = await getWorkouts();
    expect(all).toHaveLength(1);
    expect(all[0]!.workout_id).toBe('w1');
  });

  it('leaves every other field on the record alone', async () => {
    const original = workout('w1', '2026-08-16T10:00:00.000Z');
    await putWorkout(original);

    await setWorkoutWeight('w1', 'pulldown', 57.5);
    const after = await getWorkout('w1');

    // The date is the record's identity in the history table and in the charts,
    // and the other four weights are other exercises' business. A correction is
    // one number wide.
    expect(after?.completed_at).toBe(original.completed_at);
    expect(after?.workout_id).toBe(original.workout_id);
    expect(after?.installation_id).toBe(original.installation_id);
    expect(after?.seated_row_kg).toBe(original.seated_row_kg);
    expect(after?.chest_press_kg).toBe(original.chest_press_kg);
    expect(after?.overhead_press_kg).toBe(original.overhead_press_kg);
    expect(after?.leg_press_kg).toBe(original.leg_press_kg);
  });

  it('marks the record for re-sync, which upserts rather than inserts', async () => {
    await putWorkout(workout('w1', '2026-08-16T10:00:00.000Z'));

    await setWorkoutWeight('w1', 'pulldown', 57.5);

    expect((await getWorkout('w1'))?.sync_status).toBe('pending');
  });

  it('applies the same step and ceiling as the rest of the app', async () => {
    await putWorkout(workout('w1', '2026-08-16T10:00:00.000Z'));

    // Off-step values snap to the nearest 2.5 kg, exactly as the steppers do.
    await setWorkoutWeight('w1', 'pulldown', 51);
    expect((await getWorkout('w1'))?.pulldown_kg).toBe(50);

    await setWorkoutWeight('w1', 'pulldown', 51.5);
    expect((await getWorkout('w1'))?.pulldown_kg).toBe(52.5);

    await setWorkoutWeight('w1', 'pulldown', -10);
    expect((await getWorkout('w1'))?.pulldown_kg).toBe(0);

    await setWorkoutWeight('w1', 'overhead_press', 9999);
    expect((await getWorkout('w1'))?.overhead_press_kg).toBe(250);
  });

  it('does nothing when the workout is gone', async () => {
    expect(await setWorkoutWeight('missing', 'pulldown', 60)).toBeUndefined();
    expect(await getWorkouts()).toHaveLength(0);
  });
});

describe('the starting weight for the next workout', () => {
  it('comes from the newest completed workout', async () => {
    await putWorkout(workout('older', '2026-08-01T10:00:00.000Z', { pulldown_kg: 10 }));
    await putWorkout(workout('newest', '2026-08-16T10:00:00.000Z', { pulldown_kg: 50 }));

    await refreshCurrentWeightsFromHistory();

    expect((await getCurrentWeights()).pulldown).toBe(50);
  });

  it('follows a correction made to that newest workout', async () => {
    await putWorkout(workout('older', '2026-08-01T10:00:00.000Z', { pulldown_kg: 10 }));
    await putWorkout(workout('newest', '2026-08-16T10:00:00.000Z', { pulldown_kg: 50 }));

    await setWorkoutWeight('newest', 'pulldown', 57.5);

    expect((await getCurrentWeights()).pulldown).toBe(57.5);
  });

  it('ignores a correction made to an older workout', async () => {
    await putWorkout(workout('older', '2026-08-01T10:00:00.000Z', { pulldown_kg: 10 }));
    await putWorkout(workout('newest', '2026-08-16T10:00:00.000Z', { pulldown_kg: 50 }));
    await refreshCurrentWeightsFromHistory();

    await setWorkoutWeight('older', 'pulldown', 30);

    expect((await getCurrentWeights()).pulldown).toBe(50);
  });
});

describe('deleting a workout', () => {
  it('removes only that workout', async () => {
    await putWorkout(workout('older', '2026-08-01T10:00:00.000Z'));
    await putWorkout(workout('newest', '2026-08-16T10:00:00.000Z'));

    await deleteWorkout('newest');

    const all = await getWorkouts();
    expect(all).toHaveLength(1);
    expect(all[0]!.workout_id).toBe('older');
    expect(await getWorkout('newest')).toBeUndefined();
  });

  it('hands the starting weights back to the workout before it', async () => {
    await putWorkout(workout('older', '2026-08-01T10:00:00.000Z', { pulldown_kg: 10 }));
    await putWorkout(workout('newest', '2026-08-16T10:00:00.000Z', { pulldown_kg: 50 }));
    await refreshCurrentWeightsFromHistory();
    expect((await getCurrentWeights()).pulldown).toBe(50);

    await deleteWorkout('newest');

    expect((await getCurrentWeights()).pulldown).toBe(10);
  });

  it('keeps the last known weights when nothing is left to derive them from', async () => {
    await putWorkout(workout('only', '2026-08-16T10:00:00.000Z', { pulldown_kg: 50 }));
    await refreshCurrentWeightsFromHistory();

    await deleteWorkout('only');

    // Zeroing them would throw away the one useful guess the app still has.
    expect((await getCurrentWeights()).pulldown).toBe(50);
  });

  it('is harmless when the workout is already gone', async () => {
    await putWorkout(workout('w1', '2026-08-16T10:00:00.000Z'));

    await deleteWorkout('nothing-here');

    expect(await getWorkouts()).toHaveLength(1);
  });
});
