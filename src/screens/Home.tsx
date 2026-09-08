import type { ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { Logo } from '../components/Logo.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { InfoIcon, SettingsIcon } from '../components/Icons.tsx';
import { navigate } from '../lib/router.ts';
import { useWorkout } from '../state/workout.tsx';

/**
 * Deliberately empty. No history, no statistics, no graphs — one obvious thing
 * to do, and two quiet ways to get everywhere else, placed at opposite corners
 * so they frame the wordmark instead of crowding it.
 *
 * The one thing to do is Start Workout, unless a workout is already in progress
 * — after leaving an exercise, say — in which case it is that workout. Starting
 * a second one over the top of it is not offered: the sets already done in it
 * would go with it.
 */
export function Home(): ReactNode {
  const { active, startWorkout } = useWorkout();

  const begin = async (): Promise<void> => {
    await startWorkout();
    navigate('workout');
  };

  return (
    <div className="screen home">
      <TopBar
        lead={
          <IconButton label="Information" onClick={() => navigate('information')}>
            <InfoIcon />
          </IconButton>
        }
        trail={
          <IconButton label="Settings" onClick={() => navigate('settings')}>
            <SettingsIcon />
          </IconButton>
        }
      />

      <div className="home__mark">
        <Logo className="home__logo" />
        <div className="home__name">
          <h1 className="home__wordmark">BBS</h1>
          <p className="home__sub">Body by Science</p>
        </div>
      </div>

      <div className="home__actions">
        <button
          type="button"
          className="btn btn--primary btn--hero btn--block"
          onClick={() => (active ? navigate('workout') : void begin())}
        >
          {active ? 'Resume Workout' : 'Start Workout'}
        </button>
        <button
          type="button"
          className="btn btn--quiet btn--block"
          onClick={() => navigate('history')}
        >
          History
        </button>
      </div>
    </div>
  );
}
