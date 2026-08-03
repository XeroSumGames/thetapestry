// Seam for portrait_bank storage + metadata operations.

export async function fetchRandomPortrait(
  supabase: any,
  gender: 'man' | 'woman' | null,
): Promise<string | null> {
  let q = supabase.from('portrait_bank').select('url_256').eq('is_private', false)
  if (gender) q = q.eq('gender', gender)
  const { data } = await q.limit(200)
  if (!data || data.length === 0) return null
  return data[Math.floor(Math.random() * data.length)].url_256 as string
}
// Accepts the Supabase browser client as a parameter since storage
// operations require the client-side instance.

// Upload a portrait to the shared public bank using the platform counter.
// Follows the same naming convention as the Crop & Upload single-image flow.
export async function uploadPublicPortrait(
  supabase: any,
  b256: Blob,
  b56: Blob,
  b32: Blob,
  gender: 'man' | 'woman',
): Promise<{ error: string | null; number?: number }> {
  const { data: n, error: rpcErr } = await supabase.rpc('increment_portrait_counter', { g: gender })
  if (rpcErr) return { error: `Counter: ${rpcErr.message}` }
  const num: number = typeof n === 'number' ? n : 0
  const gLabel = gender === 'man' ? 'MAN' : 'WOMAN'
  const base = `NPC-${gLabel}-${String(num).padStart(3, '0')}`
  const p256 = `${gender}/256/${base}.jpg`
  const p56 = `${gender}/56/${base}.jpg`
  const p32 = `${gender}/32/${base}.jpg`

  const ups = await Promise.all([
    supabase.storage.from('portrait-bank').upload(p256, b256, { contentType: 'image/jpeg', upsert: true }),
    supabase.storage.from('portrait-bank').upload(p56, b56, { contentType: 'image/jpeg', upsert: true }),
    supabase.storage.from('portrait-bank').upload(p32, b32, { contentType: 'image/jpeg', upsert: true }),
  ])
  const upErr = ups.find((u: any) => u.error)
  if (upErr?.error) return { error: `Upload: ${upErr.error.message}` }

  const url256 = supabase.storage.from('portrait-bank').getPublicUrl(p256).data.publicUrl
  const url56 = supabase.storage.from('portrait-bank').getPublicUrl(p56).data.publicUrl
  const url32 = supabase.storage.from('portrait-bank').getPublicUrl(p32).data.publicUrl

  const { error: insErr } = await supabase.from('portrait_bank').insert({
    number: num,
    gender,
    url_256: url256,
    url_56: url56,
    url_32: url32,
    is_private: false,
  })
  if (insErr) return { error: `Metadata: ${insErr.message}` }
  return { error: null, number: num }
}

// Private portraits live in their own private:false bucket so reads are
// RLS-enforced (own-uid only) instead of served unauthenticated like the
// shared public bank. getPublicUrl() would be readable by anyone with the
// URL regardless of RLS, so we sign once at upload time and store that
// URL - verified live that Supabase accepts multi-year signed-URL expiry
// with no cap, so this needs no periodic re-signing.
const PRIVATE_PORTRAIT_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365 * 10 // 10 years

export async function uploadPrivatePortrait(
  supabase: any,
  userId: string,
  id: string,
  b256: Blob,
  b56: Blob,
  b32: Blob,
  name: string,
  gender: 'man' | 'woman' | null,
): Promise<{ error: string | null }> {
  const path256 = `${userId}/256/${id}.jpg`
  const path56 = `${userId}/56/${id}.jpg`
  const path32 = `${userId}/32/${id}.jpg`

  const ups = await Promise.all([
    supabase.storage.from('portrait-bank-private').upload(path256, b256, { contentType: 'image/jpeg', upsert: false }),
    supabase.storage.from('portrait-bank-private').upload(path56, b56, { contentType: 'image/jpeg', upsert: false }),
    supabase.storage.from('portrait-bank-private').upload(path32, b32, { contentType: 'image/jpeg', upsert: false }),
  ])
  const upErr = ups.find((u: any) => u.error)
  if (upErr?.error) return { error: `Upload: ${upErr.error.message}` }

  const [signed256, signed56, signed32] = await Promise.all([
    supabase.storage.from('portrait-bank-private').createSignedUrl(path256, PRIVATE_PORTRAIT_URL_EXPIRY_SECONDS),
    supabase.storage.from('portrait-bank-private').createSignedUrl(path56, PRIVATE_PORTRAIT_URL_EXPIRY_SECONDS),
    supabase.storage.from('portrait-bank-private').createSignedUrl(path32, PRIVATE_PORTRAIT_URL_EXPIRY_SECONDS),
  ])
  const signErr = [signed256, signed56, signed32].find((s: any) => s.error)
  if (signErr?.error) return { error: `Sign: ${signErr.error.message}` }

  const { error: insErr } = await supabase.from('portrait_bank').insert({
    name,
    gender: gender ?? null,
    url_256: signed256.data.signedUrl,
    url_56: signed56.data.signedUrl,
    url_32: signed32.data.signedUrl,
    is_private: true,
    created_by: userId,
  })
  if (insErr) return { error: `Metadata: ${insErr.message}` }
  return { error: null }
}
