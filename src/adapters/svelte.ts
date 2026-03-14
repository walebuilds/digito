/**
 * digito/svelte
 * ─────────────────────────────────────────────────────────────────────────────
 * Svelte adapter — useOTP store + action (single hidden-input architecture)
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import { writable, derived, get } from 'svelte/store'

import {
  createDigito,
  createTimer,
  filterString,
  type DigitoOptions,
  type DigitoState,
  type InputType,
} from '../core/index.js'


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended options for the Svelte useOTP composable.
 * Adds controlled-input, separator, and disabled support on top of DigitoOptions.
 */
export type SvelteOTPOptions = DigitoOptions & {
  /**
   * Controlled value — drives the slot state from outside the composable.
   * Pass a string of up to length characters to pre-fill or sync the field.
   */
  value?: string
  /**
   * Fires exactly ONCE per user interaction with the current joined code string.
   * Receives partial values too — not just when the code is complete.
   */
  onChange?: (code: string) => void
  /**
   * Insert a purely visual separator after this slot index (0-based).
   * Accepts a single position or an array for multiple separators.
   * aria-hidden, never part of the value, no effect on the state machine.
   * Default: 0 (no separator).
   * @example separatorAfter: 3      ->  [*][*][*] — [*][*][*]
   * @example separatorAfter: [2, 4] ->  [*][*] — [*][*] — [*][*]
   */
  separatorAfter?: number | number[]
  /**
   * The character or string to render as the separator.
   * Default: '—'
   */
  separator?: string
  /**
   * When `true`, slot templates should display a mask glyph instead of the real
   * character. The hidden input switches to `type="password"` via the action.
   *
   * `getCode()` and `onComplete` always return real characters.
   * Use for PIN entry or any sensitive input flow.
   *
   * Default: `false`.
   */
  masked?: boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Returned as a `writable` store so Svelte templates can subscribe to it.
   *
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   * @example maskChar: '*'
   */
  maskChar?: string
}

