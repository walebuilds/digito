/**
 * digito/vue
 * ─────────────────────────────────────────────────────────────────────────────
 * Vue 3 adapter — useOTP composable (single hidden-input architecture)
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  isRef,
  type Ref,
} from 'vue'

import {
  createDigito,
  createTimer,
  filterString,
  type DigitoOptions,
  type InputType,
} from '../core/index.js'


// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended options for the Vue useOTP composable.
 * Adds controlled-input, separator, and disabled support on top of DigitoOptions.
 */
export type VueOTPOptions = DigitoOptions & {
  /**
   * Controlled value — pre-fills and drives the slot state from outside the composable.
   *
   * Reactive mode (recommended): pass a Ref<string>. The composable watches it
   * via Vue's reactivity system — changes propagate automatically, making it
   * fully equivalent to React's controlled-input pattern.
   * ```ts
   * const code = ref('')
   * const otp = useOTP({ value: code, length: 6 })
   * // Clearing from parent:
   * code.value = ''
   * ```
   *
   * Static mode: pass a plain string to pre-fill slots once on creation.
   * Subsequent changes to the string will NOT be reactive (composables run
   * once during setup()). Use reset() or the Ref pattern for runtime updates.
   */
  value?: string | Ref<string>
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
   * character. The hidden input switches to `type="password"` via `hiddenInputAttrs`.
   *
   * `getCode()` and `onComplete` always return real characters.
   * Use for PIN entry or any sensitive input flow.
   *
   * Default: `false`.
   */
  masked?: boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Returned as a reactive `Ref<string>` so templates can bind to it directly.
   *
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   * @example maskChar: '*'
   */
  maskChar?: string
}

