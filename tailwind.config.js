/** @type {import('tailwindcss').Config} */
module.exports = {
  /*
   * SOURCE, not dist.
   *
   * The dashboard resolves `@soundboard-ng` to
   * projects/soundboard-ng/src/public-api.ts (see `paths` in tsconfig.json),
   * so the files the browser actually runs are the ones under projects/.
   * Pointing Tailwind at ./dist/ instead meant it scanned either nothing or a
   * stale build, and every utility class in the piano markup was treated as
   * unused and dropped.
   *
   * NOTE FOR THE DE-TAILWIND SLICE: this config is scheduled for deletion.
   * The components are meant to be copied into an app that has no Tailwind at
   * all, so their styling has to move into SCSS + CSS custom properties. A
   * class that only renders because of a scan path is exactly the kind of
   * hidden coupling that makes a "port" turn into a rewrite.
   */
  content: [
    './src/**/*.{html,ts}',
    './projects/**/*.{html,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
