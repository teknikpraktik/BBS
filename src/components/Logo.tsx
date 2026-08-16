import type { ReactNode } from 'react';

/**
 * The product mark: the timer ring, broken into the five exercises of a
 * workout, each segment one step along the same spectrum the running clock is
 * painted with. It says the two things the app is — a ring that counts, and
 * five of them — and it says them at 48 pixels as well as at 512.
 *
 * The identical geometry is rasterised into the app icons by
 * scripts/gen-icons.mjs. Change the shape here, change it there.
 */

const CENTRE = 256;
const RADIUS = 176;
const STROKE = 54;

const SEGMENTS = 5;
/** Wide enough that the round caps still leave daylight between segments. */
const GAP_DEG = 26;
const SPAN_DEG = 360 / SEGMENTS - GAP_DEG;

/**
 * Five stops of the timer's spectrum, hand-adjusted rather than generated: each
 * has to hold its own against both a near-black plate and a white page.
 */
export const MARK_COLORS = ['#E5484D', '#E8811A', '#2BA55B', '#1F7FE0', '#8B4FD0'];

/** A point on the ring. 0 degrees is the top, running clockwise. */
function point(degrees: number): [number, number] {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return [CENTRE + RADIUS * Math.cos(rad), CENTRE + RADIUS * Math.sin(rad)];
}

/** The five arcs, with the gap between the first and last centred on the top. */
export const MARK_ARCS = Array.from({ length: SEGMENTS }, (_, i) => {
  const from = GAP_DEG / 2 + i * (SPAN_DEG + GAP_DEG);
  const [x1, y1] = point(from);
  const [x2, y2] = point(from + SPAN_DEG);
  return {
    d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    stroke: MARK_COLORS[i],
  };
});

interface Props {
  className?: string;
}

export function Logo({ className }: Props): ReactNode {
  return (
    // Decorative: the wordmark beside it already says the name out loud.
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <g fill="none" strokeWidth={STROKE} strokeLinecap="round">
        {MARK_ARCS.map((arc) => (
          <path key={arc.d} d={arc.d} stroke={arc.stroke} />
        ))}
      </g>
    </svg>
  );
}
