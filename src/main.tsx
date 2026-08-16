import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import { SettingsProvider } from './state/settings.tsx';
import { WorkoutProvider } from './state/workout.tsx';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <SettingsProvider>
      <WorkoutProvider>
        <App />
      </WorkoutProvider>
    </SettingsProvider>
  </StrictMode>,
);

// The service worker is what makes a workout possible with no network at all.
// Updates are applied on the next launch, never in the middle of a set.
registerSW({ immediate: true });
