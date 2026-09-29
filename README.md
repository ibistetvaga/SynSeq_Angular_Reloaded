# synseq-ng

Angular 22 standalone library: a browser-native synthesiser (Web Audio API), a
piano keyboard, a 16-step sequencer, an infinite piano roll, preset patterns
and a `localStorage`-backed sequence cache.

No samples, no external assets, **no styling setup, no providers**.

> Formerly published as `soundboard-ng`. This fork has diverged far enough —
> Angular 22, no Tailwind, no `HttpClient`, and a tokenizer that actually parses
> chords — that it carries its own name.

---

## Install

```bash
npm install synseq-ng
```

That is the whole installation. Drop the component in:

```ts
import { Component } from '@angular/core';
import { PianoPageComponent } from 'synseq-ng';

@Component({
  standalone: true,
  imports: [PianoPageComponent],
  template: '<lib-piano-page></lib-piano-page>',
})
export class MyPage {}
```

> **Coming from `soundboard-ng` 0.1.x?** Change the package name in your
> imports, and delete the `tailwind.config.js` entry that pointed at
> `node_modules/soundboard-ng/fesm2022/**` — it does nothing now. The library
> carries its own styles.

---

## Table of contents

1. [Requirements](#requirements)
2. [Theming](#theming)
3. [Components](#components)
4. [`PianoSoundService`](#pianosoundservice)
5. [The MIDI:step format](#the-midistep-format)
6. [Presets](#presets)
7. [`SequenceCacheService`](#sequencecacheservice)
8. [Working on the library](#working-on-the-library)
9. [Publishing](#publishing)

---

## Requirements

| | |
| --- | --- |
| Angular | 22+ |
| Change detection | zoneless or zone-based — both work |
| Browser | any with the Web Audio API |
| Styling | none. The library ships its own CSS |
| Providers | **none.** The library injects nothing it does not supply itself |

**Audio needs a user gesture.** Browsers refuse to start an `AudioContext`
until the user interacts with the page, so call any `play*` method from a click
or keydown handler, never from a constructor or `ngOnInit`.

---

## Theming

The library renders in a dark slate/emerald palette **with no configuration**.
To change it, set any `--sb-*` custom property on an ancestor element:

```css
.my-app {
  --sb-accent: #f472b6;        /* pink instead of emerald */
  --sb-surface: #1c1917;       /* warmer panels */
  --sb-radius-xl: 0.25rem;     /* squarer corners */
}
```

```html
<div class="my-app">
  <lib-piano-page></lib-piano-page>
</div>
```

**Set them on an ANCESTOR, not on the component itself.** Custom properties
inherit, and the library reads each one as `var(--sb-x, <default>)` at the point
of use — so an inherited value wins, and you never need `::ng-deep`.

### Tokens

**Surfaces** — `--sb-surface-sunken`, `--sb-surface`, `--sb-surface-raised`,
`--sb-surface-hover`, `--sb-surface-translucent`

**Borders** — `--sb-border-subtle`, `--sb-border`, `--sb-border-strong`

**Text** — `--sb-text`, `--sb-text-secondary`, `--sb-text-muted`,
`--sb-text-faint`, `--sb-text-on-accent`, `--sb-text-on-strong`

**Accent** — `--sb-accent-lightest`, `--sb-accent-light`, `--sb-accent`,
`--sb-accent-deep`, plus the opacity variants `--sb-accent-ring`,
`--sb-accent-ring-soft`, `--sb-accent-wash`, `--sb-accent-wash-faint`,
`--sb-accent-selected`, `--sb-accent-glow`, `--sb-accent-glow-strong`

**Transport** — `--sb-danger`, `--sb-danger-hover`, `--sb-danger-glow`

**Keys** — `--sb-key-white`, `--sb-key-white-text`, `--sb-key-black`,
`--sb-key-black-text`

**Shape & motion** — `--sb-radius-sm|md|lg|xl|pill`, `--sb-transition-fast`,
`--sb-transition`, `--sb-font-mono`, `--sb-shadow-sm`

The prefix stays `--sb-*` rather than `--synseq-*`: renaming ~50 tokens would
break every consumer's theme to gain nothing but tidiness.

The opacity variants are separate tokens rather than computed from `--sb-accent`
on purpose: if you re-theme the accent, you can match the washes to it instead
of inheriting tinted green.

---

## Components

### `<lib-piano-page>`

The full dashboard: controls, keyboard, sequencer, piano roll, presets and the
save-sequence panel. No inputs — it owns its own state.

### `<lib-piano-sequencer>`

A fixed 16-step loop grid.

```html
<lib-piano-sequencer
  [waveform]="'piano'"
  [baseOctave]="4"
  [octaveCount]="2"
  (notePreview)="onNote($event)"
></lib-piano-sequencer>
```

| Input | Type | Default | |
| --- | --- | --- | --- |
| `waveform` | `OscillatorType \| VoiceName` | `'softPad'` | voice for previews and playback |
| `baseOctave` | `number` | `4` | lowest octave shown |
| `octaveCount` | `number` | `2` | octaves rendered |

**Output:** `notePreview: EventEmitter<Pitch>` — fires whenever a note is
auditioned, both when a cell is painted and when a step sounds during playback.

**Public methods:** `gridAsText()`, `loadFromText(text)`, `gridAsSequence()`,
`togglePlay()`, `clear()`

`gridAsText()` is the lossless one: it records the step of every note.
`gridAsSequence()` reconstructs positions as `{ restMs }` gaps, which is fine
for playback but cannot express two notes at the same step in different rows as
anything other than a chord.

### `<lib-piano-roll>`

Same inputs, but the grid scrolls horizontally and **grows without limit** as
you paint past the right edge. It also has a draggable playhead and an export
console.

Use the sequencer for loops, the roll for arrangements.

---

## `PianoSoundService`

Injectable, `providedIn: 'root'`. Synthesises everything from oscillators.

```ts
private piano = inject(PianoSoundService);

await this.piano.playNote('C4', { durationMs: 500, waveform: 'piano' });
await this.piano.playChord(['C4', 'E4', 'G4'], { durationMs: 1200 });
```

### Notes and chords

```ts
playNote(input: string | Pitch, options?: PlayOptions): Promise<void>
playChord(input: Array<string | Pitch>, options?: PlayOptions): Promise<void>
```

Omit `durationMs` and the note sustains until `stopNote()`. Chord voices share
one scheduling timestamp, so a chord never smears.

`PlayOptions`: `{ durationMs?, velocity?, waveform? }`

### Precise timing — `scheduleNoteAt`

```ts
scheduleNoteAt(
  input: string | Pitch,
  targetTime: number,
  options?: PlayOptions,
): void
```

`playNote()` sounds a note **as soon as possible**, which is right for a
keypress and wrong for anything with a pulse: `setTimeout` drifts by 5–20 ms,
and that wobble is audible as an unsteady beat.

`scheduleNoteAt()` places a note at an exact moment on the **AudioContext
clock**, so the audio engine — not your timer — decides when it sounds.

```ts
const ctx = this.piano.getAudioContext();
if (ctx) {
  // Four notes, 150 ms apart, immune to timer jitter.
  const t0 = ctx.currentTime + 0.05;
  ['C4', 'E4', 'G4', 'C5'].forEach((n, i) =>
    this.piano.scheduleNoteAt(n, t0 + i * 0.15, { durationMs: 140 }),
  );
}
```

- `targetTime` is in **seconds on `getAudioContext().currentTime`**, not
  `Date.now()`. A time in the past plays immediately.
- It is **synchronous** and does not await the context: by the time a promise
  resolved, the moment you asked for might have passed. Call `resume()` from a
  user gesture first.
- Scheduling the same pitch twice releases the earlier note exactly where the
  later one starts, so a repeated note does not cut itself short.

The usual shape is a **look-ahead scheduler**: a timer that fires often, looks a
little way into the future, and hands the engine everything due in that window.
`<lib-piano-sequencer>` runs one at 25 ms with a 100 ms horizon.

### Sequences

```ts
playSequence(steps: SequenceStep[], options?: SequenceOptions): Promise<void>
```

`SequenceStep` is a discriminated union:

```ts
{ note: 'C4', durationMs: 300 }
{ chord: ['C4', 'E4', 'G4'], durationMs: 600 }
{ restMs: 100 }
```

`SequenceOptions`: `{ gapMs?, waveform?, velocity?, legatoMs?, humanize?,
velocityHumanize? }`

`legatoMs` (default 60) overlaps each step into the previous one; set it to `0`
for staccato. `humanize` (0.08) and `velocityHumanize` (0.12) add human jitter
to timing and dynamics. Both are applied to the **audio clock**, not to
`setTimeout`, so they never accumulate drift.

Note that `SequenceStep[]` has no notion of position — order and duration only.
For patterns where the exact placement matters, prefer the MIDI:step format
below.

### Patterns

```ts
playMidiSteps(text, options?: SequenceOptions & {
  stepMs?: number;    // default 200 (100 BPM at 1/16)
  loop?: boolean;
  onEnd?: () => void; // one-shots only
}): Promise<void>
```

`onEnd` never fires in loop mode — a loop has no end, and firing it every cycle
would flicker whatever UI state it resets.

### Transport and config

```ts
stopNote(input)        stopAll()        stopSequence()
stopEverything()       // all of the above; use this in ngOnDestroy
setVolume(0..1)        getVolume()      setWaveform(voice)
resume()               // call from a user gesture
parsePitch('C4')       frequencyOf(pitch)      getAudioContext()
voiceRecipe(voice)     // the harmonics behind a composite voice, or null
```

`voiceRecipe()` is there so a UI can *draw* a voice without describing it a
second time — the piano page's waveform preview reads it.

### Voices

| Voice | Character |
| --- | --- |
| `glass` | crystalline sine + inharmonic shimmer |
| `marimba` | triangle fundamental + wooden knock |
| `musicBox` | bell partials, very fast decay |
| `softPiano` | felted, subdued upper harmonics |
| `softPad` | slow-attack detuned sines — the calmest |
| `piano` | acoustic-ish, decaying partials |
| `bell` | FM-ish, inharmonic ratios |
| `organ` | full Hammond-like stack |
| `pluck` | triangle, fast release |
| `lead` | detuned saw pair |
| `bass` | sine sub + triangle harmonic |
| `pad` | detuned sines + subtle triangle |

Plus the raw `OscillatorType`s: `'sine'`, `'square'`, `'triangle'`,
`'sawtooth'`.

---

## The MIDI:step format

One string describes a whole pattern.

| Token | Meaning |
| --- | --- |
| `step@midi:length` | one note at an explicit step |
| `step@[m1,m2,...]:length` | a chord at an explicit step |
| `midi:length` | one note, step auto-increments |
| `[m1,m2,...]:length` | a chord, step auto-increments |

```text
0@60:2            C4 for 2 steps, starting at step 0
2@[60,64,67]:4    C major triad at step 2, lasting 4 steps
60:2 64:4 67:4    three notes, steps auto-assigned 0 / 2 / 6
```

**Explicit tokens fire at the step you wrote, not one after another.** So
`2@75:1 2@67:2` sounds both notes together at step 2. If you want them
sequential, write increasing steps.

Separators between tokens can be spaces, newlines, commas or semicolons.

> Chords did not work in `soundboard-ng` — the tokenizer split on commas, which
> tore every `[60,64,67]` apart before it could be read. If you have patterns
> saved from that version, their chords will start sounding now.

MIDI reference: C4 = 60, A4 = 69 = 440 Hz. Valid range 0–127; out-of-range
numbers are dropped from a chord rather than voiding it.

---

## Presets

Eight patterns ship with the library:

`success` · `gentle` · `flow` · `alert` · `bounce` · `chime` · `test` · `test2`

```ts
private presets = inject(PianoPresetsService);

const text = this.presets.get('flow');
if (text) await this.piano.playMidiSteps(text, { loop: true });
```

`getAll()` returns everything, `keys()` lists the names. All three are
synchronous — presets are constants, not a resource.

### Custom presets

Register them as a provider:

```ts
// app.config.ts
import { providePianoPresets } from 'synseq-ng';

export const appConfig: ApplicationConfig = {
  providers: [
    providePianoPresets({
      wakeup: '0@60:4 4@64:4 8@67:4 12@72:8',
      intro:  '0@[60,64,67]:8 8@72:8 16@[60,64,67,72]:8',
    }),
  ],
};
```

Your entries merge over the defaults, yours winning on a name clash. To hide a
built-in preset, override its name with an empty string.

Provide it anywhere an injector exists — application, route or component — so a
single route can carry its own set without affecting the rest of the app.

> **Changed from `soundboard-ng`.** Custom presets used to come from
> `src/assets/piano-presets.json`, fetched with `HttpClient`. That made
> `provideHttpClient()` a hidden requirement — without it the library threw
> `NullInjectorError` — and cost every other consumer a 404 on first use. If you
> have such a JSON file, pass its contents to `providePianoPresets()` and delete
> it. `PRESETS_URL` is gone.

---

## `SequenceCacheService`

CRUD over `localStorage`, under the key `piano-sequence-cache-v1`.

```ts
const cache = inject(SequenceCacheService);

if (isValidSequence('0@60:2 4@64:4')) {
  cache.add('0@60:2 4@64:4', 'My melody');
}

cache.list();          // CachedSequence[], newest first — a signal, so it
                       // repaints on its own in a zoneless app
cache.remove(id);
```

`CachedSequence` is `{ id, name, text, createdAt }`. Quota errors and disabled
storage are swallowed — the in-memory copy keeps working for the session.

---

## Working on the library

```bash
npm install
npm start          # dashboard at http://localhost:4200
npm test           # both projects, exits when done
npm run test:watch # the app's specs, interactive
npm run build:lib  # -> dist/synseq-ng/
```

`npm test` runs `ng test` **twice**, once per project. That is not redundancy:
the unit-test builder resolves its `include` globs against each project's
`sourceRoot`, so a single invocation can only ever see one project's specs.
Running only the app's target is how both library suites went unnoticed —
`npm test` reported "1 passed" while three spec files existed.

Use `test:app` or `test:lib` to run one side.

The dashboard imports the library from **source**, not from `dist/`, so
`npm start` always runs what you are editing — no `build:lib` step first.

```
projects/soundboard-ng/src/        (directory name predates the rename)
  public-api.ts                     what consumers can import
  lib/
    styles/_tokens.scss             the design tokens
    services/
      piano-sound.service.ts        the synth
      music-theory.ts               notes, pitches, MIDI
      midi-step-parser.ts           the pattern format
      piano-presets.ts              built-in patterns
      sequence-cache.service.ts     localStorage CRUD
    pages/piano/
      piano-page.component.*        <lib-piano-page>
      lib-sequencer/                <lib-piano-sequencer>
      lib-piano-roll/               <lib-piano-roll>
src/                                the dev dashboard (not published)
```

---

## Publishing

```bash
npm run build:lib
# bump version in projects/soundboard-ng/package.json
cd dist/synseq-ng && npm publish --access public
```

`build:lib` only produces `dist/synseq-ng/` — it does not publish. Publishing is
the separate `npm publish` above, run from inside that directory.

There is also a tag-triggered workflow in `.github/workflows/release.yml` which
tests, builds, publishes and attaches the tarball to a GitHub Release. It needs
`NPM_TOKEN` in the repo secrets, and it reads the version from the library's
`package.json` rather than from the tag — bump it in the commit you tag.

---

## Changelog

### 0.2.0 — first release as `synseq-ng`

- **Renamed** from `soundboard-ng`.
- **Angular 22**, zoneless-compatible. Angular 17 is no longer supported.
- **Tailwind removed.** The library styles itself and needs no build config.
- **Themeable** via `--sb-*` custom properties.
- **No `HttpClient`.** Custom presets are registered with
  `providePianoPresets()` instead of being fetched from an assets JSON. The
  library now requires no providers at all. `PRESETS_URL` removed.
- **Chords now play.** The tokenizer split on commas, so every chord token was
  destroyed before it could be parsed — in every syntax, for every caller.
  `gentle`, `bounce` and `flow` were all affected.
- **`loop: true` actually loops.** It previously ran three cycles and stopped.
- **`scheduleNoteAt()`** — place a note at an exact moment on the audio clock.
  The sequencer's look-ahead used to compute a target and then discard it, so
  its pulse carried `setTimeout` jitter; now it does not.
- **`voiceRecipe()`** — read the harmonics behind a composite voice instead of
  copying them. The piano page's waveform preview had drifted from the synth.
- **`<lib-piano-sequencer>` keeps its contract.** `notePreview` now actually
  emits; `baseOctave` and `octaveCount` work after init; "play" no longer
  flattens the rests out of the pattern; stopping no longer lets a queued note
  through.
- `stopEverything()` added.
- Dropped `@angular/animations` (deprecated upstream) and `zone.js`.
