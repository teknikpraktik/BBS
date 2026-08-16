import type { ReactNode } from 'react';
import { IconButton } from '../components/IconButton.tsx';
import { PageHead, TopBar } from '../components/TopBar.tsx';
import { BackIcon } from '../components/Icons.tsx';
import { EXERCISES } from '../lib/exercises.ts';
import { goBack } from '../lib/router.ts';

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="stack" style={{ gap: 10 }}>
      <h2 className="section-title">{title}</h2>
      <div className="prose muted">{children}</div>
    </section>
  );
}

/**
 * General information about the protocol the app implements. It explains how
 * the app works; it does not give individual medical or training advice.
 */
export function Information(): ReactNode {
  return (
    <div className="screen screen--scroll">
      <TopBar
        lead={
          <IconButton label="Back" onClick={() => goBack('')}>
            <BackIcon />
          </IconButton>
        }
      />

      <PageHead title="Information" subtitle="How this app runs the protocol." />

      <div className="stack" style={{ gap: 30, paddingBottom: 24 }}>
        <Section title="The Big Five">
          <p>
            BBS is built around five compound machine exercises that together cover the major
            movement patterns of the body: a horizontal pull, a horizontal push, a vertical pull, a
            vertical push, and a leg movement.
          </p>
          <ol>
            {EXERCISES.map((e) => (
              <li key={e.id}>{e.name}</li>
            ))}
          </ol>
        </Section>

        <Section title="How a Workout Works">
          <p>
            A workout is five exercises, one working set each. Every set lasts up to 90 seconds and
            the app times it for you.
          </p>
          <p>
            Set the machine to the weight you intend to use, match it on screen, and press Start.
            When the clock reaches 00:00 the set is over, the weight shown at that moment is
            recorded, and the exercise is marked as completed for the workout.
          </p>
          <p>
            There is no rest timer between exercises. The next set begins only when you start it.
          </p>
        </Section>

        <Section title="Time Under Load">
          <p>
            The goal of a set is time under load, not repetitions. How many reps you get through in
            the 90 seconds is not the measure of the set and is not recorded anywhere in this app.
            The only thing that counts is how long the muscle stays loaded.
          </p>
          <p>
            Each repetition is therefore performed very slowly — roughly 5 to 10 seconds in each
            direction — with no pause and no lockout at either end of the movement. At that speed a
            full 90 second set is only a handful of repetitions. That is expected, and it is not a
            sign that the weight is too heavy.
          </p>
          <p>
            Moving faster to fit more repetitions into the set works against it. Speed brings in
            momentum, and momentum unloads the muscle at exactly the point the set is meant to load
            it. Being quick is not the objective here; staying under load is.
          </p>
        </Section>

        <Section title="Exercise Order">
          <p>The standard sequence is:</p>
          <ol>
            {EXERCISES.map((e) => (
              <li key={e.id}>{e.name}</li>
            ))}
          </ol>
          <p>
            The app highlights the next exercise in this order, but you are not bound to it. If a
            machine is occupied, pick any exercise you have not done yet and come back to the others
            later. The workout is complete when all five are done, in whatever order you took them.
          </p>
        </Section>

        <Section title="Weight Selection">
          <p>
            You choose the weight yourself, in 2.5 kg steps. The app never suggests a weight and
            never tells you when to change one.
          </p>
          <p>
            The first time you use BBS every exercise starts at 0 kg, so you will need to set your
            own starting weights. After a completed workout, each exercise starts at the weight you
            finished it with last time.
          </p>
          <p>
            The weight can be adjusted before a set and while a set is running. Only the value shown
            when the clock reaches 00:00 is saved.
          </p>
        </Section>

        <Section title="Controlled Movement">
          <p>
            At the 5 to 10 second cadence described above, the movement has to be smooth in both
            directions to stay controlled. Changing direction gradually, rather than reversing at a
            stop, keeps the muscle loaded across the whole range.
          </p>
          <p>
            Momentum, jerking, and bouncing the weight shift the load away from the muscle and onto
            the joints, which is the opposite of what the set is meant to do.
          </p>
        </Section>

        <Section title="Pause">
          <p>
            A set can be paused at any time, for example to change the weight or adjust the machine.
            The clock freezes where it is and continues from the same point when you press Resume.
          </p>
          <p>
            If the app is sent to the background during a set, the clock pauses automatically. You
            have to press Resume to continue.
          </p>
        </Section>

        <Section title="Safety">
          <p>
            Stop the set if you feel pain, chest discomfort, dizziness, shortness of breath, or any
            other symptom that concerns you. Do not attempt to finish the 90 seconds through such a
            symptom.
          </p>
          <p>
            Make sure the machine is adjusted to you and that the weight is one you can control for
            the whole set. Breathe continuously; do not hold your breath under load.
          </p>
          <p>
            This app records what you did. It is not a medical device and does not provide medical
            or personal training advice. If you have a health condition, are pregnant, are returning
            from injury, or are new to resistance training, consult a qualified professional before
            starting.
          </p>
        </Section>

        <Section title="About">
          <p>
            Body by Science describes a low-frequency, high-intensity approach to resistance
            training: a small number of compound exercises, performed slowly, taken to a point of
            deep fatigue within a single set, with substantial recovery time between workouts.
          </p>
          <p>
            BBS implements only the timing and record keeping of that idea. It records what you
            lifted and shows how it changes over time. It does not evaluate your performance,
            recommend weights, or tell you when to train.
          </p>
        </Section>
      </div>
    </div>
  );
}
