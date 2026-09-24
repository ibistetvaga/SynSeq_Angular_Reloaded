import { describe, expect, it } from 'vitest';

import { hasValidMidiStepToken, parseMidiStepTokens } from './midi-step-parser';
import { PIANO_PRESETS_DEFAULT } from './piano-presets';

describe('parseMidiStepTokens', () => {
  // =========================================================================
  // THE CHORD REGRESSION
  // =========================================================================
  //
  // The old tokenizer split on /[\s\n,;]+/, comma included, so a chord was cut
  // into unmatchable pieces before any regex saw it. These four cases are the
  // ones that were returning [].

  it('parses an explicit chord without being cut at the commas', () => {
    expect(parseMidiStepTokens('2@[60,64,67]:4')).toEqual([
      { startStep: 2, midis: [60, 64, 67], lengthSteps: 4 },
    ]);
  });

  it('parses a sequential chord and advances the cursor past it', () => {
    expect(parseMidiStepTokens('[60,64]:2 67:1')).toEqual([
      { startStep: 0, midis: [60, 64], lengthSteps: 2 },
      { startStep: 2, midis: [67], lengthSteps: 1 },
    ]);
  });

  it('tolerates spaces inside a chord', () => {
    expect(parseMidiStepTokens('0@[60, 64, 67]:2')).toEqual([
      { startStep: 0, midis: [60, 64, 67], lengthSteps: 2 },
    ]);
  });

  it('drops MIDI numbers outside 0..127 from a chord, keeping the rest', () => {
    expect(parseMidiStepTokens('0@[60,200,64]:2')).toEqual([
      { startStep: 0, midis: [60, 64], lengthSteps: 2 },
    ]);
  });

  // =========================================================================
  // THE BEHAVIOUR THAT ALREADY WORKED - pinned so the fix cannot cost it
  // =========================================================================

  it('keeps explicit step positions instead of packing them', () => {
    // The distinguishing feature of this format: tokens land on the step
    // written, so these two sound TOGETHER at step 2 rather than in turn.
    expect(parseMidiStepTokens('2@75:1 2@67:2')).toEqual([
      { startStep: 2, midis: [75], lengthSteps: 1 },
      { startStep: 2, midis: [67], lengthSteps: 2 },
    ]);
  });

  it('auto-increments the cursor when no step is given', () => {
    expect(parseMidiStepTokens('60:2 64:4 67:4')).toEqual([
      { startStep: 0, midis: [60], lengthSteps: 2 },
      { startStep: 2, midis: [64], lengthSteps: 4 },
      { startStep: 6, midis: [67], lengthSteps: 4 },
    ]);
  });

  it('still accepts commas and semicolons as separators BETWEEN tokens', () => {
    // The old tokenizer treated these as delimiters. The scanner ignores
    // separators entirely, so this has to keep working by construction.
    expect(parseMidiStepTokens('0@60:2,4@64:2')).toHaveLength(2);
    expect(parseMidiStepTokens('0@60:2; 4@64:2')).toHaveLength(2);
    expect(parseMidiStepTokens('0@60:2\n4@64:2')).toHaveLength(2);
  });

  it('skips unparseable text instead of failing the whole string', () => {
    expect(parseMidiStepTokens('0@60:2 nonsense 4@64:2')).toHaveLength(2);
  });

  it('returns an empty list for empty input', () => {
    expect(parseMidiStepTokens('')).toEqual([]);
    expect(parseMidiStepTokens('   ')).toEqual([]);
  });

  it('returns the same events when the same string is parsed twice', () => {
    // TOKEN_SCAN is module-level and global. An exec-in-a-loop refactor would
    // carry lastIndex across calls and quietly make the second parse differ.
    const text = '0@[36,43]:12 4@74:4';
    expect(parseMidiStepTokens(text)).toEqual(parseMidiStepTokens(text));
  });
});

describe('PIANO_PRESETS_DEFAULT', () => {
  const chordsIn = (name: string) =>
    parseMidiStepTokens(PIANO_PRESETS_DEFAULT[name]).filter(
      (e) => e.midis.length > 1,
    );

  it('parses every shipped preset to at least one event', () => {
    for (const key of Object.keys(PIANO_PRESETS_DEFAULT)) {
      // The second argument is Vitest's label, and it is what tells you WHICH
      // preset broke when this fails.
      expect(
        parseMidiStepTokens(PIANO_PRESETS_DEFAULT[key]).length,
        key,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * The bug, pinned to the real data.
   *
   * `gentle` is a descending melody over a HELD BASS CHORD. The tokenizer took
   * the bass away and left the melody, so the preset still made a sound and
   * still passed any test that only asked whether something parsed. Counting
   * the chords is what catches it.
   */
  it('keeps the chords in the presets that are built on them', () => {
    // The opening [36,43] and the closing [36,43,55,60].
    expect(chordsIn('gentle')).toHaveLength(2);
    expect(chordsIn('gentle')[0]).toEqual({
      startStep: 0,
      midis: [36, 43],
      lengthSteps: 12,
    });

    // The off-beat triad, four times over.
    expect(chordsIn('bounce')).toHaveLength(4);

    // The chord the cascade resolves onto.
    expect(chordsIn('flow')).toHaveLength(1);
    expect(chordsIn('flow')[0].midis).toEqual([48, 67, 76]);
  });
});

describe('hasValidMidiStepToken', () => {
  it('accepts every supported flavor', () => {
    expect(hasValidMidiStepToken('0@60:2')).toBe(true);
    expect(hasValidMidiStepToken('60:2')).toBe(true);
    expect(hasValidMidiStepToken('0@[60,64]:2')).toBe(true);
    expect(hasValidMidiStepToken('[60,64]:2')).toBe(true);
  });

  it('rejects empty and unparseable input', () => {
    expect(hasValidMidiStepToken('')).toBe(false);
    expect(hasValidMidiStepToken('   ')).toBe(false);
    expect(hasValidMidiStepToken('do re mi')).toBe(false);
  });

  /**
   * The old implementation tested tokens against a SEPARATE set of regexes, so
   * it could call a string valid that the parser then read as nothing. The
   * sequence cache trusted that answer and stored patterns which played
   * silence.
   */
  it('does not call a string valid that parses to nothing', () => {
    expect(hasValidMidiStepToken('0@[200,201]:2')).toBe(false);
    expect(hasValidMidiStepToken('0@200:2')).toBe(false);
  });
});
