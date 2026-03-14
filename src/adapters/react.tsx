/**
 * digito/react
 * ─────────────────────────────────────────────────────────────────────────────
 * React adapter — useOTP hook + HiddenOTPInput component (single hidden-input architecture)
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
} from 'react'

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
 * Extended options for the React useOTP hook.
 * Adds controlled-input, separator, and disabled support on top of DigitoOptions.
 *
 * Controlled pattern (react-hook-form compatible):
 *   Pass value + onChange together. onChange fires exactly once per user
 *   interaction with the current joined code string (partial or complete).
 *
 * @example — uncontrolled (most common)
 *   const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *
 * @example — controlled / react-hook-form
 *   const { control } = useForm()
 *   <Controller name="otp" control={control} render={({ field }) => (
 *     <OTPInput value={field.value} onChange={field.onChange} length={6} />
 *   )} />
 *
 * @example — disabled during async verification
 *   const otp = useOTP({ length: 6, disabled: isVerifying })
 */
export type ReactOTPOptions = DigitoOptions & {
  /**
   * Controlled value — drives the slot state from outside the hook.
   * Pass a string of up to length characters to pre-fill or sync the field.
   * Compatible with react-hook-form via <Controller>.
   */
  value?: string
  /**
   * Uncontrolled initial value. Applied once on mount when `value` is undefined.
   * Does not trigger `onComplete` or `onChange`.
   */
  defaultValue?: string
  /** When `true`, mutations are blocked; focus/navigation/copy remain allowed. */
  readOnly?: boolean
  /**
   * Fires exactly ONCE per user interaction with the current joined code string.
   * Receives partial values too — not just when the code is complete.
   * Use alongside value for a fully controlled pattern.
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
   * When `true`, each filled slot should display a mask glyph instead of the
   * real character. The hidden input switches to `type="password"` for correct
   * mobile keyboard and browser autocomplete behavior.
   *
   * `getCode()` and `onComplete` always return real characters — masking is visual only.
   * Use for PIN entry or any sensitive input flow.
   *
   * Default: `false`.
   */
  masked?: boolean
  /**
   * The glyph displayed in filled slots when `masked` is `true`.
   * Passed through `SlotRenderProps.maskChar` so headless slot components can
   * render the correct character without needing to re-read the option.
   *
   * Default: `'●'` (U+25CF BLACK CIRCLE).
   * @example maskChar: '*'
   */
  maskChar?: string
}

/**
 * Per-slot render props returned by getSlotProps(index).
 * Spread onto a custom slot component for full structural control.
 *
 * @example
 * ```tsx
 * function MySlot(props: SlotRenderProps) {
 *   return (
 *     <div className={['slot', props.isActive ? 'active' : ''].join(' ')}>
 *       {props.hasFakeCaret && <span className="caret" />}
 *       {props.char || <span className="placeholder">·</span>}
 *     </div>
 *   )
 * }
 *
 * // In JSX:
 * {otp.slotValues.map((_, i) => <MySlot key={i} {...otp.getSlotProps(i)} />)}
 * ```
 */
export type SlotRenderProps = {
  /** The character value of this slot. Empty string when unfilled. */
  char:         string
  /** Zero-based slot index. */
  index:        number
  /** Whether this slot is the active/focused slot. */
  isActive:     boolean
  /** Whether this slot contains a character. */
  isFilled:     boolean
  /** Whether the field is in error state. */
  isError:      boolean
  /** Whether all slots are filled. */
  isComplete:   boolean
  /** Whether the field is disabled. */
  isDisabled:   boolean
  /** Whether the hidden input currently has browser focus. */
  isFocused:    boolean
  /**
   * True when this slot is active, empty, and the hidden input has focus —
   * i.e. the fake blinking caret should be rendered in this slot.
   * Equivalent to: isActive && !isFilled && isFocused
   */
  hasFakeCaret: boolean
  /**
   * True when the `masked` option is enabled.
   * When true, render `maskChar` instead of `char` for filled slots.
   * `char` always holds the real character regardless of this flag.
   */
  masked: boolean
  /**
   * The configured mask glyph (from the `maskChar` option).
   * Render this instead of `char` when `masked && isFilled`.
   * @example {props.masked && props.isFilled ? props.maskChar : props.char}
   */
  maskChar: string
  /**
   * The placeholder character for empty slots (from the `placeholder` option).
   * Render this when `!isFilled` to show a hint glyph such as `'○'` or `'_'`.
   * Empty string when the option is not set.
   */
  placeholder: string
}

