# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] — 2026-03-14

### Added

- `Delete` key support — clears current slot, stays in place, no backward movement
- `defaultValue` option — uncontrolled pre-fill on mount, plain string, runs once, does not trigger `onComplete`
- `readOnly` mode — display and copy, no edit, visually and semantically distinct from `disabled`
- `data-complete`, `data-invalid`, `data-disabled`, `data-readonly` attributes on the wrapper element across all adapters — boolean presence attributes that mirror field state, compatible with Tailwind `data-*` variants and plain CSS attribute selectors

## [1.0.1] — 2026-03-14

### Changed

- Live demo URL updated to `https://digitojs.vercel.app` in README

## [1.0.0] — 2026-03-14

### Added

- Pure headless state machine (`createDigito`) — zero DOM, zero framework dependencies
- Six framework adapters: Vanilla JS, React, Vue 3, Svelte, Alpine.js, Web Component (`<digito-input>`)
- Single hidden-input architecture for native SMS autofill, password manager, and screen reader support
- Built-in countdown timer and resend UI (vanilla adapter)
- Web OTP API integration — automatic SMS intercept on Android Chrome
- Password manager badge guard (LastPass, 1Password, Dashlane, Bitwarden, Keeper)
- Fake blinking caret on active empty slot
- Masked mode (`masked: true`) — renders `●` glyphs, `type="password"` on hidden input
- Visual separators (`separatorAfter`) with multi-position support
- Smart paste with wrap-around distribution and `pasteTransformer` option
- Custom charset via `pattern: RegExp`
- Programmatic API: `setError`, `setSuccess`, `setDisabled`, `reset`, `focus`, `destroy`
- `onComplete`, `onExpire`, `onResend`, `onTick`, `onInvalidChar`, `onChange`, `onFocus`, `onBlur` callbacks
- `blurOnComplete` — auto-advance focus on completion
- `selectOnFocus` — select-and-replace behavior on filled slots
- `name` option for native `<form>` / `FormData` integration
- Haptic feedback via `navigator.vibrate` and sound feedback via Web Audio API
- Subscription system (`subscribe`) — XState/Zustand-style state listeners
- Standalone `createTimer` utility — exportable, idempotent, BYOF-ready
- `filterChar` / `filterString` utilities exported for custom validation
- `triggerHapticFeedback` / `triggerSoundFeedback` exported for BYOF
- Full TypeScript support — declaration maps, source maps, strict types
- CDN IIFE bundles: `dist/digito.min.js` and `dist/digito-wc.min.js` (ES2017, minified)
- Seven independent package entry points with tree-shaking support