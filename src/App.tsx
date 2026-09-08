import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Home } from './screens/Home.tsx';
import { Workout } from './screens/Workout.tsx';
import { History } from './screens/History.tsx';
import { WorkoutDetail } from './screens/WorkoutDetail.tsx';
import { Settings } from './screens/Settings.tsx';
import { Information } from './screens/Information.tsx';
import { replace, useRoute } from './lib/router.ts';
import { startSyncWatcher } from './lib/sync.ts';
import { useWorkout } from './state/workout.tsx';

export function App(): ReactNode {
  const route = useRoute();
  const { loaded, active } = useWorkout();

  useEffect(() => startSyncWatcher(), []);

  useEffect(() => {
    // A workout survives a refresh or a cold start: return to it rather than
    // stranding the user on the home screen with a set half done.
    if (loaded && active && route.name === 'home') replace('workout');
  }, [loaded, active, route.name]);

  switch (route.name) {
    case 'workout':
      return <Workout />;
    case 'history':
      return <History />;
    case 'workout-detail':
      return <WorkoutDetail workoutId={route.workoutId} />;
    case 'settings':
      return <Settings />;
    case 'information':
      return <Information />;
    case 'home':
    default:
      return <Home />;
  }
}
