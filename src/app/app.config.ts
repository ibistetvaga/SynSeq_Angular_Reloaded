import { ApplicationConfig } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';

/**
 * The dashboard's providers.
 *
 * =========================================================================
 * THREE THINGS ARE GONE, AND THEIR ABSENCE IS THE POINT
 * =========================================================================
 *
 * 1. `provideZoneChangeDetection({ eventCoalescing: true })`
 *    Angular 22 is zoneless when zone.js is not in the polyfills, so there is
 *    nothing to configure and nothing to add - NOT even
 *    `provideZonelessChangeDetection()`, which is the default. The consuming
 *    app is configured exactly this way.
 *
 * 2. `provideHttpClient()`
 *    It existed for PianoPresetsService, which fetched presets over HTTP. That
 *    dependency is GONE: presets now arrive through the `PIANO_PRESETS` token,
 *    so the library asks for nothing the consumer has not offered. Nothing in
 *    this app, or in the library, makes a request.
 *
 *    To add your own presets here, import `providePianoPresets` from
 *    `soundboard-ng` and list it below.
 *
 * 3. `provideAnimationsAsync()`
 *    Deprecated since v20.2, and @angular/animations is deprecated outright
 *    with intent to remove in v23. Nothing here declares an animation trigger.
 *    If the build disagrees, that is a loud error and a one-line revert.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withViewTransitions({
        // The first paint is not a navigation anybody performed.
        skipInitialTransition: true,
      }),
    ),
  ],
};
