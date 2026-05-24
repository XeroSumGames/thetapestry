import { describe, it, expect, vi, afterEach } from 'vitest'
import { confirmDeleteByName } from '../../lib/confirm-delete'

// The helper calls window.prompt() and the bare global alert(); stub both.
function withPrompt(returnValue: string | null) {
  const prompt = vi.fn(() => returnValue)
  const alertFn = vi.fn()
  vi.stubGlobal('window', { prompt, alert: alertFn })
  vi.stubGlobal('alert', alertFn)
  return { prompt, alertFn }
}

afterEach(() => vi.unstubAllGlobals())

describe('confirmDeleteByName', () => {
  it('returns true when the typed name matches exactly', () => {
    withPrompt('The Arena')
    expect(confirmDeleteByName('The Arena')).toBe(true)
  })

  it('trims whitespace on both sides before matching', () => {
    withPrompt('  The Arena  ')
    expect(confirmDeleteByName('The Arena')).toBe(true)
  })

  it('is case-sensitive - a casing mismatch does NOT delete', () => {
    const { alertFn } = withPrompt('the arena')
    expect(confirmDeleteByName('The Arena')).toBe(false)
    expect(alertFn).toHaveBeenCalledTimes(1)
  })

  it('returns false on a non-matching name and alerts', () => {
    const { alertFn } = withPrompt('Wrong Name')
    expect(confirmDeleteByName('The Arena')).toBe(false)
    expect(alertFn).toHaveBeenCalledTimes(1)
  })

  it('returns false when the prompt is cancelled (null) and does NOT alert', () => {
    const { alertFn } = withPrompt(null)
    expect(confirmDeleteByName('The Arena')).toBe(false)
    expect(alertFn).not.toHaveBeenCalled()
  })

  it('falls back to "this story" when the name is empty or nullish', () => {
    withPrompt('this story')
    expect(confirmDeleteByName('')).toBe(true)
    withPrompt('this story')
    expect(confirmDeleteByName(null)).toBe(true)
  })

  it('returns false (no throw) when window is undefined (SSR guard)', () => {
    vi.stubGlobal('window', undefined)
    expect(confirmDeleteByName('The Arena')).toBe(false)
  })
})
