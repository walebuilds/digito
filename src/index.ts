/**
 * digito
 * ─────────────────────────────────────────────────────────────────────────────
 * OTP input library for the modern web.
 * Vanilla JS · React · Vue · Svelte · Alpine · Web Components
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

// Core — pure logic, zero DOM
export {
  createDigito,
  createTimer,
  filterChar,
  filterString,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type InputType,
  type DigitoState,
  type DigitoOptions,
  type TimerOptions,
  type TimerControls,
  type StateListener,
} from './core/index.js'

// Vanilla DOM adapter
export {
  initDigito,
  type DigitoInstance,
} from './adapters/vanilla.js'

// React hook + components
export {
  useOTP as useOTPReact,
  HiddenOTPInput,
  type SlotRenderProps,
} from './adapters/react.js'

// Vue composable
export { useOTP as useOTPVue } from './adapters/vue.js'

// Svelte store + action
export { useOTP as useOTPSvelte } from './adapters/svelte.js'

// Alpine plugin
export { DigitoAlpine } from './adapters/alpine.js'

// Web Component
export { DigitoInput } from './adapters/web-component.js'
