import { useEffect, useState } from 'react';

/**
 * Hash routing, so the app works from any static host and the hardware back
 * button behaves. There are five destinations; a library would be overkill.
 */

export type Route =
  | { name: 'home' }
  | { name: 'workout' }
  | { name: 'history' }
  | { name: 'workout-detail'; workoutId: string }
  | { name: 'settings' }
  | { name: 'information' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, tail] = path.split('/');
  switch (head) {
    case 'workout':
      return { name: 'workout' };
    case 'history':
      return tail ? { name: 'workout-detail', workoutId: tail } : { name: 'history' };
    case 'settings':
      return { name: 'settings' };
    case 'information':
      return { name: 'information' };
    default:
      return { name: 'home' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  const next = `#/${path.replace(/^\//, '')}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

/** Replaces the current entry so a finished workout cannot be re-entered by going back. */
export function replace(path: string): void {
  const next = `#/${path.replace(/^\//, '')}`;
  window.history.replaceState(null, '', next);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function goBack(fallback: string): void {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