export type UseOTPResult = {
  /** Subscribe to the full state store. */
  subscribe:      ReturnType<typeof writable>['subscribe']
  /** Derived — joined code string. */
  value:          ReturnType<typeof derived>
  /** Derived — completion boolean. */
  isComplete:     ReturnType<typeof derived>
  /** Derived — error boolean. */
  hasError:       ReturnType<typeof derived>
  /** Derived — active slot index. */
  activeSlot:     ReturnType<typeof derived>
  /** Remaining timer seconds store. */
  timerSeconds:   ReturnType<typeof writable>
  /** Whether the field is currently disabled. */
  isDisabled:     ReturnType<typeof writable>
  /** The separator slot index store. -1 = no separator. */
  separatorAfter: ReturnType<typeof writable>
  /** The separator character store. */
  separator:      ReturnType<typeof writable>
  /** Whether masked mode is active. When true, templates should render `maskChar` instead of char. */
  masked:         ReturnType<typeof writable>
  /**
   * The configured mask glyph store. Use in templates instead of a hard-coded `●`:
   * `{$otp.masked && char ? $otp.maskChar : char}`
   */
  maskChar:       ReturnType<typeof writable>
  /** The placeholder character for empty slots. Empty string when not set. */
  placeholder:    string
  /** Plain object to spread onto the wrapper element as data attributes for CSS/Tailwind targeting. */
  wrapperAttrs:   Record<string, string>
  /** Svelte action to bind to the single hidden input. */
  action:         (node: HTMLInputElement) => { destroy: () => void }
  /** Returns the current joined code string. */
  getCode:        () => string
  /** Clear all slots, restart timer, return focus to input. */
  reset:          () => void
  /** Apply or clear the error state. */
  setError:       (isError: boolean) => void
  /** Enable or disable the field at runtime. */
  setDisabled:    (value: boolean) => void
  /** Programmatically move focus to a slot index. */
  focus:          (slotIndex: number) => void
  /**
   * Programmatically set the field value without triggering `onComplete`.
   * Pass `undefined` to no-op. Filters the incoming string through the current
   * `type`/`pattern` before distribution, identical to controlled-value sync.
   */
  setValue:       (v: string | undefined) => void
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Svelte composable for OTP input — single hidden-input architecture.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useOTP } from 'digito/svelte'
 *   const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *   $: state = $otp
 * </script>
 *
 * <div style="position:relative; display:inline-flex; gap:8px; align-items:center">
 *   <input
 *     use:otp.action
 *     style="position:absolute;inset:0;opacity:0;z-index:1;cursor:text"
 *   />
 *   {#each state.slotValues as char, i}
 *     {#if $otp.separatorAfter > 0 && i === $otp.separatorAfter}
 *       <span aria-hidden="true">{$otp.separator}</span>
 *     {/if}
 *     <div class="slot"
 *       class:is-active={i === state.activeSlot}
 *       class:is-filled={!!char}
 *       class:is-error={state.hasError}
 *       class:is-disabled={$otp.isDisabled}
 *     >{char}</div>
 *   {/each}
 * </div>
 * ```
 */
export function useOTP(options: SvelteOTPOptions = {}): UseOTPResult {
  const {
    length             = 6,
    type               = 'numeric' as InputType,
    timer:             timerSecs = 0,
    disabled:          initialDisabled = false,
    onComplete,
    onExpire,
    onResend,
    haptic             = true,
    sound              = false,
    pattern,
    pasteTransformer,
    onInvalidChar,
    value:             controlledValue,
    defaultValue,
    readOnly:          readOnlyOpt = false,
    onChange:          onChangeProp,
    onFocus:           onFocusProp,
    onBlur:            onBlurProp,
    separatorAfter:    separatorAfterOpt = 0,
    separator:         separatorOpt = '—',
    masked:            maskedOpt = false,
    maskChar:          maskCharOpt = '\u25CF',
    autoFocus:         autoFocusOpt = true,
    name:              nameOpt,
    placeholder:       placeholderOpt = '',
    selectOnFocus:     selectOnFocusOpt = false,
    blurOnComplete:    blurOnCompleteOpt = false,
  } = options

  // ── Core instance ──────────────────────────────────────────────────────────
  const digito = createDigito({ length, type, pattern, pasteTransformer, onInvalidChar, onComplete, onExpire, onResend, haptic, sound, readOnly: readOnlyOpt })

  // ── Stores ─────────────────────────────────────────────────────────────────
  const store               = writable(digito.state)
  const timerStore          = writable(timerSecs)
  const isDisabledStore     = writable(initialDisabled)
  const separatorAfterStore = writable(separatorAfterOpt)
  const separatorStore      = writable(separatorOpt)
  const maskedStore         = writable(maskedOpt)
  const maskCharStore       = writable(maskCharOpt)

  let inputEl: HTMLInputElement | null = null

  // ── sync() ─────────────────────────────────────────────────────────────────
  function sync(suppressOnChange = false): void {
    const s = digito.state
    store.set({ ...s })
    if (!suppressOnChange) {
      onChangeProp?.(s.slotValues.join(''))
    }
  }

  // ── Controlled value sync ──────────────────────────────────────────────────
  function setValue(incoming: string | undefined): void {
    if (incoming === undefined) return
    const filtered = filterString(incoming.slice(0, length), type, pattern)
    const current  = digito.state.slotValues.join('')
    if (filtered === current) return

    digito.resetState()
    for (let i = 0; i < filtered.length; i++) {
      digito.inputChar(i, filtered[i])
    }
    // Prevent a programmatic fill from triggering onComplete as if the user
    // had typed the code. cancelPendingComplete cancels the 10ms deferred
    // callback scheduled by the final inputChar above.
    digito.cancelPendingComplete()
    sync(true)
    if (inputEl) {
      inputEl.value = filtered
      inputEl.setSelectionRange(filtered.length, filtered.length)
    }
    onChangeProp?.(filtered)
  }

  if (controlledValue !== undefined) {
    setValue(controlledValue)
  } else if (defaultValue) {
    // Apply defaultValue once — no onComplete, no onChange
    const filtered = filterString(defaultValue.slice(0, length), type, pattern)
    if (filtered) {
      for (let i = 0; i < filtered.length; i++) digito.inputChar(i, filtered[i])
      digito.cancelPendingComplete()
      sync(true)
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  let timerControls: ReturnType<typeof createTimer> | null = null

  if (timerSecs > 0) {
    timerControls = createTimer({
      totalSeconds: timerSecs,
      onTick:   (r) => timerStore.set(r),
      onExpire: () => { timerStore.set(0); onExpire?.() },
    })
  }

  // ── Svelte Action ──────────────────────────────────────────────────────────
  function action(node: HTMLInputElement): { destroy: () => void } {
    inputEl = node

    node.type           = maskedOpt ? 'password' : 'text'
    node.inputMode      = type === 'numeric' ? 'numeric' : 'text'
    node.autocomplete   = 'one-time-code'
    node.maxLength      = length
    node.disabled       = get(isDisabledStore)
    node.spellcheck     = false
    if (nameOpt) node.name = nameOpt
    node.setAttribute('aria-label',      `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`)
    node.setAttribute('autocorrect',     'off')
    node.setAttribute('autocapitalize',  'off')
    if (readOnlyOpt) node.setAttribute('aria-readonly', 'true')

    const unsubDisabled = isDisabledStore.subscribe((v: boolean) => { node.disabled = v })

    function onKeydown(e: KeyboardEvent): void {
      if (get(isDisabledStore)) return
      const pos = node.selectionStart ?? 0
      if (e.key === 'Backspace') {
        e.preventDefault()
        if (readOnlyOpt) return
        digito.deleteChar(pos)
        sync()
        const next = digito.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
      } else if (e.key === 'Delete') {
        e.preventDefault()
        if (readOnlyOpt) return
        digito.clearSlot(pos)
        sync()
        requestAnimationFrame(() => node.setSelectionRange(pos, pos))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        digito.moveFocusLeft(pos)
        sync()
        const next = digito.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        digito.moveFocusRight(pos)
        sync()
        const next = digito.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
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
        sync()
        const next = digito.state.activeSlot
        requestAnimationFrame(() => node.setSelectionRange(next, next))
      }
    }

    function onChange(e: Event): void {
      if (get(isDisabledStore) || readOnlyOpt) return
      const raw = (e.target as HTMLInputElement).value
      if (!raw) {
        digito.resetState()
        node.value = ''
        node.setSelectionRange(0, 0)
        sync()
        return
      }
      const valid = filterString(raw, type, pattern).slice(0, length)
      digito.resetState()
      for (let i = 0; i < valid.length; i++) digito.inputChar(i, valid[i])
      const next = Math.min(valid.length, length - 1)
      node.value = valid
      node.setSelectionRange(next, next)
      digito.moveFocusTo(next)
      sync()
      if (blurOnCompleteOpt && digito.state.isComplete) {
        requestAnimationFrame(() => node.blur())
      }
    }

    function onPaste(e: ClipboardEvent): void {
      if (get(isDisabledStore) || readOnlyOpt) return
      e.preventDefault()
      const text = e.clipboardData?.getData('text') ?? ''
      const pos  = node.selectionStart ?? 0
      digito.pasteString(pos, text)
      const { slotValues, activeSlot } = digito.state
      node.value = slotValues.join('')
      node.setSelectionRange(activeSlot, activeSlot)
      sync()
      if (blurOnCompleteOpt && digito.state.isComplete) {
        requestAnimationFrame(() => node.blur())
      }
    }

    function onFocus(): void {
      onFocusProp?.()
      const pos = digito.state.activeSlot
      requestAnimationFrame(() => {
        const char = digito.state.slotValues[pos]
        if (selectOnFocusOpt && char) {
          node.setSelectionRange(pos, pos + 1)
        } else {
          node.setSelectionRange(pos, pos)
        }
      })
    }

    function onBlur(): void {
      onBlurProp?.()
    }

    node.addEventListener('keydown', onKeydown)
    node.addEventListener('input',   onChange)
    node.addEventListener('paste',   onPaste)
    node.addEventListener('focus',   onFocus)
    node.addEventListener('blur',    onBlur)

    if (autoFocusOpt && !get(isDisabledStore)) {
      requestAnimationFrame(() => node.focus())
    }

    // Start timer now that the component is mounted and the input element is
    // available — matching Vue's onMounted pattern.
    timerControls?.start()

    return {
      destroy() {
        node.removeEventListener('keydown', onKeydown)
        node.removeEventListener('input',   onChange)
        node.removeEventListener('paste',   onPaste)
        node.removeEventListener('focus',   onFocus)
        node.removeEventListener('blur',    onBlur)
        unsubDisabled()
        timerControls?.stop()
        inputEl = null
      },
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset(): void {
    digito.resetState()
    if (inputEl) { inputEl.value = ''; inputEl.focus(); inputEl.setSelectionRange(0, 0) }
    timerStore.set(timerSecs)
    timerControls?.restart()
    sync()
  }

  function setError(isError: boolean): void {
    digito.setError(isError)
    sync(true)
  }

  function setDisabled(value: boolean): void {
    isDisabledStore.set(value)
    digito.setDisabled(value)
  }

  function focus(slotIndex: number): void {
    digito.moveFocusTo(slotIndex)
    inputEl?.focus()
    requestAnimationFrame(() => inputEl?.setSelectionRange(slotIndex, slotIndex))
    sync(true)
  }

  function getCode(): string {
    return digito.getCode()
  }

  // Derived stores
  const value      = derived(store, ($s: DigitoState) => $s.slotValues.join(''))
  const isComplete = derived(store, ($s: DigitoState) => $s.isComplete)
  const hasError   = derived(store, ($s: DigitoState) => $s.hasError)
  const activeSlot = derived(store, ($s: DigitoState) => $s.activeSlot)

  // Derived wrapper data attributes for CSS/Tailwind targeting
  const wrapperAttrs = derived(
    [store, isDisabledStore],
    ([$s, $dis]: [typeof $s, boolean]) => ({
      ...($s.isComplete ? { 'data-complete': '' } : {}),
      ...($s.hasError   ? { 'data-invalid':  '' } : {}),
      ...($dis          ? { 'data-disabled': '' } : {}),
      ...(readOnlyOpt   ? { 'data-readonly': '' } : {}),
    })
  )

  return {
    subscribe:      store.subscribe,
    value,
    isComplete,
    hasError,
    activeSlot,
    timerSeconds:   timerStore,
    isDisabled:     isDisabledStore,
    separatorAfter: separatorAfterStore,
    separator:      separatorStore,
    masked:         maskedStore,
    maskChar:       maskCharStore,
    placeholder:    placeholderOpt,
    wrapperAttrs,
    action,
    getCode,
    reset,
    setError,
    setDisabled,
    setValue,
    focus,
  }
}
