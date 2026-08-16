import type { ReactNode } from 'react';

/**
 * Thin, geometric line icons on one 24px grid, drawn at a single stroke weight
 * so no icon reads heavier than its neighbour. Every icon is decorative: the
 * control around it always carries a text label or an aria-label.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export function InfoIcon(): ReactNode {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.2v5.4" />
      <circle cx="12" cy="7.9" r="0.55" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SettingsIcon(): ReactNode {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 3.2v2.2M12 18.6v2.2M20.8 12h-2.2M5.4 12H3.2" />
      <path d="M18.22 5.78l-1.56 1.56M7.34 16.66l-1.56 1.56M18.22 18.22l-1.56-1.56M7.34 7.34L5.78 5.78" />
    </svg>
  );
}

export function BackIcon(): ReactNode {
  return (
    <svg {...base} strokeWidth={1.75}>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </svg>
  );
}

export function CloseIcon(): ReactNode {
  return (
    <svg {...base} strokeWidth={1.75}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function CheckIcon(): ReactNode {
  return (
    <svg {...base} strokeWidth={1.9}>
      <path d="M5 12.5l4.6 4.6L19 6.8" />
    </svg>
  );
}

export function ChevronRightIcon(): ReactNode {
  return (
    <svg {...base} strokeWidth={1.75}>
      <path d="M9.5 5.5L16 12l-6.5 6.5" />
    </svg>
  );
}
