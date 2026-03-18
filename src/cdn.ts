/**
 * CDN entry point for Digito.
 *
 * Exposes all public browser-facing APIs as a single window.Digito global.
 * This file is the entrypoint for dist/digito.min.js only — it is not
 * part of the npm package exports.
 *
 * Usage after loading the CDN script:
 *   const { initDigito, createDigito, filterChar, filterString, createTimer } = window.Digito
 */

// Vanilla adapter
export { initDigito } from './adapters/vanilla'

// Core state machine + utilities
export {
  createDigito,
  createTimer,
  formatCountdown,
  filterChar,
  filterString,
  triggerHapticFeedback,
  triggerSoundFeedback,
} from './core'