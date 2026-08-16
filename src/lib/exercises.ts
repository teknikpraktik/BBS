/**
 * The Big Five. This list is the product: it is fixed, ordered, and not
 * user-editable. Nothing in the app may add to, remove from, or rename it.
 */

export const EXERCISE_IDS = [
  'seated_row',
  'chest_press',
  'pulldown',
  'overhead_press',
  'leg_press',
] as const;

export type ExerciseId = (typeof EXERCISE_IDS)[number];

export interface Exercise {
  id: ExerciseId;
  /** Full name, used on the exercise screen and in detail views. */
  name: string;
  /** Abbreviation for the history table header. */
  short: string;
  /** Generous technical ceiling. Not a training recommendation. */
  maxKg: number;
  /** Key on a completed workout record. */
  column: `${ExerciseId}_kg`;
}

export const EXERCISES: readonly Exercise[] = [
  { id: 'seated_row', name: 'Seated Row', short: 'Row', maxKg: 300, column: 'seated_row_kg' },
  { id: 'chest_press', name: 'Chest Press', short: 'Chest', maxKg: 300, column: 'chest_press_kg' },
  { id: 'pulldown', name: 'Pulldown', short: 'Pull', maxKg: 300, column: 'pulldown_kg' },
  { id: 'overhead_press', name: 'Overhead Press', short: 'OHP', maxKg: 250, column: 'overhead_press_kg' },
  { id: 'leg_press', name: 'Leg Press', short: 'Leg', maxKg: 500, column: 'leg_press_kg' },
];

const BY_ID = new Map<ExerciseId, Exercise>(EXERCISES.map((e) => [e.id, e]));

export function exercise(id: ExerciseId): Exercise {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown exercise: ${id}`);
  return found;
}

/** Every set is exactly 90 seconds. */
export const SET_DURATION_MS = 90_000;

/** Weight moves in 2.5 kg steps only. */
export const WEIGHT_STEP_KG = 2.5;
export const MIN_WEIGHT_KG = 0;

export function clampWeight(id: ExerciseId, kg: number): number {
  const { maxKg } = exercise(id);
  const stepped = Math.round(kg / WEIGHT_STEP_KG) * WEIGHT_STEP_KG;
  return Math.min(maxKg, Math.max(MIN_WEIGHT_KG, stepped));
}
