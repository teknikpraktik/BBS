import type { ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { PageHead, TopBar } from '../components/TopBar.tsx';
import { CheckIcon, CloseIcon } from '../components/Icons.tsx';
import { EXERCISES } from '../lib/exercises.ts';
import { formatWeight } from '../lib/format.ts';
import { nextInSequence, useWorkout } from '../state/workout.tsx';
import type { ActiveWorkout } from '../lib/types.ts';

interface Props {
  active: ActiveWorkout;
  onRequestEnd: () => void;
}

/**
 * The between-sets screen. The standard sequence is highlighted, but any
 * remaining exercise can be taken instead when a machine is occupied. There is
 * no clock here: the next set starts only when the user says so.
 */
export function OverviewScreen({ active, onRequestEnd }: Props): ReactNode {
  const { selectExercise } = useWorkout();
  const next = nextInSequence(active.completed_exercises);
  const remaining = EXERCISES.length - active.completed_exercises.length;

  return (
    <div className="screen screen--scroll">
      <TopBar
        lead={
          <IconButton label="End workout" onClick={onRequestEnd}>
            <CloseIcon />
          </IconButton>
        }
      />

      <PageHead
        title="Workout"
        subtitle={
          // The opening screen of a workout says the rule once. It points at the
          // list itself, not at the Next badge: on this screen the badge sits on
          // the top row, where it tells you nothing the order has not already.
          active.completed_exercises.length === 0
            ? 'Listed in the standard order. Any order works.'
            : `${remaining} of ${EXERCISES.length} exercises left`
        }
      />

      <ul className="list">
        {EXERCISES.map((item) => {
          const isDone = active.completed_exercises.includes(item.id);
          const isNext = item.id === next;
          const weight = active.temporary_weights[item.id];

          return (
            <li key={item.id}>
              <button
                type="button"
                className={`row ${isDone ? 'row--done' : ''} ${isNext ? 'row--next' : ''}`}
                disabled={isDone}
                onClick={() => selectExercise(item.id)}
                aria-label={
                  isDone
                    ? `${item.name}, completed at ${formatWeight(weight)} kilograms`
                    : `Start ${item.name} at ${formatWeight(weight)} kilograms`
                }
              >
                <span className="row__mark" aria-hidden="true">
                  {isDone ? <CheckIcon /> : null}
                </span>
                <span className="row__body">
                  <span className="row__name">{item.name}</span>
                  {isDone ? <span className="row__meta">Completed</span> : null}
                </span>
                {isNext ? <span className="badge">Next</span> : null}
                <span className="row__value">{formatWeight(weight)} kg</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
