/**
 * digito/core/types
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared TypeScript interfaces and type aliases used across the core modules.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

/** The set of characters each slot will accept. */
export type InputType = 'numeric' | 'alphabet' | 'alphanumeric' | 'any'

/** Snapshot of the OTP field state at any point in time. */
export type DigitoState = {
  /** Current value of each slot. Empty string means unfilled. */
  slotValues:  string[]
  /** Index of the currently focused slot. */
  activeSlot:  number
  /** Whether an error state is active. */
  hasError:    boolean
  /** True when every slot contains a valid character. */
  isComplete:  boolean
  /**
   * Mirrors the initial timer value — NOT a live countdown.
   * The live countdown is managed by each adapter layer.
   * Do not use this field to read remaining time; use the adapter's onTick callback instead.
   */
  timerSeconds: number
}

/** Configuration options passed to `createDigito` or `initDigito`. */
export type DigitoOptions = {
  /** Number of input slots. Default: `6`. */
  length?:       number
  /** Character set accepted by each slot. Default: `'numeric'`. */
  type?:         InputType
  /** Countdown duration in seconds. `0` disables the timer. Default: `0`. */
  timer?:        number
  /** Resend cooldown in seconds after the user clicks Resend. Default: `30`. */
  resendAfter?:  number
  /** Called with the joined code string when all slots are filled. */
  onComplete?:   (code: string) => void
  /**
   * Called every second with the remaining seconds. Use to drive a custom timer UI.
   *
   * **Adapter note:** Only fires in adapters that include a built-in countdown timer
   * (vanilla, alpine, web component). In React, Vue, and Svelte the timer is managed
   * separately inside each adapter — pass `onTick` as part of those adapters' options.
   * Has no effect when passed directly to `createDigito`.
   */
  onTick?:       (remainingSeconds: number) => void
  /** Called when the countdown reaches zero. */
  onExpire?:     () => void
  /**
   * Called when the resend action is triggered.
   *
   * **Adapter note:** Only fires automatically in adapters with a built-in Resend button
   * (vanilla, alpine, web component). In React, Vue, and Svelte there is no built-in
   * Resend button — call `onResend` manually in your own UI handler.
   * Has no effect when passed directly to `createDigito`.
   */
  onResend?:     () => void
  /** Vibrate on completion and error via `navigator.vibrate`. Default: `true`. */
  haptic?:       boolean
  /** Play a short tone on completion via Web Audio API. Default: `false`. */
  sound?:        boolean
  /**
   * When `true`, all input actions (typing, backspace, paste) are silently ignored.
   * Use this during async verification to prevent the user modifying the code.
   * Default: `false`.
   */
  disabled?:     boolean
  /**
   * Arbitrary per-character regex. When provided, each typed/pasted character must
   * match this pattern to be accepted into a slot.
   *
   * Takes precedence over the named `type` for character validation only —
   * `type` still controls `inputMode` and ARIA labels on the hidden input.
   *
   * The regex should match a **single character**:
   * @example pattern: /^[0-9A-F]$/   — uppercase hex only
   * @example pattern: /^[2-9A-HJ-NP-Z]$/  — ambiguity-free alphanumeric (no 0/O, 1/I/L)
   */
  pattern?:      RegExp
  /**
   * Optional transform applied to the raw clipboard text before it is filtered
   * and distributed into slots. Runs before `filterString` inside `pasteString()`.
   *
   * Use to strip formatting from pasted codes that real users copy from emails or
   * SMS messages (e.g. `"G-123456"` → `"123456"`, `"123 456"` → `"123456"`).
   *
   * The return value is then passed through the normal `filterString` + `pattern`
   * validation, so you only need to handle the structural formatting — character
   * validity is still enforced automatically.
   *
   * @example pasteTransformer: (raw) => raw.replace(/\s+|-/g, '')
   * @example pasteTransformer: (raw) => raw.toUpperCase()
   */
  pasteTransformer?: (raw: string) => string
  /**
   * Auto-focus the hidden input when the component mounts.
   * Set to `false` to prevent the field from stealing focus on load.
   * Default: `true`.
   */
  autoFocus?: boolean
  /**
   * The `name` attribute to set on the hidden input for native HTML form
   * submission and `FormData` compatibility.
   * @example name: 'otp'  →  FormData includes otp=123456
   */
  name?: string
  /**
   * Called when the hidden input gains browser focus.
   * Use to show contextual help or update surrounding UI.
   */
  onFocus?: () => void
  /**
   * Called when the hidden input loses browser focus.
   * Use to trigger validation or hide contextual help.
   */
  onBlur?: () => void
  /**
   * Character to display in empty (unfilled) slots as a visual hint.
   * Common choices: `'○'`, `'_'`, `'·'`, `'•'`.
   * Default: `''` (blank — no placeholder).
   * @example placeholder: '○'
   */
  placeholder?: string
  /**
   * When `true`, focusing a slot that already contains a character selects that
   * character so the next keystroke replaces it in-place.
   * When `false` (default), the cursor is placed at the slot position and the
   * existing character must be deleted before a new one can be entered.
   * Default: `false`.
   */
  selectOnFocus?: boolean
  /**
   * When `true`, the hidden input is automatically blurred when all slots are
   * filled. Removes focus styling and hides the fake caret once the code is
   * complete. Useful for flows that immediately submit or verify on completion.
   * Default: `false`.
   */
  blurOnComplete?: boolean
  /**
   * Uncontrolled initial value applied once on mount.
   * Distributed across slots exactly like user input but does NOT trigger
   * `onComplete` or fire change events. Ignored when a `value` prop is present.
   * Default: `undefined` (no pre-fill).
   */
  defaultValue?: string
  /**
   * When `true`, all slot mutations (typing, backspace, delete, paste) are
   * blocked while focus, selection, arrow navigation, and copy remain allowed.
   * Semantically distinct from `disabled` — the field is readable and focusable.
   * Default: `false`.
   */
  readOnly?: boolean
  /**
   * Called when the user types or pastes a character that is rejected by the
   * current `type` or `pattern` filter.
   *
   * Receives the raw rejected character and the zero-based slot index where
   * entry was attempted. Use to display inline feedback such as
   * "Only digits are allowed" or highlight the offending slot.
   *
   * @example
   * onInvalidChar: (char, index) => console.warn(`Rejected "${char}" at slot ${index}`)
   */
  onInvalidChar?: (char: string, index: number) => void
}

/** Options for the standalone `createTimer` utility. */
export type TimerOptions = {
  /** Total countdown duration in seconds. */
  totalSeconds:   number
  /** Called every second with the remaining seconds. */
  onTick?:        (remainingSeconds: number) => void
  /** Called when the countdown reaches zero. */
  onExpire?:      () => void
}

/** Controls returned by `createTimer`. */
export type TimerControls = {
  /** Start the countdown. */
  start:   () => void
  /** Stop and pause the countdown. */
  stop:    () => void
  /** Reset remaining time back to `totalSeconds` without starting. */
  reset:   () => void
  /** Reset and immediately start again. */
  restart: () => void
}

/** Listener function invoked after every state mutation in `createDigito`. */
export type StateListener = (state: DigitoState) => void
