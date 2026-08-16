import type { ReactNode } from 'react';
import { formatClock } from '../lib/format.ts';
import { SET_DURATION_MS } from '../lib/exercises.ts';
import type { TimerState } from '../lib/types.ts';

const RADIUS = 47;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATE_LABEL: Record<TimerState, string> = {
  ready: 'Ready',
  running: 'Working set',
  paused: 'Paused',
  completed: 'Complete',
};

interface Props {
  remainingMs: number;
  state: TimerState;
}

/**
 * The single most prominent element on the exercise screen. Legible from a few
 * metres away, and the state is spelled out in words as well as shown by the
 * ring, so colour is never the only signal.
 */
export function TimerDial({ remainingMs, state }: Props): ReactNode {
  const fraction = Math.max(0, Math.min(1, remainingMs / SET_DURATION_MS));
  const clock = formatClock(remainingMs);

  return (
    <div className={`timer ${state === 'paused' ? 'timer--paused' : ''}`}>
      <div className="timer__dial">
        <svg className="timer__ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle className="timer__ring-track" cx="50" cy="50" r={RADIUS} />
          <circle
            className="timer__ring-progress"
            cx="50"
            cy="50"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          />
        </svg>
        <div className="timer__value" role="timer" aria-label={`${clock} remaining`}>
          {clock}
        </div>
      </div>
      <div className="timer__state" aria-live="polite">
        {STATE_LABEL[state]}
      </div>
    </div>
  );
}
