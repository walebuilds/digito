<!--
  digito — Vue 3 example

  Demonstrates:
    - useOTP composable + hidden-input architecture
    - Custom slot styling with slotBorderColor / slotBoxShadow helpers
    - maskChar option (configurable mask glyph, not hardcoded ●)
    - Separator rendering for single number and array values
    - Live timer countdown via timerSeconds → formatTimer
    - pasteTransformer, onComplete, onExpire
    - Programmatic reset / setError
-->

<template>
  <div style="font-family: sans-serif; padding: 32px; max-width: 480px">
    <h2 style="margin-bottom: 8px">Enter verification code</h2>
    <p style="margin-bottom: 20px; font-size: 14px; color: #5C5C5C">
      Enter the 6-digit code sent to <strong>hello@example.com</strong>.
    </p>

    <!-- ── OTP field ──────────────────────────────────────────────────────── -->
    <!--
      Single hidden input sits over the visual slot divs.
      All keyboard / paste / autofill events are captured by this one input.
    -->
    <div style="position: relative; display: inline-flex; gap: 8px; align-items: center">
      <!-- Hidden real input — captures all keyboard / paste / autofill -->
      <input
        :ref="(el) => (otp.inputRef.value = el as HTMLInputElement | null)"
        v-bind="otp.hiddenInputAttrs.value"
        style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; z-index: 1; cursor: text; border: none; outline: none; background: transparent; font-size: 1px"
        @keydown="otp.onKeydown"
        @input="otp.onChange"
        @paste="otp.onPaste"
        @focus="otp.onFocus"
        @blur="otp.onBlur"
      />

      <!-- Visual slot divs — purely decorative mirrors of state -->
      <template v-for="(char, i) in otp.slotValues.value" :key="i">
        <!-- Separator — handles both single number and array values -->
        <span
          v-if="isSeparatorBefore(otp.separatorAfter.value, i)"
          aria-hidden="true"
          style="color: #A1A1A1; font-size: 18px; padding: 0 2px; user-select: none"
        >{{ otp.separator.value }}</span>

        <div
          :style="{
            position:       'relative',
            width:          '56px',
            height:         '56px',
            border:         `1px solid ${slotBorderColor(i)}`,
            borderRadius:   '10px',
            fontSize:       otp.masked.value && !!char ? '16px' : '24px',
            fontWeight:     600,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            background:     char ? '#FFFFFF' : '#FAFAFA',
            color:          char ? '#0A0A0A' : '#C0C0C0',
            boxShadow:      slotBoxShadow(i),
            opacity:        otp.isDisabled.value ? 0.45 : 1,
            transition:     'border-color 150ms ease, box-shadow 150ms ease',
            userSelect:     'none',
            fontFamily:     'ui-monospace, monospace',
            cursor:         'text',
          }"
        >
          <!-- Fake blinking caret on the active empty slot -->
          <div
            v-if="i === otp.activeSlot.value && otp.isFocused.value && !char"
            style="position: absolute; width: 2px; height: 52%; background: #3D3D3D; border-radius: 1px; animation: digito-blink 1s step-start infinite"
          />
          <!--
            masked + filled  →  the configured maskChar (not a hardcoded ●)
            unfilled         →  placeholder hint glyph (e.g. '○')
            normal           →  the real character
          -->
          {{ otp.masked.value && char ? otp.maskChar.value : char || otp.placeholder }}
        </div>
      </template>
    </div>

    <!-- ── Live timer countdown ───────────────────────────────────────────── -->
    <p
      v-if="otp.timerSeconds.value > 0"
      :style="{ marginTop: '8px', fontSize: '13px', color: otp.timerSeconds.value < 10 ? '#FB2C36' : '#757575' }"
    >
      Code expires in {{ formatTimer(otp.timerSeconds.value) }}
    </p>

    <!-- ── Status messages ───────────────────────────────────────────────── -->
    <p v-if="otp.hasError.value" style="margin-top: 8px; font-size: 13px; color: #FB2C36">
      Incorrect code. Try <strong>123456</strong>.
    </p>
    <p v-if="otp.isComplete.value && !otp.hasError.value" style="margin-top: 8px; font-size: 13px; color: #00C950">
      ✓ Verified!
    </p>

    <!-- ── Controls ──────────────────────────────────────────────────────── -->
    <div style="display: flex; gap: 8px; margin-top: 20px">
      <button
        @click="otp.reset()"
        style="padding: 8px 16px; border-radius: 8px; border: 1px solid #E5E5E5; cursor: pointer; font-family: inherit"
      >
        Reset
      </button>
      <button
        @click="otp.setError(false)"
        style="padding: 8px 16px; border-radius: 8px; border: 1px solid #E5E5E5; cursor: pointer; font-family: inherit"
      >
        Clear error
      </button>
    </div>

    <!-- ── Debug output ───────────────────────────────────────────────────── -->
    <pre style="margin-top: 20px; font-size: 12px; color: #757575; background: #F5F5F5; padding: 12px; border-radius: 8px">{{ debugState }}</pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOTP } from 'digito/vue'

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

  onComplete: (code: string) => {
    console.log('Complete:', code)
    otp.setError(code !== '123456')
  },
  onExpire: () => console.log('Expired'),
})


// ── Helpers ──────────────────────────────────────────────────────────────────

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


// ── Slot style helpers ────────────────────────────────────────────────────────

function slotBorderColor(i: number): string {
  if (otp.hasError.value)                                return '#FB2C36'
  if (otp.isComplete.value && !otp.hasError.value)       return '#00C950'
  if (i === otp.activeSlot.value && otp.isFocused.value) return '#3D3D3D'
  return '#E5E5E5'
}

function slotBoxShadow(i: number): string {
  const color    = slotBorderColor(i)
  const isActive = i === otp.activeSlot.value && otp.isFocused.value
  if (otp.hasError.value || (otp.isComplete.value && !otp.hasError.value))
    return `0 0 0 3px color-mix(in srgb, ${color} 12%, transparent)`
  if (isActive)
    return `0 0 0 3px color-mix(in srgb, ${color} 10%, transparent)`
  return 'none'
}

const debugState = computed(() => JSON.stringify({
  code:       otp.value.value,
  isComplete: otp.isComplete.value,
  hasError:   otp.hasError.value,
  timer:      otp.timerSeconds.value,
}, null, 2))
</script>

<style>
@keyframes digito-blink { 0%,100%{opacity:1} 50%{opacity:0} }
</style>
