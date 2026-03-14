/**
 * CDN bundle builder for Digito.
 *
 * Produces two browser-ready IIFE bundles from the TypeScript sources:
 *
 *   dist/digito.min.js     — vanilla initDigito + window.Digito global
 *   dist/digito-wc.min.js  — <digito-input> web component (auto-registers)
 *
 * Both are minified, target ES2017 (async/await transpiled), and include an
 * inline source map for debugging. Import via CDN:
 *
 *   <script src="https://unpkg.com/digito/dist/digito.min.js"></script>
 *   <!-- window.Digito.init('.digito-wrapper', { length: 6 }) -->
 *
 *   <script src="https://unpkg.com/digito/dist/digito-wc.min.js"></script>
 *   <!-- <digito-input length="6"></digito-input> -->
 *
 * Usage:
 *   node build-cdn.js          # build both bundles
 *   npm run build:cdn          # same via npm
 *   npm run build:all          # tsc + cdn in one step
 */

import esbuild from 'esbuild'

const shared = {
  bundle:    true,
  minify:    true,
  sourcemap: 'external',
  target:    ['es2017'],
  format:    'iife',
  logLevel:  'info',
  banner: {
    js: '/*! Digito v1.2.0 | MIT | Olawale Balo — Product Designer + Design Engineer */',
  },
}

await Promise.all([
  // Vanilla adapter — window.Digito.init() global
  esbuild.build({
    ...shared,
    entryPoints: ['src/adapters/vanilla.ts'],
    outfile:     'dist/digito.min.js',
  }),

  // Web Component — auto-registers <digito-input>
  esbuild.build({
    ...shared,
    entryPoints: ['src/adapters/web-component.ts'],
    outfile:     'dist/digito-wc.min.js',
  }),
])