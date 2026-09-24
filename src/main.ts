/*
 * No `import 'zone.js'`.
 *
 * Angular 22 runs zoneless when no zone.js polyfill is configured, and that is
 * how the consuming app runs too. Dropping it here is not just tidiness: a
 * component developed under zone.js can rely on change detection it will not
 * get once copied across, and the failure mode is a control that works in this
 * dashboard and silently stops repainting over there.
 */
import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
