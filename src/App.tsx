import { useEffect, useRef } from 'react';
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
  /** Whether the one automatic return to a workout in progress has happened. */
  const returned = useRef(false);

  useEffect(() => startSyncWatcher(), []);

  useEffect(() => {
    // A workout survives a refresh or a cold start: return to it rather than
    // stranding the user on the home screen with a set half done.
    //
    // Once only, and only for a workout that was already there when the app
    // opened. Leaving an exercise puts the user on the home screen on purpose,
    // and the workout it left standing is picked up from the button there —
    // being thrown straight back into it would make Exit Exercise do nothing.
    if (!loaded || !active || returned.current) return;
    returned.current = true;
    if (route.name === 'home') replace('workout');
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
