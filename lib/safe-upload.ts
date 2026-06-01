// Hardens user-uploaded files before they hit Supabase Storage.
// - Sanitizes filename: strips path segments, replaces unsafe chars, caps length.
// - Caps size per bucket.
// - Maps extension to a whitelisted content-type (never trusts user-supplied file.type).
// - SVG is excluded everywhere (script-execution risk).

type BucketRule = {
  maxBytes: number
  extToCt: Record<string, string>
}

const IMAGE_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

const ATTACHMENT_EXT: Record<string, string> = {
  ...IMAGE_EXT,
  pdf: 'application/pdf',
  txt: 'text/plain',
}

const BUCKETS: Record<string, BucketRule> = {
  'session-attachments': { maxBytes: 10 * 1024 * 1024, extToCt: ATTACHMENT_EXT },
  'note-attachments':    { maxBytes: 10 * 1024 * 1024, extToCt: ATTACHMENT_EXT },
  'pin-attachments':     { maxBytes: 10 * 1024 * 1024, extToCt: IMAGE_EXT },
  'war-stories':         { maxBytes: 10 * 1024 * 1024, extToCt: IMAGE_EXT },
  'module-covers':       { maxBytes: 5 * 1024 * 1024,  extToCt: IMAGE_EXT },
  // tactical-maps holds GM-authored scene backgrounds (room scans, city
  // blocks, large outdoor maps). Sized higher than other image buckets
  // because high-res GM maps run 5-20 MB; capped at 25 to prevent abuse
  // without strangling legitimate use. Stability-audit M1 (2026-05-30).
  'tactical-maps':       { maxBytes: 25 * 1024 * 1024, extToCt: IMAGE_EXT },
}

const MAX_STEM_LEN = 80

export function sanitizeFilename(raw: string): string {
  // NFKD decomposes accented chars; the [^a-zA-Z0-9_-] sweep below then drops
  // the leftover combining marks, so an `e` survives but the accent doesn't.
  const base = (raw.split(/[\/\\]/).pop() || 'file').normalize('NFKD')
  const dot = base.lastIndexOf('.')
  const rawStem = dot > 0 ? base.slice(0, dot) : base
  const rawExt = dot > 0 ? base.slice(dot + 1) : ''
  const stem = (rawStem.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_STEM_LEN)) || 'file'
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  return ext ? `${stem}.${ext}` : stem
}

export type UploadCheck =
  | { ok: true; filename: string; contentType: string }
  | { ok: false; reason: string }

export function prepareUpload(
  bucket: string,
  file: { name: string; size: number; type?: string },
): UploadCheck {
  const rule = BUCKETS[bucket]
  if (!rule) return { ok: false, reason: `unknown bucket: ${bucket}` }
  if (file.size > rule.maxBytes) {
    const mb = Math.floor(rule.maxBytes / 1024 / 1024)
    return { ok: false, reason: `${file.name} is too large (max ${mb} MB)` }
  }
  const filename = sanitizeFilename(file.name)
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''
  const contentType = rule.extToCt[ext]
  if (!contentType) {
    const allowed = Object.keys(rule.extToCt).join(', ')
    return { ok: false, reason: `${file.name}: file type ".${ext || 'none'}" not allowed (accepted: ${allowed})` }
  }
  return { ok: true, filename, contentType }
}
