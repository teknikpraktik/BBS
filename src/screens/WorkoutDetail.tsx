import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { BackIcon } from '../components/Icons.tsx';
import { getWorkout } from '../lib/db.ts';
import { EXERCISES } from '../lib/exercises.ts';
import { formatDateLong, formatWeight } from '../lib/format.ts';
import { goBack } from '../lib/router.ts';
import type { CompletedWorkout } from '../lib/types.ts';

interface Props {
  workoutId: string;
}

/** A recorded workout, read only. Past workouts are never edited or deleted. */
export function WorkoutDetail({ workoutId }: Props): ReactNode {
  const [workout, setWorkout] = useState<CompletedWorkout | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getWorkout(workoutId).then((found) => {
      if (cancelled) return;
      if (found) setWorkout(found);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  return (
    <div className="screen screen--scroll">
      <header className="topbar">
        <IconButton label="Back" onClick={() => goBack('history')}>
          <BackIcon />
        </IconButton>
      </header>

      {missing ? <p className="empty">This workout is no longer available.</p> : null}

      {workout ? (
        <>
          <h1 className="title" style={{ marginBottom: 20 }}>
            {formatDateLong(workout.completed_at)}
          </h1>

          <div className="summary">
            {EXERCISES.map((item) => (
              <div className="summary__item" key={item.id}>
                <span className="summary__name">{item.name}</span>
                <span className="summary__value">
                  {formatWeight(workout[item.column])}
                  <span className="weight__unit">kg</span>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
