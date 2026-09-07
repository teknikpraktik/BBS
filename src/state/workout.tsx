import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  clearActiveWorkout,
  getActiveWorkout,
  getCurrentWeights,
  getInstallation,
  newId,
  putActiveWorkout,
  putCurrentWeights,
  putWorkout,
} from '../lib/db.ts';
import {
  COUNTDOWN_DURATION_MS,
  COUNTDOWN_SECONDS,
  EXERCISES,
  SET_DURATION_MS,
  WEIGHT_STEP_KG,
  clampWeight,
  exercise,
  type ExerciseId,
} from '../lib/exercises.ts';
import { playCue, unlockAudio, type Cue } from '../lib/feedback.ts';
import { releaseWakeLock, requestWakeLock } from '../lib/wakeLock.ts';
import { syncNow } from '../lib/sync.ts';
import { useSettings } from './settings.tsx';
import type { ActiveWorkout, CompletedWorkout } from '../lib/types.ts';

/** Which screen the workout flow is showing, derived entirely from state. */
export type WorkoutPhase = 'exercise' | 'overview' | 'complete';

interface WorkoutValue {
  /** False until the stored active workout, if any, has been read back. */
  loaded: boolean;
  active: ActiveWorkout | null;
  phase: WorkoutPhase | null;
  remainingMs: number;
  /** The whole number on screen during the lead-in: 5 down to 1. */
  countdownSeconds: number;
  startWorkout: () => Promise<void>;
  selectExercise: (id: ExerciseId) => void;
  showOverview: () => void;
  adjustWeight: (steps: number) => void;
  startSet: () => void;
  pauseSet: () => void;
  resumeSet: () => void;
  restartSet: () => void;
  endWorkout: () => Promise<void>;
  finishWorkout: () => Promise<void>;
}

const WorkoutContext = createContext<WorkoutValue | null>(null);

/** 5 while more than four seconds remain, 1 through the last one. Never 0: the
 *  screen goes straight from 1 to the running clock. */
function countdownAt(deadline: number): number {
  return Math.max(1, Math.min(COUNTDOWN_SECONDS, Math.ceil((deadline - Date.now()) / 1000)));
}

function phaseOf(active: ActiveWorkout | null): WorkoutPhase | null {
  if (!active) return null;
  if (active.completed_exercises.length === EXERCISES.length) return 'complete';
  return active.current_exercise ? 'exercise' : 'overview';
}

