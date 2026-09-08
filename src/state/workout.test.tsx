import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dbMock, resetStore, store } from '../test/db-mock.ts';
import {
  COUNTDOWN_DURATION_MS,
  COUNTDOWN_SECONDS,
  EXERCISES,
  SET_DURATION_MS,
  WEIGHT_STEP_KG,
  type ExerciseId,
} from '../lib/exercises.ts';
import type { ActiveWorkout } from '../lib/types.ts';
import { SettingsProvider } from './settings.tsx';
import { WorkoutProvider, useWorkout } from './workout.tsx';
import { Workout } from '../screens/Workout.tsx';

vi.mock('../lib/db.ts', () => dbMock);

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return (
    <SettingsProvider>
      <WorkoutProvider>{children}</WorkoutProvider>
    </SettingsProvider>
  );
}

type Hook = { result: { current: ReturnType<typeof useWorkout> }; unmount: () => void };

/** Mounts the provider and waits out the restore read. */
async function mount(): Promise<Hook> {
  const hook = renderHook(() => useWorkout(), { wrapper });
  await act(async () => {
    await Promise.resolve();
  });
  return hook;
}

async function openWorkout(): Promise<Hook> {
  const hook = await mount();
  await act(async () => {
    await hook.result.current.startWorkout();
  });
  return hook;
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** An active workout as it would be read back on a reload. */
function seedActive(over: Partial<ActiveWorkout> = {}): void {
  store.activeWorkout = {
    workout_id: 'w1',
    workout_started_at: '2026-01-01T00:00:00.000Z',
    current_exercise: null,
    completed_exercises: [],
    temporary_weights: {
      seated_row: 40,
      chest_press: 40,
      pulldown: 40,
      overhead_press: 25,
      leg_press: 80,
    },
    timer_remaining_ms: SET_DURATION_MS,
    timer_state: 'ready',
    running_until: null,
    ...over,
  };
}

/** Start, sit through the lead-in, work the full set. */
function workSet(hook: Hook, id: ExerciseId): void {
  act(() => hook.result.current.selectExercise(id));
  act(() => hook.result.current.startSet());
  advance(COUNTDOWN_DURATION_MS);
  advance(SET_DURATION_MS);
}

beforeEach(() => {
  resetStore();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/* -------------------------------------------------------------------------- */

describe('the lead-in countdown', () => {
  it('counts 5, 4, 3, 2, 1 before the set clock starts', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.startSet());

    const seen: number[] = [];
    for (let second = 0; second < COUNTDOWN_SECONDS; second += 1) {
      expect(hook.result.current.active?.timer_state).toBe('countdown');
      seen.push(hook.result.current.countdownSeconds);
      advance(1000);
    }

    expect(seen).toEqual([5, 4, 3, 2, 1]);
    expect(hook.result.current.active?.timer_state).toBe('running');
  });

  it('leaves the set clock untouched while it runs', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.startSet());

    advance(3000);
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);

    // Handing over gives the set its full length: the five seconds are spent
    // before time under load starts, not out of it.
    advance(2000);
    expect(hook.result.current.active?.timer_state).toBe('running');
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);

    advance(1000);
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS - 1000);
  });

  it('takes the full set duration after the countdown, not five seconds less', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.startSet());

    advance(COUNTDOWN_DURATION_MS);
    advance(SET_DURATION_MS - 1000);
    expect(hook.result.current.active?.completed_exercises).toEqual([]);

    advance(1000);
    expect(hook.result.current.active?.completed_exercises).toEqual(['seated_row']);
  });

  it('records nothing while it is counting', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.startSet());
    advance(3000);

    expect(hook.result.current.active?.completed_exercises).toEqual([]);
    expect(store.workouts).toEqual([]);
  });

  it('is dropped, not paused, when the app leaves the foreground', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.startSet());
    advance(2000);

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(hook.result.current.active?.timer_state).toBe('ready');
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);
    expect(hook.result.current.active?.current_exercise).toBe('seated_row');

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('is never resumed after a reload', async () => {
    store.activeWorkout = {
      workout_id: 'w1',
      workout_started_at: '2026-01-01T00:00:00.000Z',
      current_exercise: 'pulldown',
      completed_exercises: [],
      temporary_weights: {
        seated_row: 40,
        chest_press: 40,
        pulldown: 55,
        overhead_press: 30,
        leg_press: 90,
      },
      timer_remaining_ms: SET_DURATION_MS,
      timer_state: 'countdown',
      running_until: Date.now() + 2000,
    };

    const hook = await mount();

    expect(hook.result.current.active?.timer_state).toBe('ready');
    expect(hook.result.current.active?.running_until).toBeNull();
    expect(hook.result.current.active?.current_exercise).toBe('pulldown');
    expect(hook.result.current.active?.temporary_weights.pulldown).toBe(55);
  });
});

