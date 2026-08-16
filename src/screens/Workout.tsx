import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { ExerciseScreen } from './ExerciseScreen.tsx';
import { OverviewScreen } from './OverviewScreen.tsx';
import { CompleteScreen } from './CompleteScreen.tsx';
import { replace } from '../lib/router.ts';
import { useWorkout } from '../state/workout.tsx';

/** Routes the workout phase to a screen and owns the one destructive dialog. */
export function Workout(): ReactNode {
  const { loaded, active, phase, endWorkout } = useWorkout();
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
      {phase === 'exercise' ? (
        <ExerciseScreen active={active} onRequestEnd={() => setConfirming(true)} />
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
