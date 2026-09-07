import type { ReactNode } from 'react';
import { formatClock } from '../lib/format.ts';
import { SET_DURATION_MS } from '../lib/exercises.ts';
import type { TimerState } from '../lib/types.ts';

const RADIUS = 43;
const STROKE = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The ring is painted as a spectrum, which SVG cannot express as a single
 * gradient around a circle, so it is drawn as a run of short arcs. Thirty-six
 * is enough that the seams disappear at any size the dial is shown at.
 */
const ARCS = 36;
/** Red at the top, running through the spectrum clockwise. */
const HUE_SWEEP = 300;

/** A point on the ring. 0 degrees is the top; the CSS rotation is what puts it there. */
function point(degrees: number): [number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [50 + RADIUS * Math.cos(rad), 50 + RADIUS * Math.sin(rad)];
}

/** One arc of the spectrum, overlapping its neighbour slightly to hide the seam. */
const SEGMENTS = Array.from({ length: ARCS }, (_, i) => {
  const step = 360 / ARCS;
  const [x1, y1] = point(i * step);
  const [x2, y2] = point((i + 1) * step + 0.6);
  return {
    d: `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${RADIUS} ${RADIUS} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    stroke: `hsl(${(HUE_SWEEP * i) / ARCS} 78% 52%)`,
  };
});

const STATE_LABEL: Record<TimerState, string> = {
  ready: 'Ready',
  countdown: 'Starting',
  running: 'Working set',
  paused: 'Paused',
  completed: 'Complete',
};

interface Props {
  remainingMs: number;
  state: TimerState;
  /** The whole number shown during the lead-in. Ignored in every other state. */
  countdownSeconds?: number;
}

/**
 * The single most prominent element on the exercise screen. Legible from a few
 * metres away, and the state is spelled out in words as well as shown by the
 * ring, so colour is never the only signal.
 */
export function TimerDial({ remainingMs, state, countdownSeconds = 0 }: Props): ReactNode {
  // The lead-in leaves the ring full: nothing has been spent yet, and a ring
  // that drained during it would say the set had started when it had not.
  const fraction = Math.max(0, Math.min(1, remainingMs / SET_DURATION_MS));
  const counting = state === 'countdown';
  const clock = formatClock(remainingMs);

  return (
    <div
      className={[
        'timer',
        state === 'paused' ? 'timer--paused' : '',
        counting ? 'timer--countdown' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="timer__dial">
        <svg className="timer__ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <defs>
            {/*
              The spectrum is a flat drawing; the mask is what makes it a clock.
              The mask arc is cut butt, not round: a round cap at its start would
              reach back past twelve o'clock and show the far end of the spectrum
              alongside the near end.
            */}
            <mask id="timer-remaining">
              <circle
                className="timer__ring-mask"
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke="#fff"
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
              />
            </mask>
          </defs>

          <circle className="timer__ring-track" cx="50" cy="50" r={RADIUS} strokeWidth={STROKE} />

          <g className="timer__ring-progress" mask="url(#timer-remaining)" strokeWidth={STROKE}>
            {SEGMENTS.map((segment) => (
              <path key={segment.d} d={segment.d} stroke={segment.stroke} fill="none" />
            ))}
          </g>
        </svg>
        {counting ? (
          // One number, as large as the dial will take. Same face, same ring,
          // same place on screen as the clock it is about to become.
          <div
            className="timer__value timer__value--count"
            role="timer"
            aria-label={`Starting in ${countdownSeconds}`}
          >
            {countdownSeconds}
          </div>
        ) : (
          <div className="timer__value" role="timer" aria-label={`${clock} remaining`}>
            {clock}
          </div>
        )}
      </div>
      {/*
        The state used to be spelled out under the ring. It said nothing the
        screen did not already say — the ring, the digits and the one button
        below all change with it — so it is now announced rather than shown,
        which keeps the state available without a word for it taking up room.
      */}
      <div className="visually-hidden" aria-live="polite">
        {STATE_LABEL[state]}
      </div>
    </div>
  );
}