/* -------------------------------------------------------------------------- */

describe('restart exercise', () => {
  it('resets a running set to the start', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('chest_press'));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 20_000);
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS - 20_000);

    act(() => hook.result.current.restartSet());

    expect(hook.result.current.active?.timer_state).toBe('ready');
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);
    expect(hook.result.current.active?.running_until).toBeNull();
    expect(hook.result.current.active?.current_exercise).toBe('chest_press');
  });

  it('clears the pause as well as the clock', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('chest_press'));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 30_000);
    act(() => hook.result.current.pauseSet());
    expect(hook.result.current.active?.timer_state).toBe('paused');

    act(() => hook.result.current.restartSet());

    expect(hook.result.current.active?.timer_state).toBe('ready');
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);
  });

  it('keeps the chosen weight', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('leg_press'));
    act(() => hook.result.current.adjustWeight(8));
    const chosen = hook.result.current.active?.temporary_weights.leg_press;
    expect(chosen).toBe(8 * WEIGHT_STEP_KG);

    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 10_000);
    act(() => hook.result.current.restartSet());

    expect(hook.result.current.active?.temporary_weights.leg_press).toBe(chosen);
  });

  it('counts down from five again on the next start', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('leg_press'));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 5000);
    act(() => hook.result.current.restartSet());

    act(() => hook.result.current.startSet());
    expect(hook.result.current.active?.timer_state).toBe('countdown');
    expect(hook.result.current.countdownSeconds).toBe(COUNTDOWN_SECONDS);
    advance(COUNTDOWN_DURATION_MS);
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);
  });

  it('writes no history entry and completes no exercise', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('overhead_press'));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 60_000);
    act(() => hook.result.current.restartSet());

    expect(hook.result.current.active?.completed_exercises).toEqual([]);
    expect(store.workouts).toEqual([]);
    // And the abandoned attempt did not leak a second exercise either.
    expect(hook.result.current.active?.current_exercise).toBe('overhead_press');
  });

  it('leaves the other four exercises alone', async () => {
    const hook = await openWorkout();
    workSet(hook, 'seated_row');
    act(() => hook.result.current.selectExercise('pulldown'));
    act(() => hook.result.current.adjustWeight(4));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 10_000);

    act(() => hook.result.current.restartSet());

    expect(hook.result.current.active?.completed_exercises).toEqual(['seated_row']);
    expect(hook.result.current.active?.temporary_weights.pulldown).toBe(4 * WEIGHT_STEP_KG);
  });

  it('does nothing on an exercise that has not been started', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    const before = hook.result.current.active;

    act(() => hook.result.current.restartSet());

    expect(hook.result.current.active).toBe(before);
  });
});

/* -------------------------------------------------------------------------- */

