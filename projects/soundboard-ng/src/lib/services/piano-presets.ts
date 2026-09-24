import { inject, Injectable, InjectionToken, Provider } from '@angular/core';

/**
 * Cada preset es un string en el formato MIDI:step que usa el piano roll.
 *
 *   `step@midi:length`     — una nota
 *   `step@[m1,m2,...]:length` — un acorde
 *   `midi:length`          — nota sin step explícito (auto-incrementa)
 *
 * El servicio schedulea cada token en el step EXACTO que escribiste —
 * no son secuenciales. Si querés que suenen uno tras otro, especificá
 * steps crecientes.
 *
 * Duración de step: 200ms por default (configurable vía `stepMs`).
 */
export const PIANO_PRESETS_DEFAULT: Readonly<Record<string, string>> = Object.freeze({
  // C-E-G major arpeggio ascending.
  success:
    '2@64:1 4@68:1 5@71:1',

  // Slow descending lullaby over a held low chord.
  gentle:
    '0@[36,43]:12 0@76:4 4@74:4 8@72:6 12@71:4 16@72:4 20@[36,43,55,60]:10',

  // Cascading up-and-back arpeggio ending on a held chord.
  flow:
    '0@72:4 4@76:4 8@79:4 12@83:4 16@81:4 20@79:4 24@76:4 28@72:4 32@[48,67,76]:10',

  // Three short attention notes (G4, C5, E5).
  alert: '0@67:3 3@72:3 6@76:5',

  // Bouncy dance riff — bass note + chord on the off-beat.
  bounce:
    '0@60:2 2@[60,64,67]:1 3@60:2 5@[60,64,67]:1 6@60:2 8@[60,64,67]:1 9@60:2 11@[60,64,67]:1',

  // Two chimes in the C5–E5 range.
  chime: '3@72:1 5@79:3',

  // Test 1 — sparse, overlapping notes.
  test:
    '2@75:1 2@67:2 5@72:1 7@74:1 8@67:5 11@74:1 14@74:1 15@74:1 15@64:1',

  // Test 2 — bass + melody with shared steps.
  test2:
    '2@67:1 2@62:4 4@70:2 7@67:1 8@74:1 10@65:1 12@72:1 12@63:1 15@64:1',
});

/**
 * Extra (or replacement) presets, supplied by the consuming application.
 *
 * =========================================================================
 * WHY A TOKEN AND NOT AN HTTP FETCH
 * =========================================================================
 *
 * This used to be `assets/piano-presets.json`, fetched with `HttpClient`.
 * Three things were wrong with that, and only the first is obvious:
 *
 *   1. `inject(HttpClient)` THROWS `NullInjectorError` in any application that
 *      has not called `provideHttpClient()`. A library that crashes unless the
 *      consumer adds a provider it was never told about is broken, not
 *      configurable. This workspace's own `app.config.ts` is such an app.
 *
 *   2. Every consumer that never created the JSON paid a guaranteed 404 on
 *      first use, swallowed by a `catch`. A request that is expected to fail
 *      is not a feature.
 *
 *   3. It made reading a constant asynchronous, which pushed `await` into
 *      `ngOnInit` and a `markForCheck()` after it.
 *
 * Presets are static strings. Supplying them through DI is synchronous,
 * type-checked at the call site, tree-shakeable, trivially overridable per
 * test, and costs nothing at runtime.
 *
 * Defaults are merged first, so a consumer's entry with the same key WINS.
 * To drop a default entirely, override its key with an empty string.
 */
export const PIANO_PRESETS = new InjectionToken<Readonly<Record<string, string>>>(
  'soundboard-ng.piano-presets',
  { providedIn: 'root', factory: () => ({}) },
);

/**
 * Register your own presets.
 *
 * ```ts
 * // app.config.ts
 * providers: [
 *   providePianoPresets({
 *     wakeup: '0@60:4 4@64:4 8@67:4 12@72:8',
 *     intro:  '0@[60,64,67]:8 8@72:8 16@[60,64,67,72]:8',
 *   }),
 * ]
 * ```
 *
 * Call it once. A second call replaces the first rather than merging, which is
 * ordinary provider behaviour and the reason this is not a multi-provider: two
 * places defining the same preset key silently would be worse than one place
 * defining all of them loudly.
 */
export function providePianoPresets(
  presets: Readonly<Record<string, string>>,
): Provider {
  return { provide: PIANO_PRESETS, useValue: presets };
}

/**
 * Exposes the preset library — defaults merged with whatever the consuming
 * application registered through {@link providePianoPresets}.
 *
 * Zero configuration: with no provider at all, you get the defaults.
 */
@Injectable({ providedIn: 'root' })
export class PianoPresetsService {
  private readonly extra = inject(PIANO_PRESETS);

  /** Defaults first, so a consumer's entry of the same name wins. */
  private readonly presets: Readonly<Record<string, string>> = Object.freeze({
    ...PIANO_PRESETS_DEFAULT,
    ...this.extra,
  });

  /** Every preset — library defaults plus the consumer's overrides. */
  getAll(): Readonly<Record<string, string>> {
    return this.presets;
  }

  /** The text of a preset by name, or `null` if there is no such preset. */
  get(name: string): string | null {
    return this.presets[name] ?? null;
  }

  /** The preset names, in declaration order (defaults first). */
  keys(): string[] {
    return Object.keys(this.presets);
  }

  /**
   * @deprecated Presets are no longer loaded asynchronously — call
   * {@link getAll} instead. Kept so an existing `await presets.loadAll()`
   * keeps working; it resolves immediately and performs no I/O.
   */
  async loadAll(): Promise<Readonly<Record<string, string>>> {
    return this.presets;
  }
}

/**
 * The library defaults as a plain object.
 *
 * @deprecated Use `PianoPresetsService.getAll()`, which includes the presets
 * the consuming application registered. This const can only ever see the
 * defaults.
 */
export const PianoPresets: Readonly<Record<string, string>> = PIANO_PRESETS_DEFAULT;

export type PianoPresetKey = keyof typeof PIANO_PRESETS_DEFAULT;
