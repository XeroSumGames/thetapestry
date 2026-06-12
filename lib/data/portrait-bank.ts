// Seam for portrait_bank storage + metadata operations.
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
  const path256 = `private/${userId}/256/${id}.jpg`
  const path56 = `private/${userId}/56/${id}.jpg`
  const path32 = `private/${userId}/32/${id}.jpg`

  const ups = await Promise.all([
    supabase.storage.from('portrait-bank').upload(path256, b256, { contentType: 'image/jpeg', upsert: false }),
    supabase.storage.from('portrait-bank').upload(path56, b56, { contentType: 'image/jpeg', upsert: false }),
    supabase.storage.from('portrait-bank').upload(path32, b32, { contentType: 'image/jpeg', upsert: false }),
  ])
  const upErr = ups.find((u: any) => u.error)
  if (upErr?.error) return { error: `Upload: ${upErr.error.message}` }

  const url256 = supabase.storage.from('portrait-bank').getPublicUrl(path256).data.publicUrl
  const url56 = supabase.storage.from('portrait-bank').getPublicUrl(path56).data.publicUrl
  const url32 = supabase.storage.from('portrait-bank').getPublicUrl(path32).data.publicUrl

  const { error: insErr } = await supabase.from('portrait_bank').insert({
    name,
    gender: gender ?? null,
    url_256: url256,
    url_56: url56,
    url_32: url32,
    is_private: true,
    created_by: userId,
  })
  if (insErr) return { error: `Metadata: ${insErr.message}` }
  return { error: null }
}