export function WorkoutProvider({ children }: { children: ReactNode }): ReactNode {
  const { sound, haptics } = useSettings();
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [remainingMs, setRemainingMs] = useState(SET_DURATION_MS);
  const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_SECONDS);
  const [loaded, setLoaded] = useState(false);

  // Cue options are read at fire time so a settings change takes effect mid-set.
  const cueOptions = useRef({ sound, haptics });
  cueOptions.current = { sound, haptics };
  const cue = useCallback((name: Cue) => playCue(name, cueOptions.current), []);

  /**
   * The workout as of the last write, updated synchronously.
   *
   * An interval callback that was already queued when the state changed still
   * runs, holding the workout it was started for. Pausing a set — which is what
   * the Restart question does — must not be able to have a clock tick from the
   * moment before it complete the set anyway, so both tickers check here that
   * they are still ticking for the workout that is actually current.
   */
  const live = useRef<ActiveWorkout | null>(null);

  /** Single write path: state and IndexedDB never drift apart. */
  const commit = useCallback((next: ActiveWorkout | null) => {
    live.current = next;
    setActive(next);
    if (next) {
      // The lead-in leaves the set clock alone: during "countdown" the set is
      // still showing its full, untouched length.
      setRemainingMs(next.timer_state === 'running' && next.running_until
        ? Math.max(0, next.running_until - Date.now())
        : next.timer_remaining_ms);
      setCountdownSeconds(
        next.timer_state === 'countdown' && next.running_until
          ? countdownAt(next.running_until)
          : COUNTDOWN_SECONDS,
      );
      void putActiveWorkout(next);
    } else {
      setRemainingMs(SET_DURATION_MS);
      setCountdownSeconds(COUNTDOWN_SECONDS);
      void clearActiveWorkout();
    }
  }, []);

  /**
   * The weight on screen when the clock reaches 00:00 is the set's final
   * weight. Nothing earlier in the set is recorded.
   */
  const completeSet = useCallback(
    (workout: ActiveWorkout, options: { announce: boolean }) => {
      const id = workout.current_exercise;
      if (!id || workout.completed_exercises.includes(id)) return;
      if (options.announce) cue('complete');
      commit({
        ...workout,
        completed_exercises: [...workout.completed_exercises, id],
        current_exercise: null,
        timer_state: 'ready',
        timer_remaining_ms: SET_DURATION_MS,
        running_until: null,
      });
    },
    [commit, cue],
  );

  /* ---------------------------------------------------------------------- */
  /* Restore                                                                 */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    void getActiveWorkout().then((stored) => {
      if (cancelled) return;
      if (!stored) {
        setLoaded(true);
        return;
      }
      if (stored.timer_state === 'countdown') {
        // Nothing was worked during the lead-in, so there is nothing to
        // restore and nothing to lose: the exercise goes back to Ready and the
        // next Start counts down again.
        commit({
          ...stored,
          timer_state: 'ready',
          timer_remaining_ms: SET_DURATION_MS,
          running_until: null,
        });
        setLoaded(true);
        return;
      }
      if (stored.timer_state === 'running' && stored.running_until) {
        const left = stored.running_until - Date.now();
        if (left <= 0) {
          // The app was killed outright and the full 90 seconds elapsed. The
          // weight at the deadline is known, so the set stands.
          completeSet(stored, { announce: false });
          setLoaded(true);
          return;
        }
        // Otherwise a set is never resumed automatically: the user has to
        // press Resume, exactly as after leaving the foreground.
        commit({ ...stored, timer_state: 'paused', timer_remaining_ms: left, running_until: null });
        setLoaded(true);
        return;
      }
      live.current = stored;
      setActive(stored);
      setRemainingMs(stored.timer_remaining_ms);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Restore runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Ticking                                                                 */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!active || active.timer_state !== 'running' || active.running_until === null) return;
    const workout = active;
    const deadline: number = active.running_until;
    // Wall-clock driven, so a throttled timer callback can never make a set
    // longer than 90 seconds.
    let lastSecond = Math.ceil(Math.max(0, deadline - Date.now()) / 1000);

    const tick = (): void => {
      // The set was paused or restarted under this interval. Nothing it could
      // do now would be about the set that is actually on screen.
      if (live.current !== workout) return;
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      const second = Math.max(0, Math.ceil(left / 1000));
      if (second < lastSecond) {
        if (second === 3 || second === 2 || second === 1) cue('countdown');
        lastSecond = second;
      }
      if (left <= 0) completeSet(workout, { announce: true });
    };

    const handle = window.setInterval(tick, 100);
    tick();
    return () => window.clearInterval(handle);
  }, [active, cue, completeSet]);

  /**
   * The lead-in. Wall-clock driven like the set clock, and its own state, so
   * none of these five seconds can reach the set: the set clock only starts
   * once this hands over, and it starts from the length already on the
   * workout rather than from a duration repeated here.
   */
  useEffect(() => {
    if (!active || active.timer_state !== 'countdown' || active.running_until === null) return;
    const workout = active;
    const deadline: number = active.running_until;
    let handedOver = false;

    const tick = (): void => {
      // Same staleness guard as the set clock: a cancelled lead-in must not
      // hand over to a set from an interval that has already been replaced.
      if (handedOver || live.current !== workout) return;
      if (deadline - Date.now() > 0) {
        setCountdownSeconds(countdownAt(deadline));
        return;
      }
      handedOver = true;
      // The pip is the hand-off, and the only cue the user is not looking at
      // the screen for.
      cue('go');
      commit({
        ...workout,
        timer_state: 'running',
        running_until: Date.now() + workout.timer_remaining_ms,
      });
    };

    const handle = window.setInterval(tick, 100);
    tick();
    return () => window.clearInterval(handle);
  }, [active, commit, cue]);

  /* ---------------------------------------------------------------------- */
  /* Foreground / wake lock                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!active || active.running_until === null) return;
    if (active.timer_state !== 'running' && active.timer_state !== 'countdown') return;
    const workout = active;
    const deadline: number = active.running_until;
    const onVisibility = (): void => {
      if (document.visibilityState !== 'hidden') return;
      if (workout.timer_state === 'countdown') {
        // A lead-in that nobody is watching has nothing to count. It is
        // dropped rather than paused: the user was not at the machine yet.
        commit({
          ...workout,
          timer_state: 'ready',
          timer_remaining_ms: SET_DURATION_MS,
          running_until: null,
        });
        return;
      }
      // Leaving the foreground pauses the set. Silently — a cue nobody is
      // there to hear is just noise.
      commit({
        ...workout,
        timer_state: 'paused',
        timer_remaining_ms: Math.max(0, deadline - Date.now()),
        running_until: null,
      });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, commit]);

  useEffect(() => {
    if (!active) return;
    requestWakeLock();
    return () => releaseWakeLock();
  }, [active]);

  /* ---------------------------------------------------------------------- */
  /* Actions                                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * A workout opens on the overview, not on a machine. The standard sequence is
   * only a suggestion, and the app cannot know which machine is free — so the
   * first decision of every workout is the user's, not ours.
   */
  const startWorkout = useCallback(async () => {
    unlockAudio();
    const weights = await getCurrentWeights();
    commit({
      workout_id: newId(),
      workout_started_at: new Date().toISOString(),
      current_exercise: null,
      completed_exercises: [],
      temporary_weights: weights,
      timer_remaining_ms: SET_DURATION_MS,
      timer_state: 'ready',
      running_until: null,
    });
  }, [commit]);

  const selectExercise = useCallback(
    (id: ExerciseId) => {
      if (!active || active.completed_exercises.includes(id)) return;
      commit({
        ...active,
        current_exercise: id,
        timer_state: 'ready',
        timer_remaining_ms: SET_DURATION_MS,
        running_until: null,
      });
    },
    [active, commit],
  );

  /**
   * Steps back to the overview to pick a different machine. Only possible
   * before the set has been started — a running set is never abandoned.
   */
  const showOverview = useCallback(() => {
    if (!active || active.timer_state !== 'ready') return;
    commit({ ...active, current_exercise: null, running_until: null });
  }, [active, commit]);

  const adjustWeight = useCallback(
    (steps: number) => {
      if (!active?.current_exercise) return;
      const id = active.current_exercise;
      const next = clampWeight(id, active.temporary_weights[id] + steps * WEIGHT_STEP_KG);
      if (next === active.temporary_weights[id]) return;
      // Deliberately does not touch the timer: weight can change mid-set.
      commit({ ...active, temporary_weights: { ...active.temporary_weights, [id]: next } });
    },
    [active, commit],
  );

  /**
   * Start opens the five second lead-in, not the set. timer_remaining_ms is
   * set to the full set length here and read back when the lead-in hands over,
   * so the set length lives in one place and the lead-in cannot eat into it.
   */
  const startSet = useCallback(() => {
    if (!active || active.timer_state !== 'ready') return;
    unlockAudio();
    cue('start');
    commit({
      ...active,
      timer_state: 'countdown',
      timer_remaining_ms: SET_DURATION_MS,
      running_until: Date.now() + COUNTDOWN_DURATION_MS,
    });
  }, [active, commit, cue]);

  const pauseSet = useCallback(() => {
    if (!active || active.timer_state !== 'running' || active.running_until === null) return;
    cue('pause');
    commit({
      ...active,
      timer_state: 'paused',
      timer_remaining_ms: Math.max(0, active.running_until - Date.now()),
      running_until: null,
    });
  }, [active, commit, cue]);

  const resumeSet = useCallback(() => {
    if (!active || active.timer_state !== 'paused') return;
    unlockAudio();
    cue('resume');
    commit({
      ...active,
      timer_state: 'running',
      running_until: Date.now() + active.timer_remaining_ms,
    });
  }, [active, commit, cue]);

  /**
   * Throws the current attempt away and puts the same exercise back at Ready.
   *
   * The line against Pause is the whole point: Pause keeps the attempt and
   * comes back to it, Restart ends it. What goes: the clock, the pause, the
   * lead-in, and every second worked so far. What stays: the exercise, its
   * weight, and the four other exercises. Nothing is written to History —
   * completed_exercises is not touched, so an abandoned attempt cannot become
   * a completed set, and the next Start counts down from five again.
   */
  const restartSet = useCallback(() => {
    if (!active?.current_exercise) return;
    // Ready is already the restarted state; re-committing would only churn.
    if (active.timer_state === 'ready') return;
    commit({
      ...active,
      timer_state: 'ready',
      timer_remaining_ms: SET_DURATION_MS,
      running_until: null,
    });
  }, [active, commit]);

  /** Discards everything about the workout. Nothing reaches History. */
  const endWorkout = useCallback(async () => {
    commit(null);
  }, [commit]);

  const finishWorkout = useCallback(async () => {
    if (!active || active.completed_exercises.length !== EXERCISES.length) return;
    const installation = await getInstallation();
    const weights = active.temporary_weights;
    const workout: CompletedWorkout = {
      workout_id: active.workout_id,
      installation_id: installation.installation_id,
      completed_at: new Date().toISOString(),
      seated_row_kg: weights.seated_row,
      chest_press_kg: weights.chest_press,
      pulldown_kg: weights.pulldown,
      overhead_press_kg: weights.overhead_press,
      leg_press_kg: weights.leg_press,
      sync_status: 'pending',
    };
    // Local first. The backend is told about it afterwards, and never blocks.
    await putWorkout(workout);
    await putCurrentWeights(weights);
    commit(null);
    void syncNow();
  }, [active, commit]);

  const value = useMemo<WorkoutValue>(
    () => ({
      loaded,
      active,
      phase: phaseOf(active),
      remainingMs,
      countdownSeconds,
      startWorkout,
      selectExercise,
      showOverview,
      adjustWeight,
      startSet,
      pauseSet,
      resumeSet,
      restartSet,
      endWorkout,
      finishWorkout,
    }),
    [
      loaded,
      active,
      remainingMs,
      countdownSeconds,
      startWorkout,
      selectExercise,
      showOverview,
      adjustWeight,
      startSet,
      pauseSet,
      resumeSet,
      restartSet,
      endWorkout,
      finishWorkout,
    ],
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkout(): WorkoutValue {
  const value = useContext(WorkoutContext);
  if (!value) throw new Error('useWorkout must be used inside WorkoutProvider');
  return value;
}

/** The next exercise in the standard sequence that has not been done yet. */
export function nextInSequence(completed: readonly ExerciseId[]): ExerciseId | null {
  for (const e of EXERCISES) if (!completed.includes(e.id)) return e.id;
  return null;
}

export { exercise };
