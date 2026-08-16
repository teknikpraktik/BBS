import type { ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { PageHead, TopBar } from '../components/TopBar.tsx';
import { BackIcon } from '../components/Icons.tsx';
import { goBack } from '../lib/router.ts';
import { playCue } from '../lib/feedback.ts';
import { useSettings } from '../state/settings.tsx';
import type { Appearance } from '../lib/types.ts';

const APPEARANCES: readonly { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function Settings(): ReactNode {
  const { appearance, sound, haptics, hapticsSupported, setAppearance, setSound, setHaptics } =
    useSettings();

  return (
    <div className="screen screen--scroll">
      <TopBar
        lead={
          <IconButton label="Back" onClick={() => goBack('')}>
            <BackIcon />
          </IconButton>
        }
      />

      <PageHead title="Settings" />

      <div className="field">
        <span className="field__label" id="appearance-label">
          Appearance
        </span>
        <div className="segmented" role="group" aria-labelledby="appearance-label">
          {APPEARANCES.map((option) => (
            <button
              key={option.value}
              type="button"
              className="segmented__option"
              aria-pressed={appearance === option.value}
              onClick={() => setAppearance(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label" id="sound-label">
          Sound
        </span>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={sound}
          aria-labelledby="sound-label"
          onClick={() => {
            const next = !sound;
            setSound(next);
            // Turning it on plays the countdown blip, so the volume can be
            // checked here rather than mid-set. Starting a set is silent, so
            // that cue would demonstrate nothing.
            if (next) playCue('countdown', { sound: true, haptics: false });
          }}
        />
      </div>

      <div className="field">
        <span className="stack">
          <span className="field__label" id="haptics-label">
            Haptics
          </span>
          {hapticsSupported ? null : (
            <span className="field__hint">Not supported on this device</span>
          )}
        </span>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={haptics}
          aria-labelledby="haptics-label"
          disabled={!hapticsSupported}
          onClick={() => {
            const next = !haptics;
            setHaptics(next);
            if (next) playCue('start', { sound: false, haptics: true });
          }}
        />
      </div>

      <p className="field__hint" style={{ marginTop: 22 }}>
        Settings are stored on this device.
      </p>
    </div>
  );
}
