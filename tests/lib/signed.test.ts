// Smoke test for the signed-integer renderer used in the vehicle brew
// + crew labels. Lives at tests/lib/ even though the helper is currently
// inline in app/vehicle/page.tsx - locks the contract while the helper
// finds its permanent home in a future extraction.

import { describe, it, expect } from 'vitest'

function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '0'
}

describe('signed', () => {
  it('renders positive with a + prefix', () => {
    expect(signed(2)).toBe('+2')
    expect(signed(99)).toBe('+99')
  })
  it('renders negative with no extra + (the minus is the sign)', () => {
    expect(signed(-3)).toBe('-3')
    expect(signed(-1)).toBe('-1')
  })
  it('renders zero as "0" with no sign', () => {
    expect(signed(0)).toBe('0')
  })
})
