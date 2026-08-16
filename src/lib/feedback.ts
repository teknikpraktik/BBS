/**
 * Sound and haptics. Both are discreet, both are optional, and neither is ever
 * the only channel for information — the screen always shows the same state.
 */

export type Cue = 'start' | 'pause' | 'resume' | 'countdown' | 'complete';

interface Tone {
  /** Hz */
  freq: number;
  /** seconds */
  duration: number;
  /** peak gain, 0..1 */
  gain: number;
  /** seconds to wait before playing */
  delay?: number;
  type?: OscillatorType;
}

/**
 * Muted and low for everything that happens mid-set, and deliberately not muted
 * for the end of one. The last set of a workout is reached in a state where you
 * are not watching the screen, so the completion cue is three bright triangle
 * tones — the loudest thing the app does, and nothing else in it sounds close.
 */
const CUES: Record<Cue, Tone[]> = {
  start: [{ freq: 320, duration: 0.11, gain: 0.5 }],
  pause: [{ freq: 200, duration: 0.09, gain: 0.4 }],
  resume: [{ freq: 280, duration: 0.09, gain: 0.4 }],
  // The last three seconds are already a warning; make them audible as one.
  countdown: [{ freq: 660, duration: 0.1, gain: 0.6, type: 'triangle' }],
  complete: [
    { freq: 880, duration: 0.19, gain: 0.95, type: 'triangle' },
    { freq: 880, duration: 0.19, gain: 0.95, delay: 0.24, type: 'triangle' },
    { freq: 587, duration: 0.75, gain: 1, delay: 0.48, type: 'triangle' },
  ],
};

const VIBRATIONS: Record<Cue, number | number[]> = {
  start: 25,
  pause: 15,
  resume: 15,
  countdown: 30,
  complete: [140, 90, 140, 90, 320],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * Browsers only allow audio after a user gesture. Called from the first tap so
 * the 3-2-1 countdown is never the thing that discovers a suspended context.
 */
export function unlockAudio(): void {
  const audio = context();
  if (audio && audio.state === 'suspended') void audio.resume();
}

function playTone(audio: AudioContext, tone: Tone, at: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  // A low-passed sine reads as a dull knock rather than a beep.
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.max(600, tone.freq * 2.5);

  osc.type = tone.type ?? 'sine';
  osc.frequency.setValueAtTime(tone.freq, at);

  const attack = 0.008;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(tone.gain, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(at);
  osc.stop(at + tone.duration + 0.02);
}

export function playCue(cue: Cue, options: { sound: boolean; haptics: boolean }): void {
  if (options.sound) {
    const audio = context();
    if (audio) {
      if (audio.state === 'suspended') void audio.resume();
      const now = audio.currentTime;
      for (const tone of CUES[cue]) playTone(audio, tone, now + (tone.delay ?? 0));
    }
  }
  if (options.haptics && supportsHaptics()) {
    try {
      navigator.vibrate(VIBRATIONS[cue]);
    } catch {
      /* Vibration is best effort; a device refusing it changes nothing. */
    }
  }
}

export function supportsHaptics(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
