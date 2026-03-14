<!--
  digito — Svelte example

  Demonstrates:
    - useOTP composable + use:action (single hidden-input architecture)
    - Store subscriptions for reactive slot rendering
    - maskChar option (configurable mask glyph, not hardcoded ●)
    - isFocused tracking via onFocus / onBlur callbacks
    - Separator rendering for single number and array values
    - Live timer countdown via timerSeconds → formatTimer
    - pasteTransformer, onComplete, onExpire
    - Programmatic reset / setError
-->

<script lang="ts">
  import { writable } from 'svelte/store'
  import { useOTP } from 'digito/svelte'

  // Track hidden-input focus ourselves — useOTP does not expose an isFocused store.
  const isFocused = writable(false)

  const otp = useOTP({
    length: 6,
    type:   'numeric',
    timer:  30,

    // Strip formatting from pasted codes like "G-123456" or "123 456"
    pasteTransformer: (raw: string) => raw.replace(/[\s-]/g, ''),

    // Masked mode: render maskChar instead of the real character
    masked:   true,
    maskChar: '*',          // default is '●' — any glyph works

    // Visual hint in empty slots
    placeholder: '○',

    // Visual separator — accepts a single index or an array: [2, 4]
    separatorAfter: 3,
    separator:      '—',

    onFocus: () => isFocused.set(true),
    onBlur:  () => isFocused.set(false),

    onComplete: (code: string) => {
      console.log('Complete:', code)
      otp.setError(code !== '123456')
    },
    onExpire: () => console.log('Expired'),
  })

  // Destructure the standalone stores (not on $otp DigitoState)
  const { value, timerSeconds, isDisabled, separatorAfter, separator, masked, maskChar, placeholder } = otp


  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Returns true when a separator should be rendered before slot `i`. */
  function isSeparatorBefore(separatorAfterVal: number | number[], i: number): boolean {
    if (Array.isArray(separatorAfterVal)) return separatorAfterVal.includes(i)
    return separatorAfterVal > 0 && i === separatorAfterVal
  }

  /** Formats remaining seconds as "M:SS". */
  function formatTimer(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }


  // ── Slot style helpers ────────────────────────────────────────────────────

  function borderColor(i: number, activeSlot: number, focused: boolean, hasError: boolean, isComplete: boolean): string {
    if (hasError)                         return '#FB2C36'
    if (isComplete && !hasError)          return '#00C950'
    if (i === activeSlot && focused)      return '#3D3D3D'
    return '#E5E5E5'
  }

  function boxShadow(color: string, isActive: boolean, hasError: boolean, isComplete: boolean): string {
    if (hasError || (isComplete && !hasError))
      return `0 0 0 3px color-mix(in srgb, ${color} 12%, transparent)`
    if (isActive)
      return `0 0 0 3px color-mix(in srgb, ${color} 10%, transparent)`
    return 'none'
  }
</script>

<div style="font-family: sans-serif; padding: 32px; max-width: 480px">
  <h2 style="margin-bottom: 8px">Enter verification code</h2>
  <p style="margin-bottom: 20px; font-size: 14px; color: #5C5C5C">
    Enter the 6-digit code sent to <strong>hello@example.com</strong>.
  </p>

  <!-- ── OTP field ──────────────────────────────────────────────────────── -->
  <!-- $otp subscribes to the main DigitoState store -->
  <div style="position: relative; display: inline-flex; gap: 8px; align-items: center">
    <!-- Single hidden input — bound via use:action, captures all input/paste/autofill -->
    <input
      use:otp.action
      style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; z-index: 1; cursor: text; border: none; outline: none; background: transparent; font-size: 1px"
    />

    <!-- Visual slot divs — purely decorative mirrors of state -->
    {#each $otp.slotValues as char, i}
      <!-- Separator — handles both single number and array values -->
      {#if isSeparatorBefore($separatorAfter, i)}
        <span aria-hidden="true" style="color: #A1A1A1; font-size: 18px; padding: 0 2px; user-select: none">
          {$separator}
        </span>
      {/if}

      {@const bc     = borderColor(i, $otp.activeSlot, $isFocused, $otp.hasError, $otp.isComplete)}
      {@const shadow = boxShadow(bc, i === $otp.activeSlot && $isFocused, $otp.hasError, $otp.isComplete)}
      <div style="
        position: relative;
        width: 56px; height: 56px;
        border: 1px solid {bc};
        border-radius: 10px;
        font-size: {$masked && char ? '16px' : '24px'}; font-weight: 600;
        display: flex; align-items: center; justify-content: center;
        background: {char ? '#FFFFFF' : '#FAFAFA'}; color: {char ? '#0A0A0A' : '#C0C0C0'};
        box-shadow: {shadow};
        opacity: {$isDisabled ? 0.45 : 1};
        transition: border-color 150ms ease, box-shadow 150ms ease;
        user-select: none; font-family: ui-monospace, monospace; cursor: text;
      ">
        <!-- Fake blinking caret on the active empty slot -->
        {#if i === $otp.activeSlot && $isFocused && !char && !$isDisabled}
          <div style="position: absolute; width: 2px; height: 52%; background: #3D3D3D; border-radius: 1px; animation: digito-blink 1s step-start infinite" />
        {/if}
        <!--
          masked + filled  →  the configured maskChar (not a hardcoded ●)
          unfilled         →  placeholder hint glyph (e.g. '○')
          normal           →  the real character
          Note: placeholder is a plain string (not a store) — no $ prefix
        -->
        {$masked && char ? $maskChar : char || placeholder}
      </div>
    {/each}
  </div>

  <!-- ── Live timer countdown ───────────────────────────────────────────── -->
  {#if $timerSeconds > 0}
    <p style="margin-top: 8px; font-size: 13px; color: {$timerSeconds < 10 ? '#FB2C36' : '#757575'}">
      Code expires in {formatTimer($timerSeconds)}
    </p>
  {/if}

  <!-- ── Status messages ───────────────────────────────────────────────── -->
  {#if $otp.hasError}
    <p style="margin-top: 8px; font-size: 13px; color: #FB2C36">
      Incorrect code. Try <strong>123456</strong>.
    </p>
  {/if}
  {#if $otp.isComplete && !$otp.hasError}
    <p style="margin-top: 8px; font-size: 13px; color: #00C950">✓ Verified!</p>
  {/if}

  <!-- ── Controls ──────────────────────────────────────────────────────── -->
  <div style="display: flex; gap: 8px; margin-top: 20px">
    <button on:click={otp.reset} style="padding: 8px 16px; border-radius: 8px; border: 1px solid #E5E5E5; cursor: pointer; font-family: inherit">
      Reset
    </button>
    <button on:click={() => otp.setError(false)} style="padding: 8px 16px; border-radius: 8px; border: 1px solid #E5E5E5; cursor: pointer; font-family: inherit">
      Clear error
    </button>
  </div>

  <!-- ── Debug output ───────────────────────────────────────────────────── -->
  <pre style="margin-top: 20px; font-size: 12px; color: #757575; background: #F5F5F5; padding: 12px; border-radius: 8px">{JSON.stringify({ code: $value, isComplete: $otp.isComplete, hasError: $otp.hasError, timer: $timerSeconds }, null, 2)}</pre>
</div>

<style>
  @keyframes digito-blink { 0%,100%{opacity:1} 50%{opacity:0} }
</style>