export type UseOTPResult = {
  /** Current value of each slot. Empty string = unfilled. */
  slotValues:       Ref<string[]>
  /** Index of the currently active slot. */
  activeSlot:       Ref<number>
  /** Computed joined code string. */
  value:            Ref<string>
  /** True when every slot is filled. */
  isComplete:       Ref<boolean>
  /** True when error state is active. */
  hasError:         Ref<boolean>
  /** True when the field is disabled. Mirrors the disabled option. */
  isDisabled:       Ref<boolean>
  /** Remaining timer seconds. */
  timerSeconds:     Ref<number>
  /** True while the hidden input has browser focus. */
  isFocused:        Ref<boolean>
  /** The separator slot index/indices for template rendering. */
  separatorAfter:   Ref<number | number[]>
  /** The separator character/string to render. */
  separator:        Ref<string>
  /**
   * Whether masked mode is enabled. When true, templates should display
   * `maskChar.value` instead of the real character. `getCode()` still returns real chars.
   */
  masked:           Ref<boolean>
  /**
   * The configured mask glyph. Use in templates instead of a hard-coded `●`:
   * `{{ masked.value && char ? maskChar.value : char }}`
   */
  maskChar:         Ref<string>
  /** The placeholder character for empty slots. Empty string when not set. */
  placeholder:      string
  /** Ref to bind to the hidden input element via :ref. */
  inputRef:         Ref<HTMLInputElement | null>
  /** Attribute object to spread onto the hidden input via v-bind. */
  hiddenInputAttrs: Ref<Record<string, unknown>>
  /** Spread onto the wrapper element to expose state as data attributes for CSS/Tailwind targeting. */
  wrapperAttrs:     Ref<Record<string, string | undefined>>
  /** Returns the current joined code string. */
  getCode:          () => string
  /** Clear all slots, restart timer, return focus to input. */
  reset:            () => void
  /** Apply or clear the error state. */
  setError:         (isError: boolean) => void
  /** Programmatically move focus to a slot index. */
  focus:            (slotIndex: number) => void
  /** Event handlers to bind on the hidden input. */
  onKeydown:        (e: KeyboardEvent) => void
  onChange:         (e: Event) => void
  onPaste:          (e: ClipboardEvent) => void
  onFocus:          () => void
  onBlur:           () => void
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vue 3 composable for OTP input — single hidden-input architecture.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useOTP } from 'digito/vue'
 * const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 * </script>
 *
 * <template>
 *   <div style="position:relative; display:inline-flex; gap:8px; align-items:center">
 *     <input
 *       :ref="(el) => otp.inputRef.value = el"
 *       v-bind="otp.hiddenInputAttrs.value"
 *       style="position:absolute;inset:0;opacity:0;z-index:1;cursor:text"
 *       @keydown="otp.onKeydown"
 *       @input="otp.onChange"
 *       @paste="otp.onPaste"
 *       @focus="otp.onFocus"
 *       @blur="otp.onBlur"
 *     />
 *     <template v-for="(char, i) in otp.slotValues.value" :key="i">
 *       <span v-if="otp.separatorAfter.value > 0 && i === otp.separatorAfter.value" aria-hidden="true">
 *         {{ otp.separator.value }}
 *       </span>
 *       <div :class="['slot',
 *         i === otp.activeSlot.value && otp.isFocused.value ? 'is-active'   : '',
 *         char                                              ? 'is-filled'   : '',
 *         otp.hasError.value                               ? 'is-error'    : '',
 *         otp.isComplete.value && !otp.hasError.value      ? 'is-success'  : '',
 *         otp.isDisabled.value                             ? 'is-disabled' : '',
 *       ]">{{ char }}</div>
 *     </template>
 *   </div>
 * </template>
 * ```
 */
export function useOTP(options: VueOTPOptions = {}): UseOTPResult {
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

  // ── Reactive state ─────────────────────────────────────────────────────────
  const slotValues   = ref<string[]>(Array(length).fill(''))
  const activeSlot   = ref(0)
  const isComplete   = ref(false)
  const hasError     = ref(false)
  const isDisabled   = ref(initialDisabled)
  const timerSeconds = ref(timerSecs)
  const isFocused    = ref(false)
  const inputRef     = ref<HTMLInputElement | null>(null)
  const separatorAfter = ref<number | number[]>(separatorAfterOpt)
  const separator      = ref(separatorOpt)
  const masked         = ref(maskedOpt)
  const maskChar       = ref(maskCharOpt)

  const value = computed(() => slotValues.value.join(''))

  const hiddenInputAttrs = computed<Record<string, unknown>>(() => ({
    type:           masked.value ? 'password' : 'text',
    inputmode:      type === 'numeric' ? 'numeric' : 'text',
    autocomplete:   'one-time-code',
    maxlength:      length,
    disabled:       isDisabled.value,
    ...(nameOpt      ? { name: nameOpt }          : {}),
    ...(autoFocusOpt ? { autofocus: true }         : {}),
    'aria-label':   `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`,
    spellcheck:     'false',
    autocorrect:    'off',
    autocapitalize: 'off',
    ...(readOnlyOpt ? { 'aria-readonly': 'true' } : {}),
  }))

  const wrapperAttrs = computed<Record<string, string | undefined>>(() => ({
    ...(isComplete.value ? { 'data-complete': '' } : {}),
    ...(hasError.value   ? { 'data-invalid':  '' } : {}),
    ...(isDisabled.value ? { 'data-disabled': '' } : {}),
    ...(readOnlyOpt      ? { 'data-readonly': '' } : {}),
  }))

  // ── sync() ─────────────────────────────────────────────────────────────────
  function sync(suppressOnChange = false): void {
    const s          = digito.state
    slotValues.value = [...s.slotValues]
    activeSlot.value = s.activeSlot
    isComplete.value = s.isComplete
    hasError.value   = s.hasError
    if (!suppressOnChange) {
      onChangeProp?.(s.slotValues.join(''))
    }
  }

  // ── Controlled value sync ──────────────────────────────────────────────────
  // When value is a Ref<string>, watch it reactively so parent changes
  // propagate automatically. When it's a plain string, the arrow-function
  // source returns a constant — watch fires once via { immediate: true }
  // and never again (documented static-pre-fill behaviour).
  if (controlledValue !== undefined) {
    const watchSource = isRef(controlledValue)
      ? controlledValue
      : () => controlledValue as string

    watch(
      watchSource,
      (incoming: string) => {
        const filtered = filterString(incoming.slice(0, length), type, pattern)
        const current  = digito.state.slotValues.join('')
        if (filtered === current) return

        digito.resetState()
        for (let i = 0; i < filtered.length; i++) {
          digito.inputChar(i, filtered[i])
        }
        sync(true)
        if (inputRef.value) {
          inputRef.value.value = filtered
          inputRef.value.setSelectionRange(filtered.length, filtered.length)
        }
        onChangeProp?.(filtered)
      },
      { immediate: true }
    )
  }

  // ── Timer ──────────────────────────────────────────────────────────────────
  let timerControls: ReturnType<typeof createTimer> | null = null

  onMounted(() => {
    if (controlledValue === undefined && defaultValue) {
      const filtered = filterString(defaultValue.slice(0, length), type, pattern)
      if (filtered) {
        for (let i = 0; i < filtered.length; i++) digito.inputChar(i, filtered[i])
        digito.cancelPendingComplete()
        sync(true)
        if (inputRef.value) { inputRef.value.value = filtered; inputRef.value.setSelectionRange(filtered.length, filtered.length) }
      }
    }
    if (autoFocusOpt && !initialDisabled && inputRef.value) {
      inputRef.value.focus()
      inputRef.value.setSelectionRange(0, 0)
    }
    if (!timerSecs) return
    timerControls = createTimer({
      totalSeconds: timerSecs,
      onTick:   (r) => { timerSeconds.value = r },
      onExpire: () => { timerSeconds.value = 0; onExpire?.() },
    })
    timerControls.start()
  })

  onUnmounted(() => timerControls?.stop())

  // ── Event handlers ─────────────────────────────────────────────────────────

  function onKeydown(e: KeyboardEvent): void {
    if (isDisabled.value) return
    const pos = inputRef.value?.selectionStart ?? 0
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (readOnlyOpt) return
      digito.deleteChar(pos)
      sync()
      const next = digito.state.activeSlot
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
    } else if (e.key === 'Delete') {
      e.preventDefault()
      if (readOnlyOpt) return
      digito.clearSlot(pos)
      sync()
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(pos, pos))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      digito.moveFocusLeft(pos)
      sync()
      const next = digito.state.activeSlot
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      digito.moveFocusRight(pos)
      sync()
      const next = digito.state.activeSlot
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
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
      requestAnimationFrame(() => inputRef.value?.setSelectionRange(next, next))
    }
  }

  function onChange(e: Event): void {
    if (isDisabled.value || readOnlyOpt) return
    const raw = (e.target as HTMLInputElement).value
    if (!raw) {
      digito.resetState()
      if (inputRef.value) { inputRef.value.value = ''; inputRef.value.setSelectionRange(0, 0) }
      sync()
      return
    }
    const valid = filterString(raw, type, pattern).slice(0, length)
    digito.resetState()
    for (let i = 0; i < valid.length; i++) digito.inputChar(i, valid[i])
    const next = Math.min(valid.length, length - 1)
    if (inputRef.value) { inputRef.value.value = valid; inputRef.value.setSelectionRange(next, next) }
    digito.moveFocusTo(next)
    sync()
    if (blurOnCompleteOpt && digito.state.isComplete) {
      requestAnimationFrame(() => inputRef.value?.blur())
    }
  }

  function onPaste(e: ClipboardEvent): void {
    if (isDisabled.value || readOnlyOpt) return
    e.preventDefault()
    const text = e.clipboardData?.getData('text') ?? ''
    const pos  = inputRef.value?.selectionStart ?? 0
    digito.pasteString(pos, text)
    const { slotValues: sv, activeSlot: as } = digito.state
    if (inputRef.value) { inputRef.value.value = sv.join(''); inputRef.value.setSelectionRange(as, as) }
    sync()
    if (blurOnCompleteOpt && digito.state.isComplete) {
      requestAnimationFrame(() => inputRef.value?.blur())
    }
  }

  function onFocus(): void {
    isFocused.value = true
    onFocusProp?.()
    const pos = digito.state.activeSlot
    requestAnimationFrame(() => {
      const char = digito.state.slotValues[pos]
      if (selectOnFocusOpt && char) {
        inputRef.value?.setSelectionRange(pos, pos + 1)
      } else {
        inputRef.value?.setSelectionRange(pos, pos)
      }
    })
  }

  function onBlur(): void {
    isFocused.value = false
    onBlurProp?.()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function reset(): void {
    digito.resetState()
    if (inputRef.value) { inputRef.value.value = ''; inputRef.value.focus(); inputRef.value.setSelectionRange(0, 0) }
    timerSeconds.value = timerSecs
    timerControls?.restart()
    sync()
  }

  function setError(isError: boolean): void {
    digito.setError(isError)
    sync(true)
  }

  function focus(slotIndex: number): void {
    digito.moveFocusTo(slotIndex)
    inputRef.value?.focus()
    requestAnimationFrame(() => inputRef.value?.setSelectionRange(slotIndex, slotIndex))
    sync(true)
  }

  function getCode(): string {
    return digito.getCode()
  }

  return {
    slotValues,
    activeSlot,
    value,
    isComplete,
    hasError,
    isDisabled,
    timerSeconds,
    isFocused,
    separatorAfter,
    separator,
    masked,
    maskChar,
    placeholder:    placeholderOpt,
    inputRef,
    hiddenInputAttrs,
    wrapperAttrs,
    getCode,
    reset,
    setError,
    focus,
    onKeydown,
    onChange,
    onPaste,
    onFocus,
    onBlur,
  }
}
