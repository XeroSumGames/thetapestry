import { describe, it, expect } from 'vitest'
import { sanitizeFilename, prepareUpload } from '../../lib/safe-upload'

describe('sanitizeFilename', () => {
  it('strips path traversal', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd')
    expect(sanitizeFilename('..\\..\\windows\\system32\\evil.exe')).toBe('evil.exe')
  })

  it('replaces unsafe chars in stem with underscore', () => {
    expect(sanitizeFilename('my file (1).PNG')).toBe('my_file__1_.png')
  })

  it('lowercases extension', () => {
    expect(sanitizeFilename('foo.JPEG')).toBe('foo.jpeg')
    expect(sanitizeFilename('Bar.Png')).toBe('Bar.png')
  })

  it('truncates long stems (stem<=80, ext<=8)', () => {
    const long = 'a'.repeat(200) + '.png'
    const out = sanitizeFilename(long)
    expect(out.length).toBeLessThanOrEqual(80 + 1 + 8)
    expect(out.endsWith('.png')).toBe(true)
  })

  it('returns "file" when stem is empty', () => {
    expect(sanitizeFilename('')).toBe('file')
    expect(sanitizeFilename('   ')).toBe('___')
  })

  it('handles missing extension', () => {
    expect(sanitizeFilename('README')).toBe('README')
  })

  it('strips accents via NFKD + ASCII sweep', () => {
    expect(sanitizeFilename('café.png')).toBe('cafe_.png')
  })

  it('caps extension to 8 chars', () => {
    expect(sanitizeFilename('foo.superlongextension')).toBe('foo.superlon')
  })

  it('drops null bytes / weird unicode', () => {
    expect(sanitizeFilename('photo\x00.png')).toBe('photo_.png')
  })
})

describe('prepareUpload', () => {
  const f = (name: string, size = 1024, type = 'whatever') => ({ name, size, type })

  it('returns ok for valid image in pin-attachments', () => {
    const r = prepareUpload('pin-attachments', f('photo.jpg'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.filename).toBe('photo.jpg')
      expect(r.contentType).toBe('image/jpeg')
    }
  })

  it('rejects unknown bucket', () => {
    const r = prepareUpload('nope', f('photo.jpg'))
    expect(r.ok).toBe(false)
  })

  it('rejects oversized file', () => {
    const r = prepareUpload('pin-attachments', f('photo.jpg', 11 * 1024 * 1024))
    expect(r.ok).toBe(false)
  })

  it('module-covers has 5 MB cap, not 10', () => {
    const at5mb = 5 * 1024 * 1024
    expect(prepareUpload('module-covers', f('cover.png', at5mb)).ok).toBe(true)
    expect(prepareUpload('module-covers', f('cover.png', at5mb + 1)).ok).toBe(false)
  })

  it('tactical-maps has 25 MB cap (GM scene backgrounds run large)', () => {
    const at25mb = 25 * 1024 * 1024
    expect(prepareUpload('tactical-maps', f('map.png', at25mb)).ok).toBe(true)
    expect(prepareUpload('tactical-maps', f('map.png', at25mb + 1)).ok).toBe(false)
  })

  it('tactical-maps allows image extensions only (no PDFs)', () => {
    expect(prepareUpload('tactical-maps', f('map.png')).ok).toBe(true)
    expect(prepareUpload('tactical-maps', f('map.jpg')).ok).toBe(true)
    expect(prepareUpload('tactical-maps', f('map.webp')).ok).toBe(true)
    expect(prepareUpload('tactical-maps', f('handout.pdf')).ok).toBe(false)
    expect(prepareUpload('tactical-maps', f('vector.svg')).ok).toBe(false)
  })

  it('rejects SVG (script-execution risk)', () => {
    const r = prepareUpload('pin-attachments', f('vector.svg'))
    expect(r.ok).toBe(false)
  })

  it('rejects HTML', () => {
    const r = prepareUpload('pin-attachments', f('evil.html'))
    expect(r.ok).toBe(false)
  })

  it('rejects executables', () => {
    expect(prepareUpload('session-attachments', f('virus.exe')).ok).toBe(false)
    expect(prepareUpload('session-attachments', f('script.js')).ok).toBe(false)
  })

  it('sanitizes path-traversal filenames before accepting', () => {
    const r = prepareUpload('session-attachments', f('../../../etc/photo.png'))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.filename).toBe('photo.png')
  })

  it('PDFs allowed in attachment buckets, not in image-only buckets', () => {
    expect(prepareUpload('note-attachments', f('doc.pdf')).ok).toBe(true)
    expect(prepareUpload('session-attachments', f('doc.pdf')).ok).toBe(true)
    expect(prepareUpload('pin-attachments', f('doc.pdf')).ok).toBe(false)
    expect(prepareUpload('module-covers', f('doc.pdf')).ok).toBe(false)
  })

  it('overrides user-supplied content-type with extension-mapped value', () => {
    const r = prepareUpload('note-attachments', { name: 'photo.png', size: 100, type: 'text/html' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.contentType).toBe('image/png')
  })

  it('rejects files with no recognizable extension', () => {
    const r = prepareUpload('pin-attachments', f('noextension'))
    expect(r.ok).toBe(false)
  })
})
