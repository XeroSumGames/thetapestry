import { describe, it, expect } from 'vitest'
import { dropBenignEvent } from '../../lib/sentry-filters'

function eventWith(opts: { message?: string; frames?: Array<{ filename?: string }> } = {}): any {
  const exception: any = {}
  if (opts.message !== undefined) exception.value = opts.message
  if (opts.frames !== undefined) exception.stacktrace = { frames: opts.frames }
  return {
    exception: { values: [exception] },
  }
}

describe('dropBenignEvent', () => {
  it('drops ResizeObserver loop noise', () => {
    expect(dropBenignEvent(eventWith({ message: 'ResizeObserver loop limit exceeded' }))).toBeNull()
    expect(dropBenignEvent(eventWith({ message: 'ResizeObserver loop completed with undelivered notifications' }))).toBeNull()
  })

  it('drops Non-Error promise rejection captured', () => {
    expect(dropBenignEvent(eventWith({ message: 'Non-Error promise rejection captured with value: cancelled' }))).toBeNull()
  })

  it('drops user-aborted fetches', () => {
    expect(dropBenignEvent(eventWith({ message: 'AbortError: The user aborted a request.' }))).toBeNull()
    expect(dropBenignEvent(eventWith({ message: 'signal is aborted without reason' }))).toBeNull()
    expect(dropBenignEvent(eventWith({ message: 'The operation was aborted' }))).toBeNull()
  })

  it('drops Safari fetch-on-navigation noise', () => {
    expect(dropBenignEvent(eventWith({ message: 'Load failed' }))).toBeNull()
    expect(dropBenignEvent(eventWith({ message: 'NetworkError when attempting to fetch resource.' }))).toBeNull()
  })

  it('drops bare "Failed to fetch" but KEEPS detailed fetch errors', () => {
    expect(dropBenignEvent(eventWith({ message: 'Failed to fetch' }))).toBeNull()
    // Detailed fetch error with a cause/path appended is a real signal, keep it.
    const detailed = eventWith({ message: 'Failed to fetch https://api.example.com/v1/users' })
    expect(dropBenignEvent(detailed)).not.toBeNull()
  })

  it('drops server-side socket churn', () => {
    expect(dropBenignEvent(eventWith({ message: 'Error: read ECONNRESET' }))).toBeNull()
    expect(dropBenignEvent(eventWith({ message: 'Client network socket disconnected before secure TLS connection was established' }))).toBeNull()
  })

  it('drops errors from browser extensions', () => {
    const event = eventWith({
      message: 'Some error from an extension',
      frames: [
        { filename: 'https://thetapestry.distemperverse.com/_next/static/chunks/app.js' },
        { filename: 'chrome-extension://abc123/content.js' },
      ],
    })
    expect(dropBenignEvent(event)).toBeNull()
  })

  it('drops moz-extension + safari-web-extension + webkit-masked-url', () => {
    for (const url of [
      'moz-extension://abc/content.js',
      'safari-web-extension://abc/content.js',
      'webkit-masked-url://hidden/',
    ]) {
      const event = eventWith({ message: 'x', frames: [{ filename: url }] })
      expect(dropBenignEvent(event)).toBeNull()
    }
  })

  it('keeps real application errors', () => {
    const event = eventWith({
      message: 'Cannot read properties of undefined (reading "id")',
      frames: [
        { filename: 'https://thetapestry.distemperverse.com/_next/static/chunks/page.js' },
      ],
    })
    expect(dropBenignEvent(event)).not.toBeNull()
  })

  it('keeps events with no exception payload (passthrough)', () => {
    const event = { message: 'something' } as any
    expect(dropBenignEvent(event)).not.toBeNull()
  })

  it('keeps events with empty exception value', () => {
    const event = { exception: { values: [{}] } } as any
    expect(dropBenignEvent(event)).not.toBeNull()
  })
})
