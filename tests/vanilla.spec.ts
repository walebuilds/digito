/**
 * Digito — Vanilla adapter E2E tests
 *
 * Fixture: examples/vanilla.html
 *   - 6-slot alphanumeric field
 *   - data-timer="60"  (built-in footer + resend row)
 *   - data-separator-after="4"  (separator after slot index 3)
 *   - masked: false (hidden input type="text")
 *   - pasteTransformer: strips /[\s-]/g
 *   - Verify button: code "123456" → success, anything else → error
 *   - window.Digito.init is available for programmatic instances in tests
 */

import { test, expect, type Page } from '@playwright/test'

const FIXTURE = '/examples/vanilla.html'

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Set the hidden input's value via JS and fire an input event.
 * Uses evaluate() so opacity:0 never blocks the action.
 */
async function fillHidden(page: Page, value: string): Promise<void> {
  await page.evaluate((v) => {
    const input = document.querySelector<HTMLInputElement>('.digito-hidden-input')!
    input.value = v
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/**
 * Focus the hidden input via JS (bypasses opacity:0 actionability check).
 */
async function focusHidden(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector<HTMLInputElement>('.digito-hidden-input')!.focus()
  })
}

/**
 * Dispatch a synthetic paste event on the hidden input.
 * Uses Object.defineProperty for cross-browser compatibility (Firefox does not
 * support setting clipboardData via the ClipboardEvent constructor).
 */
async function pasteInto(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const input = document.querySelector<HTMLInputElement>('.digito-hidden-input')!
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (_type: string) => t },
    })
    input.dispatchEvent(event)
  }, text)
}


// ── Initial render ─────────────────────────────────────────────────────────────

test.describe('Vanilla adapter — render', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-slot')
  })

  test('renders 6 slot divs', async ({ page }) => {
    await expect(page.locator('.digito-slot')).toHaveCount(6)
  })

  test('renders a separator at the configured position', async ({ page }) => {
    // Create a programmatic instance with separatorAfter: 3 (after slot index 2, 1-based)
    const separatorCount = await page.evaluate(() => {
      const wrapper = document.createElement('div')
      wrapper.id = 'test-separator-render'
      document.body.appendChild(wrapper)
      ;(window as any).Digito.init('#test-separator-render', {
        length: 6,
        type: 'numeric',
        separatorAfter: 3,
        autoFocus: false,
      })
      return wrapper.querySelectorAll('.digito-separator').length
    })
    expect(separatorCount).toBe(1)
  })

  test('hidden input has autocomplete="one-time-code"', async ({ page }) => {
    await expect(page.locator('.digito-hidden-input'))
      .toHaveAttribute('autocomplete', 'one-time-code')
  })

  test('hidden input type is "text" when masked is false', async ({ page }) => {
    await expect(page.locator('.digito-hidden-input')).toHaveAttribute('type', 'text')
  })

  /**
   * Mobile Chrome keyboard hint:
   * A numeric-type field must set inputMode="numeric" so that mobile browsers
   * (Pixel 5, iPhone, etc.) show the numpad instead of the full QWERTY keyboard.
   * The fixture uses type="alphanumeric" so we create a fresh numeric instance.
   */
  test('numeric type sets inputMode="numeric" for mobile keyboard hint', async ({ page }) => {
    await page.evaluate(() => {
      const div = document.createElement('div')
      div.id = 'test-inputmode'
      document.body.appendChild(div)
      ;(window as any).Digito.init('#test-inputmode', {
        length: 4,
        type: 'numeric',
        autoFocus: false,
      })
    })
    const inputMode = await page.locator('#test-inputmode .digito-hidden-input').evaluate(
      (el) => (el as HTMLInputElement).inputMode,
    )
    expect(inputMode).toBe('numeric')
  })
})


// ── autoFocus ──────────────────────────────────────────────────────────────────

