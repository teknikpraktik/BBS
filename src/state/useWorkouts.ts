import { useEffect, useState } from 'react';
import { getWorkouts } from '../lib/db.ts';
import type { CompletedWorkout } from '../lib/types.ts';

interface Result {
  workouts: CompletedWorkout[];
  loading: boolean;
}

/**
 * Reads completed workouts from local storage. History is always served from
 * IndexedDB, never from the network, so it is fully available offline.
 */
export function useWorkouts(): Result {
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getWorkouts().then((rows) => {
      if (cancelled) return;
      setWorkouts(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { workouts, loading };
}
