/**
 * digito/core/feedback
 * ─────────────────────────────────────────────────────────────────────────────
 * Optional sensory feedback utilities — exported so consumers can call them
 * in their own event handlers without reimplementing the Web Audio / vibration
 * boilerplate ("bring your own feedback" pattern).
 *
 * Used internally by the core machine when `haptic` / `sound` options are set.
 *
 * @author  Olawale Balo — Product Designer + Design Engineer
 * @license MIT
 */

/**
 * Trigger a short haptic pulse via `navigator.vibrate`.
 * Silently no-ops in environments that don't support the Vibration API
 * (e.g. desktop browsers, Safari, Node.js).
 */
export function triggerHapticFeedback(): void {
  try { navigator?.vibrate?.(10) } catch { /* not supported — fail silently */ }
}

/**
 * Play a brief 880 Hz tone via the Web Audio API.
 * The AudioContext is closed immediately after the tone ends to prevent
 * Chrome's ~6-concurrent-context limit from being reached across calls.
 * Silently no-ops where Web Audio is unavailable.
 */
export function triggerSoundFeedback(): void {
  try {
    const audioCtx    = new AudioContext()
    const oscillator  = audioCtx.createOscillator()
    const gainNode    = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = 880
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08)
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + 0.08)
    // Close the context after the tone ends — prevents AudioContext instance leak
    oscillator.onended = () => { audioCtx.close().catch(() => { /* ignore */ }) }
  } catch { /* Web Audio not available — fail silently */ }
}
