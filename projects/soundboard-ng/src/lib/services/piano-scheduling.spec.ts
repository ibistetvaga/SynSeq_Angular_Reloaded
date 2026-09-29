import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PianoSoundService } from './piano-sound.service';

/**
 * These specs exist because the sequencer's look-ahead was decorative.
 *
 * It computed a precise audio-clock target for every step and then handed the
 * note to `playNote()`, which can only schedule at `currentTime` — so the
 * target was discarded at the door and each note landed with whatever jitter
 * `setTimeout` had. The pattern still played, in the right order, at roughly
 * the right speed. Only the steadiness was wrong, and "roughly right" is
 * exactly what listening cannot catch.
 *
 * So the assertion has to be about the NUMBER the engine was given. The fake
 * context below records every automation call with its timestamp; nothing here
 * makes a sound.
 */

interface AutomationCall {
  fn: 'setValueAtTime' | 'ramp' | 'cancel' | 'hold';
  time: number;
  value?: number;
}

class FakeParam {
  value = 1;
  readonly calls: AutomationCall[] = [];

  setValueAtTime(value: number, time: number): this {
    this.calls.push({ fn: 'setValueAtTime', time, value });
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ fn: 'ramp', time, value });
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.calls.push({ fn: 'cancel', time });
    return this;
  }
  cancelAndHoldAtTime(time: number): this {
    this.calls.push({ fn: 'hold', time });
    return this;
  }
}

class FakeGain {
  readonly gain = new FakeParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeOscillator {
  type = 'sine';
  readonly frequency = new FakeParam();
  readonly detune = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  connect(): void {}
  start(time: number): void {
    this.startedAt = time;
  }
  stop(time: number): void {
    this.stoppedAt = time;
  }
}

/**
 * `currentTime` is deliberately NOT zero. If it were, "scheduled at the target"
 * and "scheduled at now" would both be 0 for a target of 0 and the test would
 * pass against the bug.
 */
const NOW = 10;

class FakeAudioContext {
  currentTime = NOW;
  state = 'running';
  readonly destination = {};
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];

  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator(): FakeOscillator {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

describe('audio-clock scheduling', () => {
  let svc: PianoSoundService;
  let ctx: FakeAudioContext;
  let originalAudioContext: unknown;

  beforeEach(() => {
    originalAudioContext = (window as any).AudioContext;
    (window as any).AudioContext = FakeAudioContext;

    svc = new PianoSoundService();
    // Forces lazy creation, and hands back the instance the service will use.
    ctx = svc.getAudioContext() as unknown as FakeAudioContext;
  });

  afterEach(() => {
    (window as any).AudioContext = originalAudioContext;
  });

  describe('scheduleNoteAt', () => {
    it('starts the oscillator at the requested time, not at currentTime', () => {
      const target = NOW + 0.5;

      svc.scheduleNoteAt('C4', target, { waveform: 'sine', durationMs: 100 });

      expect(ctx.oscillators).toHaveLength(1);
      // The whole point. Before this existed, the caller's target was dropped
      // and this read NOW.
      expect(ctx.oscillators[0].startedAt).toBe(target);
    });

    it('opens the envelope at the requested time too', () => {
      const target = NOW + 0.25;

      svc.scheduleNoteAt('C4', target, { waveform: 'sine', durationMs: 100 });

      // The voice master is the gain created for this note (the service's own
      // master gain was created with the context, before any note).
      const voiceMaster = ctx.gains[ctx.gains.length - 2];
      const opening = voiceMaster.gain.calls[0];

      expect(opening.fn).toBe('setValueAtTime');
      expect(opening.time).toBe(target);
    });

    it('accepts a Pitch object as well as a string', () => {
      svc.scheduleNoteAt({ note: 'C', octave: 4 }, NOW + 0.1, {
        waveform: 'sine',
      });

      expect(ctx.oscillators).toHaveLength(1);
      expect(ctx.oscillators[0].startedAt).toBe(NOW + 0.1);
    });

    it('ignores a pitch it cannot parse', () => {
      svc.scheduleNoteAt('not-a-note', NOW + 0.1);

      expect(ctx.oscillators).toHaveLength(0);
    });

    it('builds one oscillator per harmonic of a composite voice', () => {
      const partials = svc.voiceRecipe('softPad')!.length;

      svc.scheduleNoteAt('C4', NOW + 0.1, { waveform: 'softPad' });

      expect(ctx.oscillators).toHaveLength(partials);
      // Every partial of a voice starts together, or the voice smears.
      for (const osc of ctx.oscillators) {
        expect(osc.startedAt).toBe(NOW + 0.1);
      }
    });
  });

  describe('retriggering the same pitch', () => {
    /*
     * A look-ahead window can hold two notes of the same pitch. Releasing the
     * first at `currentTime` would silence it BEFORE it had sounded - the
     * pattern would simply lose a note, and only at high tempo, which is the
     * worst kind of bug to go looking for.
     */
    it('releases the previous voice where the new one begins', () => {
      const first = NOW + 0.2;
      const second = NOW + 0.4;

      svc.scheduleNoteAt('C4', first, { waveform: 'sine' });
      svc.scheduleNoteAt('C4', second, { waveform: 'sine' });

      const held = ctx.gains.filter((g) =>
        g.gain.calls.some((c) => c.fn === 'hold' || c.fn === 'cancel'),
      );

      // Exactly one voice was released: the first.
      expect(held).toHaveLength(1);

      const release = held[0].gain.calls.find(
        (c) => c.fn === 'hold' || c.fn === 'cancel',
      )!;
      expect(release.time).toBe(second);
      expect(release.time).not.toBe(NOW);
    });

    it('leaves a different pitch alone', () => {
      svc.scheduleNoteAt('C4', NOW + 0.2, { waveform: 'sine' });
      svc.scheduleNoteAt('E4', NOW + 0.4, { waveform: 'sine' });

      const held = ctx.gains.filter((g) =>
        g.gain.calls.some((c) => c.fn === 'hold' || c.fn === 'cancel'),
      );

      expect(held).toHaveLength(0);
    });

    it('never schedules a release into the past', () => {
      svc.scheduleNoteAt('C4', NOW + 0.5, { waveform: 'sine' });
      // A target behind the clock: the engine ignores past events, so the
      // release has to be clamped to now rather than sent backwards.
      svc.scheduleNoteAt('C4', NOW - 5, { waveform: 'sine' });

      const held = ctx.gains.filter((g) =>
        g.gain.calls.some((c) => c.fn === 'hold' || c.fn === 'cancel'),
      );
      const release = held[0].gain.calls.find(
        (c) => c.fn === 'hold' || c.fn === 'cancel',
      )!;

      expect(release.time).toBe(NOW);
    });
  });

  describe('playNote', () => {
    it('still schedules at currentTime - it is the "now" entry point', async () => {
      await svc.playNote('C4', { waveform: 'sine', durationMs: 100 });

      expect(ctx.oscillators).toHaveLength(1);
      expect(ctx.oscillators[0].startedAt).toBe(NOW);
    });
  });
});