test.describe('Vanilla adapter — autoFocus', () => {
  test('autofocuses the hidden input on mount', async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForFunction(
      () => document.activeElement?.classList.contains('digito-hidden-input'),
      { timeout: 5_000 },
    )
  })
})


// ── Keyboard input ─────────────────────────────────────────────────────────────

test.describe('Vanilla adapter — keyboard input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-slot')
    // Wait for autoFocus rAF so the input is actually focused
    await page.waitForFunction(
      () => document.activeElement?.classList.contains('digito-hidden-input'),
      { timeout: 3_000 },
    )
  })

  test('typing fills slots and applies is-filled class', async ({ page }) => {
    await fillHidden(page, '123456')
    await expect(page.locator('.digito-slot.is-filled')).toHaveCount(6)
  })

  test('typing advances the active slot index', async ({ page }) => {
    // After typing 1 char the cursor moves to slot 1
    await fillHidden(page, '1')
    await expect(page.locator('.digito-slot[data-slot="1"]')).toHaveClass(/is-active/)
  })

  test('backspace removes the last character', async ({ page }) => {
    await fillHidden(page, '123')
    await expect(page.locator('.digito-slot.is-filled')).toHaveCount(3)
    await focusHidden(page)
    // Move cursor to position 3 (after '3') then press Backspace
    await page.evaluate(() => {
      const el = document.querySelector<HTMLInputElement>('.digito-hidden-input')!
      el.setSelectionRange(3, 3)
    })
    await page.keyboard.press('Backspace')
    await expect(page.locator('.digito-slot.is-filled')).toHaveCount(2)
  })

  test('ArrowLeft moves focus to the previous slot', async ({ page }) => {
    await fillHidden(page, '12')
    await focusHidden(page)
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('.digito-hidden-input')!.setSelectionRange(2, 2)
    })
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.digito-slot[data-slot="1"]')).toHaveClass(/is-active/)
  })

  test('ArrowRight moves focus to the next slot', async ({ page }) => {
    await fillHidden(page, '1')
    await focusHidden(page)
    // Move cursor to slot 0 first
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('.digito-hidden-input')!.setSelectionRange(0, 0)
    })
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.digito-slot[data-slot="1"]')).toHaveClass(/is-active/)
  })
})


// ── Paste ──────────────────────────────────────────────────────────────────────

test.describe('Vanilla adapter — paste', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-slot')
  })

  test('paste fills all slots from clipboard text', async ({ page }) => {
    await pasteInto(page, '123456')
    await expect(page.locator('.digito-slot.is-filled')).toHaveCount(6)
  })

  test('pasteTransformer strips spaces and dashes before filling', async ({ page }) => {
    // Raw paste: '12 - 3456'  →  pasteTransformer → '123456'
    await pasteInto(page, '12 - 3456')
    await expect(page.locator('.digito-slot.is-filled')).toHaveCount(6)
    const hiddenVal = await page.locator('.digito-hidden-input').inputValue()
    expect(hiddenVal).toBe('123456')
  })
})


// ── Verify, error, success ─────────────────────────────────────────────────────

