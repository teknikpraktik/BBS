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
 * The two ways out are not the same door. Inside an exercise the close button
 * leaves that exercise and keeps the workout, so its question lives on the
 * exercise screen; on the overview it ends the whole workout, and that question
 * lives here.
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

  /**
   * Closes the exercise and goes home. The workout is left standing — including
   * every set already completed in it — and is picked up again from the home
   * screen.
   */
  const leaveExercise = (): void => {
    exitExercise();
    replace('');
  };

  return (
    <>
      {phase === 'exercise' ? (
        <ExerciseScreen active={active} onExit={leaveExercise} />
      ) : null}
      {phase === 'overview' ? (
        <OverviewScreen active={active} onRequestEnd={() => setConfirming(true)} />
      ) : null}
      {phase === 'complete' ? <CompleteScreen active={active} /> : null}

      {confirming ? (
        <ConfirmDialog
          title="End workout?"
          body="This workout will not be saved."
          cancelLabel="Continue Workout"
          confirmLabel="End Workout"
          destructive
          onCancel={() => setConfirming(false)}
          onConfirm={() => void discard()}
        />
      ) : null}
    </>
  );
}
