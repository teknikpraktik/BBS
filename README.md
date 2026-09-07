# BBS — Body by Science

A minimal Big Five workout PWA. Five fixed exercises, one 90 second working set
each, the final weight recorded, and nothing else.

> Pick a weight → 5, 4, 3, 2, 1, pip → work for 90 seconds → the final weight is
> recorded → move on → watch it change over time.

## The product in one paragraph

BBS guides a single, fixed workout: Seated Row, Chest Press, Pulldown, Overhead
Press, Leg Press. Each exercise gets exactly one set of up to 90 seconds. The
weight shown when the clock reaches 00:00 is what gets saved, and it becomes the
starting weight for that exercise next time. There are no accounts, no streaks,
no recommendations, no coaching, and no performance scores. A workout can be
completed with the device fully offline.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build
npm test             # vitest, once
npm run test:watch   # vitest, watching
npm run typecheck    # tsc --noEmit on its own
npm run icons        # regenerate public/icons from scripts/gen-icons.mjs
npm run server       # optional reference sync backend on :8787
```

Deploying: it is a static build. Any static host works; on Vercel the defaults
(`npm run build`, output `dist`) are correct with no extra configuration.

## Architecture

```
src/
  lib/
    exercises.ts    The Big Five, the 90s duration, the 2.5 kg step, weight ceilings
    types.ts        Data model (installation, weights, workouts, active workout)
    db.ts           IndexedDB. The immediate source of truth during a workout
    sync.ts         Fire-and-forget, idempotent backend sync
    feedback.ts     WebAudio cues and vibration patterns
    wakeLock.ts     Best-effort screen wake lock while a workout is in progress
    router.ts       Hash router, five destinations
    format.ts       Clock, weight and date formatting
  state/
    settings.tsx    Appearance / sound / haptics, persisted per installation
    workout.tsx     The workout state machine
  screens/          Home, Workout (exercise / overview / complete), History,
                    WorkoutDetail, Settings, Information
  components/       TimerDial, WeightControl, ProgressChart, ConfirmDialog, icons
  test/             jsdom setup and the in-memory stand-in for db.ts
server/
  server.mjs        Zero-dependency reference sync backend
