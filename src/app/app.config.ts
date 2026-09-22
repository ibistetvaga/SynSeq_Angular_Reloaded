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
 *    dependency is being removed (the consuming app routes every request
 *    through one API service, so a library reaching for HttpClient on its own
 *    cannot come along). Until then, nothing in this app makes a request.
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
