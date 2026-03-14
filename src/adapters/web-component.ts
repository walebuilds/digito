/**
 * digito/web-component
 * ─────────────────────────────────────────────────────────────────────────────
 * Framework-agnostic Web Component — <digito-input>
 * Uses single hidden-input architecture for correct SMS autofill + a11y.
 *
 * Attributes:
 *   length           Number of slots (default: 6)
 *   type             Character set: numeric | alphabet | alphanumeric | any (default: numeric)
 *   timer            Countdown seconds (default: 0 = no timer)
 *   resend-after     Cooldown seconds before the built-in Resend re-enables (default: 30)
 *   disabled         Boolean attribute — disables all input when present
 *   separator-after  Slot index (1-based) or comma-separated list, e.g. "3" or "2,4" (default: none)
 *   separator        Separator character to render (default: —)
 *   name             Sets the hidden input's name attr for native form submission
 *   placeholder      Character shown in empty slots (e.g. "○" or "_")
 *   auto-focus       Boolean attribute — focus input on mount (default: true when absent)
 *   select-on-focus  Boolean attribute — selects the current slot char on focus
 *   blur-on-complete Boolean attribute — blurs the input when all slots are filled
 *
 * Events:
 *   complete         CustomEvent<{ code: string }> — fired when all slots filled
 *   expire           CustomEvent — fired when timer reaches zero
 *   change           CustomEvent<{ code: string }> — fired on every input change
 *
 * DOM API:
 *   el.reset()
 *   el.setError(boolean)
 *   el.setSuccess(boolean)
 *   el.setDisabled(boolean)
 *   el.getCode() -> string
 *   el.pattern = /^[0-9A-F]$/     (JS property, not attribute)
 *   el.pasteTransformer = fn       (JS property)
 *   el.onComplete = code => {}     (JS property)
 *   el.onResend   = () => {}       (JS property)
 *   el.onFocus    = () => {}       (JS property)
 *   el.onBlur     = () => {}       (JS property)
 *   el.onInvalidChar = (char, i) => {} (JS property)
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  createDigito,
  createTimer,
  filterString,
  type InputType,
} from '../core/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// SHADOW DOM STYLES
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
  :host {
    display:      inline-block;
    position:     relative;
    line-height:  1;
  }

  .digito-wc-root {
    position: relative;
    display:  inline-block;
  }

  .digito-wc-slots {
    display:     inline-flex;
    gap:         var(--digito-gap, 12px);
    align-items: center;
    position:    relative;
  }

  .digito-wc-hidden {
    position:    absolute;
    inset:       0;
    width:       100%;
    height:      100%;
    opacity:     0;
    border:      none;
    outline:     none;
    background:  transparent;
    color:       transparent;
    caret-color: transparent;
    z-index:     1;
    cursor:      text;
    font-size:   1px;
  }

  .digito-wc-slot {
    position:        relative;
    width:           var(--digito-size, 56px);
    height:          var(--digito-size, 56px);
    border:          1px solid var(--digito-border-color, #E5E5E5);
    border-radius:   var(--digito-radius, 10px);
    font-size:       var(--digito-font-size, 24px);
    font-weight:     600;
    display:         flex;
    align-items:     center;
    justify-content: center;
    background:      var(--digito-bg, #FAFAFA);
    color:           var(--digito-color, #0A0A0A);
    font-family:     inherit;
    cursor:          text;
    user-select:     none;
    transition:      border-color 150ms ease, box-shadow 150ms ease, background 150ms ease, opacity 150ms ease;
  }
  .digito-wc-slot.is-active {
    border-color: var(--digito-active-color, #3D3D3D);
    box-shadow:   0 0 0 3px color-mix(in srgb, var(--digito-active-color, #3D3D3D) 10%, transparent);
    background:   var(--digito-bg-filled, #FFFFFF);
  }
  .digito-wc-slot.is-filled    { background: var(--digito-bg-filled, #FFFFFF); }
  .digito-wc-slot.is-error     {
    border-color: var(--digito-error-color, #FB2C36);
    box-shadow:   0 0 0 3px color-mix(in srgb, var(--digito-error-color, #FB2C36) 12%, transparent);
  }
  .digito-wc-slot.is-success {
    border-color: var(--digito-success-color, #00C950);
    box-shadow:   0 0 0 3px color-mix(in srgb, var(--digito-success-color, #00C950) 12%, transparent);
  }
  .digito-wc-slot.is-disabled {
    opacity:        0.45;
    cursor:         not-allowed;
    pointer-events: none;
  }
  .digito-wc-slot:not(.is-filled) {
    font-size: var(--digito-placeholder-size, 16px);
    color:     var(--digito-placeholder-color, #D3D3D3);
  }
  .digito-wc-slot.is-masked.is-filled {
    font-size: var(--digito-masked-size, 16px);
  }

  .digito-wc-separator {
    display:         flex;
    align-items:     center;
    justify-content: center;
    color:           var(--digito-separator-color, #A1A1A1);
    font-size:       var(--digito-separator-size, 18px);
    font-weight:     400;
    user-select:     none;
    flex-shrink:     0;
    padding:         0 2px;
  }

  .digito-wc-caret {
    position:      absolute;
    width:         2px;
    height:        52%;
    background:    var(--digito-caret-color, #3D3D3D);
    border-radius: 1px;
    animation:     wc-blink 1s step-start infinite;
    pointer-events: none;
    display:       none;
  }
  @keyframes wc-blink { 0%,100%{opacity:1} 50%{opacity:0} }

  .digito-wc-timer {
    display:     flex;
    align-items: center;
    gap:         8px;
    font-size:   14px;
    padding:     12px 0 0;
  }
  .digito-wc-timer-label {
    color:     var(--digito-timer-color, #5C5C5C);
    font-size: 14px;
  }
  .digito-wc-timer-badge {
    display:         inline-flex;
    align-items:     center;
    background:      color-mix(in srgb, var(--digito-error-color, #FB2C36) 10%, transparent);
    color:           var(--digito-error-color, #FB2C36);
    font-weight:     500;
    font-size:       14px;
    padding:         2px 10px;
    border-radius:   99px;
    height:          24px;
    font-variant-numeric: tabular-nums;
  }

  .digito-wc-resend {
    display:     none;
    align-items: center;
    gap:         8px;
    font-size:   14px;
    color:       var(--digito-timer-color, #5C5C5C);
    padding:     12px 0 0;
  }
  .digito-wc-resend.is-visible { display: flex; }
  .digito-wc-resend-btn {
    display:       inline-flex;
    align-items:   center;
    background:    #E8E8E8;
    border:        none;
    padding:       2px 10px;
    border-radius: 99px;
    color:         #0A0A0A;
    font-weight:   500;
    font-size:     14px;
    transition:    background 150ms ease;
    cursor:        pointer;
    height:        24px;
    font-family:   inherit;
  }
  .digito-wc-resend-btn:hover    { background: #E5E5E5; }
  .digito-wc-resend-btn:disabled { color: #A1A1A1; cursor: not-allowed; background: #F5F5F5; }
`

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

class DigitoInput extends HTMLElement {
  /**
   * HTML attribute names whose changes trigger `attributeChangedCallback`.
   * Any change to these attributes causes a full shadow DOM rebuild so the
   * component always reflects its attribute state without manual reconciliation.
   */
  static observedAttributes = ['length', 'type', 'timer', 'resend-after', 'disabled', 'separator-after', 'separator', 'masked', 'mask-char', 'name', 'placeholder', 'auto-focus', 'select-on-focus', 'blur-on-complete']

  // Shadow DOM references — rebuilt in full on every attributeChangedCallback.
  private slotEls:        HTMLDivElement[]              = []
  private caretEls:       HTMLDivElement[]              = []
  private hiddenInput:    HTMLInputElement        | null = null
  private timerEl:        HTMLDivElement          | null = null
  private timerBadgeEl:   HTMLSpanElement         | null = null
  private resendEl:       HTMLDivElement          | null = null
  private timerCtrl:      ReturnType<typeof createTimer> | null = null
  private resendCountdown: ReturnType<typeof createTimer> | null = null
  private digito:         ReturnType<typeof createDigito> | null = null
  private shadow:         ShadowRoot

  // Runtime mutable state — toggled by setDisabled() without a full rebuild.
  private _isDisabled  = false
  private _isSuccess   = false

  // JS-property-only options. These cannot be expressed as HTML attributes
  // (RegExp and functions are not serialisable to strings), so they are stored
  // here and applied on every build().
  private _pattern:          RegExp | undefined = undefined
  private _pasteTransformer: ((raw: string) => string) | undefined = undefined
  private _onComplete:       ((code: string) => void) | undefined = undefined
  private _onResend:         (() => void) | undefined = undefined
  private _onFocus:          (() => void) | undefined = undefined
  private _onBlur:           (() => void) | undefined = undefined
  private _onInvalidChar:    ((char: string, index: number) => void) | undefined = undefined

  /** Called when all slots are filled. Also dispatches the `complete` CustomEvent. */
  set onComplete(fn: ((code: string) => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[digito] onComplete must be a function, got:', typeof fn); return
    }
    this._onComplete = fn
  }
  /** Called when the built-in Resend button is clicked. */
  set onResend(fn: (() => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[digito] onResend must be a function, got:', typeof fn); return
    }
    this._onResend = fn
  }
  /** Fires when the hidden input receives focus. Set as JS property. */
  set onFocus(fn: (() => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[digito] onFocus must be a function, got:', typeof fn); return
    }
    this._onFocus = fn
  }
  /** Fires when the hidden input loses focus. Set as JS property. */
  set onBlur(fn: (() => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[digito] onBlur must be a function, got:', typeof fn); return
    }
    this._onBlur = fn
  }
  /**
   * Fires when a typed character is rejected by type/pattern validation.
   * Receives the character and the slot index it was attempted on.
   * Set as JS property.
   */
  set onInvalidChar(fn: ((char: string, index: number) => void) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[digito] onInvalidChar must be a function, got:', typeof fn); return
    }
    this._onInvalidChar = fn
    if (this.shadow.children.length > 0) this.build()
  }

  /**
   * Arbitrary per-character regex. When set, each typed/pasted character must
   * match to be accepted. Takes precedence over the type attribute for
   * character validation. Cannot be expressed as an HTML attribute — set as a
   * JS property instead.
   * @example el.pattern = /^[0-9A-F]$/
   */
  set pattern(re: RegExp | undefined) {
    if (re !== undefined && !(re instanceof RegExp)) {
      console.warn('[digito] pattern must be a RegExp, got:', typeof re); return
    }
    this._pattern = re
    if (this.shadow.children.length > 0) this.build()
  }

  /**
   * Optional paste transformer function. Applied to raw clipboard text before
   * filtering. Use to strip formatting (e.g. `"G-123456"` → `"123456"`).
   * Cannot be expressed as an HTML attribute — set as a JS property.
   * @example el.pasteTransformer = (raw) => raw.replace(/\s+|-/g, '')
   */
  set pasteTransformer(fn: ((raw: string) => string) | undefined) {
    if (fn !== undefined && typeof fn !== 'function') {
      console.warn('[digito] pasteTransformer must be a function, got:', typeof fn); return
    }
    this._pasteTransformer = fn
    if (this.shadow.children.length > 0) this.build()
  }

  constructor() {
    super()
    // Open shadow root so external CSS custom properties (--digito-*) cascade in.
    this.shadow = this.attachShadow({ mode: 'open' })
  }

  /** Called when the element is inserted into the DOM. Triggers the initial build. */
  connectedCallback():    void { this.build() }

  /**
   * Called when the element is removed from the DOM.
   * Stops both timers and cancels any pending `onComplete` timeout to avoid
   * callbacks firing after the element is detached.
   */
  disconnectedCallback(): void {
    this.timerCtrl?.stop()
    this.resendCountdown?.stop()
    this.digito?.resetState()
  }

  /**
   * Called when any observed attribute changes after the initial connection.
   * Guards on `shadow.children.length > 0` so it does not fire before
   * `connectedCallback` has completed the first build.
   */
  attributeChangedCallback(): void {
    if (this.shadow.children.length > 0) this.build()
  }

  // ── Attribute accessors ─────────────────────────────────────────────────────
  // Each getter reads directly from the live attribute to stay in sync with
  // external attribute mutations. All values are snapshotted at the top of
  // build() so a single rebuild is always internally consistent.

  private get _length(): number {
    const v = parseInt(this.getAttribute('length') ?? '6', 10)
    return isNaN(v) || v < 1 ? 6 : Math.floor(v)
  }
  private get _type():            InputType { return (this.getAttribute('type') ?? 'numeric') as InputType }
  private get _timer(): number {
    const v = parseInt(this.getAttribute('timer') ?? '0', 10)
    return isNaN(v) || v < 0 ? 0 : Math.floor(v)
  }
  private get _resendAfter(): number {
    const v = parseInt(this.getAttribute('resend-after') ?? '30', 10)
    return isNaN(v) || v < 1 ? 30 : Math.floor(v)
  }
  private get _disabledAttr():    boolean   { return this.hasAttribute('disabled') }
  /** Parses `separator-after="2,4"` into `[2, 4]`. Filters NaN and zero values. */
  private get _separatorAfter():  number[]  {
    const v = this.getAttribute('separator-after')
    if (!v) return []
    return v.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
  }
  private get _separator():       string    { return this.getAttribute('separator') ?? '—' }
  /** `masked` is a boolean attribute — present means true, absent means false. */
  private get _masked():          boolean   { return this.hasAttribute('masked') }
  private get _maskChar():        string    { return this.getAttribute('mask-char') ?? '\u25CF' }
  private get _name():            string    { return this.getAttribute('name') ?? '' }
  private get _placeholder():     string    { return this.getAttribute('placeholder') ?? '' }
  /**
   * `auto-focus` defaults to `true` when the attribute is absent.
   * Setting `auto-focus="false"` explicitly suppresses focus on mount.
   */
  private get _autoFocus():       boolean   { return !this.hasAttribute('auto-focus') || this.getAttribute('auto-focus') !== 'false' }
  private get _selectOnFocus():   boolean   { return this.hasAttribute('select-on-focus') }
  private get _blurOnComplete():  boolean   { return this.hasAttribute('blur-on-complete') }

  // ── Build ───────────────────────────────────────────────────────────────────
  /**
   * Constructs the entire shadow DOM from scratch.
   *
   * Called on first connect, on every observed attribute change, and when
   * certain JS-property setters (`pattern`, `pasteTransformer`, `onInvalidChar`)
   * are assigned after mount. Tears down any running timer and resets the
   * state machine before rebuilding to prevent duplicate intervals or stale
   * closure references from the previous build.
   */
  private build(): void {
    const length             = this._length
    const type               = this._type
    const timerSecs          = this._timer
    const resendCooldown     = this._resendAfter
    const separatorPositions = this._separatorAfter
    const separator          = this._separator
    const masked             = this._masked
    const inputName          = this._name
    const autoFocus          = this._autoFocus
    const selectOnFocus      = this._selectOnFocus
    const blurOnComplete     = this._blurOnComplete
    this._isDisabled         = this._disabledAttr

    this.timerCtrl?.stop()
    this.resendCountdown?.stop()
    this.digito?.resetState()

    // Clear shadow DOM using safe child removal
    while (this.shadow.firstChild) this.shadow.removeChild(this.shadow.firstChild)
    this.slotEls  = []
    this.caretEls = []
    this.timerEl        = null
    this.timerBadgeEl   = null
    this.resendEl       = null
    this.timerCtrl      = null
    this.resendCountdown = null

    // Styles
    const styleEl = document.createElement('style')
    styleEl.textContent = STYLES
    this.shadow.appendChild(styleEl)

    // Root
    const rootEl = document.createElement('div')
    rootEl.className = 'digito-wc-root'

    // Slot row
    const slotRowEl = document.createElement('div')
    slotRowEl.className = 'digito-wc-slots'

    // Visual slots + optional separator
    for (let i = 0; i < length; i++) {
      const slotEl  = document.createElement('div')
      slotEl.className = 'digito-wc-slot'
      slotEl.setAttribute('aria-hidden', 'true')

      const caretEl = document.createElement('div')
      caretEl.className = 'digito-wc-caret'
      slotEl.appendChild(caretEl)

      this.caretEls.push(caretEl)
      this.slotEls.push(slotEl)
      slotRowEl.appendChild(slotEl)

      if (separatorPositions.some(pos => i === pos - 1)) {
        const sepEl = document.createElement('div')
        sepEl.className   = 'digito-wc-separator'
        sepEl.textContent = separator
        sepEl.setAttribute('aria-hidden', 'true')
        slotRowEl.appendChild(sepEl)
      }
    }

    // Hidden input
    const hiddenInput = document.createElement('input')
    hiddenInput.type           = masked ? 'password' : 'text'
    hiddenInput.inputMode      = type === 'numeric' ? 'numeric' : 'text'
    hiddenInput.autocomplete   = 'one-time-code'
    hiddenInput.maxLength      = length
    hiddenInput.disabled       = this._isDisabled
    hiddenInput.className      = 'digito-wc-hidden'
    hiddenInput.setAttribute('aria-label',     `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`)
    hiddenInput.setAttribute('spellcheck',     'false')
    hiddenInput.setAttribute('autocorrect',    'off')
    hiddenInput.setAttribute('autocapitalize', 'off')
    if (inputName) hiddenInput.name = inputName
    this.hiddenInput = hiddenInput

    rootEl.appendChild(slotRowEl)
    rootEl.appendChild(hiddenInput)
    this.shadow.appendChild(rootEl)

    // Core
    this.digito = createDigito({
      length,
      type,
      pattern:          this._pattern,
      pasteTransformer: this._pasteTransformer,
      onInvalidChar:    this._onInvalidChar,
      onComplete: (code) => {
        // Call JS property setter AND dispatch CustomEvent
        this._onComplete?.(code)
        this.dispatchEvent(
          new CustomEvent('complete', { detail: { code }, bubbles: true, composed: true })
        )
      },
    })

    // ── Built-in timer + resend (mirrors vanilla/alpine adapters) ──────────────
    if (timerSecs > 0) {
      // Timer footer — "Code expires in [0:45]"
      const timerFooterEl = document.createElement('div')
      timerFooterEl.className = 'digito-wc-timer'
      this.timerEl = timerFooterEl

      const timerLabel = document.createElement('span')
      timerLabel.className   = 'digito-wc-timer-label'
      timerLabel.textContent = 'Code expires in'

      const timerBadge = document.createElement('span')
      timerBadge.className   = 'digito-wc-timer-badge'
      timerBadge.textContent = formatCountdown(timerSecs)
      this.timerBadgeEl = timerBadge

      timerFooterEl.appendChild(timerLabel)
      timerFooterEl.appendChild(timerBadge)
      rootEl.appendChild(timerFooterEl)

      // Resend row — "Didn't receive the code? [Resend]"
      const resendRowEl = document.createElement('div')
      resendRowEl.className = 'digito-wc-resend'
      this.resendEl = resendRowEl

      const resendLabel = document.createElement('span')
      resendLabel.textContent = 'Didn\u2019t receive the code?'

      const resendBtn = document.createElement('button')
      resendBtn.className   = 'digito-wc-resend-btn'
      resendBtn.textContent = 'Resend'
      resendBtn.type        = 'button'

      resendRowEl.appendChild(resendLabel)
      resendRowEl.appendChild(resendBtn)
      rootEl.appendChild(resendRowEl)

      // Main countdown
      this.timerCtrl = createTimer({
        totalSeconds: timerSecs,
        onTick: (r) => { if (this.timerBadgeEl) this.timerBadgeEl.textContent = formatCountdown(r) },
        onExpire: () => {
          if (this.timerEl) this.timerEl.style.display = 'none'
          if (this.resendEl) this.resendEl.classList.add('is-visible')
          this.dispatchEvent(new CustomEvent('expire', { bubbles: true, composed: true }))
        },
      })
      this.timerCtrl.start()

      // Resend button click — restart with resend cooldown
      resendBtn.addEventListener('click', () => {
        if (!this.timerEl || !this.timerBadgeEl || !this.resendEl) return
        this.resendEl.classList.remove('is-visible')
        this.timerEl.style.display = 'flex'
        this.timerBadgeEl.textContent = formatCountdown(resendCooldown)
        this.resendCountdown?.stop()
        this.resendCountdown = createTimer({
          totalSeconds: resendCooldown,
          onTick:   (r) => { if (this.timerBadgeEl) this.timerBadgeEl.textContent = formatCountdown(r) },
          onExpire: () => {
            if (this.timerEl) this.timerEl.style.display = 'none'
            if (this.resendEl) this.resendEl.classList.add('is-visible')
          },
        })
        this.resendCountdown.start()
        this._onResend?.()
      })
    }

    this.attachEvents(selectOnFocus, blurOnComplete)

    if (this._isDisabled) this.applyDisabledDOM(true)

    hiddenInput.addEventListener('click', (e: MouseEvent) => {
      if (this._isDisabled) return
      // click fires after the browser places cursor (always 0 due to font-size:1px).
      // Coordinate hit-test determines which slot was visually clicked, then
      // setSelectionRange overrides the browser's placement.
      let rawSlot = this.slotEls.length - 1
      for (let i = 0; i < this.slotEls.length; i++) {
        if (e.clientX <= this.slotEls[i].getBoundingClientRect().right) { rawSlot = i; break }
      }
      // Clamp to filled count so the visual active slot matches the actual cursor position.
      const clickedSlot = Math.min(rawSlot, hiddenInput.value.length)
      this.digito?.moveFocusTo(clickedSlot)
      const char = this.digito?.state.slotValues[clickedSlot] ?? ''
      if (selectOnFocus && char) {
        hiddenInput.setSelectionRange(clickedSlot, clickedSlot + 1)
      } else {
        hiddenInput.setSelectionRange(clickedSlot, clickedSlot)
      }
      this.syncSlotsToDOM()
    })

    requestAnimationFrame(() => {
      if (!this._isDisabled && autoFocus) hiddenInput.focus()
      hiddenInput.setSelectionRange(0, 0)
      this.syncSlotsToDOM()
    })
  }

  // ── DOM sync ────────────────────────────────────────────────────────────────
  /**
   * Reconcile the shadow slot divs with the current core state using CSS class
   * toggles. Called after every user action (input, keydown, paste, focus, click).
   *
   * Uses `this.shadow.activeElement` instead of `document.activeElement` to
   * correctly detect focus within the shadow root across all browsers — the
   * document active element is the host `<digito-input>` element, not the
   * internal hidden input.
   */
  private syncSlotsToDOM(): void {
    if (!this.digito || !this.hiddenInput) return
    const { slotValues, activeSlot, hasError } = this.digito.state
    const focused = this.shadow.activeElement === this.hiddenInput

    this.slotEls.forEach((slotEl, i) => {
      const char     = slotValues[i] ?? ''
      const isActive = i === activeSlot && focused

      let textNode = slotEl.childNodes[1] as Text | undefined
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
        textNode = document.createTextNode('')
        slotEl.appendChild(textNode)
      }
      textNode.nodeValue = this._masked && char ? this._maskChar : char || this._placeholder

      slotEl.classList.toggle('is-active',   isActive && !this._isDisabled)
      slotEl.classList.toggle('is-filled',   !!char)
      slotEl.classList.toggle('is-masked',   this._masked)
      slotEl.classList.toggle('is-error',    hasError)
      slotEl.classList.toggle('is-success',  this._isSuccess)
      slotEl.classList.toggle('is-disabled', this._isDisabled)

      this.caretEls[i].style.display = isActive && !char && !this._isDisabled ? 'block' : 'none'
    })

    // Only update value when it actually differs — assigning the same string
    // resets selectionStart/End in some browsers, clobbering the cursor.
    const newValue = slotValues.join('')
    if (this.hiddenInput.value !== newValue) this.hiddenInput.value = newValue
  }

  /**
   * Apply or remove the disabled state directly on existing DOM nodes without
   * triggering a full rebuild. Used by both `build()` (initial disabled attr)
   * and `setDisabled()` (runtime toggle).
   */
  private applyDisabledDOM(value: boolean): void {
    if (this.hiddenInput) this.hiddenInput.disabled = value
    this.slotEls.forEach(s => s.classList.toggle('is-disabled', value))
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  /**
   * Wire all event listeners to the hidden input element.
   * Called once at the end of each `build()`. Because `build()` creates a fresh
   * `hiddenInput` element, there is no need to `removeEventListener` — the old
   * element is discarded and its listeners are garbage-collected with it.
   *
   * @param selectOnFocus  When `true`, focusing a filled slot selects its character.
   * @param blurOnComplete When `true`, blurs the input after the last slot is filled.
   */
  private attachEvents(selectOnFocus: boolean, blurOnComplete: boolean): void {
    const input   = this.hiddenInput!
    const digito  = this.digito!
    const length  = this._length
    const type    = this._type
    const pattern = this._pattern

    input.addEventListener('keydown', (e) => {
      if (this._isDisabled) return
      const pos = input.selectionStart ?? 0
      if (e.key === 'Backspace') {
        e.preventDefault()
        digito.deleteChar(pos)
        this.syncSlotsToDOM()
        this.dispatchChange()
        const next = digito.state.activeSlot
        requestAnimationFrame(() => input.setSelectionRange(next, next))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        digito.moveFocusLeft(pos)
        this.syncSlotsToDOM()
        requestAnimationFrame(() => input.setSelectionRange(digito.state.activeSlot, digito.state.activeSlot))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        digito.moveFocusRight(pos)
        this.syncSlotsToDOM()
        requestAnimationFrame(() => input.setSelectionRange(digito.state.activeSlot, digito.state.activeSlot))
      } else if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (pos === 0) return
          e.preventDefault()
          digito.moveFocusLeft(pos)
        } else {
          if (!digito.state.slotValues[pos]) return
          if (pos >= length - 1) return
          e.preventDefault()
          digito.moveFocusRight(pos)
        }
        this.syncSlotsToDOM()
        const next = digito.state.activeSlot
        requestAnimationFrame(() => input.setSelectionRange(next, next))
      }
    })

    input.addEventListener('input', () => {
      if (this._isDisabled) return
      const raw = input.value
      if (!raw) {
        digito.resetState()
        input.value = ''
        input.setSelectionRange(0, 0)
        this.syncSlotsToDOM()
        this.dispatchChange()
        return
      }
      const valid = filterString(raw, type, pattern).slice(0, length)
      digito.resetState()
      for (let i = 0; i < valid.length; i++) digito.inputChar(i, valid[i])
      const next = Math.min(valid.length, length - 1)
      input.value = valid
      input.setSelectionRange(next, next)
      digito.moveFocusTo(next)
      this.syncSlotsToDOM()
      this.dispatchChange()
      if (blurOnComplete && digito.state.isComplete) {
        requestAnimationFrame(() => input.blur())
      }
    })

    input.addEventListener('paste', (e) => {
      if (this._isDisabled) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      const pos  = input.selectionStart ?? 0
      digito.pasteString(pos, text)
      const { slotValues, activeSlot } = digito.state
      input.value = slotValues.join('')
      input.setSelectionRange(activeSlot, activeSlot)
      this.syncSlotsToDOM()
      this.dispatchChange()
      if (blurOnComplete && digito.state.isComplete) {
        requestAnimationFrame(() => input.blur())
      }
    })

    input.addEventListener('focus', () => {
      this._onFocus?.()
      requestAnimationFrame(() => {
        const pos  = digito.state.activeSlot
        const char = digito.state.slotValues[pos]
        if (selectOnFocus && char) {
          input.setSelectionRange(pos, pos + 1)
        } else {
          input.setSelectionRange(pos, pos)
        }
        this.syncSlotsToDOM()
      })
    })

    input.addEventListener('blur', () => {
      this._onBlur?.()
      this.slotEls.forEach(s => { s.classList.remove('is-active') })
      this.caretEls.forEach(c => { c.style.display = 'none' })
    })

  }

  /**
   * Dispatch a `change` CustomEvent carrying the current code string.
   * Fired after every input, paste, and backspace action.
   * `composed: true` lets the event cross the shadow root boundary so host-page
   * listeners registered with `el.addEventListener('change', ...)` receive it.
   */
  private dispatchChange(): void {
    this.dispatchEvent(new CustomEvent('change', {
      detail:   { code: this.digito?.getCode() ?? '' },
      bubbles:  true,
      composed: true,
    }))
  }

  // ── Public DOM API ──────────────────────────────────────────────────────────

  /** Clear all slots, reset the timer display, and re-focus the hidden input. */
  reset(): void {
    this._isSuccess = false
    this.digito?.resetState()
    if (this.hiddenInput) {
      this.hiddenInput.value = ''
      if (!this._isDisabled) this.hiddenInput.focus()
      this.hiddenInput.setSelectionRange(0, 0)
    }
    if (this.timerBadgeEl) this.timerBadgeEl.textContent = formatCountdown(this._timer)
    if (this.timerEl)      this.timerEl.style.display    = 'flex'
    if (this.resendEl)     this.resendEl.classList.remove('is-visible')
    this.resendCountdown?.stop()
    this.timerCtrl?.restart()
    this.syncSlotsToDOM()
  }

  /** Apply or clear the error state on all visual slots. */
  setError(isError: boolean): void {
    if (isError) this._isSuccess = false
    this.digito?.setError(isError)
    this.syncSlotsToDOM()
  }

  /** Apply or clear the success state on all visual slots. Stops the timer on success. */
  setSuccess(isSuccess: boolean): void {
    this._isSuccess = isSuccess
    if (isSuccess) {
      this.digito?.setError(false)
      this.timerCtrl?.stop()
      this.resendCountdown?.stop()
      if (this.timerEl)  this.timerEl.style.display  = 'none'
      if (this.resendEl) this.resendEl.style.display  = 'none'
    }
    this.syncSlotsToDOM()
  }

  /**
   * Enable or disable the input at runtime.
   * Equivalent to toggling the `disabled` HTML attribute but without triggering
   * a full rebuild. Re-enabling automatically restores focus to the active slot.
   */
  setDisabled(value: boolean): void {
    this._isDisabled = value
    this.digito?.setDisabled(value)
    this.applyDisabledDOM(value)
    this.syncSlotsToDOM()
    if (!value && this.hiddenInput) {
      requestAnimationFrame(() => {
        this.hiddenInput?.focus()
        this.hiddenInput?.setSelectionRange(this.digito?.state.activeSlot ?? 0, this.digito?.state.activeSlot ?? 0)
      })
    }
  }

  /** Returns the current code as a joined string (e.g. `"123456"`). */
  getCode(): string {
    return this.digito?.getCode() ?? ''
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('digito-input')) {
  customElements.define('digito-input', DigitoInput)
}

export { DigitoInput }
