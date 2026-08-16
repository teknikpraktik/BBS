import type { ReactNode } from 'react';
import { MIN_WEIGHT_KG, WEIGHT_STEP_KG, exercise, type ExerciseId } from '../lib/exercises.ts';
import { formatWeight } from '../lib/format.ts';

interface Props {
  exerciseId: ExerciseId;
  weightKg: number;
  onAdjust: (steps: number) => void;
}

/**
 * Large circular steppers. Sized for tired hands: the touch targets are far
 * bigger than the minimum, and there is no free-text entry to get wrong.
 */
export function WeightControl({ exerciseId, weightKg, onAdjust }: Props): ReactNode {
  const { maxKg } = exercise(exerciseId);
  const step = formatWeight(WEIGHT_STEP_KG);

  return (
    <div className="weight">
      <button
        type="button"
        className="weight__step"
        onClick={() => onAdjust(-1)}
        disabled={weightKg <= MIN_WEIGHT_KG}
        aria-label={`Decrease weight by ${step} kilograms`}
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
        aria-label={`Increase weight by ${step} kilograms`}
      >
        +&thinsp;{step}
      </button>
    </div>
  );
}
