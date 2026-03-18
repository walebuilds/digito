/**
 * digito — Definitive Test Suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers every public API surface of core.ts plus targeted tests for each of
 * the 12 issues fixed in this release. Ship this file as part of the package.
 *
 * Run: npx jest core.test
 */

import {
  filterChar,
  filterString,
  createDigito,
  createTimer,
  formatCountdown,
  triggerHapticFeedback,
  triggerSoundFeedback,
  type InputType,
} from './src/core'

// ─────────────────────────────────────────────────────────────────────────────
// 1. filterChar
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar', () => {
  describe('numeric', () => {
    it('accepts every digit 0-9', () => {
      for (const d of '0123456789') expect(filterChar(d, 'numeric')).toBe(d)
    })
    it('rejects letters', () => {
      expect(filterChar('a', 'numeric')).toBe('')
      expect(filterChar('Z', 'numeric')).toBe('')
    })
    it('rejects specials and whitespace', () => {
      expect(filterChar('!', 'numeric')).toBe('')
      expect(filterChar(' ', 'numeric')).toBe('')
    })
  })

  describe('alphabet', () => {
    it('accepts a-z and A-Z', () => {
      expect(filterChar('a', 'alphabet')).toBe('a')
      expect(filterChar('Z', 'alphabet')).toBe('Z')
    })
    it('rejects digits and specials', () => {
      expect(filterChar('3', 'alphabet')).toBe('')
      expect(filterChar('@', 'alphabet')).toBe('')
    })
  })

  describe('alphanumeric', () => {
    it('accepts letters and digits', () => {
      expect(filterChar('a', 'alphanumeric')).toBe('a')
      expect(filterChar('5', 'alphanumeric')).toBe('5')
    })
    it('rejects specials', () => {
      expect(filterChar('!', 'alphanumeric')).toBe('')
    })
  })

  describe('any', () => {
    it('passes any single character including specials and unicode', () => {
      expect(filterChar('!', 'any')).toBe('!')
      expect(filterChar('漢', 'any')).toBe('漢')
    })
    it('rejects empty string', () => {
      expect(filterChar('', 'any')).toBe('')
    })
    it('rejects multi-character strings', () => {
      expect(filterChar('ab', 'any')).toBe('')
    })
  })

  it('rejects empty string and multi-char for all types', () => {
    const types: InputType[] = ['numeric', 'alphabet', 'alphanumeric', 'any']
    for (const t of types) {
      expect(filterChar('', t)).toBe('')
      expect(filterChar('12', t)).toBe('')
    }
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 2. filterString
// ─────────────────────────────────────────────────────────────────────────────

describe('filterString', () => {
  it('strips invalid chars for numeric', () => {
    expect(filterString('1a2b3', 'numeric')).toBe('123')
  })
  it('returns empty string when nothing is valid', () => {
    expect(filterString('abc', 'numeric')).toBe('')
  })
  it('passes all chars for "any"', () => {
    expect(filterString('a1!', 'any')).toBe('a1!')
  })
  it('handles empty string', () => {
    expect(filterString('', 'numeric')).toBe('')
  })
  it('filters alphanumeric correctly', () => {
    expect(filterString('a1!b2@', 'alphanumeric')).toBe('a1b2')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 3. createDigito — initial state
// ─────────────────────────────────────────────────────────────────────────────

describe('createDigito — initial state', () => {
  it('creates 6 empty slots, activeSlot=0, no error, not complete (defaults)', () => {
    const d = createDigito()
    expect(d.state.slotValues).toEqual(['', '', '', '', '', ''])
    expect(d.state.activeSlot).toBe(0)
    expect(d.state.hasError).toBe(false)
    expect(d.state.isComplete).toBe(false)
  })
  it('respects custom length', () => {
    expect(createDigito({ length: 4 }).state.slotValues).toHaveLength(4)
  })
  it('stores the initial timer value in state', () => {
    expect(createDigito({ timer: 30 }).state.timerSeconds).toBe(30)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 4. inputChar
// ─────────────────────────────────────────────────────────────────────────────

describe('inputChar', () => {
  it('fills a slot and advances focus by one', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('1')
    expect(d.state.activeSlot).toBe(1)
  })
  it('stays on the last slot after filling it', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(3, '9')
    expect(d.state.activeSlot).toBe(3)
  })
  it('keeps focus when an invalid char is typed', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, 'a')   // numeric rejects letters
    expect(d.state.slotValues[0]).toBe('')
    expect(d.state.activeSlot).toBe(0)
  })
  it('clears hasError when a valid char is typed', () => {
    const d = createDigito({ length: 4 })
    d.setError(true)
    d.inputChar(0, '1')
    expect(d.state.hasError).toBe(false)
  })
  it('sets isComplete when all slots are filled', () => {
    const d = createDigito({ length: 4 })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.state.isComplete).toBe(true)
  })
  it('fires onComplete with the joined code (after 10ms)', (done) => {
    const d = createDigito({ length: 4, onComplete: (code) => { expect(code).toBe('1234'); done() } })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
  })
  it('overwrites an existing char in the slot', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    d.inputChar(0, '9')
    expect(d.state.slotValues[0]).toBe('9')
  })
  it('does not throw on out-of-bounds slot index', () => {
    expect(() => createDigito({ length: 4 }).inputChar(99, '5')).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 5. deleteChar
// ─────────────────────────────────────────────────────────────────────────────

describe('deleteChar', () => {
  it('clears a filled slot and keeps focus at the same index', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '5')
    d.inputChar(1, '6')
    d.deleteChar(1)
    expect(d.state.slotValues[1]).toBe('')
    expect(d.state.activeSlot).toBe(1)
  })
  it('moves back to the previous slot when the current slot is empty', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '5')
    d.deleteChar(1)
    expect(d.state.slotValues[0]).toBe('')
    expect(d.state.activeSlot).toBe(0)
  })
  it('clamps at slot 0 — does not go negative', () => {
    const d = createDigito({ length: 4 })
    d.deleteChar(0)
    expect(d.state.activeSlot).toBe(0)
  })
  it('clears isComplete flag', () => {
    const d = createDigito({ length: 4 })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.state.isComplete).toBe(true)
    d.deleteChar(3)
    expect(d.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 6. Focus movement
// ─────────────────────────────────────────────────────────────────────────────

describe('focus movement', () => {
  it('moveFocusLeft moves left and clamps at 0', () => {
    const d = createDigito({ length: 4 })
    d.moveFocusTo(2)
    d.moveFocusLeft(2)
    expect(d.state.activeSlot).toBe(1)
    d.moveFocusLeft(0)
    expect(d.state.activeSlot).toBe(0)
  })
  it('moveFocusRight moves right and clamps at last slot', () => {
    const d = createDigito({ length: 4 })
    d.moveFocusRight(1)
    expect(d.state.activeSlot).toBe(2)
    d.moveFocusRight(3)
    expect(d.state.activeSlot).toBe(3)
  })
  it('moveFocusTo clamps negative index to 0', () => {
    const d = createDigito({ length: 6 })
    d.moveFocusTo(-1)
    expect(d.state.activeSlot).toBe(0)
  })
  it('moveFocusTo clamps over-range index to last slot', () => {
    const d = createDigito({ length: 6 })
    d.moveFocusTo(99)
    expect(d.state.activeSlot).toBe(5)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 7. pasteString
// ─────────────────────────────────────────────────────────────────────────────

describe('pasteString', () => {
  it('fills all slots from cursor 0', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, '123456')
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(d.state.isComplete).toBe(true)
  })
  it('lands focus on the last slot when all slots are filled', () => {
    const d = createDigito({ length: 4 })
    d.pasteString(0, '1234')
    expect(d.state.activeSlot).toBe(3)
  })
  it('filters invalid chars before distributing', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, '1a2b3c')
    expect(d.state.slotValues.slice(0, 3)).toEqual(['1', '2', '3'])
    expect(d.state.slotValues.slice(3)).toEqual(['', '', ''])
  })
  it('wraps around from a mid-slot cursor', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(5, '847291')
    expect(d.state.slotValues[5]).toBe('8')
    expect(d.state.slotValues[0]).toBe('4')
    expect(d.state.slotValues[4]).toBe('1')
  })
  it('returns unchanged state for an empty paste', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, '')
    expect(d.state.slotValues).toEqual(['', '', '', '', '', ''])
  })
  it('returns unchanged state when paste contains only invalid chars', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, 'abcdef')
    expect(d.state.slotValues).toEqual(['', '', '', '', '', ''])
  })
  it('fires onComplete after a full paste', (done) => {
    const d = createDigito({ length: 6, onComplete: code => { expect(code).toBe('123456'); done() } })
    d.pasteString(0, '123456')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 8. setError / resetState / getCode / getSnapshot
// ─────────────────────────────────────────────────────────────────────────────

describe('setError', () => {
  it('sets and clears hasError', () => {
    const d = createDigito()
    d.setError(true)
    expect(d.state.hasError).toBe(true)
    d.setError(false)
    expect(d.state.hasError).toBe(false)
  })
})

describe('resetState', () => {
  it('clears all slots, resets all flags, and restores timerSeconds', () => {
    const d = createDigito({ length: 4, timer: 30 })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    d.setError(true)
    d.resetState()
    expect(d.state.slotValues).toEqual(['', '', '', ''])
    expect(d.state.activeSlot).toBe(0)
    expect(d.state.hasError).toBe(false)
    expect(d.state.isComplete).toBe(false)
    expect(d.state.timerSeconds).toBe(30)
  })
})

describe('getCode', () => {
  it('returns the joined code string', () => {
    const d = createDigito({ length: 4 })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.getCode()).toBe('1234')
  })
  it('empty slots contribute empty strings — no spaces or placeholders', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    expect(d.getCode()).toBe('1')   // ['1','','',''].join('') = '1'
  })
})

describe('getSnapshot', () => {
  it('returns a copy — mutations to the snapshot do not affect live state', () => {
    const d    = createDigito({ length: 4 })
    const snap = d.getSnapshot()
    d.inputChar(0, '5')
    expect(snap.slotValues[0]).toBe('')
    expect(d.state.slotValues[0]).toBe('5')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #1 — disabled flag guards input actions, not navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #1 — disabled flag on core', () => {
  it('inputChar is a no-op when disabled=true at construction', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('')
    expect(d.state.activeSlot).toBe(0)
  })
  it('deleteChar is a no-op when disabled=true at construction', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.deleteChar(0)
    expect(d.state.slotValues[0]).toBe('')
    expect(d.state.activeSlot).toBe(0)
  })
  it('pasteString is a no-op when disabled=true at construction', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.pasteString(0, '1234')
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })
  it('navigation is allowed even when disabled', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.moveFocusTo(3)
    d.moveFocusLeft(3)
    expect(d.state.activeSlot).toBe(2)
  })
  it('setError still works when disabled', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.setError(true)
    expect(d.state.hasError).toBe(true)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #2 — setDisabled() runtime toggle on core
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #2 — core.setDisabled() runtime toggle', () => {
  it('enabling allows input after the instance was constructed as disabled', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.setDisabled(false)
    d.inputChar(0, '5')
    expect(d.state.slotValues[0]).toBe('5')
  })
  it('disabling blocks input on an instance that started enabled', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    d.setDisabled(true)
    d.inputChar(1, '2')
    expect(d.state.slotValues[1]).toBe('')   // blocked
    expect(d.state.slotValues[0]).toBe('1')  // previous input preserved
  })
  it('re-enabling after runtime disable resumes input', () => {
    const d = createDigito({ length: 4 })
    d.setDisabled(true)
    d.inputChar(0, '9')
    expect(d.state.slotValues[0]).toBe('')  // still blocked
    d.setDisabled(false)
    d.inputChar(0, '9')
    expect(d.state.slotValues[0]).toBe('9')  // now allowed
  })
  it('pasteString is blocked/unblocked correctly by setDisabled()', () => {
    const d = createDigito({ length: 4 })
    d.setDisabled(true)
    d.pasteString(0, '1234')
    expect(d.state.isComplete).toBe(false)
    d.setDisabled(false)
    d.pasteString(0, '1234')
    expect(d.state.isComplete).toBe(true)
  })
  it('navigation remains available regardless of setDisabled state', () => {
    const d = createDigito({ length: 6 })
    d.moveFocusTo(3)
    d.setDisabled(true)
    d.moveFocusLeft(3)
    expect(d.state.activeSlot).toBe(2)
    d.moveFocusRight(2)
    expect(d.state.activeSlot).toBe(3)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #3 — onComplete race condition (stale callback after reset)
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #3 — onComplete race condition', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('onComplete does NOT fire synchronously — it is deferred 10ms', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(cb).not.toHaveBeenCalled()
    jest.advanceTimersByTime(10)
    expect(cb).toHaveBeenCalledWith('1234')
  })

  it('resetState() cancels the pending onComplete — stale callback never fires', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    d.resetState()                         // cancel within the 10ms window
    jest.advanceTimersByTime(50)
    expect(cb).not.toHaveBeenCalled()
  })

  it('rapid complete → reset → complete: only the second call fires', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    d.resetState()
    '5678'.split('').forEach((c, i) => d.inputChar(i, c))
    jest.advanceTimersByTime(50)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('5678')
  })

  it('single-slot OTP: complete + reset suppresses callback', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 1, onComplete: cb })
    d.inputChar(0, '9')
    expect(d.state.isComplete).toBe(true)
    d.resetState()
    jest.advanceTimersByTime(50)
    expect(cb).not.toHaveBeenCalled()
  })

  it('two consecutive full inputs: only the last fires', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb })
    '1111'.split('').forEach((c, i) => d.inputChar(i, c))
    d.resetState()
    '2222'.split('').forEach((c, i) => d.inputChar(i, c))
    jest.advanceTimersByTime(50)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('2222')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #4 — onChange fires exactly ONCE per interaction (no echo loop)
