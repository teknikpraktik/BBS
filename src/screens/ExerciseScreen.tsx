import type { ReactNode } from 'react';
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
  onRequestEnd: () => void;
}

/**
 * One exercise, one set. Everything on this screen serves the set in progress:
 * the name, the weight, the clock, and a single primary action.
 */
export function ExerciseScreen({ active, onRequestEnd }: Props): ReactNode {
  const { remainingMs, adjustWeight, startSet, pauseSet, resumeSet, showOverview } = useWorkout();
  const id = active.current_exercise;
  if (!id) return null;

  const { name } = exercise(id);
  const state = active.timer_state;
  const done = active.completed_exercises.length;

  return (
    <div className="screen exercise">
      <TopBar
        lead={
          <IconButton label="End workout" onClick={onRequestEnd}>
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

      <TimerDial remainingMs={remainingMs} state={state} />

      <WeightControl exerciseId={id} weightKg={active.temporary_weights[id]} onAdjust={adjustWeight} />

      <div className="exercise__actions">
        {state === 'ready' ? (
          <button type="button" className="btn btn--primary btn--hero btn--block" onClick={startSet}>
            Start
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
        ) : (
          // Keeps the layout from shifting under the primary control mid-set.
          <div style={{ minHeight: 'var(--tap)' }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
