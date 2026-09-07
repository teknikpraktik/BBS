import type { ExerciseId } from './exercises.ts';

export type Appearance = 'system' | 'light' | 'dark';

export interface Installation {
  installation_id: string;
  created_at: string;
  appearance: Appearance;
  sound_enabled: boolean;
  haptics_enabled: boolean;
}

export interface CurrentWeight {
  exercise_id: ExerciseId;
  current_weight_kg: number;
  updated_at: string;
}

export type SyncStatus = 'pending' | 'synced';

export interface CompletedWorkout {
  workout_id: string;
  installation_id: string;
  /** ISO 8601 instant the fifth set finished. */
  completed_at: string;
  seated_row_kg: number;
  chest_press_kg: number;
  pulldown_kg: number;
  overhead_press_kg: number;
  leg_press_kg: number;
  sync_status: SyncStatus;
}

/**
 * "countdown" is the five second lead-in between pressing Start and the set
 * clock running. It is a timer state of its own so that the set clock cannot
 * be running during it, and so a reload can tell the two apart.
 */
export type TimerState = 'ready' | 'countdown' | 'running' | 'paused' | 'completed';

/**
 * A workout in progress. Temporary by definition: it is deleted on End Workout
 * and promoted to a CompletedWorkout only when all five sets are done.
 */
export interface ActiveWorkout {
  workout_id: string;
  workout_started_at: string;
  current_exercise: ExerciseId | null;
  completed_exercises: ExerciseId[];
  temporary_weights: Record<ExerciseId, number>;
  timer_remaining_ms: number;
  timer_state: TimerState;
  /**
   * Wall-clock deadline for whichever clock is running: the lead-in countdown
   * while the state is "countdown", the set itself while it is "running". Used
   * so a throttled or backgrounded tab cannot stretch either one.
   */
  running_until: number | null;
}
