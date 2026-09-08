import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { WeightControl } from './WeightControl.tsx';
import { SET_DURATION_MS, exercise, type ExerciseId } from '../lib/exercises.ts';

interface Props {
  exerciseId: ExerciseId;
  weightKg: number;
  onAdjust: (steps: number) => void;
  onClose: () => void;
}

/**
 * Corrects the weight of a set that is already done, without reopening the set.
 *
 * The steppers are the same component, the same 2.5 kg step and the same
 * ceilings used during the set and in history — only the state behind them
 * differs. Every tap is saved where it lands, exactly as during the set, so the
 * single button here closes rather than commits, and the backdrop and Escape do
 * the same. The time under load is shown because it is what makes the number
 * mean anything, and it is not editable: it was measured, not chosen.
 */
export function WeightDialog({ exerciseId, weightKg, onAdjust, onClose }: Props): ReactNode {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { name } = exercise(exerciseId);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="weight-dialog-title">
        <h2 className="dialog__title" id="weight-dialog-title">
          {name}
        </h2>
        <p className="dialog__body">
          Completed at {SET_DURATION_MS / 1000} s under load. Adjust the weight if it was recorded
          wrong.
        </p>

        <WeightControl
          exerciseId={exerciseId}
          weightKg={weightKg}
          onAdjust={onAdjust}
          labelSuffix={name}
        />

        <div className="dialog__actions">
          <button
            type="button"
            ref={closeRef}
            className="btn btn--primary btn--block"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
