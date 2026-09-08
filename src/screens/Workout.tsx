import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { ExerciseScreen } from './ExerciseScreen.tsx';
import { OverviewScreen } from './OverviewScreen.tsx';
import { CompleteScreen } from './CompleteScreen.tsx';
import { replace } from '../lib/router.ts';
import { useWorkout } from '../state/workout.tsx';

/**
 * Routes the workout phase to a screen and owns the dialog that ends a workout.
 *
 * The two ways out are not the same door, and they are one step apart. Inside an
 * exercise the close button leaves that exercise for the overview and keeps the
 * workout, so its question lives on the exercise screen; on the overview the
 * same corner ends the whole workout, and that question lives here.
 */
export function Workout(): ReactNode {
  const { loaded, active, phase, endWorkout, exitExercise } = useWorkout();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // Nothing in progress: this route has no meaning.
    if (loaded && !active) replace('');
  }, [loaded, active]);

  if (!loaded || !active || !phase) return <div className="screen" />;

  const discard = async (): Promise<void> => {
    setConfirming(false);
    await endWorkout();
    replace('');
  };

  return (
    <>
      {/* Exit takes no route of its own: clearing the current exercise is what
          puts the overview on screen, so the user steps back into the workout —
          every set already completed still there — rather than out of it. */}
      {phase === 'exercise' ? <ExerciseScreen active={active} onExit={exitExercise} /> : null}
      {phase === 'overview' ? (
        <OverviewScreen active={active} onRequestEnd={() => setConfirming(true)} />
      ) : null}
      {phase === 'complete' ? <CompleteScreen active={active} /> : null}

      {/* Ending leads, for the same reason exiting an exercise does: the cross
          in the corner is already the answer, and the question only says what
          it costs. */}
      {confirming ? (
        <ConfirmDialog
          title="End workout?"
          body="This workout will not be saved."
          cancelLabel="Continue Workout"
          confirmLabel="End Workout"
          lead="confirm"
          onCancel={() => setConfirming(false)}
          onConfirm={() => void discard()}
        />
      ) : null}
    </>
  );
}
