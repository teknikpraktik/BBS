import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getInstallation, putInstallation } from '../lib/db.ts';
import { supportsHaptics } from '../lib/feedback.ts';
import type { Appearance, Installation } from '../lib/types.ts';

interface SettingsValue {
  /** Null until the local installation record has loaded. */
  installation: Installation | null;
  appearance: Appearance;
  sound: boolean;
  haptics: boolean;
  hapticsSupported: boolean;
  setAppearance: (value: Appearance) => void;
  setSound: (value: boolean) => void;
  setHaptics: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement;
  if (appearance === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', appearance);
  // Keep the OS chrome in step with the app in standalone mode.
  root.style.colorScheme = appearance === 'system' ? 'light dark' : appearance;
}

export function SettingsProvider({ children }: { children: ReactNode }): ReactNode {
  const [installation, setInstallation] = useState<Installation | null>(null);
  const hapticsSupported = useMemo(supportsHaptics, []);

  useEffect(() => {
    let cancelled = false;
    void getInstallation().then((loaded) => {
      if (cancelled) return;
      setInstallation(loaded);
      applyAppearance(loaded.appearance);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Installation>) => {
    setInstallation((previous) => {
      if (!previous) return previous;
      const next = { ...previous, ...patch };
      if (patch.appearance) applyAppearance(patch.appearance);
      void putInstallation(next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      installation,
      appearance: installation?.appearance ?? 'system',
      sound: installation?.sound_enabled ?? true,
      haptics: (installation?.haptics_enabled ?? true) && hapticsSupported,
      hapticsSupported,
      setAppearance: (appearance) => update({ appearance }),
      setSound: (sound_enabled) => update({ sound_enabled }),
      setHaptics: (haptics_enabled) => update({ haptics_enabled }),
    }),
    [installation, hapticsSupported, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
