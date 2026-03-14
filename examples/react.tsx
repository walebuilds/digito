/**
 * digito — React example
 *
 * Demonstrates:
 *   - useOTP hook + HiddenOTPInput component (hidden-input architecture)
 *   - Custom headless slot component via getSlotProps / SlotRenderProps
 *   - maskChar option (configurable mask glyph, not hardcoded ●)
 *   - Separator rendering for single number and array values
 *   - Live timer countdown via onTick → timerSeconds state
 *   - pasteTransformer, onComplete, onExpire
 *   - Programmatic reset / setError
 */

import { useOTP, HiddenOTPInput, type SlotRenderProps } from 'digito/react'


// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns true when a separator should be rendered before slot `i`. */
function isSeparatorBefore(separatorAfter: number | number[], i: number): boolean {
  if (Array.isArray(separatorAfter)) return separatorAfter.includes(i)
  return separatorAfter > 0 && i === separatorAfter
}

/** Formats remaining seconds as "M:SS". */
function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}


// ── Custom slot component ──────────────────────────────────────────────────

function Slot(props: SlotRenderProps) {
  const {
    char, isActive, isFilled, isError, isComplete, isDisabled,
    hasFakeCaret, masked, maskChar, placeholder,
  } = props

  const borderColor = isError
    ? '#FB2C36'
    : isComplete && !isError ? '#00C950'
    : isActive               ? '#3D3D3D'
    : '#E5E5E5'

  const boxShadow = isError || (isComplete && !isError) || isActive
    ? `0 0 0 3px color-mix(in srgb, ${borderColor} ${isActive ? 10 : 12}%, transparent)`
    : 'none'

  // What to show in the slot:
  //   masked + filled  →  the configured maskChar (not a hardcoded ●)
  //   unfilled         →  placeholder hint glyph (e.g. '○')
  //   normal           →  the real character
  const display = masked && isFilled ? maskChar : char || placeholder

  return (
    <div style={{
      position: 'relative', width: 56, height: 56,
      border: `1px solid ${borderColor}`, borderRadius: 10,
      fontSize: masked && isFilled ? 16 : 24,
      fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isFilled ? '#FFFFFF' : '#FAFAFA', color: char ? '#0A0A0A' : '#C0C0C0',
      boxShadow, opacity: isDisabled ? 0.45 : 1,
      transition: 'border-color 150ms ease, box-shadow 150ms ease',
      userSelect: 'none', fontFamily: 'ui-monospace, monospace',
      cursor: 'text',
    }}>
      {/* Fake blinking caret on the active empty slot */}
      {hasFakeCaret && (
        <div style={{
          position: 'absolute', width: 2, height: '52%',
          background: '#3D3D3D', borderRadius: 1,
          animation: 'digito-blink 1s step-start infinite',
        }} />
      )}
      {display}
    </div>
  )
}


// ── Main component ─────────────────────────────────────────────────────────

export default function OTPForm() {
  const otp = useOTP({
    length: 6,
    type:   'numeric',
    timer:  30,

    // Strip formatting from pasted codes like "G-123456" or "123 456"
    pasteTransformer: (raw) => raw.replace(/[\s-]/g, ''),

    // Masked mode: render maskChar instead of the real character
    masked:   true,
    maskChar: '*',          // default is '●' — any glyph works

    // Visual hint in empty slots
    placeholder: '○',

    // Visual separator — accepts a single index or an array: [2, 4]
    separatorAfter: 3,
    separator:      '—',

    onComplete: (code) => {
      console.log('Complete:', code)
      otp.setError(code !== '123456')
    },
    onExpire: () => console.log('Expired'),
  })

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 32, maxWidth: 480 }}>
      <h2 style={{ marginBottom: 8 }}>Enter verification code</h2>
      <p style={{ marginBottom: 20, fontSize: 14, color: '#5C5C5C' }}>
        Enter the 6-digit code sent to <strong>hello@example.com</strong>.
      </p>

      {/* ── OTP field ─────────────────────────────────────────────────── */}
      {/*
        Single hidden input sits over the visual slot divs.
        HiddenOTPInput positions itself absolutely to cover all slots.
        All keyboard / paste / autofill events are captured by this one input.
      */}
      <div style={{ position: 'relative', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <HiddenOTPInput {...otp.hiddenInputProps} />

        {/* Visual slots — purely decorative mirrors of state */}
        {otp.slotValues.map((_, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {/* Separator before this slot — supports single number and array */}
            {isSeparatorBefore(otp.separatorAfter, i) && (
              <span aria-hidden="true" style={{ color: '#A1A1A1', fontSize: 18, padding: '0 2px', userSelect: 'none' }}>
                {otp.separator}
              </span>
            )}
            <Slot {...otp.getSlotProps(i)} />
          </span>
        ))}
      </div>

      {/* ── Live timer countdown ──────────────────────────────────────── */}
      {otp.timerSeconds > 0 && (
        <p style={{ marginTop: 8, fontSize: 13, color: otp.timerSeconds < 10 ? '#FB2C36' : '#757575' }}>
          Code expires in {formatTimer(otp.timerSeconds)}
        </p>
      )}

      {/* ── Status messages ───────────────────────────────────────────── */}
      {otp.hasError && (
        <p style={{ marginTop: 8, fontSize: 13, color: '#FB2C36' }}>
          Incorrect code. Try <strong>123456</strong>.
        </p>
      )}
      {otp.isComplete && !otp.hasError && (
        <p style={{ marginTop: 8, fontSize: 13, color: '#00C950' }}>✓ Verified!</p>
      )}

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button
          onClick={otp.reset}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E5E5', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Reset
        </button>
        <button
          onClick={() => otp.setError(false)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E5E5', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Clear error
        </button>
      </div>

      {/* ── Debug output ──────────────────────────────────────────────── */}
      <pre style={{ marginTop: 20, fontSize: 12, color: '#757575', background: '#F5F5F5', padding: 12, borderRadius: 8 }}>
        {JSON.stringify({
          code:       otp.getCode(),
          isComplete: otp.isComplete,
          hasError:   otp.hasError,
          timer:      otp.timerSeconds,
        }, null, 2)}
      </pre>

      {/* Caret keyframe — place in global CSS or a <style> tag in a real app */}
      <style>{`@keyframes digito-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
