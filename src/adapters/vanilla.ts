/**
 * digito/vanilla
 * ─────────────────────────────────────────────────────────────────────────────
 * DOM adapter using the single-hidden-input architecture.
 *
 * Architecture:
 *   One real <input> sits invisibly behind the visual slot divs.
 *   It captures ALL keyboard input, paste, and native SMS autofill.
 *   The visual slot <div>s are pure mirrors — they display characters
 *   from the hidden input's value, show a fake caret on the active slot,
 *   and forward click events to focus the real input.
 *
 * Why this is better than multiple inputs:
 *   - autocomplete="one-time-code" works as native single-input autofill
 *   - iOS SMS autofill works without any hacks
 *   - Screen readers see one real input — perfect a11y
 *   - No focus-juggling between inputs on every keystroke
 *   - Password managers can't confuse the slots for separate fields
 *
 * Web OTP API:
 *   When supported (Android Chrome), navigator.credentials.get is called
 *   automatically to intercept the SMS OTP code without any user interaction.
 *   The AbortController is wired to destroy() so the request is cancelled
 *   on cleanup. Falls back gracefully in all other environments.
 *
 * Two timer modes:
 *   Built-in UI  — omit onTick. Digito renders "Code expires in [0:60]"
 *                  and "Didn't receive the code? Resend" automatically.
 *   Custom UI    — pass onTick. Digito fires the callback and skips its timer.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  createDigito,
  createTimer,
  filterString,
  type DigitoOptions,
  type InputType,
} from '../core/index.js'

export { createTimer } from '../core/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** The control surface returned by initDigito for each mounted wrapper. */
export type DigitoInstance = {
  /** Clear all slots, restart timer, focus the hidden input. */
  reset:        () => void
  /** Reset + fire onResend callback. */
  resend:       () => void
  /** Apply or clear the error state on all visual slots. */
  setError:     (isError: boolean) => void
  /** Apply or clear the success state on all visual slots. */
  setSuccess:   (isSuccess: boolean) => void
  /**
   * Enable or disable the input. When disabled, all keypresses and pastes are
   * silently ignored and the hidden input is set to disabled. Use during async
   * verification to prevent the user from modifying the code mid-request.
   */
  setDisabled:  (isDisabled: boolean) => void
  /** Returns the current joined code string. */
  getCode:      () => string
  /** Programmatically move focus to a slot index (focuses the hidden input). */
  focus:        (slotIndex: number) => void
  /** Remove all event listeners and stop the timer. */
  destroy:      () => void
}


// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const INJECTED_STYLE_ID = 'digito-styles'

/**
 * Injects the digito stylesheet into head exactly once per page.
 *
 * CSS custom properties (set on .digito-wrapper to override):
 *   --digito-size              Slot width + height          (default: 56px)
 *   --digito-gap               Gap between slots            (default: 12px)
 *   --digito-radius            Slot border radius           (default: 10px)
 *   --digito-font-size         Digit font size              (default: 24px)
 *   --digito-bg                Slot background              (default: #FAFAFA)
 *   --digito-bg-filled         Slot background when filled  (default: #FFFFFF)
 *   --digito-color             Digit text colour            (default: #0A0A0A)
 *   --digito-border-color      Default slot border          (default: #E5E5E5)
 *   --digito-active-color      Active slot border + ring    (default: #757575)
 *   --digito-error-color       Error border, ring + badge   (default: #FB2C36)
 *   --digito-success-color     Success border + ring        (default: #00C950)
 *   --digito-timer-color       Timer label text colour      (default: #5C5C5C)
 *   --digito-caret-color       Fake caret colour            (default: #3D3D3D)
 *   --digito-separator-color   Separator text colour      (default: #A1A1A1)
 *   --digito-separator-size    Separator font size        (default: 18px)
 *   --digito-masked-size       Mask character font size   (default: 16px)
 */