test.describe('Vanilla adapter — verify flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-slot')
  })

  test('correct code applies is-success to all slots and shows success status', async ({ page }) => {
    await fillHidden(page, '032026')
    await page.locator('#btn-verify').click()
    await expect(page.locator('.digito-slot.is-success')).toHaveCount(6)
    await expect(page.locator('#status')).toContainText('Verification successful')
  })

  test('wrong code applies is-error to all slots and shows error status', async ({ page }) => {
    await fillHidden(page, '999999')
    await page.locator('#btn-verify').click()
    await expect(page.locator('.digito-slot.is-error')).toHaveCount(6)
    await expect(page.locator('#status')).toContainText('Incorrect')
  })

  test('incomplete code applies is-error and shows fill-in message', async ({ page }) => {
    await fillHidden(page, '123')
    await page.locator('#btn-verify').click()
    await expect(page.locator('.digito-slot.is-error')).toHaveCount(6)
    await expect(page.locator('#status')).toContainText('Please enter all')
  })

  /**
   * Firefox onComplete coverage:
   * onComplete must fire automatically (via its 10 ms setTimeout) when all
   * slots are filled, without any button click. We create a fresh instance
   * with a custom onComplete that stores the code in window.__completedCode,
   * then verify that value appears after filling the input.
   */
  test('onComplete callback fires automatically when all slots are filled', async ({ page }) => {
    await page.evaluate(() => {
      const div = document.createElement('div')
      div.id = 'test-oncomplete'
      document.body.appendChild(div)
      ;(window as any).Digito.init('#test-oncomplete', {
        length: 4,
        type: 'numeric',
        autoFocus: false,
        onComplete: (code: string) => { ;(window as any).__completedCode = code },
      })
    })

    // Fill all 4 slots
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#test-oncomplete .digito-hidden-input')!
      input.value = '4321'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    // onComplete fires after a 10 ms setTimeout — poll until it appears
    await page.waitForFunction(() => (window as any).__completedCode !== undefined, { timeout: 3_000 })
    const code = await page.evaluate(() => (window as any).__completedCode)
    expect(code).toBe('4321')
  })
})


// ── Reset ──────────────────────────────────────────────────────────────────────

test.describe('Vanilla adapter — reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-slot')
  })

  test('reset clears all slots and removes error/success state', async ({ page }) => {
    // Enter wrong code to produce error state
    await fillHidden(page, '999999')
    await page.locator('#btn-verify').click()
    await expect(page.locator('.digito-slot.is-error')).toHaveCount(6)

    await page.locator('#btn-reset').click()
    await expect(page.locator('.digito-slot.is-filled')).toHaveCount(0)
    await expect(page.locator('.digito-slot.is-error')).toHaveCount(0)
    await expect(page.locator('.digito-slot.is-success')).toHaveCount(0)
    await expect(page.locator('#status')).toHaveText('')
  })

  test('reset re-focuses the hidden input', async ({ page }) => {
    await fillHidden(page, '123456')
    // Blur by clicking elsewhere
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.locator('#btn-reset').click()
    await page.waitForFunction(
      () => document.activeElement?.classList.contains('digito-hidden-input'),
      { timeout: 3_000 },
    )
  })
})


// ── Timer ──────────────────────────────────────────────────────────────────────

test.describe('Vanilla adapter — timer', () => {
  // page.clock.install() must be called BEFORE page.goto() so that the
  // setInterval created by createTimer() uses the fake clock from the start.
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-timer-badge')
  })

  test('timer badge shows the initial countdown value (1:00)', async ({ page }) => {
    await expect(page.locator('.digito-timer-badge')).toHaveText('1:00')
  })

  test('timer badge counts down by 5 seconds', async ({ page }) => {
    await page.clock.runFor(5_000)
    await expect(page.locator('.digito-timer-badge')).toHaveText('0:55')
  })

  test('resend row becomes visible after timer expires', async ({ page }) => {
    await page.clock.runFor(61_000)
    await expect(page.locator('.digito-resend')).toHaveClass(/is-visible/)
    await expect(page.locator('.digito-timer')).toBeHidden()
  })

  test('clicking Resend restarts the timer and fires onResend', async ({ page }) => {
    await page.clock.runFor(61_000)
    await expect(page.locator('.digito-resend')).toHaveClass(/is-visible/)

    await page.locator('.digito-resend-btn').click()

    // Timer footer should reappear and resend row should be hidden
    await expect(page.locator('.digito-timer')).toBeVisible()
    await expect(page.locator('.digito-resend')).not.toHaveClass(/is-visible/)
    // onResend callback sets the status element
    await expect(page.locator('#status')).toContainText('new code')
  })
})


// ── Disabled & masked ──────────────────────────────────────────────────────────

