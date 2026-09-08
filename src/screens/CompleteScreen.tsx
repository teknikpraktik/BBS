import { useState } from 'react';
import type { ReactNode } from 'react';
import { PageHead, TopBar } from '../components/TopBar.tsx';
import { ChevronRightIcon } from '../components/Icons.tsx';
import { WeightDialog } from '../components/WeightDialog.tsx';
import { EXERCISES, type ExerciseId } from '../lib/exercises.ts';
import { formatWeight } from '../lib/format.ts';
import { useWorkout } from '../state/workout.tsx';
import { replace } from '../lib/router.ts';
import type { ActiveWorkout } from '../lib/types.ts';

interface Props {
  active: ActiveWorkout;
}

/**
 * The five recorded weights, and nothing else. No score, no comparison with
 * last time, no congratulation.
 *
 * Each of the five is still correctable, on the same terms as a completed row
 * on the overview and through the same dialog: the fifth set has no overview to
 * go back to, and a weight the fifth machine did not actually hold should not be
 * saved just because it was the last one worked. Nothing here is a second kind
 * of weight — the steppers move the same temporary_weights, and Finish saves
 * whatever is on them.
 */
export function CompleteScreen({ active }: Props): ReactNode {
  const { finishWorkout, adjustWeightFor } = useWorkout();
  /** The exercise whose weight is being corrected, if any. */
  const [editing, setEditing] = useState<ExerciseId | null>(null);

  const finish = async (): Promise<void> => {
    await finishWorkout();
    // Replace, so the back gesture cannot land on a workout that is now saved.
    replace('');
  };

  return (
    <div className="screen screen--scroll">
      <TopBar />

      <PageHead title="Workout Complete" subtitle="Recorded on this device." />

      <div className="summary">
        {EXERCISES.map((item) => (
          <button
            type="button"
            className="summary__item summary__item--action"
            key={item.id}
            onClick={() => setEditing(item.id)}
            aria-label={`${item.name}, recorded at ${formatWeight(
              active.temporary_weights[item.id],
            )} kilograms. Adjust weight`}
          >
            <span className="summary__name">{item.name}</span>
            <span className="summary__value">
              {formatWeight(active.temporary_weights[item.id])}
              <span className="weight__unit">kg</span>
            </span>
            <span className="summary__go" aria-hidden="true">
              <ChevronRightIcon />
            </span>
          </button>
        ))}
      </div>

      <div className="grow" />

      <button
        type="button"
        className="btn btn--primary btn--hero btn--block"
        style={{ marginTop: 28 }}
        onClick={() => void finish()}
      >
        Finish
      </button>

      {editing ? (
        <WeightDialog
          exerciseId={editing}
          weightKg={active.temporary_weights[editing]}
          onAdjust={(steps) => adjustWeightFor(editing, steps)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