function injectStylesOnce(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(INJECTED_STYLE_ID)) return

  const styleEl = document.createElement('style')
  styleEl.id = INJECTED_STYLE_ID
  styleEl.textContent = [
    '.digito-element{position:relative;display:inline-block;line-height:1}',
    '.digito-hidden-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;border:none;outline:none;background:transparent;color:transparent;caret-color:transparent;z-index:1;cursor:text;font-size:1px}',
    '.digito-content{display:inline-flex;gap:var(--digito-gap,12px);align-items:center;padding:24px 0 0px;position:relative}',
    '.digito-slot{position:relative;width:var(--digito-size,56px);height:var(--digito-size,56px);border:1px solid var(--digito-border-color,#E5E5E5);border-radius:var(--digito-radius,10px);font-size:var(--digito-font-size,24px);font-weight:600;display:flex;align-items:center;justify-content:center;background:var(--digito-bg,#FAFAFA);color:var(--digito-color,#0A0A0A);transition:border-color 150ms ease,box-shadow 150ms ease,background 150ms ease;user-select:none;-webkit-user-select:none;cursor:text;font-family:inherit}',
    '.digito-slot.is-active{border-color:var(--digito-active-color,#3D3D3D);box-shadow:0 0 0 3px color-mix(in srgb,var(--digito-active-color,#3D3D3D) 10%,transparent);background:var(--digito-bg-filled,#FFFFFF)}',
    '.digito-slot.is-filled{background:var(--digito-bg-filled,#FFFFFF)}',
    '.digito-slot.is-error{border-color:var(--digito-error-color,#FB2C36);box-shadow:0 0 0 3px color-mix(in srgb,var(--digito-error-color,#FB2C36) 12%,transparent)}',
    '.digito-slot.is-success{border-color:var(--digito-success-color,#00C950);box-shadow:0 0 0 3px color-mix(in srgb,var(--digito-success-color,#00C950) 12%,transparent)}',
    '.digito-slot.is-disabled{opacity:0.45;cursor:not-allowed;pointer-events:none}',
    '.digito-caret{position:absolute;width:2px;height:52%;background:var(--digito-caret-color,#3D3D3D);border-radius:1px;animation:digito-blink 1s step-start infinite;pointer-events:none}',
    '@keyframes digito-blink{0%,100%{opacity:1}50%{opacity:0}}',
    '.digito-separator{display:flex;align-items:center;justify-content:center;color:var(--digito-separator-color,#A1A1A1);font-size:var(--digito-separator-size,18px);font-weight:400;user-select:none;flex-shrink:0;}',
    '.digito-slot:not(.is-filled){font-size:var(--digito-placeholder-size,16px);color:var(--digito-placeholder-color,#D3D3D3)}',
    '.digito-slot.is-masked.is-filled{font-size:var(--digito-masked-size,16px)}',
    '.digito-timer{display:flex;align-items:center;gap:8px;font-size:14px;padding:20px 0 0}',
    '.digito-timer-label{color:var(--digito-timer-color,#5C5C5C);font-size:14px}',
    '.digito-timer-badge{display:inline-flex;align-items:center;background:color-mix(in srgb,var(--digito-error-color,#FB2C36) 10%,transparent);color:var(--digito-error-color,#FB2C36);font-weight:500;font-size:14px;padding:2px 10px;border-radius:99px;height: 24px}',
    '.digito-resend{display:none;align-items:center;gap:8px;font-size:14px;color:var(--digito-timer-color,#5C5C5C);padding:20px 0 0}',
    '.digito-resend.is-visible{display:flex}',
    '.digito-resend-btn{display:inline-flex;align-items:center;background:#E8E8E8;border:none;padding:2px 10px;border-radius:99px;color:#0A0A0A;font-weight:500;font-size:14px;transition:background 150ms ease;cursor:pointer;height: 24px}',
    '.digito-resend-btn:hover{background:#E5E5E5}',
    '.digito-resend-btn:disabled{color:#A1A1A1;cursor:not-allowed;background:#F5F5F5}',
  ].join('')
  document.head.appendChild(styleEl)
}


// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vanilla-only options that extend the core DigitoOptions.
 * These are not part of the shared adapter API.
 */
export type VanillaOnlyOptions = Partial<DigitoOptions> & {
  /**
   * Insert a purely visual separator after this slot index (0-based).
   * The separator is aria-hidden, never enters the value, and has no effect on state.
   * Accepts a single position or an array for multiple separators.
   * Default: 0 (no separator).
   * @example separatorAfter: 3      -> [ ][ ][ ] — [ ][ ][ ]       (6-slot field)
   * @example separatorAfter: [2, 4] -> [ ][ ] — [ ][ ] — [ ][ ]
   */
  separatorAfter?: number | number[]
  /**
   * The character or string to render as the separator.
   * Default: '—'
   */
  separator?: string
  /**
   * When `true`, each filled slot displays a mask glyph instead of the real
   * character. The hidden input switches to `type="password"` so the OS keyboard
   * and browser autocomplete treat it as a sensitive field.
   *
   * `getCode()` and `onComplete` always return the real characters — masking is
   * purely visual. Use for PIN entry or any flow where the value should not be
   * visible to shoulder-surfers.
   *
   * Default: `false`.
   */
  masked?: boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Allows substituting the default bullet with any character of your choice
   * (e.g. `'*'`, `'•'`, `'x'`).
   *
   * Readable via the `data-mask-char` HTML attribute:
   * `<div class="digito-wrapper" data-mask-char="*">`.
   *
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   */
  maskChar?: string
}

