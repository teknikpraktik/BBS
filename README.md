# BBS — Body by Science

A minimal Big Five workout PWA. Five fixed exercises, one 90 second working set
each, the final weight recorded, and nothing else.

> Pick a weight → work for 90 seconds → the final weight is recorded → move on →
> watch it change over time.

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

### The timer

The countdown is driven by a wall-clock deadline, not by accumulated interval
ticks, so a throttled or delayed callback can never stretch a set past 90
seconds. Pausing stores the remaining milliseconds; resuming computes a new
deadline from it.

A set never resumes on its own. Leaving the foreground pauses it, and coming
back requires an explicit **Resume** — the app does not assume the wake lock was
honoured or that the screen stayed on.

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

The backend contract is two routes:

```
PUT /workouts                            upsert on workout_id -> { ok, created }
GET /workouts?installation_id=<id>       -> { workouts: [...] }
```

`server/server.mjs` implements exactly that in ~180 dependency-free lines. It is
a reference, not a production service: no auth, no rate limiting, JSON file
storage.

## Design notes

Light and dark are one design system with swapped tokens, not two looks. The
timer is the largest element on screen and readable from several metres away.
Weight controls are oversized because they are used by tired hands. State is
always spelled out in words as well as shown by colour, and neither sound nor
haptics is ever the only channel carrying information.

## Deliberately not built

Accounts, social login, multiple programmes, custom exercises, multiple sets,
rep counting, RPE/RIR, recommendations, AI coaching, automatic progression,
calories, heart rate, Apple Health / Health Connect, leaderboards, achievements,
streaks, push notifications, payments.

The main risk to this product is not too few features — it is that new ones
gradually make the workout itself more complicated. The test for any addition:
**does this make the Big Five workout simpler, or the information afterwards
clearer?** If not, it does not belong here.
