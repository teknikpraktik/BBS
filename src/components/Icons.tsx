import type { ReactNode } from 'react';

/**
 * Thin, geometric line icons. Every icon is decorative: the control around it
 * always carries a text label or an aria-label.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export function InfoIcon(): ReactNode {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.6" />
    </svg>
  );
}

export function SettingsIcon(): ReactNode {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.36 5.64l-1.7 1.7M7.34 16.66l-1.7 1.7M18.36 18.36l-1.7-1.7M7.34 7.34l-1.7-1.7" />
    </svg>
  );
}

export function BackIcon(): ReactNode {
  return (
    <svg {...base}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function CloseIcon(): ReactNode {
  return (
    <svg {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CheckIcon(): ReactNode {
  return (
    <svg {...base} strokeWidth={2}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

export function ChevronRightIcon(): ReactNode {
  return (
    <svg {...base}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
