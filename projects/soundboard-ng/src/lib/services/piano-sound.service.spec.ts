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
    let cycles: number;

    beforeEach(() => {
      vi.useFakeTimers();
      svc = new PianoSoundService();
      cycles = 0;

      /*
       * There is no AudioContext in the test environment, and we do not need
       * one: the question is how many times the scheduler RE-ARMS, which is
       * pure timer logic. `ensureRunning` is stubbed to hand back a minimal
       * fake whose clock never advances, so no event is ever inside the
       * look-ahead window and `tick()` settles immediately — leaving the loop
       * timer as the only thing driving the test.
       */
      const fakeCtx = {
        currentTime: 0,
        state: 'running',
        createGain: () => ({
          gain: {
            value: 1,
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
            cancelScheduledValues: () => {},
          },
          connect: () => {},
        }),
        destination: {},
      };

      (svc as any).ensureRunning = () => {
        (svc as any).audioCtx = fakeCtx;
        (svc as any).masterGain = fakeCtx.createGain();
        return Promise.resolve(fakeCtx);
      };

      const originalStop = svc.stopSequence.bind(svc);
      svc.stopSequence = () => originalStop();
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
      const tickMs = stepMs;
      for (let elapsed = 0; elapsed < forMs; elapsed += tickMs) {
        await vi.advanceTimersByTimeAsync(tickMs);
        const handle = (svc as any).loopTimerHandle;
        if (handle) seen.add(handle);
      }
      cycles = seen.size;
      return cycles;
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
  });
});
