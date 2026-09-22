import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { App } from './app';

/**
 * The shell.
 *
 * This spec used to assert that the page rendered `Hello, ngx-chat-module` -
 * scaffolding left over from an unrelated project. `app.html` has no <h1> at
 * all, so that test could only ever have failed; it was never run.
 *
 * What it asserts now is what the shell is actually for: it mounts, and it
 * provides the router outlet every route renders into.
 *
 * No `provideZonelessChangeDetection()` in the providers either - zoneless is
 * the default in Angular 22, so naming it here would imply the app opts into
 * something it does not.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('creates the shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a router outlet for the routed page to mount into', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
