/*
 * Public API Surface of synseq-ng
 *
 * Everything a consumer can import. If it is not listed here it is internal,
 * and may change without a version bump.
 */

export { PianoPageComponent } from './lib/pages/piano/piano-page.component';
export { PianoSequencerComponent } from './lib/pages/piano/lib-sequencer/piano-sequencer.component';
export { PianoRollComponent } from './lib/pages/piano/lib-piano-roll/piano-roll.component';

/**
 * The synth. Notable methods beyond the obvious play/stop pairs:
 *
 * - `scheduleNoteAt(note, targetTime, opts)` places a note at an exact moment
 *   on the AudioContext clock. Use it for anything with a pulse; `playNote`
 *   can only sound a note now, and inherits your timer's jitter.
 * - `voiceRecipe(voice)` returns the harmonics behind a composite voice, so a
 *   UI can draw a voice without keeping its own copy of the recipe.
 */
export { PianoSoundService } from './lib/services/piano-sound.service';
export type {
  NoteName,
  Pitch,
  VoiceName,
  Harmonic,
  SequenceStep,
  PlayOptions,
  SequenceOptions,
} from './lib/services/piano-sound.service';

/**
 * Presets are constants, not a resource. `providePianoPresets({...})` merges
 * your own over the eight built in; with no provider at all you get the
 * defaults. Nothing here makes a network request.
 */
export {
  PIANO_PRESETS,
  PIANO_PRESETS_DEFAULT,
  PianoPresetsService,
  providePianoPresets,
} from './lib/services/piano-presets';
export type { PianoPresetKey } from './lib/services/piano-presets';

export { SequenceCacheService } from './lib/services/sequence-cache.service';
export type { CachedSequence } from './lib/services/sequence-cache.service';
export { isValidSequence } from './lib/services/sequence-cache.service';

/**
 * For NgModule-based apps. Standalone consumers should import the components
 * directly instead.
 */
export { PianoModule } from './lib/piano.module';
