/**
 * digito/core/machine
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure OTP state machine — zero DOM, zero framework, zero side effects.
 * All adapters import `createDigito` from here (via core/index.ts).
 *
 * Subscription system: pass a listener to `subscribe()` to be notified after
 * every state mutation. Compatible with XState / Zustand-style patterns:
 *
 *   const otp = createDigito({ length: 6 })
 *   const unsub = otp.subscribe(state => console.log(state))
 *   // ... later:
 *   unsub()
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import type { DigitoOptions, DigitoState, StateListener, InputType } from './types.js'
import { filterChar, filterString }                                    from './filter.js'
import { triggerHapticFeedback, triggerSoundFeedback }                 from './feedback.js'


// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns `true` when every slot contains exactly one character. */
function allSlotsFilled(slotValues: string[]): boolean {
  return slotValues.every(v => v.length === 1)
}

/** Clamp `index` to the inclusive range `[min, max]`. */
function clampIndex(index: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, index))
}

/** Join all slot values into a single string (the OTP code). */
function joinSlots(slotValues: string[]): string {
  return slotValues.join('')
}


// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a pure OTP state machine.
 * Returns action functions, a `state` getter, a `subscribe` method, and a
 * `getState` snapshot helper — no DOM, no side effects.
 */
export function createDigito(options: DigitoOptions = {}) {
  // Security: guard against invalid length values.
  // Negative numbers would throw a RangeError from Array(); zero would produce
  // a permanently-incomplete input with no slots. Clamp to a safe minimum of 1.
  const rawLength = options.length ?? 6
  // Guard against NaN (e.g. parseInt('', 10) from a missing data-attribute).
  // NaN would propagate through Math.floor and crash Array() with RangeError.
  const length    = isNaN(rawLength) ? 6 : Math.max(1, Math.floor(rawLength))

  const {
    type             = 'numeric' as InputType,
    pattern,
    onComplete,
    onInvalidChar,
    haptic           = true,
    sound            = false,
    pasteTransformer,
  } = options

  // `disabled` is mutable so setDisabled() can toggle it at runtime without
  // requiring the instance to be recreated. Adapters that pass disabled at
  // construction time still work — the initial value is honoured.
  let disabled = options.disabled ?? false

  let state: DigitoState = {
    slotValues:   Array(length).fill('') as string[],
    activeSlot:   0,
    hasError:     false,
    isComplete:   false,
    timerSeconds: options.timer ?? 0,
  }

  // ── Subscription set ──────────────────────────────────────────────────────
  const listeners = new Set<StateListener>()

  function applyState(patch: Partial<DigitoState>): DigitoState {
    state = { ...state, ...patch }
    // Notify all subscribers with a deep copy of slotValues so they cannot
    // mutate the live array. A simple { ...state } is a shallow copy — the
    // slotValues array reference would be shared, letting a subscriber silently
    // corrupt internal state.
    if (listeners.size > 0) {
      const snapshot = { ...state, slotValues: [...state.slotValues] }
      listeners.forEach(fn => fn(snapshot))
    }
    return state
  }

  /**
   * Handle for the pending onComplete timeout.
   * Stored so resetState() can cancel it if the user clears the input
   * within the 10ms defer window (e.g. rapid type-then-delete).
   */
  let completeTimeoutId: ReturnType<typeof setTimeout> | null = null

  /** Fire onComplete after a short delay so DOM sync can finish first. */
  function notifyCompleteIfReady(slotValues: string[]): void {
    if (!allSlotsFilled(slotValues) || !onComplete) return
    if (haptic) triggerHapticFeedback()
    if (sound)  triggerSoundFeedback()
    const code = joinSlots(slotValues)
    if (completeTimeoutId !== null) clearTimeout(completeTimeoutId)
    completeTimeoutId = setTimeout(() => {
      completeTimeoutId = null
      onComplete(code)
    }, 10)
  }

  /**
   * Cancel any pending onComplete callback without clearing slot state.
   * Use this after a programmatic fill (e.g. controlled-value sync in adapters)
   * to prevent a parent-driven pre-fill from triggering onComplete as if the
   * user had typed the code.
   */
  function cancelPendingComplete(): void {
    if (completeTimeoutId !== null) {
      clearTimeout(completeTimeoutId)
      completeTimeoutId = null
    }
  }


  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Process a single character typed into `slotIndex`.
   * Invalid characters leave the slot unchanged and keep focus in place.
   * Out-of-bounds indices are silently ignored to prevent sparse-array corruption.
   */
  function inputChar(slotIndex: number, char: string): DigitoState {
    if (disabled) return state
    if (slotIndex < 0 || slotIndex >= length) return state
    const validChar = filterChar(char, type, pattern)
    if (!validChar) {
      // Fire onInvalidChar for single rejected characters (not empty/multi-char)
      if (char.length === 1) onInvalidChar?.(char, slotIndex)
      // Only notify subscribers if focus actually needs to move. Firing applyState
      // when activeSlot is already slotIndex causes a spurious state notification
      // on every invalid keystroke, which can trigger expensive re-renders.
      if (state.activeSlot !== slotIndex) {
        return applyState({ activeSlot: slotIndex })
      }
      return state
    }

    const slotValues = [...state.slotValues]
    slotValues[slotIndex] = validChar

    const nextSlot = slotIndex < length - 1 ? slotIndex + 1 : length - 1

    const newState = applyState({
      slotValues,
      activeSlot:  nextSlot,
      hasError:    false,
      isComplete:  allSlotsFilled(slotValues),
    })

    notifyCompleteIfReady(slotValues)
    return newState
  }

  /**
   * Handle backspace at `slotIndex`.
   * Clears the current slot if filled, otherwise clears the previous slot and moves back.
   */
  function deleteChar(slotIndex: number): DigitoState {
    if (disabled) return state
    if (slotIndex < 0 || slotIndex >= length) return state
    const slotValues = [...state.slotValues]

    if (slotValues[slotIndex]) {
      slotValues[slotIndex] = ''
      return applyState({ slotValues, activeSlot: slotIndex, isComplete: false })
    }

    const prevSlot = clampIndex(slotIndex - 1, 0, length - 1)
    slotValues[prevSlot] = ''
    return applyState({ slotValues, activeSlot: prevSlot, isComplete: false })
  }

  /** Move focus one slot to the left, clamped to slot 0. */
  function moveFocusLeft(slotIndex: number): DigitoState {
    return applyState({ activeSlot: clampIndex(slotIndex - 1, 0, length - 1) })
  }

  /** Move focus one slot to the right, clamped to the last slot. */
  function moveFocusRight(slotIndex: number): DigitoState {
    return applyState({ activeSlot: clampIndex(slotIndex + 1, 0, length - 1) })
  }

  /**
   * Smart paste — distributes valid characters from `cursorSlot` forward,
   * wrapping around to slot 0 if the string is longer than the remaining slots.
   *
   * Examples (length = 6, type = numeric):
   *   paste(0, '123456') → fills all slots
   *   paste(5, '847291') → slot5='8', slot0='4', slot1='7', slot2='2', slot3='9', slot4='1'
   *   paste(0, '84AB91') → filtered='8491', fills slots 0–3, slots 4–5 unchanged
   */
  function pasteString(cursorSlot: number, rawText: string): DigitoState {
    if (disabled) return state

    let transformed: string
    try {
      transformed = pasteTransformer ? pasteTransformer(rawText) : rawText
    } catch (err) {
      console.warn('[digito] pasteTransformer threw — using raw paste text.', err)
      transformed = rawText
    }

    // Report each rejected character so adapters can provide inline feedback.
    // Tracks the effective write cursor so the reported slot index matches where
    // the character would have landed if it had been valid.
    if (onInvalidChar && transformed) {
      let slotCursor = cursorSlot
      for (const char of Array.from(transformed)) {
        if (filterChar(char, type, pattern)) {
          slotCursor = (slotCursor + 1) % length
        } else {
          onInvalidChar(char, slotCursor)
        }
      }
    }

    const validChars  = filterString(transformed, type, pattern)
    if (!validChars) return state

    const slotValues = [...state.slotValues]
    let   writeSlot  = cursorSlot

    for (let i = 0; i < validChars.length && i < length; i++) {
      slotValues[writeSlot] = validChars[i]
      writeSlot = (writeSlot + 1) % length
    }

    const charsWritten = Math.min(validChars.length, length)
    const nextActiveSlot = charsWritten >= length
      ? length - 1
      : (cursorSlot + charsWritten) % length

    const newState = applyState({
      slotValues,
      activeSlot:  nextActiveSlot,
      hasError:    false,
      isComplete:  allSlotsFilled(slotValues),
    })

    notifyCompleteIfReady(slotValues)
    return newState
  }

  /** Set or clear the error state. Triggers haptic feedback when setting. */
  function setError(isError: boolean): DigitoState {
    if (isError && haptic) triggerHapticFeedback()
    return applyState({ hasError: isError })
  }

  /** Clear all slots and reset to initial state. Cancels any pending onComplete callback. */
  function resetState(): DigitoState {
    if (completeTimeoutId !== null) {
      clearTimeout(completeTimeoutId)
      completeTimeoutId = null
    }
    return applyState({
      slotValues:   Array(length).fill('') as string[],
      activeSlot:   0,
      hasError:     false,
      isComplete:   false,
      timerSeconds: options.timer ?? 0,
    })
  }

  /** Move focus to a specific slot index. */
  function moveFocusTo(slotIndex: number): DigitoState {
    return applyState({ activeSlot: clampIndex(slotIndex, 0, length - 1) })
  }

  /**
   * Reactively enable or disable the input.
   * When `true`, inputChar / deleteChar / pasteString are silently ignored.
   * Navigation (moveFocusLeft/Right/To) is always allowed regardless of state.
   *
   * Prefer this over passing `disabled` at construction time whenever you need
   * to toggle disabled at runtime (e.g. during async verification).
   */
  function setDisabled(value: boolean): void {
    disabled = value
  }

  /**
   * Subscribe to state changes. The listener is called after every mutation
   * with a shallow copy of the new state.
   *
   * @returns An unsubscribe function — call it to stop receiving updates.
   *
   * @example
   * ```ts
   * const otp = createDigito({ length: 6 })
   * const unsub = otp.subscribe(state => console.log(state.slotValues))
   * // Later:
   * unsub()
   * ```
   */
  function subscribe(listener: StateListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  return {
    /** Current state snapshot. */
    get state() { return state },

    // Input actions
    inputChar,
    deleteChar,
    moveFocusLeft,
    moveFocusRight,
    pasteString,

    // State control
    setError,
    resetState,
    moveFocusTo,

    /**
     * Cancel any pending onComplete callback without resetting slot state.
     * Intended for adapter-layer controlled-value syncs where a programmatic
     * fill should not be treated as a user completing the code.
     */
    cancelPendingComplete,

    /**
     * Toggle the disabled state at runtime.
     * Affects inputChar, deleteChar, and pasteString only.
     * Navigation actions are always allowed.
     */
    setDisabled,

    /** Returns the current joined code string. */
    getCode:     () => joinSlots(state.slotValues),
    /**
     * Returns a copy of the current state with a cloned slotValues array.
     * Mutations to the returned object (including its slotValues array) will
     * not affect live state.
     */
    getSnapshot: (): DigitoState => ({ ...state, slotValues: [...state.slotValues] }),

    /**
     * Subscribe to state changes. Returns an unsubscribe function.
     * Compatible with XState / Zustand-style patterns.
     */
    subscribe,

    /**
     * Returns a copy of the current state with a cloned slotValues array.
     * Equivalent to `digito.getSnapshot()` — provided for ergonomic parity
     * with state-management libraries that expose a `getState()` method.
     */
    getState: (): DigitoState => ({ ...state, slotValues: [...state.slotValues] }),
  }
}
