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

export type TimerState = 'ready' | 'running' | 'paused' | 'completed';

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
  /** Wall-clock deadline while running; used to survive a backgrounded tab. */
  running_until: number | null;
}
