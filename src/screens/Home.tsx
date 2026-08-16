import type { ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { InfoIcon, SettingsIcon } from '../components/Icons.tsx';
import { navigate } from '../lib/router.ts';
import { useWorkout } from '../state/workout.tsx';

/**
 * Deliberately empty. No history, no statistics, no graphs — one obvious thing
 * to do, and two quiet ways to get everywhere else, placed at opposite corners
 * so they frame the wordmark instead of crowding it.
 */
export function Home(): ReactNode {
  const { startWorkout } = useWorkout();

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
        <h1 className="home__wordmark">BBS</h1>
        <p className="home__sub">Body by Science</p>
      </div>

      <div className="home__actions">
        <button
          type="button"
          className="btn btn--primary btn--hero btn--block"
          onClick={() => void begin()}
        >
          Start Workout
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
