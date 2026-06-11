import { describe, it, expect, vi, afterEach } from 'vitest'
import { loginPathFor, loginPathForCurrent } from '../../lib/login-redirect'

describe('loginPathFor', () => {
  it('builds /login?redirect=<encoded> for a normal app path', () => {
    expect(loginPathFor('/account')).toBe('/login?redirect=%2Faccount')
    expect(loginPathFor('/characters/abc-123')).toBe('/login?redirect=%2Fcharacters%2Fabc-123')
  })

  it('encodes query strings + fragments in the source path', () => {
    expect(loginPathFor('/messages?thread=42')).toBe('/login?redirect=%2Fmessages%3Fthread%3D42')
  })

  it('returns bare /login for null or empty pathname', () => {
    expect(loginPathFor(null)).toBe('/login')
    expect(loginPathFor(undefined)).toBe('/login')
    expect(loginPathFor('')).toBe('/login')
  })

  it('returns bare /login when already on /login or /signup', () => {
    expect(loginPathFor('/login')).toBe('/login')
    expect(loginPathFor('/signup')).toBe('/login')
  })

  it('returns bare /login when on the bare dashboard - no redirect=/ loop', () => {
    expect(loginPathFor('/')).toBe('/login')
  })
})

describe('loginPathForCurrent', () => {
  const origWindow = globalThis.window

  afterEach(() => {
    if (origWindow === undefined) {
      delete (globalThis as any).window
    } else {
      ;(globalThis as any).window = origWindow
    }
  })

  it('returns bare /login when window is undefined (SSR)', () => {
    delete (globalThis as any).window
    expect(loginPathForCurrent()).toBe('/login')
  })

  it('reads window.location.pathname when available', () => {
    ;(globalThis as any).window = { location: { pathname: '/messages' } }
    expect(loginPathForCurrent()).toBe('/login?redirect=%2Fmessages')
  })

  it('skips redirect for the dashboard root', () => {
    ;(globalThis as any).window = { location: { pathname: '/' } }
    expect(loginPathForCurrent()).toBe('/login')
  })
})
