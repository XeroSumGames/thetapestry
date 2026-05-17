import { describe, it, expect } from 'vitest'
import { resizeImage, MAX_INPUT_BYTES, ImageTooLargeError } from '../../lib/image-utils'

// Build a minimal File-like object. We only need .size for the rejection
// branch; the rest of resizeImage's body (Image / canvas) never runs once
// the size guard rejects. Cast through unknown to silence TS.
function fakeFile(sizeBytes: number): File {
  return { size: sizeBytes, name: 'fake', type: 'image/jpeg' } as unknown as File
}

describe('resizeImage size guard', () => {
  it('rejects with ImageTooLargeError when file exceeds MAX_INPUT_BYTES', async () => {
    const oversize = fakeFile(MAX_INPUT_BYTES + 1)
    await expect(resizeImage(oversize)).rejects.toBeInstanceOf(ImageTooLargeError)
  })

  it('rejection error carries the actual file size', async () => {
    const size = MAX_INPUT_BYTES + 1024
    try {
      await resizeImage(fakeFile(size))
      throw new Error('expected resizeImage to reject')
    } catch (e) {
      expect(e).toBeInstanceOf(ImageTooLargeError)
      expect((e as ImageTooLargeError).size).toBe(size)
    }
  })

  it('MAX_INPUT_BYTES is 10 MB', () => {
    expect(MAX_INPUT_BYTES).toBe(10 * 1024 * 1024)
  })
})