describe('weight during an active workout', () => {
  it('steps up and down by the app-wide step', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));

    act(() => hook.result.current.adjustWeight(4));
    expect(hook.result.current.active?.temporary_weights.seated_row).toBe(4 * WEIGHT_STEP_KG);

    act(() => hook.result.current.adjustWeight(-1));
    expect(hook.result.current.active?.temporary_weights.seated_row).toBe(3 * WEIGHT_STEP_KG);
  });

  it('does not go below zero or above the exercise ceiling', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('overhead_press'));

    act(() => hook.result.current.adjustWeight(-4));
    expect(hook.result.current.active?.temporary_weights.overhead_press).toBe(0);

    act(() => hook.result.current.adjustWeight(1000));
    expect(hook.result.current.active?.temporary_weights.overhead_press).toBe(250);
  });

  it('keeps a separate weight per exercise across moves between them', async () => {
    const hook = await openWorkout();
    const chosen: [ExerciseId, number][] = [
      ['seated_row', 2],
      ['chest_press', 6],
      ['pulldown', 10],
      ['overhead_press', 14],
      ['leg_press', 18],
    ];

    for (const [id, steps] of chosen) {
      act(() => hook.result.current.selectExercise(id));
      act(() => hook.result.current.adjustWeight(steps));
      act(() => hook.result.current.showOverview());
    }

    // Go back around: nothing was overwritten by the visits in between.
    for (const [id, steps] of chosen) {
      act(() => hook.result.current.selectExercise(id));
      expect(hook.result.current.active?.temporary_weights[id]).toBe(steps * WEIGHT_STEP_KG);
      act(() => hook.result.current.showOverview());
    }
  });

  it('opens on the weights the last workout finished at', async () => {
    store.currentWeights = {
      seated_row: 45,
      chest_press: 50,
      pulldown: 55,
      overhead_press: 30,
      leg_press: 120,
    };
    const hook = await openWorkout();
    expect(hook.result.current.active?.temporary_weights).toEqual(store.currentWeights);
  });

  it('saves each exercise at the weight it was set to', async () => {
    const hook = await openWorkout();
    const steps: [ExerciseId, number][] = [
      ['seated_row', 18],
      ['chest_press', 20],
      ['pulldown', 22],
      ['overhead_press', 12],
      ['leg_press', 40],
    ];

    for (const [id, count] of steps) {
      act(() => hook.result.current.selectExercise(id));
      act(() => hook.result.current.adjustWeight(count));
      act(() => hook.result.current.startSet());
      advance(COUNTDOWN_DURATION_MS);
      advance(SET_DURATION_MS);
    }

    await act(async () => {
      await hook.result.current.finishWorkout();
    });

    expect(store.workouts).toHaveLength(1);
    const saved = store.workouts[0]!;
    expect(saved.seated_row_kg).toBe(18 * WEIGHT_STEP_KG);
    expect(saved.chest_press_kg).toBe(20 * WEIGHT_STEP_KG);
    expect(saved.pulldown_kg).toBe(22 * WEIGHT_STEP_KG);
    expect(saved.overhead_press_kg).toBe(12 * WEIGHT_STEP_KG);
    expect(saved.leg_press_kg).toBe(40 * WEIGHT_STEP_KG);
    // The next workout opens where this one finished.
    expect(store.currentWeights.leg_press).toBe(40 * WEIGHT_STEP_KG);
  });

  it('carries the weight of a restarted exercise into what is saved', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.adjustWeight(10));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 15_000);
    act(() => hook.result.current.restartSet());
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS);
    advance(SET_DURATION_MS);

    for (const id of ['chest_press', 'pulldown', 'overhead_press', 'leg_press'] as ExerciseId[]) {
      workSet(hook, id);
    }
    await act(async () => {
      await hook.result.current.finishWorkout();
    });

    expect(store.workouts).toHaveLength(1);
    expect(store.workouts[0]!.seated_row_kg).toBe(10 * WEIGHT_STEP_KG);
  });
});

/* -------------------------------------------------------------------------- */

