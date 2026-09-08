import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { IconButton } from '../components/IconButton.tsx';
import { PageHead, TopBar } from '../components/TopBar.tsx';
import { BackIcon } from '../components/Icons.tsx';
import { WeightControl } from '../components/WeightControl.tsx';
import { deleteWorkout, getWorkout, setWorkoutWeight } from '../lib/db.ts';
import {
  EXERCISES,
  WEIGHT_STEP_KG,
  clampWeight,
  exercise,
  type ExerciseId,
} from '../lib/exercises.ts';
import { formatDateLong } from '../lib/format.ts';
import { goBack, replace } from '../lib/router.ts';
import { deleteRemoteWorkout, syncNow } from '../lib/sync.ts';
import type { CompletedWorkout } from '../lib/types.ts';

interface Props {
  workoutId: string;
}

/**
 * A recorded workout, and the one place it can be corrected.
 *
 * Correcting is deliberately the same gesture as setting a weight during the
 * workout — the same steppers, the same 2.5 kg step, the same ceilings — but a
 * different piece of state: this writes to the saved record, whereas the
 * steppers during a workout only decide what will eventually be saved. Nothing
 * else on the record moves. The date, the id and the other four weights are
 * carried over untouched, so a correction updates this workout rather than
 * producing a second one.
 */
export function WorkoutDetail({ workoutId }: Props): ReactNode {
  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const savedTimer = useRef<number | null>(null);
  /**
   * What the screen currently believes the record is, updated on the tap rather
   * than on the write. A stepper is tapped faster than IndexedDB answers, and
   * reading the next value out of React state would make every tap after the
   * first one compute from a number that is already stale.
   */
  const shown = useRef<CompletedWorkout | null>(null);
  /** Writes go out in the order they were tapped, so the last tap wins on disk. */
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    void getWorkout(workoutId).then((found) => {
      if (cancelled) return;
      if (found) {
        shown.current = found;
        setWorkout(found);
      } else {
        setMissing(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  useEffect(
    () => () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  /**
   * Direct manipulation, saved on the tap. A correction is a small, obvious,
   * reversible edit; putting a dialog or a Save button in front of it would
   * cost more than it protects.
   */
  const adjust = useCallback(
    (id: ExerciseId, steps: number) => {
      const current = shown.current;
      if (!current) return;
      const { column } = exercise(id);
      const next = clampWeight(id, current[column] + steps * WEIGHT_STEP_KG);
      if (next === current[column]) return;

      // The same clamp the store applies, so the number under the thumb and the
      // number on disk are the same number.
      const optimistic: CompletedWorkout = { ...current, [column]: next, sync_status: 'pending' };
      shown.current = optimistic;
      setWorkout(optimistic);

      writes.current = writes.current
        .then(() => setWorkoutWeight(workoutId, id, next))
        .then(() => {
          setSaved(true);
          if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
          savedTimer.current = window.setTimeout(() => setSaved(false), 2400);
          // The push is an upsert on workout_id: the correction replaces the
          // row upstream instead of adding one.
          void syncNow();
        });
    },
    [workoutId],
  );

  const remove = async (): Promise<void> => {
    setConfirmingDelete(false);
    await deleteWorkout(workoutId);
    void deleteRemoteWorkout(workoutId);
    // Replace, so the back gesture cannot land on a workout that is now gone.
    replace('history');
  };

  return (
    <div className="screen screen--scroll">
      <TopBar
        lead={
          <IconButton label="Back" onClick={() => goBack('history')}>
            <BackIcon />
          </IconButton>
        }
      />

      {missing ? <p className="empty">This workout is no longer available.</p> : null}

      {workout ? (
        <>
          <PageHead
            title={formatDateLong(workout.completed_at)}
            subtitle="Adjust a weight if it was recorded wrong."
          />

          <div className="summary">
            {EXERCISES.map((item) => (
              <div className="summary__item summary__item--edit" key={item.id}>
                <span className="summary__name">{item.name}</span>
                <WeightControl
                  exerciseId={item.id}
                  weightKg={workout[item.column]}
                  onAdjust={(steps) => adjust(item.id, steps)}
                  compact
                  labelSuffix={item.name}
                />
              </div>
            ))}
          </div>

          {/* Announced as well as shown: the numbers change under the thumb,
              and this is the line that says the change is on disk. */}
          <p className="field__hint" role="status" aria-live="polite" style={{ marginTop: 14 }}>
            {saved ? 'Saved.' : 'Changes are saved as you make them.'}
          </p>

          <div className="grow" />

          <button
            type="button"
            className="btn btn--quiet btn--block"
            style={{ marginTop: 28 }}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete workout
          </button>
        </>
      ) : null}

      {/* Deleting leads: the button below the record is already the answer, and
          the question is here to say the reach of it — the charts as well as the
          history — not to argue against it. */}
      {confirmingDelete ? (
        <ConfirmDialog
          title="Delete this workout?"
          body="It will be removed from your history and from the progress charts. This cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Delete"
          lead="confirm"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </div>
  );
}
