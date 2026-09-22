/**
 * Parser for the `step@midi:length` string format used by the piano
 * roll, the presets service, the sound service and the sequence cache.
 *
 * Two flavors are supported:
 *
 *  1) **Explicit step** (preferred): `2@60:4 8@64:2`
 *     Each token pins its block to a specific step.
 *
 *  2) **Sequential** (auto-incrementing): `60:4 64:2 67:1`
 *     The cursor advances by `length` after each token.
 *
 * Both flavors support chords via `[m1,m2,...]:length` and
 * `step@[m1,m2,...]:length`. The shared parser keeps the four call sites
 * (sound service, sequencer, cache, presets) in lock-step.
 */

export interface MidiStepEvent {
  /** Step where the note/chord starts (0-based). */
  startStep: number;
  /** MIDI note numbers included in this event (one = note, many = chord). */
  midis: number[];
  /** Duration in steps. Always >= 1 for parsed events. */
  lengthSteps: number;
}

/*
 * =========================================================================
 * WHY THIS IS A SCANNER AND NOT A SPLIT
 * =========================================================================
 *
 * This used to tokenize with `text.split(/[\s\n,;]+/)` and then match each
 * piece against four regexes. The comma was in that separator set, so the
 * split cut INSIDE a chord:
 *
 *     '2@[60,64,67]:4'  ->  ['2@[60', '64', '67]:4']
 *
 * None of those match anything, and the parser drops tokens it cannot read.
 * So chords never played - not in explicit form, not in sequential form, not
 * for any caller - and the failure was silent, because a dropped token makes
 * no sound rather than an error.
 *
 * Scanning for whole tokens fixes it at the root: the comma inside the
 * brackets is part of the match now, rather than a delimiter competing with
 * it. Separators BETWEEN tokens stop mattering entirely - whitespace,
 * newlines, commas and semicolons all still work, because anything the
 * scanner does not match is simply not a token.
 *
 * The `[^\]]*` inside the brackets is deliberately permissive: validating the
 * MIDI numbers is parseMidiList's job, and a chord with one bad number should
 * lose that number, not the whole chord.
 */
const TOKEN_SCAN = /(?:(\d{1,3})@)?(\[[^\]]*\]|\d{1,3}):(\d{1,3})/g;

function parseMidiList(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 127);
}

/**
 * Tokenizes a sequence string in any of the four supported flavors and
 * returns the flat list of events. Sequential tokens pack one after
 * another; explicit tokens keep the step positions written by the user.
 *
 * Text that doesn't match a token is silently skipped - callers can decide
 * whether empty output means "invalid input".
 */
export function parseMidiStepTokens(text: string): MidiStepEvent[] {
  const events: MidiStepEvent[] = [];
  if (!text) return events;

  let cursorStep = 0;

  // matchAll rather than exec-in-a-loop: TOKEN_SCAN is module-level and
  // global, so a manual loop would carry lastIndex between calls and make the
  // second parse of the same string return something different from the first.
  for (const m of text.matchAll(TOKEN_SCAN)) {
    const explicitStep = m[1];
    const body = m[2];
    const length = parseInt(m[3], 10);
    if (!length) continue;

    const isChord = body.startsWith('[');
    const midis = isChord
      ? parseMidiList(body.slice(1, -1))
      : [parseInt(body, 10)].filter((n) => n >= 0 && n <= 127);
    if (!midis.length) continue;

    if (explicitStep !== undefined) {
      // Explicit tokens do NOT move the sequential cursor. Mixing the two
      // flavors in one string is unusual, but if somebody does, the explicit
      // positions should not drag the implicit ones around.
      events.push({
        startStep: parseInt(explicitStep, 10),
        midis,
        lengthSteps: length,
      });
    } else {
      events.push({ startStep: cursorStep, midis, lengthSteps: length });
      cursorStep += Math.max(1, length);
    }
  }

  return events;
}

/**
 * Returns true if the text contains at least one token that parses to a
 * usable event. Used by the sequence cache and the save form to reject
 * garbage.
 *
 * Defined in terms of parseMidiStepTokens rather than re-testing the regexes,
 * so "valid" can never drift from "actually produces sound". The previous
 * version kept a parallel set of tests, which is how the chord bug got to
 * report a chord-only string as valid while parsing it to nothing.
 */
export function hasValidMidiStepToken(text: string): boolean {
  return parseMidiStepTokens(text).length > 0;
}
