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
  startWorkout: () => Promise<void>;
  selectExercise: (id: ExerciseId) => void;
  showOverview: () => void;
  adjustWeight: (steps: number) => void;
  startSet: () => void;
  pauseSet: () => void;
  resumeSet: () => void;
  endWorkout: () => Promise<void>;
  finishWorkout: () => Promise<void>;
}

const WorkoutContext = createContext<WorkoutValue | null>(null);

function phaseOf(active: ActiveWorkout | null): WorkoutPhase | null {
  if (!active) return null;
  if (active.completed_exercises.length === EXERCISES.length) return 'complete';
  return active.current_exercise ? 'exercise' : 'overview';
}

export function WorkoutProvider({ children }: { children: ReactNode }): ReactNode {
  const { sound, haptics } = useSettings();
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [remainingMs, setRemainingMs] = useState(SET_DURATION_MS);
  const [loaded, setLoaded] = useState(false);

  // Cue options are read at fire time so a settings change takes effect mid-set.
  const cueOptions = useRef({ sound, haptics });
  cueOptions.current = { sound, haptics };
  const cue = useCallback((name: Cue) => playCue(name, cueOptions.current), []);

  /** Single write path: state and IndexedDB never drift apart. */
  const commit = useCallback((next: ActiveWorkout | null) => {
    setActive(next);
    if (next) {
      setRemainingMs(next.timer_state === 'running' && next.running_until
        ? Math.max(0, next.running_until - Date.now())
        : next.timer_remaining_ms);
      void putActiveWorkout(next);
    } else {
      setRemainingMs(SET_DURATION_MS);
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
    const deadline = active.running_until;
    // Wall-clock driven, so a throttled timer callback can never make a set
    // longer than 90 seconds.
    let lastSecond = Math.ceil(Math.max(0, deadline - Date.now()) / 1000);

    const tick = (): void => {
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      const second = Math.max(0, Math.ceil(left / 1000));
      if (second < lastSecond) {
        if (second === 3 || second === 2 || second === 1) cue('countdown');
        lastSecond = second;
      }
      if (left <= 0) completeSet(active, { announce: true });
    };

    const handle = window.setInterval(tick, 100);
    tick();
    return () => window.clearInterval(handle);
  }, [active, cue, completeSet]);

  /* ---------------------------------------------------------------------- */
  /* Foreground / wake lock                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!active || active.timer_state !== 'running' || active.running_until === null) return;
    const deadline = active.running_until;
    const onVisibility = (): void => {
      if (document.visibilityState !== 'hidden') return;
      // Leaving the foreground pauses the set. Silently — a cue nobody is
      // there to hear is just noise.
      commit({
        ...active,
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

  const startSet = useCallback(() => {
    if (!active || active.timer_state !== 'ready') return;
    unlockAudio();
    cue('start');
    commit({
      ...active,
      timer_state: 'running',
      timer_remaining_ms: SET_DURATION_MS,
      running_until: Date.now() + SET_DURATION_MS,
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
      startWorkout,
      selectExercise,
      showOverview,
      adjustWeight,
      startSet,
      pauseSet,
      resumeSet,
      endWorkout,
      finishWorkout,
    }),
    [
      loaded,
      active,
      remainingMs,
      startWorkout,
      selectExercise,
      showOverview,
      adjustWeight,
      startSet,
      pauseSet,
      resumeSet,
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
