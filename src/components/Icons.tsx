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

/*
 * The cog is generated rather than written out: a literal path of twenty-four
 * points and twelve arcs is a thing nobody can read or correct. Six teeth, and
 * wide ones — checked at the 22px it is actually drawn at, where eight finer
 * teeth close up into their own stroke and the whole icon reads as a blob.
 */
const TEETH = 6;
const TIP_R = 9.5;
const ROOT_R = 6.3;
/** Half the angular width of a tooth, and how far the root arc is set in from it. */
const TOOTH_HALF_DEG = 20;
const FLANK_DEG = 7;

function polar(radius: number, degrees: number): string {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return `${(12 + radius * Math.cos(rad)).toFixed(2)} ${(12 + radius * Math.sin(rad)).toFixed(2)}`;
}

const COG = Array.from({ length: TEETH }, (_, i) => {
  const centre = (360 / TEETH) * i;
  const tipFrom = centre - TOOTH_HALF_DEG;
  const tipTo = centre + TOOTH_HALF_DEG;
  const rootFrom = tipTo + FLANK_DEG;
  const rootTo = centre + 360 / TEETH - TOOTH_HALF_DEG - FLANK_DEG;
  return [
    `${i === 0 ? 'M' : 'L'}${polar(TIP_R, tipFrom)}`,
    `A ${TIP_R} ${TIP_R} 0 0 1 ${polar(TIP_R, tipTo)}`,
    `L${polar(ROOT_R, rootFrom)}`,
    `A ${ROOT_R} ${ROOT_R} 0 0 1 ${polar(ROOT_R, rootTo)}`,
  ].join(' ');
})
  .join(' ')
  .concat(' Z');

export function SettingsIcon(): ReactNode {
  return (
    <svg {...base}>
      <path d={COG} />
      <circle cx="12" cy="12" r="2.9" />
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
