import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WorkoutDetail } from './WorkoutDetail.tsx';
import { deleteWorkout, getWorkout, getWorkouts, putWorkout } from '../lib/db.ts';
import type { CompletedWorkout } from '../lib/types.ts';

const SAVED: CompletedWorkout = {
  workout_id: 'w1',
  installation_id: 'installation-1',
  completed_at: '2026-08-16T10:00:00.000Z',
  seated_row_kg: 40,
  chest_press_kg: 45,
  pulldown_kg: 50,
  overhead_press_kg: 25,
  leg_press_kg: 100,
  sync_status: 'synced',
};

beforeEach(async () => {
  for (const existing of await getWorkouts()) await deleteWorkout(existing.workout_id);
  await putWorkout(SAVED);
});

async function open(): Promise<void> {
  render(<WorkoutDetail workoutId="w1" />);
  await waitFor(() => expect(screen.getByText('Seated Row')).toBeTruthy());
}

function click(name: RegExp | string): void {
  act(() => screen.getByRole('button', { name }).click());
}

describe('correcting a past workout', () => {
  it('shows every exercise at its saved weight', async () => {
    await open();

    const values = [...document.querySelectorAll('.weight__value')].map((node) => node.textContent);
    expect(values).toEqual(['40kg', '45kg', '50kg', '25kg', '100kg']);
  });

  it('steps a weight up and down and saves it', async () => {
    await open();

    click(/^Increase weight for Pulldown/);
    await waitFor(async () => expect((await getWorkout('w1'))?.pulldown_kg).toBe(52.5));

    click(/^Decrease weight for Pulldown/);
    click(/^Decrease weight for Pulldown/);
    await waitFor(async () => expect((await getWorkout('w1'))?.pulldown_kg).toBe(47.5));
  });

  it('updates the record in place, leaving the rest of the history untouched', async () => {
    await open();

    click(/^Increase weight for Pulldown/);
    await waitFor(async () => expect((await getWorkout('w1'))?.pulldown_kg).toBe(52.5));

    const all = await getWorkouts();
    expect(all).toHaveLength(1);
    const after = all[0]!;
    expect(after.workout_id).toBe(SAVED.workout_id);
    expect(after.completed_at).toBe(SAVED.completed_at);
    expect(after.seated_row_kg).toBe(SAVED.seated_row_kg);
    expect(after.chest_press_kg).toBe(SAVED.chest_press_kg);
    expect(after.overhead_press_kg).toBe(SAVED.overhead_press_kg);
    expect(after.leg_press_kg).toBe(SAVED.leg_press_kg);
  });

  it('says so once the change is on disk', async () => {
    await open();
    expect(screen.getByRole('status').textContent).toBe('Changes are saved as you make them.');

    click(/^Increase weight for Pulldown/);

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved.'));
  });
});

describe('deleting a past workout', () => {
  it('asks first, and keeps the workout if the answer is no', async () => {
    await open();

    click('Delete workout');
    expect(screen.getByRole('alertdialog').textContent).toContain('Delete this workout?');

    click('Cancel');
    expect(await getWorkouts()).toHaveLength(1);
  });

  it('removes it for good on confirmation', async () => {
    await open();

    click('Delete workout');
    click('Delete');

    await waitFor(async () => expect(await getWorkouts()).toHaveLength(0));
  });
});
