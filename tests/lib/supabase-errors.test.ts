import { describe, it, expect, vi, beforeEach } from 'vitest'

const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: any[]) => captureException(...args),
}))

const { isMissingSchema, reportSupabaseError } = await import('../../lib/supabase-errors')

beforeEach(() => {
  captureException.mockClear()
})

describe('isMissingSchema', () => {
  it('detects PGRST205', () => {
    expect(isMissingSchema({ code: 'PGRST205', message: '...' })).toBe(true)
  })
  it('detects via message text', () => {
    expect(isMissingSchema({ message: 'Could not find table in schema cache' })).toBe(true)
    expect(isMissingSchema({ message: 'relation "foo" does not exist' })).toBe(true)
  })
  it('returns false for unrelated errors', () => {
    expect(isMissingSchema({ code: '42501', message: 'RLS' })).toBe(false)
    expect(isMissingSchema(null)).toBe(false)
    expect(isMissingSchema(undefined)).toBe(false)
  })
})

describe('reportSupabaseError', () => {
  it('captures to Sentry with the error code tag', () => {
    const err = { code: '42501', message: 'row violates row-level security policy for table "npc_relationships"' }
    reportSupabaseError(err, 'first-impression')
    expect(captureException).toHaveBeenCalledOnce()
    const [exception, ctx] = captureException.mock.calls[0]
    expect(exception).toBeInstanceOf(Error)
    expect((exception as Error).message).toContain('first-impression')
    expect((exception as Error).message).toContain('42501')
    expect(ctx.tags).toEqual({
      supabase_error_code: '42501',
      supabase_context: 'first-impression',
    })
  })

  it('passes details + hint as extras', () => {
    reportSupabaseError({ code: '23505', message: 'duplicate key', details: 'Key (id)=(...)', hint: 'use upsert' }, 'barter')
    const [, ctx] = captureException.mock.calls[0]
    expect(ctx.extra).toEqual({
      message: 'duplicate key',
      details: 'Key (id)=(...)',
      hint: 'use upsert',
    })
  })

  it('falls back to "unknown" when error has no code', () => {
    reportSupabaseError({ message: 'something' }, 'context')
    const [, ctx] = captureException.mock.calls[0]
    expect(ctx.tags.supabase_error_code).toBe('unknown')
  })

  it('is a no-op for null / undefined error', () => {
    reportSupabaseError(null, 'ctx')
    reportSupabaseError(undefined, 'ctx')
    expect(captureException).not.toHaveBeenCalled()
  })

  it('does not propagate even if Sentry.captureException throws', () => {
    captureException.mockImplementationOnce(() => { throw new Error('sentry-down') })
    expect(() => reportSupabaseError({ code: '42501', message: 'x' }, 'ctx')).not.toThrow()
  })
})