```

### The state machine

`workout.tsx` holds one `ActiveWorkout` object and derives the screen from it,
so there is no separate navigation state to keep in step:

| condition                        | screen           |
| -------------------------------- | ---------------- |
| no active workout                | Home             |
| `current_exercise` is set        | Exercise         |
| no current exercise, < 5 done    | Overview         |
| 5 exercises done                 | Workout Complete |

Every transition is written to IndexedDB immediately, which is why a refresh, a
crash, or a phone restart mid-workout returns you to the same set.

The clock inside an exercise is one more field on the same object,
`timer_state`:

| state       | meaning                                          | leaving the foreground |
| ----------- | ------------------------------------------------ | ---------------------- |
| `ready`     | the exercise is open, nothing has started        | nothing to do          |
| `countdown` | the five second lead-in after Start              | dropped, back to ready |
| `running`   | the set clock is running                         | pauses                 |
| `paused`    | the set clock is stopped, its remainder kept     | nothing to do          |

### The timer

Both clocks are driven by a wall-clock deadline in `running_until`, not by
accumulated interval ticks, so a throttled or delayed callback can never stretch
either one. Pausing stores the remaining milliseconds; resuming computes a new
deadline from it.

**Start does not start the set.** It opens a five second lead-in — 5, 4, 3, 2,
1, then a single pip — which exists so the stack is already moving and the user
is in position before time under load starts counting. The lead-in is a state of
its own precisely so those five seconds cannot reach the set: `timer_remaining_ms`
holds the full, untouched set length throughout, and the set's deadline is
computed from it at the hand-off rather than from a duration repeated anywhere.
Nothing about a set is recorded during the lead-in, and it is never resumed: a
reload or a trip to the background puts the exercise back at Ready.

A set never resumes on its own either. Leaving the foreground pauses it, and
coming back requires an explicit **Resume** — the app does not assume the wake
lock was honoured or that the screen stayed on.

**Restart exercise** is the counterpart to Pause and is deliberately not the
same thing. Pause keeps the attempt; Restart throws it away and puts the same
exercise back at Ready — clock, pause and lead-in reset, the exercise, its
weight and the other four exercises untouched. `completed_exercises` is never
written by it, so an abandoned attempt cannot become a completed set or a
history entry. It asks for confirmation; cancelling the lead-in does not, since
there is nothing yet to lose.

Asking the question stops the clock, through the same Pause the user has rather
than a second mechanism for the dialog. The set therefore cannot finish itself
behind the dialog, and the seconds spent deciding are not taken off the set:
Cancel resumes from exactly what was left. A set that was already paused when
the question was asked stays paused either way. Both tickers also check that the
workout they were started for is still the current one, so an interval callback
already queued when Pause landed cannot complete the set after the fact.

### The four kinds of weight

Four different things are all "the weight", and keeping them apart is most of
the weight logic in the app:

| what                        | where it lives                            | who writes it                             |
| --------------------------- | ----------------------------------------- | ----------------------------------------- |
| the starting weight         | `current_weights` store, one row per exercise | finishing a workout, and history edits    |
| the weight in this workout  | `active_workout.temporary_weights[id]`    | the steppers on the exercise screen       |
| the recorded weight         | `<exercise>_kg` on a `CompletedWorkout`   | finishing a workout                       |
| a corrected recorded weight | the same field, edited in place           | the steppers on the history detail screen |

A workout opens by copying the starting weights into `temporary_weights`, which
is a plain map from exercise to kilograms: five independent numbers, edited only
by the exercise currently open, so moving between exercises cannot disturb any
of the others. Nothing is written to history until the fifth set is done.

**The starting weight for the next workout is the newest completed workout's** —
newest by `completed_at`. `current_weights` is a cache of exactly that, so
correcting or deleting the newest workout re-derives it
(`refreshCurrentWeightsFromHistory`), and correcting an older one does not move
it. With no workouts left, the stored weights are kept rather than reset to
zero: a stale starting weight is still the best guess available.

### Editing and deleting history

A recorded weight can be corrected from the workout's detail screen, with the
same steppers, step size and ceilings as during a workout. It is an edit of the
existing record and nothing else — same `workout_id`, same `completed_at`, same
other four weights — so no second workout and no second log can come out of it.
The record goes back to `pending` so the correction is pushed; the push is an
upsert, so it replaces the row upstream rather than adding one.

Deleting removes the workout from IndexedDB and tells the backend
(`DELETE /workouts/<id>`) on a best-effort basis. Unlike a push there is nothing
left locally to retry from, so a deletion made offline is simply not mirrored.
That is invisible today — nothing is ever read back from the backend — but it is
why deletion is described as local.

### Data and sync

Everything is written to IndexedDB first and the backend is only ever a mirror;
sync never blocks or delays anything the user is doing. There is no account: a
random `installation_id` is minted on first run and is the entire identity
model. Losing local data or changing device means the history cannot be
recovered — an accepted MVP limitation.

Completed workouts are stored with `sync_status: 'pending'` and pushed when the
network allows, retried on `online` and on returning to the foreground. The push
is an upsert keyed by `workout_id`, so replaying a workout any number of times
produces exactly one row.

Set `VITE_SYNC_ENDPOINT` to enable it (see `.env.example`). Left unset, the app
runs fully local and workouts simply stay pending; nothing else changes.

The backend contract is three routes:

```
PUT    /workouts                         upsert on workout_id -> { ok, created }
GET    /workouts?installation_id=<id>    -> { workouts: [...] }
DELETE /workouts/<workout_id>            idempotent -> { ok, deleted }
```

`server/server.mjs` implements exactly that in ~190 dependency-free lines. It is
a reference, not a production service: no auth, no rate limiting, JSON file
storage.

## Design notes

Light and dark are one design system with swapped tokens, not two looks. The
timer is the largest element on screen and readable from several metres away.
Weight controls are oversized because they are used by tired hands. State is
always spelled out in words as well as shown by colour, and neither sound nor
haptics is ever the only channel carrying information.

Every state of the exercise screen shows one primary button and at most one
quiet one, so nothing has to be read mid-set: Start / Choose another exercise,
then Cancel, then Pause / Restart exercise, then Resume / Restart exercise.
Weight changes are direct manipulation everywhere, during a workout and in
history alike — steppers, never a dialog. The only dialogs in the app are in
front of the three things that destroy data: ending a workout, restarting an
exercise, and deleting a saved workout.

## Deliberately not built

Accounts, social login, multiple programmes, custom exercises, multiple sets,
rep counting, RPE/RIR, recommendations, AI coaching, automatic progression,
calories, heart rate, Apple Health / Health Connect, leaderboards, achievements,
streaks, push notifications, payments.

The main risk to this product is not too few features — it is that new ones
gradually make the workout itself more complicated. The test for any addition:
**does this make the Big Five workout simpler, or the information afterwards
clearer?** If not, it does not belong here.
