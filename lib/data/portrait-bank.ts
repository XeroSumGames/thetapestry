// Seam for portrait_bank storage + metadata operations.
// Accepts the Supabase browser client as a parameter since storage
// operations require the client-side instance.

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
