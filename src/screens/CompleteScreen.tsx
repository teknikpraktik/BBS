import type { ReactNode } from 'react';
import { PageHead, TopBar } from '../components/TopBar.tsx';
import { EXERCISES } from '../lib/exercises.ts';
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
 */
export function CompleteScreen({ active }: Props): ReactNode {
  const { finishWorkout } = useWorkout();

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
          <div className="summary__item" key={item.id}>
            <span className="summary__name">{item.name}</span>
            <span className="summary__value">
              {formatWeight(active.temporary_weights[item.id])}
              <span className="weight__unit">kg</span>
            </span>
          </div>
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
    </div>
  );
}
