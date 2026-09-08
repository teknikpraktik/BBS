import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { TimerDial } from '../components/TimerDial.tsx';
import { WeightControl } from '../components/WeightControl.tsx';
import { IconButton } from '../components/IconButton.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { CloseIcon } from '../components/Icons.tsx';
import { EXERCISES, exercise } from '../lib/exercises.ts';
import { useWorkout } from '../state/workout.tsx';
import type { ActiveWorkout } from '../lib/types.ts';

interface Props {
  active: ActiveWorkout;
  /** Confirmed Exit exercise: closes this exercise and leaves the workout. */
  onExit: () => void;
}

/**
 * One exercise, one set. Everything on this screen serves the set in progress:
 * the name, the weight, the clock, and a single primary action.
 *
 * Every state below shows exactly one primary button and at most one quiet one,
 * so the screen never grows a row of controls to read mid-set:
 *
 *   ready      Start                 / Choose another exercise
 *   countdown  Cancel                — the lead-in has nothing to restart yet
 *   running    Pause                 / Restart exercise
 *   paused     Resume                / Restart exercise
 */
export function ExerciseScreen({ active, onExit }: Props): ReactNode {
  const {
    remainingMs,
    countdownSeconds,
    adjustWeight,
    startSet,
    pauseSet,
    resumeSet,
    restartSet,
    showOverview,
  } = useWorkout();
  /** Which question is on screen, if either. They are never both. */
  const [asking, setAsking] = useState<'restart' | 'exit' | null>(null);
  /** Whether the dialog is what stopped the clock, as opposed to the user. */
  const pausedForDialog = useRef(false);
  const id = active.current_exercise;
  if (!id) return null;

  const { name } = exercise(id);
  const state = active.timer_state;
  const done = active.completed_exercises.length;
  // Restart destroys an attempt, so it asks first. Cancelling the lead-in does
  // not — there is nothing to lose in the first five seconds.
  const canRestart = state === 'running' || state === 'paused';

  /**
   * Asking either question stops the clock, using the same Pause the user has —
   * not a second mechanism for the dialog. Two things follow from that: the set
   * cannot finish itself behind the dialog, and the seconds spent deciding are
   * not taken off the set. A set that was already paused stays paused whichever
   * way the question is answered.
   *
   * A lead-in is dropped rather than paused, exactly as Cancel and a trip to
   * the background drop it: there is nothing yet to keep, and a lead-in left
   * counting behind the dialog would hand over to a set nobody is working.
   */
  const ask = (question: 'restart' | 'exit'): void => {
    if (state === 'running') {
      pausedForDialog.current = true;
      pauseSet();
    } else if (state === 'countdown') {
      restartSet();
    }
    setAsking(question);
  };

  const keepAttempt = (): void => {
    setAsking(null);
    if (!pausedForDialog.current) return;
    pausedForDialog.current = false;
    // Resume computes a fresh deadline from the milliseconds Pause stored, so
    // the set carries on with exactly what was left when the dialog opened.
    resumeSet();
  };

  const discardAttempt = (): void => {
    setAsking(null);
    pausedForDialog.current = false;
    restartSet();
  };

  /**
   * Leaves the exercise. The attempt is thrown away the same way Restart throws
   * it away — nothing about it is recorded — but the workout stays, so the sets
   * already finished are still finished and still carry their weights.
   */
  const leaveExercise = (): void => {
    setAsking(null);
    pausedForDialog.current = false;
    onExit();
  };

  return (
    <div className="screen exercise">
      <TopBar
        lead={
          <IconButton label="Exit exercise" onClick={() => ask('exit')}>
            <CloseIcon />
          </IconButton>
        }
        center={
          <span
            className="label label--num"
            aria-label={`Exercise ${done + 1} of ${EXERCISES.length}`}
          >
            {done + 1} / {EXERCISES.length}
          </span>
        }
      />

      <div className="exercise__head">
        <h1 className="exercise__name">{name}</h1>
      </div>

      <TimerDial remainingMs={remainingMs} state={state} countdownSeconds={countdownSeconds} />

      {/* The weight is on screen from the moment the exercise is opened, and
          the steppers are live before Start: what is showing here is what the
          set will be recorded at. */}
      <WeightControl exerciseId={id} weightKg={active.temporary_weights[id]} onAdjust={adjustWeight} />

      <div className="exercise__actions">
        {state === 'ready' ? (
          <button type="button" className="btn btn--primary btn--hero btn--block" onClick={startSet}>
            Start
          </button>
        ) : null}

        {state === 'countdown' ? (
          <button
            type="button"
            className="btn btn--outline btn--hero btn--block"
            onClick={restartSet}
          >
            Cancel
          </button>
        ) : null}

        {state === 'running' ? (
          <button type="button" className="btn btn--outline btn--hero btn--block" onClick={pauseSet}>
            Pause
          </button>
        ) : null}

        {state === 'paused' ? (
          <button type="button" className="btn btn--primary btn--hero btn--block" onClick={resumeSet}>
            Resume
          </button>
        ) : null}

        {state === 'ready' ? (
          <button type="button" className="btn btn--quiet btn--block" onClick={showOverview}>
            Choose another exercise
          </button>
        ) : canRestart ? (
          <button type="button" className="btn btn--quiet btn--block" onClick={() => ask('restart')}>
            Restart exercise
          </button>
        ) : (
          // Keeps the layout from shifting under the primary control mid-set.
          <div style={{ minHeight: 'var(--tap)' }} aria-hidden="true" />
        )}
      </div>

      {asking === 'restart' ? (
        <ConfirmDialog
          title="Restart this exercise?"
          body="Current progress will be discarded."
          cancelLabel="Cancel"
          confirmLabel="Restart"
          destructive
          onCancel={keepAttempt}
          onConfirm={discardAttempt}
        />
      ) : null}

      {asking === 'exit' ? (
        <ConfirmDialog
          title="Exit this exercise?"
          body="Current progress will be discarded. Exercises already completed in this workout are kept."
          cancelLabel="Cancel"
          confirmLabel="Exit Exercise"
          destructive
          onCancel={keepAttempt}
          onConfirm={leaveExercise}
        />
      ) : null}
    </div>
  );
}
