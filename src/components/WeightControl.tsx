import type { ReactNode } from 'react';
import { MIN_WEIGHT_KG, WEIGHT_STEP_KG, exercise, type ExerciseId } from '../lib/exercises.ts';
import { formatWeight } from '../lib/format.ts';

interface Props {
  exerciseId: ExerciseId;
  weightKg: number;
  onAdjust: (steps: number) => void;
  /**
   * Same control, sized for a list rather than for the one thing on screen.
   * Used where five of these stack up — correcting a past workout — and never
   * during a set, where the full size is the point.
   */
  compact?: boolean;
  /** Names the exercise for screen readers when several rows share a screen. */
  labelSuffix?: string;
}

/**
 * Large circular steppers. Sized for tired hands: the touch targets are far
 * bigger than the minimum, and there is no free-text entry to get wrong.
 */
export function WeightControl({
  exerciseId,
  weightKg,
  onAdjust,
  compact = false,
  labelSuffix = '',
}: Props): ReactNode {
  const { maxKg } = exercise(exerciseId);
  const step = formatWeight(WEIGHT_STEP_KG);
  const on = labelSuffix ? ` for ${labelSuffix}` : '';

  return (
    <div className={compact ? 'weight weight--compact' : 'weight'}>
      <button
        type="button"
        className="weight__step"
        onClick={() => onAdjust(-1)}
        disabled={weightKg <= MIN_WEIGHT_KG}
        aria-label={`Decrease weight${on} by ${step} kilograms`}
      >
        &minus;&thinsp;{step}
      </button>

      <div className="weight__value" aria-live="polite">
        {formatWeight(weightKg)}
        <span className="weight__unit">kg</span>
      </div>

      <button
        type="button"
        className="weight__step"
        onClick={() => onAdjust(1)}
        disabled={weightKg >= maxKg}
        aria-label={`Increase weight${on} by ${step} kilograms`}
      >
        +&thinsp;{step}
      </button>
    </div>
  );
}
