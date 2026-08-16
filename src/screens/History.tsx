import type { ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { BackIcon } from '../components/Icons.tsx';
import { ProgressChart, type ChartPoint } from '../components/ProgressChart.tsx';
import { EXERCISES } from '../lib/exercises.ts';
import { formatDateCompact, formatWeight } from '../lib/format.ts';
import { goBack, navigate } from '../lib/router.ts';
import { useWorkouts } from '../state/useWorkouts.ts';

/**
 * Completed workouts only. A discarded workout has never been written here.
 * The table is compact on purpose: five numbers in a fixed order are quicker
 * to compare across weeks than five labelled rows per workout.
 */
export function History(): ReactNode {
  const { workouts, loading } = useWorkouts();

  // Charts read oldest to newest; the table reads newest first.
  const chronological = [...workouts].reverse();

  return (
    <div className="screen screen--scroll">
      <header className="topbar">
        <IconButton label="Back" onClick={() => goBack('')}>
          <BackIcon />
        </IconButton>
      </header>

      <h1 className="title" style={{ marginBottom: 16 }}>
        History
      </h1>

      {loading ? null : workouts.length === 0 ? (
        <p className="empty">No completed workouts yet.</p>
      ) : (
        <>
          <div className="history-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  {EXERCISES.map((e) => (
                    <th scope="col" key={e.id}>
                      {e.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workouts.map((workout) => (
                  <tr
                    key={workout.workout_id}
                    data-pending={workout.sync_status === 'pending'}
                    onClick={() => navigate(`history/${workout.workout_id}`)}
                  >
                    <td>
                      {/* The anchor carries keyboard and screen-reader access;
                          the row click is a convenience on top of it. */}
                      <a
                        className="history-cell history-cell--date history-link"
                        href={`#/history/${workout.workout_id}`}
                        aria-label={`Open workout from ${formatDateCompact(workout.completed_at)}`}
                      >
                        {formatDateCompact(workout.completed_at)}
                      </a>
                    </td>
                    {EXERCISES.map((e) => (
                      <td key={e.id}>
                        <span className="history-cell">{formatWeight(workout[e.column])}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="section-title" style={{ marginBottom: 12 }}>
            Progress
          </h2>
          <div className="stack" style={{ gap: 28, paddingBottom: 8 }}>
            {EXERCISES.map((e) => {
              const points: ChartPoint[] = chronological.map((w) => ({
                at: w.completed_at,
                kg: w[e.column],
              }));
              return <ProgressChart key={e.id} name={e.name} points={points} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}
