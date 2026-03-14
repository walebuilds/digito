/**
 * digito/core/filter
 * ─────────────────────────────────────────────────────────────────────────────
 * Character filtering utilities — exported for use by all adapters.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

import type { InputType } from './types.js'

/**
 * Returns `char` if it is valid for `type` (and optional `pattern`), otherwise `''`.
 * Single character input only — multi-char strings always return `''`.
 *
 * When `pattern` is provided it takes precedence over `type` for validation.
 */
export function filterChar(char: string, type: InputType, pattern?: RegExp): string {
  if (!char || char.length !== 1) return ''
  if (pattern !== undefined) {
    // A pattern with the /g flag has stateful lastIndex. Reset it before every
    // test so the same pattern can be reused safely across multiple characters
    // without alternating between matches.
    if (pattern.global) pattern.lastIndex = 0
    return pattern.test(char) ? char : ''
  }
  switch (type) {
    case 'numeric':      return /^[0-9]$/.test(char)       ? char : ''
    case 'alphabet':     return /^[a-zA-Z]$/.test(char)    ? char : ''
    case 'alphanumeric': return /^[a-zA-Z0-9]$/.test(char) ? char : ''
    case 'any':          return char
    default:             return ''
  }
}

/**
 * Filters every character in `str` using `filterChar`.
 * Used to sanitize pasted strings and controlled-value inputs before distribution.
 *
 * When `pattern` is provided it takes precedence over `type` for each character.
 */
export function filterString(str: string, type: InputType, pattern?: RegExp): string {
  // Array.from iterates over Unicode code points, not UTF-16 code units.
  // str.split('') would split emoji and other supplementary-plane characters
  // into surrogate pairs (two strings of length 1 each), causing filterChar
  // to accept broken half-surrogates into slots for type:'any'.
  return Array.from(str).filter(c => filterChar(c, type, pattern) !== '').join('')
}
