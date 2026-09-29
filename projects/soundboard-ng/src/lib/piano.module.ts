import { NgModule } from '@angular/core';

import { PianoPageComponent } from './pages/piano/piano-page.component';
import { PianoSequencerComponent } from './pages/piano/lib-sequencer/piano-sequencer.component';
import { PianoRollComponent } from './pages/piano/lib-piano-roll/piano-roll.component';

/**
 * Convenience module for consumers that still organise their app with
 * NgModules. Import it and all three components are available in any template
 * the module declares.
 *
 * You do not need it. Every component in this library is standalone, so
 * importing them directly is the shorter path and the one the README shows:
 *
 * ```ts
 * imports: [PianoPageComponent]
 * ```
 *
 * `CommonModule` and `FormsModule` are deliberately NOT listed here. Standalone
 * components carry their own imports, so naming them again would pull two
 * modules into the consumer's graph for no effect.
 */
@NgModule({
  imports: [PianoPageComponent, PianoSequencerComponent, PianoRollComponent],
  exports: [PianoPageComponent, PianoSequencerComponent, PianoRollComponent],
})
export class PianoModule {}
