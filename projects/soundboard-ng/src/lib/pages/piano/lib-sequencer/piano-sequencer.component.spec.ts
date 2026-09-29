import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { PianoSequencerComponent } from './piano-sequencer.component';

/**
 * Grid <-> text is the sequencer's contract with the rest of the world: it is
 * what the textarea shows, what the clipboard carries, and what the piano page
 * captures. These pin it.
 *
 * The rest case is the regression. `gridAsSequence()` used to emit durations
 * with no positions, so a sparse pattern came out dense — audible, but only if
 * you compared it against the text next to it.
 */
describe('PianoSequencerComponent', () => {
  let cmp: PianoSequencerComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PianoSequencerComponent] });
    cmp = TestBed.createComponent(PianoSequencerComponent).componentInstance;
    cmp.ngOnInit();
  });

  describe('text round trip', () => {
    it('restores the exact steps it exported', () => {
      // C4 = 60 at step 0 for 4, E4 = 64 at step 8 for 2.
      const source = '0@60:4 8@64:2';

      cmp.loadFromText(source);

      expect(cmp.gridAsText()).toBe(source);
    });

    it('keeps a chord's notes on their shared step', () => {
      cmp.loadFromText('2@[60,64,67]:4');

      const text = cmp.gridAsText();

      // Serialised one token per note, all anchored to step 2.
      expect(text).toBe('2@60:4 2@64:4 2@67:4');
    });

    it('clamps past the end of the fixed 16-step loop instead of growing', () => {
      cmp.loadFromText('99@60:1');

      expect(cmp.gridAsText()).toBe('15@60:1');
    });
  });

  describe('gridAsSequence', () => {
    it('emits a rest for the gap between blocks', () => {
      // Step 0 for 4 steps, then silence until step 8.
      cmp.loadFromText('0@60:4 8@64:2');

      const steps = cmp.gridAsSequence();

      // note(4 steps) -> rest(4 steps) -> note(2 steps)
      expect(steps).toHaveLength(3);
      expect(steps[0]).toHaveProperty('note');
      expect(steps[1]).toHaveProperty('restMs');
      expect(steps[2]).toHaveProperty('note');

      // The gap is 4 steps long, same as the first note.
      const stepMs = cmp.getStepDurationMs();
      expect((steps[1] as { restMs: number }).restMs).toBe(
        Math.round(4 * stepMs),
      );
    });

    it('leads with a rest when the pattern does not start at step 0', () => {
      cmp.loadFromText('4@60:1');

      const steps = cmp.gridAsSequence();

      expect(steps[0]).toHaveProperty('restMs');
      expect((steps[0] as { restMs: number }).restMs).toBe(
        Math.round(4 * cmp.getStepDurationMs()),
      );
    });

    it('emits no rest for adjacent blocks', () => {
      cmp.loadFromText('0@60:2 2@64:2');

      const steps = cmp.gridAsSequence();

      expect(steps).toHaveLength(2);
      expect(steps.some((s) => 'restMs' in s)).toBe(false);
    });

    it('groups notes sharing a step into one chord step', () => {
      cmp.loadFromText('0@[60,64,67]:4');

      const steps = cmp.gridAsSequence();

      expect(steps).toHaveLength(1);
      expect(steps[0]).toHaveProperty('chord');
      expect((steps[0] as { chord: string[] }).chord).toHaveLength(3);
    });
  });

  describe('inputs', () => {
    it('rebuilds the rows when baseOctave changes after init', () => {
      const before = cmp.rows.map((r) => r.octave);

      cmp.baseOctave = 2;
      cmp.ngOnChanges({
        baseOctave: {
          currentValue: 2,
          previousValue: 4,
          firstChange: false,
          isFirstChange: () => false,
        },
      });

      expect(cmp.rows.map((r) => r.octave)).not.toEqual(before);
      expect(Math.min(...cmp.rows.map((r) => r.octave))).toBe(2);
    });

    it('rebuilds the rows when octaveCount changes after init', () => {
      const before = cmp.rows.length;

      cmp.octaveCount = 3;
      cmp.ngOnChanges({
        octaveCount: {
          currentValue: 3,
          previousValue: 2,
          firstChange: false,
          isFirstChange: () => false,
        },
      });

      expect(cmp.rows.length).toBe(before + 12);
    });
  });

  describe('notePreview', () => {
    it('emits when a cell is painted', () => {
      const seen: string[] = [];
      cmp.notePreview.subscribe((p) => seen.push(`${p.note}${p.octave}`));

      const row = cmp.rows[cmp.rows.length - 1]; // lowest row = C of baseOctave
      cmp.onPointerDown(row, 0, { button: 0 } as PointerEvent);

      expect(seen).toEqual([`${row.note}${row.octave}`]);
    });

    it('stays silent when the pointer-down only removes a block', () => {
      const row = cmp.rows[cmp.rows.length - 1];
      cmp.onPointerDown(row, 0, { button: 0 } as PointerEvent);

      const seen: string[] = [];
      cmp.notePreview.subscribe((p) => seen.push(`${p.note}${p.octave}`));

      // Second press on the same cell targets the existing block.
      cmp.onPointerDown(row, 0, { button: 0 } as PointerEvent);

      expect(seen).toEqual([]);
    });
  });
});