/** Props to spread onto the single hidden input element. */
export type HiddenInputProps = {
  ref:             RefObject<HTMLInputElement>
  type:            'text' | 'password'
  inputMode:       'numeric' | 'text'
  autoComplete:    'one-time-code'
  maxLength:       number
  disabled:        boolean
  /** The `name` attribute for native form submission / FormData. */
  name?:           string
  /** Whether the input auto-focuses on mount. */
  autoFocus?:      boolean
  'aria-label':    string
  spellCheck:      false
  autoCorrect:     'off'
  autoCapitalize:  'off'
  onKeyDown:       (e: KeyboardEvent<HTMLInputElement>) => void
  onChange:        (e: ChangeEvent<HTMLInputElement>) => void
  onPaste:         (e: ClipboardEvent<HTMLInputElement>) => void
  onFocus:         () => void
  onBlur:          () => void
}

export type UseOTPResult = {
  /** Current value of each slot. Empty string = unfilled. */
  slotValues:       string[]
  /** Index of the currently active slot. */
  activeSlot:       number
  /** True when every slot is filled. */
  isComplete:       boolean
  /** True when error state is active. */
  hasError:         boolean
  /** True when the field is disabled. Mirrors the disabled option. */
  isDisabled:       boolean
  /** Remaining timer seconds. 0 when expired or no timer configured. */
  timerSeconds:     number
  /** True while the hidden input has browser focus. */
  isFocused:        boolean
  /** Returns the current joined code string. */
  getCode:          () => string
  /** Clear all slots, restart timer, return focus to input. */
  reset:            () => void
  /** Apply or clear the error state. */
  setError:         (isError: boolean) => void
  /** Programmatically move focus to a specific slot index. */
  focus:            (slotIndex: number) => void
  /** Spread onto the wrapper element to expose state as data attributes for CSS targeting. */
  wrapperProps: Record<string, string | undefined>
  /**
   * The separator slot index/indices for JSX rendering.
   * Insert a visual divider AFTER each position. `0` / empty array = no separator.
   */
  separatorAfter:   number | number[]
  /** The separator character/string to render. */
  separator:        string
  /** Spread onto the single hidden input element. */
  hiddenInputProps: HiddenInputProps
  /**
   * Returns render props for a single slot — spread onto a custom slot component
   * for full structural control over the slot markup.
   * @example
   * ```tsx
   * {otp.slotValues.map((_, i) => <MySlot key={i} {...otp.getSlotProps(i)} />)}
   * ```
   */
  getSlotProps:     (index: number) => SlotRenderProps
}


// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook for OTP input — single hidden-input architecture.
 *
 * You render the visual slot divs; the hook handles all state, focus, and events.
 *
 * @example
 * ```tsx
 * const otp = useOTP({ length: 6, onComplete: (code) => verify(code) })
 *
 * <div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
 *   <HiddenOTPInput {...otp.hiddenInputProps} />
 *   {otp.slotValues.map((_, i) => (
 *     <MySlot key={i} {...otp.getSlotProps(i)} />
 *   ))}
 * </div>
 * ```
 */
