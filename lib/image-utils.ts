/**
 * Resize an image file to fit within maxSize x maxSize pixels.
 * Returns a base64 data URL (JPEG at 80% quality).
 *
 * Pre-launch audit Y6: reject anything over MAX_INPUT_BYTES up front
 * instead of letting the browser try to decode it. A 100MB TIFF would
 * grind a low-end client to a halt before this check existed.
 */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024  // 10 MB
export class ImageTooLargeError extends Error {
  constructor(public size: number) {
    super(`Image too large (${(size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_INPUT_BYTES / 1024 / 1024} MB.`)
    this.name = 'ImageTooLargeError'
  }
}

export function resizeImage(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_INPUT_BYTES) {
      reject(new ImageTooLargeError(file.size))
      return
    }
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round(height * (maxSize / width))
          width = maxSize
        } else {
          width = Math.round(width * (maxSize / height))
          height = maxSize
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}