describe('the exercise screen', () => {
  /**
   * These mount the screen rather than the hook, so what is asserted is what is
   * on the buttons. The provider they read is the one the screen is rendered
   * inside, seeded through the same store the app restores from on a reload.
   */
  async function openExerciseScreen(): Promise<void> {
    store.activeWorkout = {
      workout_id: 'w1',
      workout_started_at: '2026-01-01T00:00:00.000Z',
      current_exercise: 'seated_row',
      completed_exercises: [],
      temporary_weights: {
        seated_row: 40,
        chest_press: 40,
        pulldown: 40,
        overhead_press: 25,
        leg_press: 80,
      },
      timer_remaining_ms: SET_DURATION_MS,
      timer_state: 'ready',
      running_until: null,
    };
    render(<Workout />, { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
  }

  const click = (name: string | RegExp): void => {
    act(() => screen.getByRole('button', { name }).click());
  };

  it('offers Start, then Cancel, then Pause and Restart', async () => {
    await openExerciseScreen();

    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restart exercise' })).toBeNull();

    click('Start');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('5');
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();

    advance(COUNTDOWN_DURATION_MS);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restart exercise' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('01:30');
  });

  it('has live weight steppers before the set starts', async () => {
    await openExerciseScreen();

    click(/^Increase weight by/);
    expect(store.activeWorkout?.temporary_weights.seated_row).toBe(42.5);

    click(/^Decrease weight by/);
    click(/^Decrease weight by/);
    expect(store.activeWorkout?.temporary_weights.seated_row).toBe(37.5);
  });

  it('asks before discarding an attempt', async () => {
    await openExerciseScreen();
    click('Start');
    advance(COUNTDOWN_DURATION_MS + 10_000);

    click('Restart exercise');
    expect(screen.getByRole('alertdialog').textContent).toContain('Restart this exercise?');
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'Current progress will be discarded.',
    );

    // Cancelling leaves the set exactly as it was.
    click('Cancel');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();

    click('Restart exercise');
    click('Restart');
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('01:30');
    expect(store.activeWorkout?.timer_state).toBe('ready');
    expect(store.activeWorkout?.temporary_weights.seated_row).toBe(40);
    expect(store.workouts).toEqual([]);
  });

  it('stops the clock while the question is on screen', async () => {
    await openExerciseScreen();
    click('Start');
    advance(COUNTDOWN_DURATION_MS + 30_000);
    expect(screen.getByRole('timer').textContent).toBe('01:00');

    click('Restart exercise');
    expect(store.activeWorkout?.timer_state).toBe('paused');

    // Long enough that the set would have been over twice.
    advance(3 * SET_DURATION_MS);

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('01:00');
    expect(store.activeWorkout?.completed_exercises).toEqual([]);
    expect(store.workouts).toEqual([]);
  });

  it('gives back exactly what was left when Cancel is chosen', async () => {
    await openExerciseScreen();
    click('Start');
    advance(COUNTDOWN_DURATION_MS + 30_000);

    click('Restart exercise');
    advance(20_000);
    click('Cancel');

    // None of the twenty seconds spent deciding came off the set.
    expect(screen.getByRole('timer').textContent).toBe('01:00');
    expect(store.activeWorkout?.timer_state).toBe('running');

    advance(1000);
    expect(screen.getByRole('timer').textContent).toBe('00:59');

    advance(59_000);
    expect(store.activeWorkout?.completed_exercises).toEqual(['seated_row']);
  });

  it('leaves an already paused set paused when Cancel is chosen', async () => {
    await openExerciseScreen();
    click('Start');
    advance(COUNTDOWN_DURATION_MS + 30_000);
    click('Pause');

    click('Restart exercise');
    click('Cancel');

    // The dialog did not pause it, so the dialog does not resume it either.
    expect(store.activeWorkout?.timer_state).toBe('paused');
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('01:00');
  });

  it('restarts cleanly with a second left on the clock', async () => {
    await openExerciseScreen();
    click('Start');
    advance(COUNTDOWN_DURATION_MS + 89_000);
    expect(screen.getByRole('timer').textContent).toBe('00:01');

    click('Restart exercise');
    advance(10_000);
    expect(store.activeWorkout?.completed_exercises).toEqual([]);

    click('Restart');

    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('01:30');
    expect(store.activeWorkout?.timer_state).toBe('ready');
    expect(store.activeWorkout?.current_exercise).toBe('seated_row');
    expect(store.activeWorkout?.temporary_weights.seated_row).toBe(40);
    expect(store.activeWorkout?.completed_exercises).toEqual([]);
    expect(store.workouts).toEqual([]);

    // And the next attempt is a whole one, lead-in included.
    click('Start');
    expect(screen.getByRole('timer').textContent).toBe('5');
    advance(COUNTDOWN_DURATION_MS);
    expect(screen.getByRole('timer').textContent).toBe('01:30');
  });
});

/* -------------------------------------------------------------------------- */

describe('exit exercise', () => {
  it('steps back to the overview and leaves the workout standing', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('chest_press'));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 40_000);

    act(() => hook.result.current.exitExercise());

    expect(hook.result.current.active).not.toBeNull();
    expect(hook.result.current.phase).toBe('overview');
    expect(hook.result.current.active?.current_exercise).toBeNull();
    expect(hook.result.current.active?.timer_state).toBe('ready');
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);
  });

  it('records nothing from the attempt it abandons', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('pulldown'));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 80_000);

    act(() => hook.result.current.exitExercise());
    // Long enough that the abandoned set would twice have run out.
    advance(3 * SET_DURATION_MS);

    expect(hook.result.current.active?.completed_exercises).toEqual([]);
    expect(store.workouts).toEqual([]);
  });

  it('leaves exercises already completed in this workout alone', async () => {
    const hook = await openWorkout();
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.adjustWeight(16));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS);
    advance(SET_DURATION_MS);
    workSet(hook, 'chest_press');

    act(() => hook.result.current.selectExercise('leg_press'));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 20_000);
    act(() => hook.result.current.exitExercise());

    expect(hook.result.current.active?.completed_exercises).toEqual(['seated_row', 'chest_press']);
    expect(hook.result.current.active?.temporary_weights.seated_row).toBe(16 * WEIGHT_STEP_KG);

    // And the workout can still be finished, carrying those two with it.
    for (const id of ['pulldown', 'overhead_press', 'leg_press'] as ExerciseId[]) {
      workSet(hook, id);
    }
    await act(async () => {
      await hook.result.current.finishWorkout();
    });
    expect(store.workouts).toHaveLength(1);
    expect(store.workouts[0]?.seated_row_kg).toBe(16 * WEIGHT_STEP_KG);
  });

  it('does nothing when no exercise is open', async () => {
    const hook = await openWorkout();
    const before = hook.result.current.active;

    act(() => hook.result.current.exitExercise());

    expect(hook.result.current.active).toBe(before);
  });

  it('asks first, and asks about the exercise rather than the workout', async () => {
    seedActive({ current_exercise: 'seated_row' });
    render(<Workout />, { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    const click = (name: string | RegExp): void => {
      act(() => screen.getByRole('button', { name }).click());
    };

    click('Start');
    advance(COUNTDOWN_DURATION_MS + 30_000);

    click('Exit exercise');
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Exit this exercise?');
    expect(dialog.textContent).toContain('Current progress will be discarded.');
    expect(screen.getByRole('button', { name: 'Exit Exercise' })).toBeTruthy();

    // The question stops the clock, so the set cannot finish behind it.
    expect(store.activeWorkout?.timer_state).toBe('paused');
    advance(3 * SET_DURATION_MS);
    expect(store.activeWorkout?.completed_exercises).toEqual([]);

    // Cancelling gives the set back exactly as it was.
    click('Cancel');
    expect(screen.getByRole('timer').textContent).toBe('01:00');
    expect(store.activeWorkout?.timer_state).toBe('running');

    click('Exit exercise');
    click('Exit Exercise');

    // The workout is still there; the exercise is not.
    expect(store.activeWorkout).toBeTruthy();
    expect(store.activeWorkout?.current_exercise).toBeNull();
    expect(store.activeWorkout?.completed_exercises).toEqual([]);
    expect(store.workouts).toEqual([]);
    expect(screen.queryByRole('timer')).toBeNull();

    // And what is on screen is the workout it went back to: five machines to
    // choose from, the one it just left included.
    expect(screen.getByRole('button', { name: /^Start Seated Row at/ })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Start .* at .* kilograms$/ })).toHaveLength(
      EXERCISES.length,
    );
  });

  it('hands the workout back to the overview, where the same corner ends it', async () => {
    seedActive({ current_exercise: 'pulldown', completed_exercises: ['seated_row'] });
    render(<Workout />, { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    const click = (name: string | RegExp): void => {
      act(() => screen.getByRole('button', { name }).click());
    };

    click('Start');
    advance(COUNTDOWN_DURATION_MS + 20_000);
    click('Exit exercise');
    click('Exit Exercise');

    // On the overview the close button is about the workout, not the exercise.
    expect(screen.getByRole('button', { name: 'End workout' })).toBeTruthy();
    click('End workout');
    expect(screen.getByRole('alertdialog').textContent).toContain('End workout?');
    click('End Workout');

    // Nothing survives it, and nothing reached history on the way out.
    expect(store.activeWorkout).toBeUndefined();
    expect(store.workouts).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */

describe('correcting a completed exercise during the workout', () => {
  it('is the weight the set was worked at, settled afterwards', async () => {
    const hook = await openWorkout();

    // 40 kg on the stack, raised to 50 halfway through the set.
    act(() => hook.result.current.selectExercise('seated_row'));
    act(() => hook.result.current.adjustWeight(16));
    act(() => hook.result.current.startSet());
    advance(COUNTDOWN_DURATION_MS + 45_000);
    act(() => hook.result.current.adjustWeight(4));
    expect(hook.result.current.active?.temporary_weights.seated_row).toBe(50);
    advance(45_000);
    expect(hook.result.current.active?.completed_exercises).toEqual(['seated_row']);

    // Back on the overview, the user settles on 45 for the set as a whole.
    act(() => hook.result.current.adjustWeightFor('seated_row', -2));
    expect(hook.result.current.active?.temporary_weights.seated_row).toBe(45);

    for (const id of ['chest_press', 'pulldown', 'overhead_press', 'leg_press'] as ExerciseId[]) {
      workSet(hook, id);
    }
    await act(async () => {
      await hook.result.current.finishWorkout();
    });

    // 45 is what history holds and what the next workout opens on.
    expect(store.workouts).toHaveLength(1);
    expect(store.workouts[0]?.seated_row_kg).toBe(45);
    expect(store.currentWeights.seated_row).toBe(45);
  });

  it('changes the weight and nothing else about the set', async () => {
    const hook = await openWorkout();
    workSet(hook, 'chest_press');
    const doneBefore = hook.result.current.active?.completed_exercises;

    act(() => hook.result.current.adjustWeightFor('chest_press', 6));

    expect(hook.result.current.active?.temporary_weights.chest_press).toBe(6 * WEIGHT_STEP_KG);
    // The set is still done, still ninety seconds, the clock still at rest.
    expect(hook.result.current.active?.completed_exercises).toEqual(doneBefore);
    expect(hook.result.current.active?.timer_state).toBe('ready');
    expect(hook.result.current.active?.timer_remaining_ms).toBe(SET_DURATION_MS);
    expect(hook.result.current.remainingMs).toBe(SET_DURATION_MS);
    expect(hook.result.current.active?.running_until).toBeNull();
  });

  it('leaves the other four exercises where they were', async () => {
    const hook = await openWorkout();
    workSet(hook, 'seated_row');
    const before = { ...hook.result.current.active?.temporary_weights };

    act(() => hook.result.current.adjustWeightFor('seated_row', 4));

    expect(hook.result.current.active?.temporary_weights).toEqual({
      ...before,
      seated_row: 4 * WEIGHT_STEP_KG,
    });
  });

  it('works the same for all five exercises', async () => {
    for (const item of EXERCISES) {
      resetStore();
      const hook = await openWorkout();
      workSet(hook, item.id);
      expect(hook.result.current.active?.completed_exercises).toEqual([item.id]);

      act(() => hook.result.current.adjustWeightFor(item.id, 8));

      expect(hook.result.current.active?.temporary_weights[item.id]).toBe(8 * WEIGHT_STEP_KG);
      expect(hook.result.current.active?.completed_exercises).toEqual([item.id]);
      hook.unmount();
    }
  });

  it('stays inside the same ceilings as the steppers during a set', async () => {
    const hook = await openWorkout();
    workSet(hook, 'overhead_press');

    act(() => hook.result.current.adjustWeightFor('overhead_press', -4));
    expect(hook.result.current.active?.temporary_weights.overhead_press).toBe(0);

    act(() => hook.result.current.adjustWeightFor('overhead_press', 1000));
    expect(hook.result.current.active?.temporary_weights.overhead_press).toBe(250);
  });
});

/* -------------------------------------------------------------------------- */

describe('the completed exercise block on the overview', () => {
  const click = (name: string | RegExp): void => {
    act(() => screen.getByRole('button', { name }).click());
  };

  async function openOverview(): Promise<void> {
    seedActive({ completed_exercises: ['seated_row'] });
    render(<Workout />, { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('is a live button that says what it does', async () => {
    await openOverview();

    const row = screen.getByRole('button', { name: /^Seated Row, completed at 40 kilograms/ });
    expect(row.hasAttribute('disabled')).toBe(false);
    expect(row.textContent).toContain('Adjust weight');
  });

  it('opens the weight for correction and saves each tap', async () => {
    await openOverview();

    click(/^Seated Row, completed at 40 kilograms/);
    expect(screen.getByRole('dialog').textContent).toContain('Seated Row');

    click(/^Increase weight for Seated Row/);
    click(/^Increase weight for Seated Row/);
    expect(store.activeWorkout?.temporary_weights.seated_row).toBe(45);

    click('Done');
    expect(screen.queryByRole('dialog')).toBeNull();
    // The corrected number is on the overview straight away.
    expect(
      screen.getByRole('button', { name: /^Seated Row, completed at 45 kilograms/ }).textContent,
    ).toContain('45 kg');
  });

  it('does not disturb the set it belongs to', async () => {
    await openOverview();

    click(/^Seated Row, completed at 40 kilograms/);
    click(/^Decrease weight for Seated Row/);
    click('Done');

    expect(store.activeWorkout?.temporary_weights.seated_row).toBe(37.5);
    expect(store.activeWorkout?.completed_exercises).toEqual(['seated_row']);
    expect(store.activeWorkout?.timer_state).toBe('ready');
    expect(store.activeWorkout?.timer_remaining_ms).toBe(SET_DURATION_MS);
    expect(store.workouts).toEqual([]);
  });

  it('still starts an exercise that has not been done', async () => {
    await openOverview();

    click(/^Start Chest Press at 40 kilograms/);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.activeWorkout?.current_exercise).toBe('chest_press');
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */

describe('correcting a weight on Workout Complete', () => {
  const click = (name: string | RegExp): void => {
    act(() => screen.getByRole('button', { name }).click());
  };

  /** The screen the fifth set hands over to: all five done, nothing saved yet. */
  async function openComplete(): Promise<void> {
    seedActive({ completed_exercises: EXERCISES.map((e) => e.id) });
    render(<Workout />, { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
  }

  /** Lets the local-first writes behind Finish settle. */
  async function flush(): Promise<void> {
    await act(async () => {
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
    });
  }

  it('corrects the fifth exercise, which never sees the overview again', async () => {
    await openComplete();

    click(/^Leg Press, recorded at 80 kilograms/);
    expect(screen.getByRole('dialog').textContent).toContain('Leg Press');
    click(/^Decrease weight for Leg Press/);
    click(/^Decrease weight for Leg Press/);
    click('Done');

    expect(store.activeWorkout?.temporary_weights.leg_press).toBe(75);
    // And it is on the screen straight away, without a reload or a save.
    expect(
      screen.getByRole('button', { name: /^Leg Press, recorded at 75 kilograms/ }).textContent,
    ).toContain('75kg');
  });

  it('corrects any of the first four just the same', async () => {
    await openComplete();

    for (const [name, id] of [
      ['Seated Row', 'seated_row'],
      ['Chest Press', 'chest_press'],
      ['Pulldown', 'pulldown'],
      ['Overhead Press', 'overhead_press'],
    ] as [string, ExerciseId][]) {
      click(new RegExp(`^${name}, recorded at`));
      click(new RegExp(`^Increase weight for ${name}`));
      click('Done');
      expect(store.activeWorkout?.temporary_weights[id]).toBe(
        (id === 'overhead_press' ? 25 : 40) + WEIGHT_STEP_KG,
      );
    }

    // Five independent numbers still: correcting four did not move the fifth.
    expect(store.activeWorkout?.temporary_weights.leg_press).toBe(80);
  });

  it('saves the corrected weight to history and to the next workout', async () => {
    await openComplete();

    click(/^Leg Press, recorded at 80 kilograms/);
    click(/^Increase weight for Leg Press/);
    click(/^Increase weight for Leg Press/);
    click('Done');

    click('Finish');
    await flush();

    expect(store.workouts).toHaveLength(1);
    expect(store.workouts[0]?.leg_press_kg).toBe(85);
    expect(store.workouts[0]?.seated_row_kg).toBe(40);
    // The starting weight for next time follows the correction.
    expect(store.currentWeights.leg_press).toBe(85);
    expect(store.activeWorkout).toBeUndefined();
  });

  it('opens the next workout on the corrected weight', async () => {
    const hook = await openWorkout();
    for (const item of EXERCISES) workSet(hook, item.id);
    expect(hook.result.current.phase).toBe('complete');

    act(() => hook.result.current.adjustWeightFor('leg_press', 20));
    act(() => hook.result.current.adjustWeightFor('seated_row', 12));
    await act(async () => {
      await hook.result.current.finishWorkout();
    });

    expect(store.workouts[0]?.leg_press_kg).toBe(20 * WEIGHT_STEP_KG);
    expect(store.workouts[0]?.seated_row_kg).toBe(12 * WEIGHT_STEP_KG);

    await act(async () => {
      await hook.result.current.startWorkout();
    });
    expect(hook.result.current.active?.temporary_weights.leg_press).toBe(20 * WEIGHT_STEP_KG);
    expect(hook.result.current.active?.temporary_weights.seated_row).toBe(12 * WEIGHT_STEP_KG);
  });

  it('leaves the rest of the screen as it was', async () => {
    await openComplete();

    // Nothing new between the fifth set and Finish: the same title, the same
    // five lines, and no dialog until one is asked for.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Workout Complete' })).toBeTruthy();
    expect(document.querySelectorAll('.summary__item')).toHaveLength(EXERCISES.length);
    expect(store.workouts).toEqual([]);
  });
});