export function useOTP(options: ReactOTPOptions = {}): UseOTPResult {
  const {
    length           = 6,
    type             = 'numeric' as InputType,
    timer:           timerSecs = 0,
    disabled         = false,
    onComplete,
    onExpire,
    onResend,
    haptic           = true,
    sound            = false,
    pattern,
    pasteTransformer,
    onInvalidChar,
    value:           controlledValue,
    defaultValue,
    readOnly:        readOnlyProp = false,
    onChange:        onChangeProp,
    onFocus:         onFocusProp,
    onBlur:          onBlurProp,
    separatorAfter   = 0,
    separator        = '—',
    masked           = false,
    maskChar         = '\u25CF',
    autoFocus        = true,
    name:            inputName,
    placeholder      = '',
    selectOnFocus    = false,
    blurOnComplete   = false,
  } = options

  // ── Stable callback refs ───────────────────────────────────────────────────
  const onCompleteRef       = useRef(onComplete)
  const onExpireRef         = useRef(onExpire)
  const onResendRef         = useRef(onResend)
  const onChangeRef         = useRef(onChangeProp)
  const onFocusRef          = useRef(onFocusProp)
  const onBlurRef           = useRef(onBlurProp)
  const onInvalidCharRef    = useRef(onInvalidChar)
  // Keep pattern and pasteTransformer in refs so callbacks always use the latest
  // value without needing to be recreated on every render.
  const patternRef          = useRef(pattern)
  const pasteTransformerRef = useRef(pasteTransformer)
  useEffect(() => { onCompleteRef.current       = onComplete       }, [onComplete])
  useEffect(() => { onExpireRef.current         = onExpire         }, [onExpire])
  useEffect(() => { onResendRef.current         = onResend         }, [onResend])
  useEffect(() => { onChangeRef.current         = onChangeProp     }, [onChangeProp])
  useEffect(() => { onFocusRef.current          = onFocusProp      }, [onFocusProp])
  useEffect(() => { onBlurRef.current           = onBlurProp       }, [onBlurProp])
  useEffect(() => { onInvalidCharRef.current    = onInvalidChar    }, [onInvalidChar])
  useEffect(() => { patternRef.current          = pattern          }, [pattern])
  useEffect(() => { pasteTransformerRef.current = pasteTransformer }, [pasteTransformer])

  // ── Core instance ──────────────────────────────────────────────────────────
  const digitoRef = useRef(
    createDigito({
      length, type, haptic, sound, pattern, pasteTransformer,
      readOnly:      readOnlyProp,
      onComplete:    (code) => onCompleteRef.current?.(code),
      onExpire:      ()     => onExpireRef.current?.(),
      onResend:      ()     => onResendRef.current?.(),
      onInvalidChar: (char, index) => onInvalidCharRef.current?.(char, index),
    })
  )
  const digito = digitoRef.current

  // ── Disabled / readOnly refs ────────────────────────────────────────────────
  // Stored in refs so memoized callbacks (useCallback with [] deps) always read
  // the latest value without needing to be recreated on every render.
  const disabledRef  = useRef(disabled)
  const readOnlyRef  = useRef(readOnlyProp)
  useEffect(() => { disabledRef.current = disabled    }, [disabled])
  useEffect(() => { readOnlyRef.current = readOnlyProp }, [readOnlyProp])

  // ── State ──────────────────────────────────────────────────────────────────
  const [state, setState]               = useState<DigitoState>(digito.state)
  const [timerSeconds, setTimer]        = useState(timerSecs)
  const [timerTrigger, setTimerTrigger] = useState(0)
  const [isFocused, setIsFocused]       = useState(false)
  const inputRef                        = useRef<HTMLInputElement>(null)

  // ── sync() ─────────────────────────────────────────────────────────────────
  function sync(suppressOnChange = false): void {
    const next = { ...digito.state }
    setState(next)
    if (!suppressOnChange) {
      onChangeRef.current?.(next.slotValues.join(''))
    }
  }

  // ── Controlled value sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (controlledValue === undefined) return

    const incoming = filterString(controlledValue.slice(0, length), type, pattern)
    const current  = digito.state.slotValues.join('')

    if (incoming === current) return

    digito.resetState()
    for (let i = 0; i < incoming.length; i++) {
      digito.inputChar(i, incoming[i])
    }

    digito.cancelPendingComplete()

    setState({ ...digito.state })

    if (inputRef.current) {
      inputRef.current.value = incoming
      inputRef.current.setSelectionRange(incoming.length, incoming.length)
    }

    onChangeRef.current?.(incoming)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue, length])

  // ── defaultValue — applied once on mount when no controlled value is present ─
  useEffect(() => {
    if (controlledValue !== undefined || !defaultValue) return
    const filtered = filterString(defaultValue.slice(0, length), type, pattern)
    if (!filtered) return
    digito.resetState()
    for (let i = 0; i < filtered.length; i++) digito.inputChar(i, filtered[i])
    digito.cancelPendingComplete()
    setState({ ...digito.state })
    if (inputRef.current) { inputRef.current.value = filtered; inputRef.current.setSelectionRange(filtered.length, filtered.length) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerSecs) return
    setTimer(timerSecs)
    const t = createTimer({
      totalSeconds: timerSecs,
      onTick:   (r) => setTimer(r),
      onExpire: ()  => { setTimer(0); onExpireRef.current?.() },
    })
    t.start()
    return () => t.stop()
  }, [timerSecs, timerTrigger])

  // ── Event handlers ─────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (disabledRef.current) return
    const pos = inputRef.current?.selectionStart ?? 0
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (readOnlyRef.current) return
      digito.deleteChar(pos)
      sync()
      const next = digito.state.activeSlot
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))
    } else if (e.key === 'Delete') {
      e.preventDefault()
      if (readOnlyRef.current) return
      digito.clearSlot(pos)
      sync()
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      digito.moveFocusLeft(pos)
      sync()
      const next = digito.state.activeSlot
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      digito.moveFocusRight(pos)
      sync()
      const next = digito.state.activeSlot
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))
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
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(next, next))
    }
  }, [])

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (disabledRef.current || readOnlyRef.current) return
    const raw = e.target.value
    if (!raw) {
      digito.resetState()
      if (inputRef.current) { inputRef.current.value = ''; inputRef.current.setSelectionRange(0, 0) }
      sync()
      return
    }
    const valid = filterString(raw, type, patternRef.current).slice(0, length)
    digito.resetState()
    for (let i = 0; i < valid.length; i++) digito.inputChar(i, valid[i])
    const next = Math.min(valid.length, length - 1)
    if (inputRef.current) { inputRef.current.value = valid; inputRef.current.setSelectionRange(next, next) }
    digito.moveFocusTo(next)
    sync()
    if (blurOnComplete && digito.state.isComplete) {
      requestAnimationFrame(() => inputRef.current?.blur())
    }
  }, [type, length, blurOnComplete])

  const onPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    if (disabledRef.current || readOnlyRef.current) return
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const pos  = inputRef.current?.selectionStart ?? 0
    digito.pasteString(pos, text)
    const { slotValues, activeSlot } = digito.state
    if (inputRef.current) { inputRef.current.value = slotValues.join(''); inputRef.current.setSelectionRange(activeSlot, activeSlot) }
    sync()
    if (blurOnComplete && digito.state.isComplete) {
      requestAnimationFrame(() => inputRef.current?.blur())
    }
  }, [blurOnComplete])

  const onFocus = useCallback(() => {
    setIsFocused(true)
    onFocusRef.current?.()
    const pos = digito.state.activeSlot
    requestAnimationFrame(() => {
      const char = digito.state.slotValues[pos]
      if (selectOnFocus && char) {
        inputRef.current?.setSelectionRange(pos, pos + 1)
      } else {
        inputRef.current?.setSelectionRange(pos, pos)
      }
    })
  }, [selectOnFocus])

  const onBlur = useCallback(() => {
    setIsFocused(false)
    onBlurRef.current?.()
  }, [])

  // ── Public API ─────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    digito.resetState()
    if (inputRef.current) { inputRef.current.value = ''; inputRef.current.focus(); inputRef.current.setSelectionRange(0, 0) }
    setTimer(timerSecs)
    setTimerTrigger((n: number) => n + 1)
    sync(true)
  }, [timerSecs])

  const setError = useCallback((isError: boolean) => { digito.setError(isError); sync() }, [])

  const focus = useCallback((slotIndex: number) => {
    digito.moveFocusTo(slotIndex)
    inputRef.current?.focus()
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(slotIndex, slotIndex))
    sync()
  }, [])

  const getCode = useCallback(() => digito.getCode(), [])

  function getSlotProps(index: number): SlotRenderProps {
    const char     = state.slotValues[index] ?? ''
    const isActive = index === state.activeSlot && isFocused
    return {
      char,
      index,
      isActive,
      isFilled:    char.length === 1,
      isError:     state.hasError,
      isComplete:  state.isComplete,
      isDisabled:  disabled,
      isFocused,
      hasFakeCaret: isActive && char.length === 0,
      masked,
      maskChar,
      placeholder,
    }
  }

  const hiddenInputProps: HiddenInputProps = {
    ref:            inputRef,
    type:           masked ? 'password' : 'text',
    inputMode:      type === 'numeric' ? 'numeric' : 'text',
    autoComplete:   'one-time-code',
    maxLength:      length,
    disabled,
    ...(inputName   ? { name: inputName }    : {}),
    ...(autoFocus   ? { autoFocus: true }    : {}),
    'aria-label':   `Enter your ${length}-${type === 'numeric' ? 'digit' : 'character'} code`,
    spellCheck:     false,
    autoCorrect:    'off',
    autoCapitalize: 'off',
    ...(readOnlyProp ? { 'aria-readonly': 'true' as const } : {}),
    onKeyDown,
    onChange,
    onPaste,
    onFocus,
    onBlur,
  }

  const wrapperProps: Record<string, string | undefined> = {
    ...(state.isComplete ? { 'data-complete': '' } : {}),
    ...(state.hasError   ? { 'data-invalid':  '' } : {}),
    ...(disabled         ? { 'data-disabled': '' } : {}),
    ...(readOnlyProp     ? { 'data-readonly': '' } : {}),
  }

  return {
    slotValues:    state.slotValues,
    activeSlot:    state.activeSlot,
    isComplete:    state.isComplete,
    hasError:      state.hasError,
    isDisabled:    disabled,
    timerSeconds,
    isFocused,
    getCode,
    reset,
    setError,
    focus,
    separatorAfter,
    separator,
    hiddenInputProps,
    getSlotProps,
    wrapperProps,
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// HIDDEN OTP INPUT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convenience wrapper around the hidden real <input> element.
 * Applies the correct absolute-positioning styles so it sits invisibly
 * on top of the slot row and captures all keyboard input + native autofill.
 *
 * Forward the ref from useOTP's hiddenInputProps, then spread the rest:
 *
 * @example
 * ```tsx
 * const otp = useOTP({ length: 6 })
 *
 * <div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
 *   <HiddenOTPInput {...otp.hiddenInputProps} />
 *   {otp.slotValues.map((_, i) => <Slot key={i} {...otp.getSlotProps(i)} />)}
 * </div>
 * ```
 */
const HIDDEN_INPUT_STYLE: CSSProperties = {
  position:    'absolute',
  inset:       0,
  width:       '100%',
  height:      '100%',
  opacity:     0,
  border:      'none',
  outline:     'none',
  background:  'transparent',
  color:       'transparent',
  caretColor:  'transparent',
  zIndex:      1,
  cursor:      'text',
  fontSize:    1,
}

export const HiddenOTPInput = forwardRef<
  HTMLInputElement,
  Omit<HiddenInputProps, 'ref'>
>((props, ref) => (
  <input
    ref={ref}
    style={HIDDEN_INPUT_STYLE}
    {...props}
  />
))

HiddenOTPInput.displayName = 'HiddenOTPInput'
