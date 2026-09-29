import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PianoSoundService, type VoiceName } from './piano-sound.service';

/**
 * These specs exist because of two defects that were invisible to listening.
 *
 * `loop: true` played exactly THREE cycles and stopped. Three passes of a
 * preset is several seconds of audio — long enough that checking by ear gives
 * you music, a nod, and a false pass. Only counting catches it.
 *
 * The waveform preview drew from a COPY of the voice recipes that had drifted
 * from the real ones. Also invisible: the picture looked like a plausible
 * spectrum, just not that voice's.
 */
describe('PianoSoundService', () => {
  describe('voiceRecipe', () => {
    it('is the single source for every composite voice', () => {
      const svc = new PianoSoundService();

      for (const voice of Object.keys(
        PianoSoundService.VOICE_RECIPES,
      ) as VoiceName[]) {
        const recipe = svc.voiceRecipe(voice);
        expect(recipe, voice).toBe(PianoSoundService.VOICE_RECIPES[voice]);
        expect(recipe!.length, voice).toBeGreaterThan(0);
      }
    });

    it('returns null for raw oscillator types, which have no recipe', () => {
      const svc = new PianoSoundService();

      for (const raw of ['sine', 'square', 'triangle', 'sawtooth'] as const) {
        expect(svc.voiceRecipe(raw), raw).toBeNull();
      }
    });

    /*
     * The three voices whose copies in piano-page had drifted. Each is a
     * detuned STACK — the detuning is the voice's whole character, and it is
     * exactly what the stale copy had dropped.
     */
    it('keeps the detuned pairs that the drifted copy had lost', () => {
      const svc = new PianoSoundService();

      const softPad = svc.voiceRecipe('softPad')!;
      expect(softPad).toHaveLength(3);
      expect(softPad.filter((h) => h.detune !== undefined)).toHaveLength(2);

      const pad = svc.voiceRecipe('pad')!;
      expect(pad).toHaveLength(4);
      expect(pad.filter((h) => h.detune !== undefined)).toHaveLength(2);

      const lead = svc.voiceRecipe('lead')!;
      expect(lead).toHaveLength(3);
      expect(lead.filter((h) => h.detune !== undefined)).toHaveLength(2);
    });
  });

  describe('playMidiSteps loop', () => {
    let svc: PianoSoundService;
    let oscillatorCount: number;

    beforeEach(() => {
      vi.useFakeTimers();
      svc = new PianoSoundService();
      oscillatorCount = 0;

      /*
       * There is no AudioContext in the test environment, so this stands in
       * for one. It has to implement EVERYTHING the engine touches:
       * `playMidiSteps` defers node creation into a setTimeout, so as soon as
       * fake timers advance past the first event the service really does call
       * `createOscillator`. An earlier version of this fake omitted it and the
       * spec threw the moment it was finally executed.
       *
       * The clock never advances, which keeps the look-ahead window closed
       * after the first pass and leaves the loop timer as the only thing
       * driving the test.
       */
      const param = () => ({
        value: 1,
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        cancelScheduledValues: () => {},
        cancelAndHoldAtTime: () => {},
      });

      const fakeCtx = {
        currentTime: 0,
        state: 'running',
        destination: {},
        createGain: () => ({
          gain: param(),
          connect: () => {},
          disconnect: () => {},
        }),
        createOscillator: () => {
          oscillatorCount += 1;
          return {
            type: 'sine',
            frequency: param(),
            detune: param(),
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        },
        resume: () => Promise.resolve(),
      };

      (svc as any).ensureRunning = () => {
        (svc as any).audioCtx = fakeCtx;
        (svc as any).masterGain = fakeCtx.createGain();
        return Promise.resolve(fakeCtx);
      };
    });

    afterEach(() => {
      svc.stopSequence();
      vi.useRealTimers();
    });

    /**
     * Counts re-arms by watching the loop handle get replaced. Each cycle
     * schedules exactly one new timer, so the number of distinct handles is
     * the number of passes after the first.
     */
    const countCycles = async (text: string, stepMs: number, forMs: number) => {
      await svc.playMidiSteps(text, { loop: true, stepMs });

      const seen = new Set<unknown>();
      for (let elapsed = 0; elapsed < forMs; elapsed += stepMs) {
        await vi.advanceTimersByTimeAsync(stepMs);
        const handle = (svc as any).loopTimerHandle;
        if (handle) seen.add(handle);
      }
      return seen.size;
    };

    it('keeps re-arming well past the three cycles it used to stop at', async () => {
      // 4 steps at 100 ms = a 400 ms cycle. Twenty cycles' worth of time.
      const count = await countCycles('0@60:1 1@62:1 2@64:1 3@65:1', 100, 8000);

      // The old two-nested-setTimeout version could produce at most 2 handles.
      expect(count).toBeGreaterThan(5);
    });

    it('stops dead when stopSequence is called', async () => {
      await svc.playMidiSteps('0@60:1 1@62:1', { loop: true, stepMs: 100 });
      await vi.advanceTimersByTimeAsync(500);

      svc.stopSequence();
      await vi.advanceTimersByTimeAsync(2000);

      expect((svc as any).loopActive).toBe(false);
      expect((svc as any).loopTimerHandle).toBeNull();
    });

    it('never arms a loop timer for a one-shot', async () => {
      await svc.playMidiSteps('0@60:1 1@62:1', { loop: false, stepMs: 100 });
      await vi.advanceTimersByTimeAsync(2000);

      expect((svc as any).loopTimerHandle).toBeNull();
    });

    /*
     * Node creation is deferred until an event is nearly due, so at any moment
     * a stop can arrive with notes queued but not yet built. Those timers used
     * to be untracked, and fired anyway.
     */
    it('builds no further notes after stopSequence', async () => {
      await svc.playMidiSteps('0@60:1 1@62:1 2@64:1', { stepMs: 100 });

      svc.stopSequence();
      const builtAtStop = oscillatorCount;

      await vi.advanceTimersByTimeAsync(2000);

      expect(oscillatorCount).toBe(builtAtStop);
      expect((svc as any).pendingEventTimers).toHaveLength(0);
    });
  });
});
