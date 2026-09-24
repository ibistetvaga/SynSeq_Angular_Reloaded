import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  PIANO_PRESETS_DEFAULT,
  PianoPresetsService,
  providePianoPresets,
} from './piano-presets';

/**
 * These specs exist because of a defect, not for coverage.
 *
 * The service used to `inject(HttpClient)`, which throws `NullInjectorError`
 * in any application that has not called `provideHttpClient()`. Nothing caught
 * it: the library built, the types were fine, and it only failed at runtime in
 * a consumer's app. The first test below is the regression — resolve the
 * service from a TestBed with NO providers whatsoever, the same position a
 * stranger's app starts from.
 */
describe('PianoPresetsService', () => {
  it('resolves with no providers at all and yields the defaults', () => {
    TestBed.configureTestingModule({});

    const presets = TestBed.inject(PianoPresetsService);

    expect(presets.getAll()).toEqual(PIANO_PRESETS_DEFAULT);
    expect(presets.keys()).toContain('gentle');
  });

  it('returns null for an unknown preset rather than undefined', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(PianoPresetsService).get('nope')).toBeNull();
  });

  it('keeps the chord syntax intact in the shipped defaults', () => {
    // `gentle` lost its held [36,43] bass for the entire life of the project
    // because the tokenizer split on commas. The preset text is the input that
    // proved it, so it is worth pinning that it still contains a chord.
    expect(PIANO_PRESETS_DEFAULT['gentle']).toContain('[36,43]');
  });

  it('merges consumer presets on top of the defaults', () => {
    TestBed.configureTestingModule({
      providers: [providePianoPresets({ wakeup: '0@60:4 4@64:4' })],
    });

    const presets = TestBed.inject(PianoPresetsService);

    expect(presets.get('wakeup')).toBe('0@60:4 4@64:4');
    // The defaults survive the merge.
    expect(presets.get('gentle')).toBe(PIANO_PRESETS_DEFAULT['gentle']);
  });

  it('lets a consumer override a default of the same name', () => {
    TestBed.configureTestingModule({
      providers: [providePianoPresets({ alert: '0@60:1' })],
    });

    expect(TestBed.inject(PianoPresetsService).get('alert')).toBe('0@60:1');
  });

  it('still answers the deprecated async loadAll()', async () => {
    TestBed.configureTestingModule({});

    const presets = TestBed.inject(PianoPresetsService);

    expect(await presets.loadAll()).toBe(presets.getAll());
  });
});