/**
 * Mount digito on one or more wrapper elements.
 *
 * @param target   CSS selector or HTMLElement. Default: '.digito-wrapper'
 * @param options  Runtime options — supplement or override data attributes.
 * @returns        Array of DigitoInstance objects, one per wrapper found.
 */
export function initDigito(
  target:  string | HTMLElement = '.digito-wrapper',
  options: VanillaOnlyOptions = {},
): DigitoInstance[] {
  injectStylesOnce()

  const wrapperElements: HTMLElement[] = typeof target === 'string'
    ? Array.from(document.querySelectorAll<HTMLElement>(target))
    : [target]

  return wrapperElements.map(wrapperEl => mountOnWrapper(wrapperEl, options))
}


// ─────────────────────────────────────────────────────────────────────────────
// MOUNT
// ─────────────────────────────────────────────────────────────────────────────

// Web OTP API — the spec adds OTPCredential to the Credential type but it is
// not yet in TypeScript's standard DOM lib. Declare it locally.
interface OTPCredential extends Credential { code: string }

/** Augmented element type used to store per-instance footer references. */
type DigitoWrapper = HTMLElement & {
  __digitoFooterEl?:    HTMLDivElement | null
  __digitoResendRowEl?: HTMLDivElement | null
}

function mountOnWrapper(
  wrapperEl: DigitoWrapper,
  options:   VanillaOnlyOptions,
): DigitoInstance {
  // Guard against double-initialisation on the same element. Calling initDigito
  // twice without destroy() would orphan the first instance's event listeners
  // and timers. Warn and clean up the stale DOM before proceeding.
  if (wrapperEl.querySelector('.digito-element')) {
    console.warn('[digito] initDigito() called on an already-initialised wrapper — call instance.destroy() first to avoid leaks.')
  }

  // ── Config ───────────────────────────────────────────────────────────────
  const slotCount       = options.length      ?? parseInt(wrapperEl.dataset.length ?? '6',  10)
  const inputType       = (options.type       ?? wrapperEl.dataset.type            ?? 'numeric') as InputType
  const timerSeconds    = options.timer       ?? parseInt(wrapperEl.dataset.timer  ?? '0',  10)
  const resendCooldown  = options.resendAfter ?? parseInt(wrapperEl.dataset.resend ?? '30', 10)
  const onResend        = options.onResend
  const onComplete      = options.onComplete
  const onTickCallback  = options.onTick
  const onExpire        = options.onExpire
  const pattern         = options.pattern
  let   isDisabled      = options.disabled    ?? false
  const isReadOnly      = options.readOnly    ?? false
  const defaultValue    = options.defaultValue ?? ''

  // New options
  const autoFocus      = options.autoFocus !== false         // default true
  const inputName      = options.name
  const onFocusProp    = options.onFocus
  const onBlurProp     = options.onBlur
  const placeholder    = options.placeholder ?? ''
  const selectOnFocus  = options.selectOnFocus  ?? false
  const blurOnComplete = options.blurOnComplete ?? false

  const rawSepAfter = (options as VanillaOnlyOptions).separatorAfter
    ?? (wrapperEl.dataset.separatorAfter !== undefined
          ? wrapperEl.dataset.separatorAfter.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
          : [])
  // Normalise to array so all rendering logic is consistent
  const separatorAfterPositions: number[] = Array.isArray(rawSepAfter) ? rawSepAfter : [rawSepAfter]

  const separatorChar  = (options as VanillaOnlyOptions).separator
    ?? wrapperEl.dataset.separator
    ?? '—'
  const masked    = (options as VanillaOnlyOptions).masked   ?? wrapperEl.dataset.masked   === 'true'
  const maskChar  = (options as VanillaOnlyOptions).maskChar ?? wrapperEl.dataset.maskChar ?? '\u25CF'

  // ── Core state machine ───────────────────────────────────────────────────
  const otpCore = createDigito({
    length:           slotCount,
    type:             inputType,
    timer:            timerSeconds,
    resendAfter:      resendCooldown,
    onComplete,
    onTick:           onTickCallback,
    onExpire,
    pattern,
    pasteTransformer: options.pasteTransformer,
    onInvalidChar:    options.onInvalidChar,
    sound:            options.sound    ?? false,
    haptic:           options.haptic   ?? true,
    disabled:         isDisabled,
    readOnly:         isReadOnly,
  })

  // ── Build DOM ────────────────────────────────────────────────────────────
  // Clear wrapper using safe DOM removal (avoids innerHTML)
  while (wrapperEl.firstChild) wrapperEl.removeChild(wrapperEl.firstChild)

  const rootEl = document.createElement('div')
  rootEl.className = 'digito-element'

  const slotRowEl = document.createElement('div')
  slotRowEl.className = 'digito-content'

  const slotEls: HTMLDivElement[] = []
  const caretEls: HTMLDivElement[] = []

  for (let i = 0; i < slotCount; i++) {
    const slotEl = document.createElement('div')
    slotEl.className = 'digito-slot'
    slotEl.setAttribute('aria-hidden', 'true')
    slotEl.setAttribute('data-slot', String(i))

    const caretEl = document.createElement('div')
    caretEl.className = 'digito-caret'
    caretEl.style.display = 'none'

    slotEl.appendChild(caretEl)
    caretEls.push(caretEl)
    slotEls.push(slotEl)
    slotRowEl.appendChild(slotEl)

    if (separatorAfterPositions.some(pos => pos > 0 && i === pos - 1)) {
      const sepEl = document.createElement('div')
      sepEl.className   = 'digito-separator'
      sepEl.textContent = separatorChar
      sepEl.setAttribute('aria-hidden', 'true')
      slotRowEl.appendChild(sepEl)
    }
  }

  const hiddenInputEl = document.createElement('input')
  hiddenInputEl.type         = masked ? 'password' : 'text'
  hiddenInputEl.inputMode    = inputType === 'numeric' ? 'numeric' : 'text'
  hiddenInputEl.autocomplete = 'one-time-code'
  hiddenInputEl.maxLength    = slotCount
  hiddenInputEl.className    = 'digito-hidden-input'
  if (inputName) hiddenInputEl.name = inputName
  hiddenInputEl.setAttribute('aria-label', `Enter your ${slotCount}-${inputType === 'numeric' ? 'digit' : 'character'} code`)
  hiddenInputEl.setAttribute('spellcheck', 'false')
  hiddenInputEl.setAttribute('autocorrect', 'off')
  hiddenInputEl.setAttribute('autocapitalize', 'off')

  rootEl.appendChild(slotRowEl)
  rootEl.appendChild(hiddenInputEl)
  wrapperEl.appendChild(rootEl)

  if (isReadOnly) hiddenInputEl.setAttribute('aria-readonly', 'true')

  // Apply defaultValue once on mount — no onComplete, no onChange
  if (defaultValue) {
    const filtered = filterString(defaultValue.slice(0, slotCount), inputType, pattern)
    if (filtered) {
      for (let i = 0; i < filtered.length; i++) otpCore.inputChar(i, filtered[i])
      otpCore.cancelPendingComplete()
      hiddenInputEl.value = filtered
    }
  }

  // ── Password manager badge guard ─────────────────────────────────────────
  let disconnectPasswordManagerWatch: () => void = () => {}
  requestAnimationFrame(() => {
    const slotRowWidth = slotRowEl.getBoundingClientRect().width || 0
    disconnectPasswordManagerWatch = watchForPasswordManagerBadge(hiddenInputEl, slotRowWidth)
  })

  // ── Timer + resend ────────────────────────────────────────────────────────
  let timerBadgeEl:       HTMLSpanElement   | null = null
  let resendActionBtn:    HTMLButtonElement | null = null
  let mainCountdown:      ReturnType<typeof createTimer> | null = null
  let resendCountdown:    ReturnType<typeof createTimer> | null = null
  let builtInFooterEl:    HTMLDivElement    | null = null
  let builtInResendRowEl: HTMLDivElement    | null = null

  // Remove any footer elements left by a previous mount on this same wrapper.
  // Using stored references is reliable regardless of DOM siblings inserted between them.
  wrapperEl.__digitoFooterEl?.remove()
  wrapperEl.__digitoResendRowEl?.remove()
  wrapperEl.__digitoFooterEl    = null
  wrapperEl.__digitoResendRowEl = null

  if (timerSeconds > 0) {
    const shouldUseBuiltInFooter = !onTickCallback

    if (shouldUseBuiltInFooter) {
      builtInFooterEl = document.createElement('div')
      builtInFooterEl.className = 'digito-timer'

      const expiresLabel = document.createElement('span')
      expiresLabel.className   = 'digito-timer-label'
      expiresLabel.textContent = 'Code expires in'

      timerBadgeEl = document.createElement('span')
      timerBadgeEl.className   = 'digito-timer-badge'
      timerBadgeEl.textContent = formatCountdown(timerSeconds)

      builtInFooterEl.appendChild(expiresLabel)
      builtInFooterEl.appendChild(timerBadgeEl)
      wrapperEl.insertAdjacentElement('afterend', builtInFooterEl)

      builtInResendRowEl = document.createElement('div')
      builtInResendRowEl.className = 'digito-resend'

      const didntReceiveLabel = document.createElement('span')
      didntReceiveLabel.textContent = 'Didn\u2019t receive the code?'

      resendActionBtn = document.createElement('button')
      resendActionBtn.className   = 'digito-resend-btn'
      resendActionBtn.textContent = 'Resend'
      resendActionBtn.type        = 'button'

      builtInResendRowEl.appendChild(didntReceiveLabel)
      builtInResendRowEl.appendChild(resendActionBtn)
      builtInFooterEl.insertAdjacentElement('afterend', builtInResendRowEl)

      // Store on the wrapper element so subsequent mounts on the same element
      // can clean these up reliably without fragile sibling DOM walks.
      wrapperEl.__digitoFooterEl    = builtInFooterEl
      wrapperEl.__digitoResendRowEl = builtInResendRowEl
    }

    mainCountdown = createTimer({
      totalSeconds: timerSeconds,
      onTick: (remaining) => {
        if (timerBadgeEl) timerBadgeEl.textContent = formatCountdown(remaining)
        onTickCallback?.(remaining)
      },
      onExpire: () => {
        if (builtInFooterEl)    builtInFooterEl.style.display = 'none'
        if (builtInResendRowEl) builtInResendRowEl.classList.add('is-visible')
        onExpire?.()
      },
    })
    mainCountdown.start()

    if (shouldUseBuiltInFooter && resendActionBtn) {
      resendActionBtn.addEventListener('click', () => {
        if (!resendActionBtn || !timerBadgeEl || !builtInFooterEl || !builtInResendRowEl) return
        builtInResendRowEl.classList.remove('is-visible')
        builtInFooterEl.style.display = 'flex'
        timerBadgeEl.textContent = formatCountdown(resendCooldown)
        resendCountdown?.stop()
        resendCountdown = createTimer({
          totalSeconds: resendCooldown,
          onTick:   (r) => { if (timerBadgeEl) timerBadgeEl.textContent = formatCountdown(r) },
          onExpire: () => {
            if (builtInFooterEl)    builtInFooterEl.style.display = 'none'
            if (builtInResendRowEl) builtInResendRowEl.classList.add('is-visible')
          },
        })
        resendCountdown.start()
        onResend?.()
      })
    }
  }

  // ── Web OTP API (SMS autofill) ────────────────────────────────────────────
  // navigator.credentials.get({ otp: { transport: ['sms'] } }) intercepts
  // incoming OTP SMSes on Android Chrome without any user gesture.
  // The AbortController is stored so destroy() can cancel the pending request.
  let webOTPController: AbortController | null = null

  if (typeof navigator !== 'undefined' && 'credentials' in navigator) {
    webOTPController = new AbortController()
    ;(navigator.credentials.get as (opts: object) => Promise<OTPCredential | null>)({
      otp:    { transport: ['sms'] },
      signal: webOTPController.signal,
    }).then((credential) => {
      if (!credential?.code) return
      const valid = filterString(credential.code, inputType, pattern).slice(0, slotCount)
      if (!valid) return
      otpCore.resetState()
      for (let i = 0; i < valid.length; i++) {
        if (valid[i]) otpCore.inputChar(i, valid[i])
      }
      const filledCount = valid.length
      const nextCursor  = Math.min(filledCount, slotCount - 1)
      hiddenInputEl.value = valid
      hiddenInputEl.setSelectionRange(nextCursor, nextCursor)
      otpCore.moveFocusTo(nextCursor)
      syncSlotsToDOM()
    }).catch(() => { /* aborted on destroy() or not supported — fail silently */ })
  }


  // ── DOM sync ─────────────────────────────────────────────────────────────

  function syncSlotsToDOM(): void {
    const { slotValues, activeSlot, hasError } = otpCore.state
    const inputIsFocused = document.activeElement === hiddenInputEl

    slotEls.forEach((slotEl, i) => {
      const char    = slotValues[i] ?? ''
      const isActive = i === activeSlot && inputIsFocused
      const isFilled = char.length === 1

      let textNode = slotEl.childNodes[1] as Text | undefined
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        textNode = document.createTextNode('')
        slotEl.appendChild(textNode)
      }
      textNode.nodeValue = masked && char ? maskChar : char || placeholder

      slotEl.classList.toggle('is-active',  isActive)
      slotEl.classList.toggle('is-filled',  isFilled)
      slotEl.classList.toggle('is-masked',  masked)
      slotEl.classList.toggle('is-error',   hasError)
      if (hasError) slotEl.classList.remove('is-success')

      caretEls[i].style.display = isActive && !isFilled ? 'block' : 'none'
    })

    // Only update value when it actually differs — assigning the same string
    // resets selectionStart/End in some browsers, clobbering the cursor.
    const newValue = slotValues.join('')
    if (hiddenInputEl.value !== newValue) hiddenInputEl.value = newValue

    // Expose component state as data attributes for CSS/Tailwind targeting
    wrapperEl.toggleAttribute('data-complete', otpCore.state.isComplete)
    wrapperEl.toggleAttribute('data-invalid',  otpCore.state.hasError)
    wrapperEl.toggleAttribute('data-disabled', isDisabled)
    wrapperEl.toggleAttribute('data-readonly', isReadOnly)
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function onHiddenInputKeydown(event: KeyboardEvent): void {
    const cursorPos = hiddenInputEl.selectionStart ?? 0

    if (event.key === 'Backspace') {
      event.preventDefault()
      if (isReadOnly) return
      otpCore.deleteChar(cursorPos)
      syncSlotsToDOM()
      hiddenInputEl.setSelectionRange(otpCore.state.activeSlot, otpCore.state.activeSlot)
    } else if (event.key === 'Delete') {
      event.preventDefault()
      if (isReadOnly) return
      otpCore.clearSlot(cursorPos)
      syncSlotsToDOM()
      hiddenInputEl.setSelectionRange(cursorPos, cursorPos)
    } else if (event.key === 'Tab') {
      if (event.shiftKey) {
        // Shift+Tab: move to previous slot, or exit to previous DOM element from first slot
        if (cursorPos === 0) return
        event.preventDefault()
        otpCore.moveFocusLeft(cursorPos)
      } else {
        // Tab: advance to next slot only if current slot is filled
        // On last slot (filled), fall through to let browser move to next DOM element
        if (!otpCore.state.slotValues[cursorPos]) return
        if (cursorPos >= slotCount - 1) return
        event.preventDefault()
        otpCore.moveFocusRight(cursorPos)
      }
      const nextSlot = otpCore.state.activeSlot
      hiddenInputEl.setSelectionRange(nextSlot, nextSlot)
      syncSlotsToDOM()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      otpCore.moveFocusLeft(cursorPos)
      const nextSlot = otpCore.state.activeSlot
      hiddenInputEl.setSelectionRange(nextSlot, nextSlot)
      syncSlotsToDOM()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      otpCore.moveFocusRight(cursorPos)
      const nextSlot = otpCore.state.activeSlot
      hiddenInputEl.setSelectionRange(nextSlot, nextSlot)
      syncSlotsToDOM()
    }
  }

  function onHiddenInputChange(_event: Event): void {
    if (isReadOnly) return
    const rawValue = hiddenInputEl.value

    if (!rawValue) {
      otpCore.resetState()
      hiddenInputEl.value = ''
      hiddenInputEl.setSelectionRange(0, 0)
      syncSlotsToDOM()
      return
    }

    const validValue = filterString(rawValue, inputType, pattern)

    const newSlotValues = Array(slotCount).fill('') as string[]
    for (let i = 0; i < Math.min(validValue.length, slotCount); i++) {
      newSlotValues[i] = validValue[i]
    }

    otpCore.resetState()
    for (let i = 0; i < newSlotValues.length; i++) {
      if (newSlotValues[i]) otpCore.inputChar(i, newSlotValues[i])
    }

    const filledCount = newSlotValues.filter(v => v !== '').length
    const nextCursor  = Math.min(filledCount, slotCount - 1)
    hiddenInputEl.value = validValue.slice(0, slotCount)
    hiddenInputEl.setSelectionRange(nextCursor, nextCursor)
    otpCore.moveFocusTo(nextCursor)
    syncSlotsToDOM()
    if (blurOnComplete && otpCore.state.isComplete) {
      requestAnimationFrame(() => hiddenInputEl.blur())
    }
  }

  function onHiddenInputPaste(event: ClipboardEvent): void {
    event.preventDefault()
    if (isReadOnly) return
    const pastedText = event.clipboardData?.getData('text') ?? ''
    const cursorPos  = hiddenInputEl.selectionStart ?? 0
    otpCore.pasteString(cursorPos, pastedText)

    const { slotValues, activeSlot } = otpCore.state
    hiddenInputEl.value = slotValues.join('')
    hiddenInputEl.setSelectionRange(activeSlot, activeSlot)
    syncSlotsToDOM()
    if (blurOnComplete && otpCore.state.isComplete) {
      requestAnimationFrame(() => hiddenInputEl.blur())
    }
  }

  function onHiddenInputFocus(): void {
    onFocusProp?.()
    // Read activeSlot inside the RAF — not before it.
    // Browser event order on a fresh click: focus fires → click fires → RAF fires.
    // Capturing pos outside the RAF would snapshot activeSlot=0 before the click
    // handler has a chance to call moveFocusTo(clickedSlot), causing the RAF to
    // overwrite the correct slot back to 0.
    requestAnimationFrame(() => {
      const pos  = otpCore.state.activeSlot
      const char = otpCore.state.slotValues[pos]
      if (selectOnFocus && char) {
        hiddenInputEl.setSelectionRange(pos, pos + 1)
      } else {
        hiddenInputEl.setSelectionRange(pos, pos)
      }
      syncSlotsToDOM()
    })
  }

  function onHiddenInputBlur(): void {
    onBlurProp?.()
    slotEls.forEach(slotEl => slotEl.classList.remove('is-active'))
    caretEls.forEach(caretEl => { caretEl.style.display = 'none' })
  }

  hiddenInputEl.addEventListener('keydown', onHiddenInputKeydown)
  hiddenInputEl.addEventListener('input',   onHiddenInputChange)
  hiddenInputEl.addEventListener('paste',   onHiddenInputPaste)
  hiddenInputEl.addEventListener('focus',   onHiddenInputFocus)
  hiddenInputEl.addEventListener('blur',    onHiddenInputBlur)
  hiddenInputEl.addEventListener('click',   onHiddenInputClick)

  function onHiddenInputClick(e: MouseEvent): void {
    if (isDisabled) return
    // Click fires after the browser has already placed the cursor (at 0 due to
    // font-size:1px). Coordinate hit-test to find the intended slot, then
    // override the browser's placement with an explicit setSelectionRange.
    let rawSlot = slotEls.length - 1
    for (let i = 0; i < slotEls.length; i++) {
      if (e.clientX <= slotEls[i].getBoundingClientRect().right) { rawSlot = i; break }
    }
    // Clamp to filled count: setSelectionRange(N, N) on a string of length L
    // silently clamps to L, so cursor ends up at 0 on an empty field. Clamping
    // keeps the visual active slot and the actual cursor position in sync.
    const clickedSlot = Math.min(rawSlot, hiddenInputEl.value.length)
    otpCore.moveFocusTo(clickedSlot)
    const char = otpCore.state.slotValues[clickedSlot]
    if (selectOnFocus && char) {
      hiddenInputEl.setSelectionRange(clickedSlot, clickedSlot + 1)
    } else {
      hiddenInputEl.setSelectionRange(clickedSlot, clickedSlot)
    }
    syncSlotsToDOM()
  }

  requestAnimationFrame(() => {
    if (!isDisabled && autoFocus) hiddenInputEl.focus()
    hiddenInputEl.setSelectionRange(0, 0)
    syncSlotsToDOM()
  })


  // ── Public API ────────────────────────────────────────────────────────────

  function reset(): void {
    otpCore.resetState()
    hiddenInputEl.value = ''
    if (timerBadgeEl)       timerBadgeEl.textContent = formatCountdown(timerSeconds)
    if (builtInFooterEl)    builtInFooterEl.style.display    = 'flex'
    if (builtInResendRowEl) builtInResendRowEl.classList.remove('is-visible')
    resendCountdown?.stop()
    mainCountdown?.restart()
    requestAnimationFrame(() => {
      hiddenInputEl.focus()
      hiddenInputEl.setSelectionRange(0, 0)
      syncSlotsToDOM()
    })
  }

  function resend(): void {
    reset()
    onResend?.()
  }

  function setError(isError: boolean): void {
    otpCore.setError(isError)
    syncSlotsToDOM()
  }

  function setSuccess(isSuccess: boolean): void {
    slotEls.forEach(slotEl => {
      slotEl.classList.toggle('is-success', isSuccess)
      if (isSuccess) slotEl.classList.remove('is-error')
    })
  }

  function setDisabled(value: boolean): void {
    isDisabled = value
    otpCore.setDisabled(value)
    hiddenInputEl.disabled = value
    slotEls.forEach(slotEl => {
      slotEl.classList.toggle('is-disabled', value)
      ;(slotEl as HTMLElement).style.pointerEvents = value ? 'none' : ''
    })
  }

  function getCode(): string {
    return otpCore.getCode()
  }

  function focus(slotIndex: number): void {
    otpCore.moveFocusTo(slotIndex)
    hiddenInputEl.focus()
    hiddenInputEl.setSelectionRange(slotIndex, slotIndex)
    syncSlotsToDOM()
  }

  function destroy(): void {
    hiddenInputEl.removeEventListener('keydown',   onHiddenInputKeydown)
    hiddenInputEl.removeEventListener('input',     onHiddenInputChange)
    hiddenInputEl.removeEventListener('paste',     onHiddenInputPaste)
    hiddenInputEl.removeEventListener('focus',     onHiddenInputFocus)
    hiddenInputEl.removeEventListener('blur',      onHiddenInputBlur)
    hiddenInputEl.removeEventListener('click',     onHiddenInputClick)
    mainCountdown?.stop()
    resendCountdown?.stop()
    disconnectPasswordManagerWatch()
    webOTPController?.abort()
    wrapperEl.__digitoFooterEl    = null
    wrapperEl.__digitoResendRowEl = null
  }

  return { reset, resend, setError, setSuccess, setDisabled, getCode, focus, destroy }
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `0:${String(seconds).padStart(2, '0')}`
}


// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD MANAGER BADGE GUARD
// ─────────────────────────────────────────────────────────────────────────────
//
// Password managers (LastPass, 1Password, Dashlane, Bitwarden) inject a small
// icon badge into or beside <input> elements they detect as credential fields.
// On OTP inputs this badge physically overlaps the last visual slot.
//
// Fix: detect when any of these extensions are active, then push the hidden
// input's width ~40px wider so the badge renders outside the slot boundary.

const PASSWORD_MANAGER_SELECTORS = [
  '[data-lastpass-icon-root]',
  '[data-lastpass-root]',
  '[data-op-autofill]',
  '[data-1p-ignore]',
  '[data-dashlane-rid]',
  '[data-dashlane-label]',
  '[data-kwimpalastatus]',
  '[data-bwautofill]',
  'com-bitwarden-browser-arctic-modal',
]

const PASSWORD_MANAGER_BADGE_OFFSET_PX = 40

function isPasswordManagerActive(): boolean {
  if (typeof document === 'undefined') return false
  return PASSWORD_MANAGER_SELECTORS.some(sel => {
    try { return document.querySelector(sel) !== null }
    catch { return false }
  })
}

function watchForPasswordManagerBadge(
  hiddenInputEl: HTMLInputElement,
  baseWidthPx:   number,
): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}

  function applyOffset(): void {
    hiddenInputEl.style.width = `${baseWidthPx + PASSWORD_MANAGER_BADGE_OFFSET_PX}px`
  }

  if (isPasswordManagerActive()) {
    applyOffset()
    return () => {}
  }

  const observer = new MutationObserver(() => {
    if (isPasswordManagerActive()) {
      applyOffset()
      observer.disconnect()
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree:   true,
    attributes: true,
    attributeFilter: [
      'data-lastpass-icon-root',
      'data-lastpass-root',
      'data-1p-ignore',
      'data-dashlane-rid',
      'data-kwimpalastatus',
    ],
  })

  return () => observer.disconnect()
}


// ─────────────────────────────────────────────────────────────────────────────
// CDN GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['Digito'] = { init: initDigito }
}