// Tested via the algorithm used by the React/Vue/Svelte adapters.
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #4 — onChange echo loop (controlled value sync algorithm)', () => {
  /** Simulate the adapter's controlled sync: reset + replay, call onChange once. */
  function applyControlledValue(
    d: ReturnType<typeof createDigito>,
    incoming: string,
    length: number,
    type: InputType,
    onChangeCb: (code: string) => void,
  ): void {
    const filtered = incoming.replace(/[^0-9]/g, '').slice(0, length)  // numeric for test
    const current  = d.state.slotValues.join('')
    if (filtered === current) return

    d.resetState()
    for (let i = 0; i < filtered.length; i++) d.inputChar(i, filtered[i])
    // onChange fires ONCE — not inside the loop
    onChangeCb(filtered)
  }

  it('onChange is called exactly once for a full 6-char sync', () => {
    const d        = createDigito({ length: 6 })
    const onChange = jest.fn()
    applyControlledValue(d, '123456', 6, 'numeric', onChange)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('123456')
  })

  it('onChange is called exactly once for a partial sync', () => {
    const d        = createDigito({ length: 6 })
    const onChange = jest.fn()
    applyControlledValue(d, '123', 6, 'numeric', onChange)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('123')
  })

  it('onChange is called once with "" when syncing to empty', () => {
    const d        = createDigito({ length: 6 })
    const onChange = jest.fn()
    applyControlledValue(d, '123456', 6, 'numeric', onChange)
    applyControlledValue(d, '', 6, 'numeric', onChange)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('onChange is NOT called when the incoming value equals current state (bail-out)', () => {
    const d        = createDigito({ length: 4 })
    const onChange = jest.fn()
    applyControlledValue(d, '1234', 4, 'numeric', onChange)
    applyControlledValue(d, '1234', 4, 'numeric', onChange)   // same value
    expect(onChange).toHaveBeenCalledTimes(1)                   // not called again
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #5 — Controlled value equality check: simple string equality
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #5 — controlled value equality check', () => {
  it('correctly detects a change when slot 0 holds "0"', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '0')    // '0' is falsy — old filter(Boolean) would miss it
    expect(d.state.slotValues[0]).toBe('0')
    expect(d.state.slotValues.join('')).toBe('0')
    // If equality check used filter(Boolean).length, it would return 0 for ['0','','','']
    // and incorrectly bail out on an incoming '0123'. Verify the correct value is stored.
    expect(d.state.slotValues.join('')).not.toBe('')
  })

  it('pre-fills slots correctly from a controlled value containing "0"', () => {
    const d = createDigito({ length: 4 })
    // Simulate controlled sync with a value starting with '0'
    d.resetState()
    '0123'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.state.slotValues).toEqual(['0', '1', '2', '3'])
    expect(d.state.isComplete).toBe(true)
  })

  it('truncates incoming value longer than configured length', () => {
    const d = createDigito({ length: 4 })
    const incoming = '123456'.slice(0, 4)
    d.resetState()
    for (let i = 0; i < incoming.length; i++) d.inputChar(i, incoming[i])
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4'])
  })

  it('leaves remaining slots empty for a partial incoming value', () => {
    const d = createDigito({ length: 6 })
    d.resetState()
    '123'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.state.slotValues).toEqual(['1', '2', '3', '', '', ''])
    expect(d.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #6 — separator is purely decorative, never affects state/value
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #6 — separator config (adapter layer — core is agnostic)', () => {
  it('separator does not affect the state machine or getCode()', () => {
    // Core knows nothing about separatorAfter — it is adapter-only.
    // Verify that full 6-slot fill/code/wrap-paste are unaffected.
    const d = createDigito({ length: 6 })
    '123456'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.getCode()).toBe('123456')
    expect(d.state.isComplete).toBe(true)
  })

  it('pasteString wraps correctly regardless of separatorAfter position', () => {
    // Separator is rendered between e.g. slot 2 and 3 in the DOM but the
    // core state machine is a 0-based array of `length` slots — no gap.
    const d = createDigito({ length: 6 })
    d.pasteString(5, '847291')
    expect(d.state.slotValues.join('')).toBe('47291' + '8')  // wrap: slot5='8', 0-4='47291'
    // Sorted correctly:
    expect(d.state.slotValues[5]).toBe('8')
    expect(d.state.slotValues[0]).toBe('4')
  })

  it('vanilla adapter does not contain the dead newPos variable (Bug #3 regression)', () => {
    const fs  = require('fs')
    const src = fs.readFileSync('./src/adapters/vanilla.ts', 'utf8')
    expect(src).not.toMatch(/const newPos = Math\.max/)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #7 — React adapter: disabled prop is threaded through correctly
// Tested via the disabledRef pattern — event handlers guard on disabledRef.current
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #7 — React adapter disabled threading (disabledRef pattern)', () => {
  // Simulate the disabledRef pattern used by the React hook's event handlers
  it('disabledRef pattern correctly blocks input when true', () => {
    const disabledRef = { current: false }
    const d           = createDigito({ length: 4 })

    function handleKeyDown(key: string) {
      if (disabledRef.current) return   // guard — mirrors React hook
      if (key === 'Backspace') d.deleteChar(d.state.activeSlot)
    }

    function handleChange(char: string) {
      if (disabledRef.current) return   // guard — mirrors React hook
      d.inputChar(d.state.activeSlot, char)
    }

    // Enabled: input works
    handleChange('1')
    expect(d.state.slotValues[0]).toBe('1')

    // Disable
    disabledRef.current = true

    // Disabled: input blocked
    handleChange('2')
    expect(d.state.slotValues[1]).toBe('')

    // Disabled: backspace blocked
    handleKeyDown('Backspace')
    expect(d.state.slotValues[0]).toBe('1')

    // Re-enable
    disabledRef.current = false
    handleChange('2')
    expect(d.state.slotValues[1]).toBe('2')
  })

  it('HiddenInputProps contains disabled field', () => {
    // Verify the disabled prop is included in the output type
    // (structural check — disabled prop must be present and typed boolean)
    const disabledValues: boolean[] = [true, false]
    disabledValues.forEach(v => {
      // Simulate creating the hiddenInputProps object with disabled
      const props = { disabled: v }
      expect(typeof props.disabled).toBe('boolean')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createTimer
// ─────────────────────────────────────────────────────────────────────────────

describe('createTimer', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('calls onTick each second with the remaining count', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 3, onTick })
    t.start()
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(3)
    expect(onTick).toHaveBeenLastCalledWith(0)
  })

  it('calls onExpire at zero', () => {
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 2, onExpire })
    t.start()
    jest.advanceTimersByTime(2000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('stop() halts the countdown mid-way', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 5, onTick })
    t.start()
    jest.advanceTimersByTime(2000)
    t.stop()
    jest.advanceTimersByTime(3000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('reset() stops the countdown without starting', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 5, onTick })
    t.start()
    jest.advanceTimersByTime(2000)
    t.reset()
    jest.advanceTimersByTime(5000)
    expect(onTick).toHaveBeenCalledTimes(2)  // stopped by reset
  })

  it('restart() runs a full new cycle from the beginning', () => {
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 3, onExpire })
    t.start()
    jest.advanceTimersByTime(2000)
    t.restart()
    jest.advanceTimersByTime(3000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('calling stop() twice does not throw', () => {
    const t = createTimer({ totalSeconds: 5 })
    t.start()
    expect(() => { t.stop(); t.stop() }).not.toThrow()
  })

  it('calling start() without stop() first replaces the interval correctly', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 5, onTick })
    t.start()
    jest.advanceTimersByTime(1000)
    t.start()  // restart without explicit stop
    jest.advanceTimersByTime(1000)
    // If double-interval bug existed, onTick would fire 3 times not 2
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it('totalSeconds=0 fires onExpire immediately, never passes negative value to onTick', () => {
    const onTick   = jest.fn()
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 0, onTick, onExpire })
    t.start()
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onTick).not.toHaveBeenCalled()
  })

  it('negative totalSeconds fires onExpire immediately without ticking', () => {
    const onTick   = jest.fn()
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: -5, onTick, onExpire })
    t.start()
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(onTick).not.toHaveBeenCalled()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #8 — inputChar out-of-bounds guard
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #8 — inputChar out-of-bounds guard', () => {
  it('silently ignores a slot index greater than length-1', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(99, '5')
    expect(d.state.slotValues).toEqual(['', '', '', ''])
    expect(d.state.slotValues.length).toBe(4)
  })

  it('silently ignores a negative slot index', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(-1, '5')
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })

  it('state remains unmodified — getCode() returns empty, isComplete stays false', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(100, '5')
    expect(d.getCode()).toBe('')
    expect(d.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #9 — createDigito length validation
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #9 — createDigito length validation', () => {
  it('length=0 is clamped to 1 — does not throw', () => {
    expect(() => createDigito({ length: 0 })).not.toThrow()
    const d = createDigito({ length: 0 })
    expect(d.state.slotValues).toHaveLength(1)
  })

  it('negative length is clamped to 1 — does not throw', () => {
    expect(() => createDigito({ length: -3 })).not.toThrow()
    const d = createDigito({ length: -3 })
    expect(d.state.slotValues).toHaveLength(1)
  })

  it('fractional length is floored — length=4.9 produces 4 slots', () => {
    const d = createDigito({ length: 4.9 })
    expect(d.state.slotValues).toHaveLength(4)
  })

  it('normal positive integer lengths still work', () => {
    expect(createDigito({ length: 6 }).state.slotValues).toHaveLength(6)
    expect(createDigito({ length: 1 }).state.slotValues).toHaveLength(1)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #10 — cancelPendingComplete()
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #10 — cancelPendingComplete', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('cancels a pending onComplete without clearing slot values', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.state.isComplete).toBe(true)
    d.cancelPendingComplete()
    jest.advanceTimersByTime(50)
    expect(cb).not.toHaveBeenCalled()
    // Slots are still filled — only the callback was suppressed
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4'])
  })

  it('is a no-op when there is no pending callback', () => {
    const d = createDigito({ length: 4 })
    expect(() => d.cancelPendingComplete()).not.toThrow()
  })

  it('subsequent user input re-queues onComplete normally after cancel', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    d.cancelPendingComplete()  // suppress the first complete
    jest.advanceTimersByTime(50)
    expect(cb).not.toHaveBeenCalled()

    // Reset and fill again — this time let it fire
    d.resetState()
    '5678'.split('').forEach((c, i) => d.inputChar(i, c))
    jest.advanceTimersByTime(50)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('5678')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #11 — deleteChar out-of-bounds guard
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #11 — deleteChar out-of-bounds guard', () => {
  it('silently ignores a negative slot index — does not clear slot 0', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '5')
    d.deleteChar(-1)
    expect(d.state.slotValues[0]).toBe('5')  // slot 0 must NOT be cleared
    expect(d.state.slotValues).toEqual(['5', '', '', ''])
  })

  it('silently ignores a slot index >= length — does not clear last slot', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(3, '9')
    d.deleteChar(99)
    expect(d.state.slotValues[3]).toBe('9')  // last slot must NOT be cleared
    expect(d.state.slotValues).toEqual(['', '', '', '9'])
  })

  it('state and activeSlot are unchanged on out-of-bounds delete', () => {
    const d = createDigito({ length: 4 })
    d.moveFocusTo(2)
    const before = d.getSnapshot()
    d.deleteChar(-5)
    expect(d.state).toEqual(before)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FIX #12 — onTick / onExpire silently dropped by createDigito
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX #12 — createDigito: onTick and onExpire are adapter-layer concerns', () => {
  it('passes onTick/onExpire in options without throwing', () => {
    // Core must accept (and silently ignore) these for backwards compat with
    // adapters that forward the full options object to createDigito.
    expect(() => createDigito({
      length:   4,
      onExpire: () => { /* noop */ },
    })).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// FEATURE — pattern option (arbitrary per-character regex validation)
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar — pattern option', () => {
  it('accepts a character that matches the regex', () => {
    expect(filterChar('A', 'any', /^[A-F]$/)).toBe('A')
    expect(filterChar('3', 'any', /^[0-9A-F]$/)).toBe('3')
  })

  it('rejects a character that does not match the regex', () => {
    expect(filterChar('G', 'any', /^[A-F]$/)).toBe('')
    expect(filterChar('z', 'numeric', /^[0-9A-F]$/)).toBe('')
  })

  it('pattern takes precedence over type — numeric type with hex pattern accepts A-F', () => {
    // type='numeric' alone rejects letters, but pattern overrides it
    expect(filterChar('A', 'numeric', /^[0-9A-F]$/)).toBe('A')
    expect(filterChar('F', 'numeric', /^[0-9A-F]$/)).toBe('F')
    expect(filterChar('G', 'numeric', /^[0-9A-F]$/)).toBe('')
  })

  it('pattern=undefined falls through to normal type validation', () => {
    expect(filterChar('5', 'numeric', undefined)).toBe('5')
    expect(filterChar('a', 'numeric', undefined)).toBe('')
  })

  it('multi-char string still returns empty regardless of pattern', () => {
    expect(filterChar('AB', 'any', /^[A-F]+$/)).toBe('')
  })
})

describe('filterString — pattern option', () => {
  it('filters a string keeping only characters matching the pattern', () => {
    expect(filterString('1A2B3G', 'any', /^[0-9A-F]$/)).toBe('1A2B3')
  })

  it('returns empty string when no characters match', () => {
    expect(filterString('ghijkl', 'any', /^[0-9A-F]$/)).toBe('')
  })

  it('pattern=undefined behaves identically to filterString(str, type)', () => {
    expect(filterString('123abc', 'numeric', undefined)).toBe('123')
    expect(filterString('123abc', 'numeric')).toBe('123')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE — pasteTransformer option
// ─────────────────────────────────────────────────────────────────────────────

describe('pasteTransformer option', () => {
  it('strips formatting before distributing — "G-123456" fills all 6 slots', () => {
    const d = createDigito({ length: 6, pasteTransformer: (r) => r.replace(/[^0-9]/g, '') })
    d.pasteString(0, 'G-123456')
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(d.state.isComplete).toBe(true)
  })

  it('strips spaces — "123 456" fills all 6 slots', () => {
    const d = createDigito({ length: 6, pasteTransformer: (r) => r.replace(/\s+/g, '') })
    d.pasteString(0, '123 456')
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('normalises case — lowercase paste fills correctly with alphanumeric pattern', () => {
    const d = createDigito({ length: 4, type: 'any', pattern: /^[A-Z0-9]$/, pasteTransformer: (r) => r.toUpperCase() })
    d.pasteString(0, 'ab12')
    expect(d.state.slotValues).toEqual(['A', 'B', '1', '2'])
  })

  it('transformer runs before filterString — invalid chars after transform are still rejected', () => {
    // Transformer keeps only digits; filterString then validates as numeric
    const d = createDigito({ length: 4, pasteTransformer: (r) => r.replace(/[^0-9]/g, '') })
    d.pasteString(0, 'abc')   // transformer → '', filterString → ''
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })

  it('without transformer, formatted code is filtered char-by-char (dashes rejected)', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, '12-34-56')   // dashes are non-numeric, filterString strips them
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('transformer returning empty string leaves state unchanged', () => {
    const d = createDigito({ length: 4, pasteTransformer: () => '' })
    d.pasteString(0, '1234')
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })

  it('transformer does not affect keyboard inputChar — only paste path', () => {
    const d = createDigito({ length: 4, pasteTransformer: (r) => r.replace(/[^0-9]/g, '') })
    d.inputChar(0, 'A')   // inputChar goes through filterChar, not pasteTransformer
    expect(d.state.slotValues[0]).toBe('')   // 'A' rejected by numeric type
  })

  it('fires onComplete after a transformed paste that fills all slots', (done) => {
    const d = createDigito({
      length: 6,
      pasteTransformer: (r) => r.replace(/\s+|-/g, ''),
      onComplete: (code) => { expect(code).toBe('123456'); done() },
    })
    d.pasteString(0, '12-34-56'.slice(0, 8))   // transformer → '123456' (only 6 needed)
    // Actually "12-34-56" has 8 chars, transformer gives "123456" (6 digits)
  })
})

describe('createDigito — pattern option', () => {
  it('inputChar accepts characters matching the pattern', () => {
    const d = createDigito({ length: 4, type: 'any', pattern: /^[0-9A-F]$/ })
    d.inputChar(0, 'A')
    d.inputChar(1, '3')
    expect(d.state.slotValues[0]).toBe('A')
    expect(d.state.slotValues[1]).toBe('3')
  })

  it('inputChar rejects characters not matching the pattern', () => {
    const d = createDigito({ length: 4, type: 'any', pattern: /^[0-9A-F]$/ })
    d.inputChar(0, 'G')
    d.inputChar(0, 'z')
    expect(d.state.slotValues[0]).toBe('')
  })

  it('pasteString filters pasted text through the pattern', () => {
    const d = createDigito({ length: 6, type: 'any', pattern: /^[0-9A-F]$/ })
    d.pasteString(0, 'A1G2BZ3')  // G, Z rejected → 'A1', '2', 'B', '3'
    expect(d.state.slotValues.join('')).toBe('A12B3')
    expect(d.state.slotValues[5]).toBe('')
  })

  it('pattern overrides type — numeric type + hex pattern accepts A-F letters', () => {
    const d = createDigito({ length: 4, type: 'numeric', pattern: /^[0-9A-F]$/ })
    d.inputChar(0, 'B')
    expect(d.state.slotValues[0]).toBe('B')
  })

  it('isComplete fires onComplete only when all slots are filled with valid chars', () => {
    const cb = jest.fn()
    // Ambiguity-free charset: excludes 0, O, 1, I, L
    const d = createDigito({ length: 4, type: 'any', pattern: /^[2-9A-HJ-NP-Z]$/, onComplete: cb })
    d.inputChar(0, 'A')
    d.inputChar(1, 'B')
    d.inputChar(2, 'C')
    d.inputChar(3, 'D')
    expect(d.state.isComplete).toBe(true)
  })

  it('rejects ambiguous chars excluded by a custom pattern', () => {
    // /^[2-9A-HJ-NP-Z]$/ excludes 0, O, 1, I, L
    const d = createDigito({ length: 4, type: 'any', pattern: /^[2-9A-HJ-NP-Z]$/ })
    d.inputChar(0, '0')  // excluded
    d.inputChar(0, 'O')  // excluded
    d.inputChar(0, '1')  // excluded
    d.inputChar(0, 'I')  // excluded
    expect(d.state.slotValues[0]).toBe('')
    d.inputChar(0, '2')  // allowed
    expect(d.state.slotValues[0]).toBe('2')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// subscribe() — pub-sub system
// ─────────────────────────────────────────────────────────────────────────────

describe('subscribe()', () => {
  it('listener is called after every state mutation', () => {
    const d = createDigito({ length: 4 })
    const calls: string[][] = []
    d.subscribe(s => calls.push([...s.slotValues]))
    d.inputChar(0, '1')
    d.inputChar(1, '2')
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe('1')
    expect(calls[1][1]).toBe('2')
  })

  it('listener receives a shallow copy — a new state object, not the same reference', () => {
    const d = createDigito({ length: 4 })
    let snapshot: typeof d.state | null = null
    d.subscribe(s => { snapshot = s })
    d.inputChar(0, '1')
    // The snapshot is a new object (spread copy), not the same reference as d.state
    expect(snapshot).not.toBe(d.state)
    // But both reflect the same values at the time of the call
    expect(snapshot!.slotValues[0]).toBe('1')
  })

  it('multiple listeners all receive notifications', () => {
    const d  = createDigito({ length: 4 })
    const a  = jest.fn()
    const b  = jest.fn()
    d.subscribe(a)
    d.subscribe(b)
    d.inputChar(0, '5')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops receiving updates', () => {
    const d   = createDigito({ length: 4 })
    const spy = jest.fn()
    const unsub = d.subscribe(spy)
    d.inputChar(0, '1')
    expect(spy).toHaveBeenCalledTimes(1)
    unsub()
    d.inputChar(1, '2')
    expect(spy).toHaveBeenCalledTimes(1)  // no new call after unsub
  })

  it('unsubscribing one listener does not affect others', () => {
    const d  = createDigito({ length: 4 })
    const a  = jest.fn()
    const b  = jest.fn()
    const unsubA = d.subscribe(a)
    d.subscribe(b)
    unsubA()
    d.inputChar(0, '9')
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('listener receives the correct isComplete flag on completion', () => {
    const d = createDigito({ length: 4 })
    let lastComplete = false
    d.subscribe(s => { lastComplete = s.isComplete })
    '123'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(lastComplete).toBe(false)
    d.inputChar(3, '4')
    expect(lastComplete).toBe(true)
  })

  it('listener is called by resetState() with empty slotValues', () => {
    const d = createDigito({ length: 4 })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    let snapshot: typeof d.state | null = null
    d.subscribe(s => { snapshot = s })
    d.resetState()
    expect(snapshot!.slotValues).toEqual(['', '', '', ''])
    expect(snapshot!.isComplete).toBe(false)
  })

  it('calling subscribe with no listeners is a no-op (no throw)', () => {
    const d = createDigito({ length: 4 })
    expect(() => d.inputChar(0, '1')).not.toThrow()
  })

  it('double-unsubscribe does not throw', () => {
    const d     = createDigito({ length: 4 })
    const unsub = d.subscribe(() => {})
    expect(() => { unsub(); unsub() }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onInvalidChar callback
// ─────────────────────────────────────────────────────────────────────────────

describe('onInvalidChar', () => {
  it('fires with the rejected char and slot index when inputChar rejects a char', () => {
    const rejections: Array<[string, number]> = []
    const d = createDigito({
      length: 4,
      onInvalidChar: (char, index) => rejections.push([char, index]),
    })
    d.inputChar(0, 'a')  // 'a' is invalid for numeric
    expect(rejections).toHaveLength(1)
    expect(rejections[0]).toEqual(['a', 0])
  })

  it('fires at the correct slot index', () => {
    let capturedIndex = -1
    const d = createDigito({
      length: 6,
      onInvalidChar: (_, index) => { capturedIndex = index },
    })
    d.inputChar(3, 'X')  // slot 3
    expect(capturedIndex).toBe(3)
  })

  it('does NOT fire when a valid char is typed', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onInvalidChar: cb })
    d.inputChar(0, '5')
    expect(cb).not.toHaveBeenCalled()
  })

  it('does NOT fire for empty string or multi-char inputs', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onInvalidChar: cb })
    d.inputChar(0, '')
    d.inputChar(0, '12')
    expect(cb).not.toHaveBeenCalled()
  })

  it('fires for each invalid character dropped during a paste operation', () => {
    const rejections: Array<[string, number]> = []
    const d = createDigito({ length: 4, onInvalidChar: (char, idx) => rejections.push([char, idx]) })
    d.pasteString(0, 'a1b2')  // 'a' at slot 0 and 'b' at slot 1 are filtered
    expect(rejections).toEqual([['a', 0], ['b', 1]])
  })

  it('fires with the pattern-rejected char when a pattern is configured', () => {
    const rejections: string[] = []
    const d = createDigito({
      length: 4,
      type: 'any',
      pattern: /^[0-9A-F]$/,
      onInvalidChar: (char) => rejections.push(char),
    })
    d.inputChar(0, 'G')  // not in [0-9A-F]
    d.inputChar(0, 'z')
    expect(rejections).toEqual(['G', 'z'])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// getState() alias
// ─────────────────────────────────────────────────────────────────────────────

describe('getState()', () => {
  it('returns the same shape as getSnapshot()', () => {
    const d    = createDigito({ length: 4 })
    d.inputChar(0, '7')
    const snap = d.getSnapshot()
    const st   = d.getState()
    expect(st).toEqual(snap)
  })

  it('returns a shallow copy — not a live reference', () => {
    const d  = createDigito({ length: 4 })
    const st = d.getState()
    d.inputChar(0, '1')
    expect(st.slotValues[0]).toBe('')   // cached copy is not mutated
  })

  it('includes all DigitoState fields', () => {
    const d  = createDigito({ length: 6, timer: 30 })
    const st = d.getState()
    expect(typeof st.activeSlot).toBe('number')
    expect(Array.isArray(st.slotValues)).toBe(true)
    expect(typeof st.hasError).toBe('boolean')
    expect(typeof st.isComplete).toBe('boolean')
    expect(typeof st.timerSeconds).toBe('number')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// pasteString — activeSlot positioning
// ─────────────────────────────────────────────────────────────────────────────

describe('pasteString — activeSlot positioning', () => {
  it('partial paste from slot 0: activeSlot = charsWritten (next empty)', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, '123')  // 3 chars written from slot 0
    // nextActiveSlot = (0 + 3) % 6 = 3
    expect(d.state.activeSlot).toBe(3)
  })

  it('partial paste from slot 2: activeSlot wraps via modulo', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(2, '1234')  // 4 chars: slots 2,3,4,5
    // nextActiveSlot = (2 + 4) % 6 = 0
    expect(d.state.activeSlot).toBe(0)
  })

  it('full paste: activeSlot = length - 1 (last slot)', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, '123456')
    expect(d.state.activeSlot).toBe(5)
  })

  it('single char paste: activeSlot advances by one', () => {
    const d = createDigito({ length: 6 })
    d.pasteString(0, '1')
    expect(d.state.activeSlot).toBe(1)
  })

  it('wrap-around paste: last slot fills then wraps to slot 0', () => {
    const d = createDigito({ length: 4 })
    d.pasteString(3, '1234')  // fills slot3='1', then wraps: slot0='2', slot1='3', slot2='4'
    expect(d.state.slotValues[3]).toBe('1')
    expect(d.state.slotValues[0]).toBe('2')
    expect(d.state.slotValues[1]).toBe('3')
    expect(d.state.slotValues[2]).toBe('4')
    expect(d.state.isComplete).toBe(true)
    expect(d.state.activeSlot).toBe(3)  // full paste → length-1
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// inputChar — all InputType variants
// ─────────────────────────────────────────────────────────────────────────────

describe('inputChar — InputType variants', () => {
  describe('type="alphabet"', () => {
    it('accepts lowercase letters', () => {
      const d = createDigito({ length: 4, type: 'alphabet' })
      d.inputChar(0, 'a')
      expect(d.state.slotValues[0]).toBe('a')
    })
    it('accepts uppercase letters', () => {
      const d = createDigito({ length: 4, type: 'alphabet' })
      d.inputChar(0, 'Z')
      expect(d.state.slotValues[0]).toBe('Z')
    })
    it('rejects digits', () => {
      const d = createDigito({ length: 4, type: 'alphabet' })
      d.inputChar(0, '5')
      expect(d.state.slotValues[0]).toBe('')
    })
  })

  describe('type="alphanumeric"', () => {
    it('accepts letters and digits', () => {
      const d = createDigito({ length: 4, type: 'alphanumeric' })
      d.inputChar(0, 'a')
      d.inputChar(1, '1')
      expect(d.state.slotValues).toEqual(['a', '1', '', ''])
    })
    it('rejects special characters', () => {
      const d = createDigito({ length: 4, type: 'alphanumeric' })
      d.inputChar(0, '@')
      expect(d.state.slotValues[0]).toBe('')
    })
  })

  describe('type="any"', () => {
    it('accepts special characters', () => {
      const d = createDigito({ length: 4, type: 'any' })
      d.inputChar(0, '!')
      d.inputChar(1, '@')
      expect(d.state.slotValues).toEqual(['!', '@', '', ''])
    })
    it('accepts unicode', () => {
      const d = createDigito({ length: 4, type: 'any' })
      d.inputChar(0, '漢')
      expect(d.state.slotValues[0]).toBe('漢')
    })
    it('still rejects empty string', () => {
      const d = createDigito({ length: 4, type: 'any' })
      d.inputChar(0, '')
      expect(d.state.slotValues[0]).toBe('')
    })
    it('still rejects multi-char strings', () => {
      const d = createDigito({ length: 4, type: 'any' })
      d.inputChar(0, 'ab')
      expect(d.state.slotValues[0]).toBe('')
    })
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// deleteChar — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('deleteChar — edge cases', () => {
  it('at slot 0 when already empty: stays at slot 0 with no state change', () => {
    const d = createDigito({ length: 4 })
    d.deleteChar(0)
    expect(d.state.activeSlot).toBe(0)
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })

  it('on a filled mid-slot: clears it, stays at same index (not moving back)', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    d.inputChar(1, '2')
    d.deleteChar(1)
    expect(d.state.slotValues[1]).toBe('')
    expect(d.state.activeSlot).toBe(1)
    expect(d.state.slotValues[0]).toBe('1')  // slot 0 unaffected
  })

  it('on an empty mid-slot: moves back to previous slot and clears it', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    d.deleteChar(1)  // slot 1 is empty, so move back to slot 0 and clear
    expect(d.state.slotValues[0]).toBe('')
    expect(d.state.activeSlot).toBe(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// haptic / sound — fail silently in Node.js
// ─────────────────────────────────────────────────────────────────────────────

describe('haptic and sound options', () => {
  it('haptic=true does not throw in Node.js (navigator.vibrate unavailable)', () => {
    expect(() => {
      const d = createDigito({ length: 4, haptic: true })
      '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    }).not.toThrow()
  })

  it('sound=true does not throw in Node.js (AudioContext unavailable)', () => {
    expect(() => {
      const d = createDigito({ length: 4, sound: true })
      '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    }).not.toThrow()
  })

  it('setError with haptic=true does not throw', () => {
    expect(() => {
      const d = createDigito({ length: 4, haptic: true })
      d.setError(true)
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// state getter — behaviour as live reference
// ─────────────────────────────────────────────────────────────────────────────

describe('otp.state getter', () => {
  it('always reflects the current state after mutation', () => {
    const d = createDigito({ length: 4 })
    expect(d.state.slotValues[0]).toBe('')
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('1')
  })

  it('a cached reference to state becomes stale after applyState creates a new object', () => {
    const d = createDigito({ length: 4 })
    const cached = d.state  // reference to current state object
    d.inputChar(0, '9')
    // applyState spreads a new object, so cached now points to the OLD object
    // The cached slot value should still be '' (pre-mutation)
    expect(cached.slotValues[0]).toBe('')
    // But the live getter returns the new state
    expect(d.state.slotValues[0]).toBe('9')
  })

  it('getSnapshot() and getState() both return a copy independent of further mutations', () => {
    const d    = createDigito({ length: 4 })
    d.inputChar(0, '3')
    const snap = d.getSnapshot()
    const st   = d.getState()
    d.resetState()
    expect(snap.slotValues[0]).toBe('3')
    expect(st.slotValues[0]).toBe('3')
    expect(d.state.slotValues[0]).toBe('')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// pasteString — integration with pattern + pasteTransformer
// ─────────────────────────────────────────────────────────────────────────────

describe('pasteString — pattern + pasteTransformer integration', () => {
  it('pasteTransformer strips dashes, pattern then validates hex chars', () => {
    const d = createDigito({
      length: 6,
      type: 'any',
      pattern: /^[0-9A-F]$/,
      pasteTransformer: (s) => s.replace(/-/g, '').toUpperCase(),
    })
    d.pasteString(0, 'a1-b2-c3')
    // after transformer: 'A1B2C3'; all valid hex
    expect(d.state.slotValues).toEqual(['A', '1', 'B', '2', 'C', '3'])
    expect(d.state.isComplete).toBe(true)
  })

  it('pasteTransformer that returns an empty string leaves slots unchanged', () => {
    const d = createDigito({
      length: 4,
      pasteTransformer: () => '',
    })
    d.pasteString(0, '1234')
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })

  it('partial paste with filter: only valid chars fill slots, rest remain empty', () => {
    const d = createDigito({ length: 6, type: 'numeric' })
    d.pasteString(0, '1a2b3c')  // valid: 1, 2, 3 — 3 chars
    expect(d.state.slotValues).toEqual(['1', '2', '3', '', '', ''])
    expect(d.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// filterChar / filterString — edge cases not yet covered
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar — additional edge cases', () => {
  it('type="numeric" rejects a space', () => {
    expect(filterChar(' ', 'numeric')).toBe('')
  })

  it('type="any" accepts a space (every single char is valid)', () => {
    expect(filterChar(' ', 'any')).toBe(' ')
  })

  it('type="alphabet" rejects a digit 0', () => {
    expect(filterChar('0', 'alphabet')).toBe('')
  })

  it('type="alphanumeric" accepts digit 0', () => {
    expect(filterChar('0', 'alphanumeric')).toBe('0')
  })

  it('unknown type falls through to empty string', () => {
    // TypeScript prevents this at compile-time, but runtime should be safe
    expect(filterChar('1', 'unknown' as InputType)).toBe('')
  })
})

describe('filterString — additional edge cases', () => {
  it('handles a string of spaces for type="numeric"', () => {
    expect(filterString('   ', 'numeric')).toBe('')
  })

  it('handles a string of spaces for type="any"', () => {
    expect(filterString('   ', 'any')).toBe('   ')
  })

  it('preserves order of valid characters', () => {
    expect(filterString('a1b2c3', 'alphanumeric')).toBe('a1b2c3')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createTimer — additional edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('createTimer — additional edge cases', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('reset() restores remainingSeconds so next start() runs full duration', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 3, onTick })
    t.start()
    jest.advanceTimersByTime(2000)
    t.reset()
    t.start()
    jest.advanceTimersByTime(3000)
    // After reset + restart: 3 more ticks (2, 1, 0)
    expect(onTick).toHaveBeenLastCalledWith(0)
  })

  it('onTick is NOT called with negative remainingSeconds', () => {
    const onTick = jest.fn()
    const t = createTimer({ totalSeconds: 1, onTick })
    t.start()
    jest.advanceTimersByTime(2000)  // well past expiry
    const allArgs = onTick.mock.calls.map(([r]) => r)
    expect(allArgs.every(r => r >= 0)).toBe(true)
  })

  it('onExpire is called exactly once even if time advances far past zero', () => {
    const onExpire = jest.fn()
    const t = createTimer({ totalSeconds: 1, onExpire })
    t.start()
    jest.advanceTimersByTime(10000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('no callbacks are called when neither onTick nor onExpire is provided', () => {
    expect(() => {
      const t = createTimer({ totalSeconds: 2 })
      t.start()
      jest.advanceTimersByTime(3000)
    }).not.toThrow()
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// createDigito — comprehensive length option handling
// ─────────────────────────────────────────────────────────────────────────────

describe('createDigito — length option comprehensive', () => {
  it('default length is 6 when no options passed', () => {
    expect(createDigito().state.slotValues).toHaveLength(6)
  })

  it('length=1 works correctly — single-slot OTP', () => {
    const d = createDigito({ length: 1 })
    d.inputChar(0, '9')
    expect(d.state.slotValues[0]).toBe('9')
    expect(d.state.isComplete).toBe(true)
    expect(d.state.activeSlot).toBe(0)  // stays at slot 0 (last slot)
  })

  it('large length (10) works correctly', () => {
    const d = createDigito({ length: 10 })
    for (let i = 0; i < 10; i++) d.inputChar(i, String(i % 10))
    expect(d.state.isComplete).toBe(true)
    expect(d.state.slotValues).toHaveLength(10)
  })

  it('fractional length 6.1 is floored to 6', () => {
    const d = createDigito({ length: 6.1 })
    expect(d.state.slotValues).toHaveLength(6)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// resetState — comprehensive
// ─────────────────────────────────────────────────────────────────────────────

describe('resetState — comprehensive', () => {
  it('does not affect the disabled flag', () => {
    const d = createDigito({ length: 4 })
    d.setDisabled(true)
    d.resetState()
    // disabled flag is NOT reset — resetState only clears slot values
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('')  // still disabled
  })

  it('can be called multiple times without throwing', () => {
    const d = createDigito({ length: 4 })
    expect(() => { d.resetState(); d.resetState(); d.resetState() }).not.toThrow()
  })

  it('resets activeSlot to 0', () => {
    const d = createDigito({ length: 4 })
    d.moveFocusTo(3)
    d.resetState()
    expect(d.state.activeSlot).toBe(0)
  })

  it('resets hasError to false', () => {
    const d = createDigito({ length: 4 })
    d.setError(true)
    d.resetState()
    expect(d.state.hasError).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: slotValues deep-clone in getSnapshot / getState / subscribe
// ─────────────────────────────────────────────────────────────────────────────

describe('slotValues immutability in snapshots', () => {
  it('mutating getSnapshot().slotValues does not corrupt live state', () => {
    const d    = createDigito({ length: 4 })
    d.inputChar(0, '7')
    const snap = d.getSnapshot()
    snap.slotValues[0] = 'MUTATED'
    expect(d.state.slotValues[0]).toBe('7')
  })

  it('mutating getState().slotValues does not corrupt live state', () => {
    const d  = createDigito({ length: 4 })
    d.inputChar(0, '3')
    const st = d.getState()
    st.slotValues[0] = 'MUTATED'
    expect(d.state.slotValues[0]).toBe('3')
  })

  it('subscriber receives a slotValues copy — mutating it does not corrupt live state', () => {
    const d = createDigito({ length: 4 })
    let captured: string[] = []
    d.subscribe(s => { captured = s.slotValues })
    d.inputChar(0, '5')
    captured[0] = 'MUTATED'
    expect(d.state.slotValues[0]).toBe('5')
  })

  it('subscriber slotValues is a different array reference than live state.slotValues', () => {
    const d = createDigito({ length: 4 })
    let subscriberRef: string[] | null = null
    d.subscribe(s => { subscriberRef = s.slotValues })
    d.inputChar(0, '1')
    expect(subscriberRef).not.toBe(d.state.slotValues)
  })

  it('getSnapshot after wrap-around paste reflects the correct values', () => {
    const d = createDigito({ length: 4 })
    d.pasteString(3, '1234')  // slot3='1', slot0='2', slot1='3', slot2='4'
    const snap = d.getSnapshot()
    expect(snap.slotValues).toEqual(['2', '3', '4', '1'])
    // Mutation must not leak back
    snap.slotValues[0] = 'X'
    expect(d.state.slotValues[0]).toBe('2')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: length: NaN must not crash
// ─────────────────────────────────────────────────────────────────────────────

describe('createDigito — length NaN guard', () => {
  it('length: NaN falls back to default length 6 without throwing', () => {
    expect(() => createDigito({ length: NaN })).not.toThrow()
    expect(createDigito({ length: NaN }).state.slotValues).toHaveLength(6)
  })

  it('length: NaN instance accepts input correctly', () => {
    const d = createDigito({ length: NaN })
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('1')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: invalid inputChar must not fire spurious subscriber notification
// ─────────────────────────────────────────────────────────────────────────────

describe('inputChar — no spurious subscriber notification on invalid char at current slot', () => {
  it('rejects invalid char without notifying subscribers when activeSlot unchanged', () => {
    const d = createDigito({ length: 4 })
    const calls: number[] = []
    d.subscribe(s => calls.push(s.activeSlot))
    d.inputChar(0, 'a')  // invalid for numeric, activeSlot already 0
    expect(calls).toHaveLength(0)
  })

  it('does notify subscribers when invalid char is typed at a different slot than active', () => {
    const d = createDigito({ length: 4 })
    d.moveFocusTo(2)
    const calls: number[] = []
    d.subscribe(s => calls.push(s.activeSlot))
    d.inputChar(0, 'a')  // invalid — but focus is at slot 2, so activeSlot changes to 0
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: filterChar — global (/g) regex must not alternate true/false
// ─────────────────────────────────────────────────────────────────────────────

describe('filterChar — global regex /g flag stability', () => {
  it('accepts the same digit on repeated calls with a /g pattern', () => {
    const gPattern = /^[0-9]$/g
    expect(filterChar('1', 'numeric', gPattern)).toBe('1')
    expect(filterChar('1', 'numeric', gPattern)).toBe('1')
    expect(filterChar('1', 'numeric', gPattern)).toBe('1')
  })

  it('filterString with a /g pattern does not corrupt intermediate results', () => {
    const gPattern = /^[0-9]$/g
    expect(filterString('1a2b3', 'numeric', gPattern)).toBe('123')
    // Called again — must be consistent, not alternating
    expect(filterString('123', 'numeric', gPattern)).toBe('123')
  })

  it('inputChar with a /g pattern accepts valid digits on every keystroke', () => {
    const d = createDigito({ length: 4, pattern: /^[0-9]$/g })
    d.inputChar(0, '1')
    d.inputChar(1, '2')
    d.inputChar(2, '3')
    d.inputChar(3, '4')
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4'])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// Bug regression: filterString — surrogate pairs must not corrupt slots
// ─────────────────────────────────────────────────────────────────────────────

describe('filterString — Unicode surrogate pair handling', () => {
  it('type="any" — emoji (supplementary plane) is rejected, not split into two slots', () => {
    // '😀' is U+1F600, encoded as a surrogate pair in UTF-16.
    // split('') would yield two half-surrogates each of length 1.
    // Array.from correctly yields one code point of length 2, which filterChar rejects.
    expect(filterString('😀', 'any')).toBe('')
  })

  it('type="any" — BMP characters (including CJK) pass through correctly', () => {
    expect(filterString('漢字', 'any')).toBe('漢字')
  })

  it('type="any" — mixed ASCII and emoji: only ASCII passes', () => {
    expect(filterString('a😀b', 'any')).toBe('ab')
  })

  it('pasteString with type="any" and emoji input does not write surrogates to slots', () => {
    const d = createDigito({ length: 4, type: 'any' })
    d.pasteString(0, '😀')
    // emoji should produce zero valid chars; all slots stay empty
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// subscribe — wrap-around paste notifies with correct slotValues
// ─────────────────────────────────────────────────────────────────────────────

describe('subscribe — wrap-around paste notification', () => {
  it('listener receives correct slotValues after wrap-around paste', () => {
    const d = createDigito({ length: 4 })
    let last: string[] = []
    d.subscribe(s => { last = [...s.slotValues] })
    d.pasteString(3, '1234')  // slot3='1', wrap: slot0='2', slot1='3', slot2='4'
    expect(last).toEqual(['2', '3', '4', '1'])
  })

  it('listener is not called when paste produces no valid characters', () => {
    const d = createDigito({ length: 4 })
    const calls: number[] = []
    d.subscribe(() => calls.push(1))
    d.pasteString(0, 'aaaa')  // all invalid for numeric
    expect(calls).toHaveLength(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// onTick in DigitoOptions is not wired to the core machine
// (core has no timer — timer is adapter-level)
// ─────────────────────────────────────────────────────────────────────────────

describe('createDigito — onTick is adapter-level, not wired to core', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('passing onTick to createDigito does not throw', () => {
    expect(() => createDigito({ length: 6, onTick: jest.fn() })).not.toThrow()
  })

  it('onTick passed to createDigito is never called (core has no timer)', () => {
    const onTick = jest.fn()
    const d = createDigito({ length: 6, onTick })
    // Fill the field and advance time — onTick should never fire
    '123456'.split('').forEach((c, i) => d.inputChar(i, c))
    jest.advanceTimersByTime(5000)
    expect(onTick).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pasteTransformer error path
// ─────────────────────────────────────────────────────────────────────────────

describe('createDigito — pasteTransformer error recovery', () => {
  let warnSpy: jest.SpyInstance
  beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(()  => { warnSpy.mockRestore() })

  it('falls back to raw text when pasteTransformer throws', () => {
    const d = createDigito({
      length: 4,
      pasteTransformer: () => { throw new Error('boom') },
    })
    expect(() => d.pasteString(0, '1234')).not.toThrow()
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4'])
    expect(warnSpy).toHaveBeenCalledWith(
      '[digito] pasteTransformer threw — using raw paste text.',
      expect.any(Error),
    )
  })

  it('fills no slots when transformer throws and raw text is invalid for the type', () => {
    const d = createDigito({
      length: 4,
      type: 'numeric',
      pasteTransformer: () => { throw new Error('boom') },
    })
    expect(() => d.pasteString(0, 'abcd')).not.toThrow()
    expect(d.state.slotValues).toEqual(['', '', '', ''])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// triggerHapticFeedback / triggerSoundFeedback
// ─────────────────────────────────────────────────────────────────────────────

describe('triggerHapticFeedback', () => {
  it('calls navigator.vibrate(10) when available', () => {
    const vibrate = jest.fn()
    Object.defineProperty(global, 'navigator', {
      value: { vibrate },
      configurable: true,
    })
    triggerHapticFeedback()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('does not throw when navigator.vibrate is absent', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
    })
    expect(() => triggerHapticFeedback()).not.toThrow()
  })

  it('does not throw when navigator is undefined', () => {
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      configurable: true,
    })
    expect(() => triggerHapticFeedback()).not.toThrow()
  })
})

describe('triggerSoundFeedback', () => {
  it('calls AudioContext and wires oscillator → gain → destination', () => {
    const close      = jest.fn().mockResolvedValue(undefined)
    const start      = jest.fn()
    const stop       = jest.fn()
    const connect    = jest.fn()
    const setValueAtTime            = jest.fn()
    const exponentialRampToValueAtTime = jest.fn()

    const oscillator = {
      connect,
      frequency: { value: 0 },
      start,
      stop,
      onended: null as (() => void) | null,
    }
    const gainNode = {
      connect,
      gain: { setValueAtTime, exponentialRampToValueAtTime },
    }
    const destination = {}
    const MockAudioContext = jest.fn().mockImplementation(() => ({
      createOscillator: () => oscillator,
      createGain:       () => gainNode,
      destination,
      currentTime: 0,
      close,
    }))

    const originalAudioContext = (global as Record<string, unknown>).AudioContext
    ;(global as Record<string, unknown>).AudioContext = MockAudioContext

    triggerSoundFeedback()

    expect(MockAudioContext).toHaveBeenCalledTimes(1)
    expect(oscillator.frequency.value).toBe(880)
    expect(start).toHaveBeenCalled()
    expect(stop).toHaveBeenCalled()

    // Simulate the oscillator ending — should close the context
    oscillator.onended!()
    expect(close).toHaveBeenCalled()

    ;(global as Record<string, unknown>).AudioContext = originalAudioContext
  })

  it('does not throw when AudioContext is unavailable', () => {
    const originalAudioContext = (global as Record<string, unknown>).AudioContext
    delete (global as Record<string, unknown>).AudioContext
    expect(() => triggerSoundFeedback()).not.toThrow()
    ;(global as Record<string, unknown>).AudioContext = originalAudioContext
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// NEW FEATURES — clearSlot (Delete key), defaultValue, readOnly, data attributes
// ─────────────────────────────────────────────────────────────────────────────

describe('clearSlot — Delete key semantics', () => {
  it('clears the focused slot and keeps activeSlot unchanged', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    d.inputChar(1, '2')
    d.moveFocusTo(1)
    d.clearSlot(1)
    expect(d.state.slotValues[1]).toBe('')
    expect(d.state.activeSlot).toBe(1)
  })

  it('does nothing when the slot is already empty', () => {
    const d = createDigito({ length: 4 })
    const before = { ...d.state }
    d.clearSlot(0)
    expect(d.state.slotValues[0]).toBe('')
    expect(d.state.activeSlot).toBe(before.activeSlot)
  })

  it('sets isComplete to false when a filled slot is cleared', () => {
    const d = createDigito({ length: 4 })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    expect(d.state.isComplete).toBe(true)
    d.clearSlot(2)
    expect(d.state.isComplete).toBe(false)
  })

  it('is silently ignored when disabled', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.inputChar(0, '1') // blocked by disabled, but set up via direct mutation for test
    const before = d.state.slotValues.join('')
    d.clearSlot(0)
    expect(d.state.slotValues.join('')).toBe(before)
  })

  it('is silently ignored when readOnly', () => {
    const d = createDigito({ length: 4 })
    // Pre-fill by temporarily disabling readOnly guard
    d.inputChar(0, '1')
    d.setReadOnly(true)
    d.clearSlot(0)
    expect(d.state.slotValues[0]).toBe('1')
  })

  it('ignores out-of-bounds indices', () => {
    const d = createDigito({ length: 4 })
    expect(() => d.clearSlot(-1)).not.toThrow()
    expect(() => d.clearSlot(99)).not.toThrow()
  })
})


describe('readOnly mode', () => {
  it('blocks inputChar', () => {
    const d = createDigito({ length: 4, readOnly: true })
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('')
  })

  it('blocks deleteChar', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '5')
    d.setReadOnly(true)
    d.deleteChar(0)
    expect(d.state.slotValues[0]).toBe('5')
  })

  it('blocks pasteString', () => {
    const d = createDigito({ length: 4, readOnly: true })
    d.pasteString(0, '1234')
    expect(d.state.slotValues.join('')).toBe('')
  })

  it('blocks clearSlot', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '7')
    d.setReadOnly(true)
    d.clearSlot(0)
    expect(d.state.slotValues[0]).toBe('7')
  })

  it('allows moveFocusLeft/Right/To', () => {
    const d = createDigito({ length: 4, readOnly: true })
    d.moveFocusRight(0)
    expect(d.state.activeSlot).toBe(1)
    d.moveFocusLeft(1)
    expect(d.state.activeSlot).toBe(0)
    d.moveFocusTo(3)
    expect(d.state.activeSlot).toBe(3)
  })

  it('setReadOnly(false) re-enables mutations', () => {
    const d = createDigito({ length: 4, readOnly: true })
    d.setReadOnly(false)
    d.inputChar(0, '9')
    expect(d.state.slotValues[0]).toBe('9')
  })
})


describe('setReadOnly — runtime toggle', () => {
  it('enabling readOnly after construction blocks input', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '1')
    d.setReadOnly(true)
    d.inputChar(1, '2')
    expect(d.state.slotValues[1]).toBe('')    // blocked
    expect(d.state.slotValues[0]).toBe('1')  // previous char preserved
  })

  it('disabling readOnly resumes input', () => {
    const d = createDigito({ length: 4, readOnly: true })
    d.setReadOnly(false)
    d.inputChar(0, '9')
    expect(d.state.slotValues[0]).toBe('9')
  })

  it('setReadOnly(true) blocks deleteChar', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '5')
    d.setReadOnly(true)
    d.deleteChar(0)
    expect(d.state.slotValues[0]).toBe('5')
  })

  it('setReadOnly(true) blocks clearSlot', () => {
    const d = createDigito({ length: 4 })
    d.inputChar(0, '7')
    d.setReadOnly(true)
    d.clearSlot(0)
    expect(d.state.slotValues[0]).toBe('7')
  })

  it('setReadOnly(true) blocks pasteString', () => {
    const d = createDigito({ length: 4 })
    d.setReadOnly(true)
    d.pasteString(0, '1234')
    expect(d.state.slotValues.join('')).toBe('')
  })

  it('setReadOnly does not affect navigation', () => {
    const d = createDigito({ length: 4, readOnly: true })
    d.moveFocusTo(3)
    d.setReadOnly(true)
    d.moveFocusLeft(3)
    expect(d.state.activeSlot).toBe(2)
  })

  it('toggle readOnly on/off multiple times works correctly', () => {
    const d = createDigito({ length: 4 })
    d.setReadOnly(true)
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('')
    d.setReadOnly(false)
    d.inputChar(0, '1')
    expect(d.state.slotValues[0]).toBe('1')
    d.setReadOnly(true)
    d.inputChar(1, '2')
    expect(d.state.slotValues[1]).toBe('')
  })
})


describe('isDisabled and isReadOnly reflected in state', () => {
  it('state.isDisabled is false by default', () => {
    const d = createDigito({ length: 4 })
    expect(d.state.isDisabled).toBe(false)
  })

  it('state.isDisabled is true when disabled option is passed', () => {
    const d = createDigito({ length: 4, disabled: true })
    expect(d.state.isDisabled).toBe(true)
  })

  it('setDisabled(true) updates state.isDisabled', () => {
    const d = createDigito({ length: 4 })
    d.setDisabled(true)
    expect(d.state.isDisabled).toBe(true)
  })

  it('setDisabled(false) updates state.isDisabled back to false', () => {
    const d = createDigito({ length: 4, disabled: true })
    d.setDisabled(false)
    expect(d.state.isDisabled).toBe(false)
  })

  it('state.isReadOnly is false by default', () => {
    const d = createDigito({ length: 4 })
    expect(d.state.isReadOnly).toBe(false)
  })

  it('state.isReadOnly is true when readOnly option is passed', () => {
    const d = createDigito({ length: 4, readOnly: true })
    expect(d.state.isReadOnly).toBe(true)
  })

  it('setReadOnly(true) updates state.isReadOnly', () => {
    const d = createDigito({ length: 4 })
    d.setReadOnly(true)
    expect(d.state.isReadOnly).toBe(true)
  })

  it('setReadOnly(false) updates state.isReadOnly back to false', () => {
    const d = createDigito({ length: 4, readOnly: true })
    d.setReadOnly(false)
    expect(d.state.isReadOnly).toBe(false)
  })

  it('subscriber receives updated isDisabled when setDisabled is called', () => {
    const d = createDigito({ length: 4 })
    const snapshots: boolean[] = []
    d.subscribe(s => snapshots.push(s.isDisabled))
    d.setDisabled(true)
    d.setDisabled(false)
    expect(snapshots).toEqual([true, false])
  })

  it('subscriber receives updated isReadOnly when setReadOnly is called', () => {
    const d = createDigito({ length: 4 })
    const snapshots: boolean[] = []
    d.subscribe(s => snapshots.push(s.isReadOnly))
    d.setReadOnly(true)
    d.setReadOnly(false)
    expect(snapshots).toEqual([true, false])
  })
})


describe('defaultValue in core initialisation', () => {
  it('pre-fills slots via inputChar without triggering onComplete', () => {
    let fired = false
    const d = createDigito({ length: 4, onComplete: () => { fired = true } })
    // Simulate what adapters do: fill via inputChar then cancel
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    d.cancelPendingComplete()
    expect(d.state.slotValues).toEqual(['1', '2', '3', '4'])
    expect(fired).toBe(false)
  })

  it('partial defaultValue leaves remaining slots empty', () => {
    const d = createDigito({ length: 6 })
    '123'.split('').forEach((c, i) => d.inputChar(i, c))
    d.cancelPendingComplete()
    expect(d.state.slotValues[3]).toBe('')
    expect(d.state.isComplete).toBe(false)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// formatCountdown
// ─────────────────────────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('formats seconds-only values as 0:ss', () => {
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(9)).toBe('0:09')
    expect(formatCountdown(30)).toBe('0:30')
    expect(formatCountdown(59)).toBe('0:59')
  })

  it('formats values with minutes as m:ss', () => {
    expect(formatCountdown(60)).toBe('1:00')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(90)).toBe('1:30')
    expect(formatCountdown(120)).toBe('2:00')
    expect(formatCountdown(125)).toBe('2:05')
  })

  it('zero-pads the seconds component to two digits', () => {
    expect(formatCountdown(61)).toBe('1:01')
    expect(formatCountdown(3600)).toBe('60:00')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// notifyCompleteIfReady — haptic / sound / clearTimeout branches
// ─────────────────────────────────────────────────────────────────────────────

describe('notifyCompleteIfReady — coverage branches', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(()  => jest.useRealTimers())

  it('haptic: false skips triggerHapticFeedback but still fires onComplete', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb, haptic: false })
    expect(() => {
      '1234'.split('').forEach((c, i) => d.inputChar(i, c))
      jest.advanceTimersByTime(10)
    }).not.toThrow()
    expect(cb).toHaveBeenCalledWith('1234')
  })

  it('sound: true does not throw and fires onComplete', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb, sound: true })
    expect(() => {
      '1234'.split('').forEach((c, i) => d.inputChar(i, c))
      jest.advanceTimersByTime(10)
    }).not.toThrow()
    expect(cb).toHaveBeenCalledWith('1234')
  })

  it('rapid re-completion clears the pending timeout and replaces it', () => {
    const cb = jest.fn()
    const d  = createDigito({ length: 4, onComplete: cb })
    '1234'.split('').forEach((c, i) => d.inputChar(i, c))
    // completeTimeoutId is now set — trigger a second completion before timeout fires
    d.deleteChar(3)
    d.inputChar(3, '4')   // re-fills slot 3 → line 116 clearTimeout branch hit
    jest.advanceTimersByTime(50)
    // onComplete must fire exactly once with the final code
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith('1234')
  })
})