test.describe('Vanilla adapter — disabled and masked', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-slot')
  })

  test('setDisabled(true) applies is-disabled to all slots and disables the input', async ({ page }) => {
    await page.evaluate(() => {
      const div = document.createElement('div')
      div.id = 'test-disabled'
      document.body.appendChild(div)
      const [inst] = (window as any).Digito.init('#test-disabled', {
        length: 4,
        type: 'numeric',
        autoFocus: false,
      })
      inst.setDisabled(true)
    })
    await expect(page.locator('#test-disabled .digito-slot.is-disabled')).toHaveCount(4)
    await expect(page.locator('#test-disabled .digito-hidden-input')).toBeDisabled()
  })

  test('masked: true sets hidden input type to "password"', async ({ page }) => {
    await page.evaluate(() => {
      const div = document.createElement('div')
      div.id = 'test-masked'
      document.body.appendChild(div)
      ;(window as any).Digito.init('#test-masked', {
        length: 4,
        type: 'numeric',
        masked: true,
        maskChar: '*',
        autoFocus: false,
      })
    })
    await expect(page.locator('#test-masked .digito-hidden-input'))
      .toHaveAttribute('type', 'password')
  })

  test('masked: true renders maskChar in filled slots instead of the real digit', async ({ page }) => {
    await page.evaluate(() => {
      const div = document.createElement('div')
      div.id = 'test-masked2'
      document.body.appendChild(div)
      ;(window as any).Digito.init('#test-masked2', {
        length: 4,
        type: 'numeric',
        masked: true,
        maskChar: '*',
        autoFocus: false,
      })
    })
    // Fill the first slot
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#test-masked2 .digito-hidden-input')!
      input.value = '1'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const slotText = await page.locator('#test-masked2 .digito-slot').first().textContent()
    expect(slotText?.trim()).toBe('*')
  })
})


// ── Tab / Shift+Tab keyboard navigation ────────────────────────────────────────

test.describe('Vanilla adapter — Tab / Shift+Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE)
    await page.waitForSelector('.digito-slot')
    await page.waitForFunction(
      () => document.activeElement?.classList.contains('digito-hidden-input'),
      { timeout: 3_000 },
    )
  })

  test('Tab on empty slot 0 releases focus from the component (falls through)', async ({ page }) => {
    // Slot 0 is empty — Tab is not intercepted, browser moves focus away
    await page.keyboard.press('Tab')
    const isHiddenFocused = await page.evaluate(
      () => document.activeElement?.classList.contains('digito-hidden-input') ?? false,
    )
    expect(isHiddenFocused).toBe(false)
  })

  test('Tab on a filled slot advances to the next slot', async ({ page }) => {
    await fillHidden(page, '1')
    await focusHidden(page)
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('.digito-hidden-input')!.setSelectionRange(0, 0)
    })
    await page.keyboard.press('Tab')
    await expect
      .poll(
        () => page.evaluate(() =>
          document.querySelector('.digito-slot.is-active')?.getAttribute('data-slot') ?? null,
        ),
        { timeout: 3_000 },
      )
      .toBe('1')
  })

  test('Shift+Tab on slot > 0 moves to the previous slot', async ({ page }) => {
    await fillHidden(page, '12')
    await focusHidden(page)
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('.digito-hidden-input')!.setSelectionRange(2, 2)
    })
    await page.keyboard.press('Shift+Tab')
    await expect
      .poll(
        () => page.evaluate(() =>
          document.querySelector('.digito-slot.is-active')?.getAttribute('data-slot') ?? null,
        ),
        { timeout: 3_000 },
      )
      .toBe('1')
  })

  test('Shift+Tab on slot 0 releases focus from the component (falls through)', async ({ page }) => {
    await focusHidden(page)
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('.digito-hidden-input')!.setSelectionRange(0, 0)
    })
    // Slot 0 — Shift+Tab falls through, releasing focus from the component
    await page.keyboard.press('Shift+Tab')
    const isHiddenFocused = await page.evaluate(
      () => document.activeElement?.classList.contains('digito-hidden-input') ?? false,
    )
    expect(isHiddenFocused).toBe(false)
  })
})
