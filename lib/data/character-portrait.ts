import type { SupabaseClient } from '@supabase/supabase-js'

// Upload a portrait blob to character-portraits/<userId>/<characterId>.jpg,
// then sync characters.portrait_url + data.photoDataUrl so both the
// dedicated column (map-token source) and CharacterCard (reads data.photoDataUrl)
// stay consistent.
export async function uploadCharacterPortrait(
  supabase: SupabaseClient,
  blob: Blob,
  userId: string,
  characterId: string,
  existingData: any,
): Promise<{ publicUrl: string } | { error: string }> {
  const path = `${userId}/${characterId}.jpg`
  const { error: upErr } = await supabase.storage
    .from('character-portraits')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (upErr) return { error: `Upload failed: ${upErr.message}` }

  const { data: urlData } = supabase.storage.from('character-portraits').getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  const newData = { ...existingData, photoDataUrl: publicUrl }
  const { error: dbErr } = await supabase
    .from('characters')
    .update({ portrait_url: publicUrl, data: newData })
    .eq('id', characterId)
  if (dbErr) return { error: `DB update failed: ${dbErr.message}` }

  return { publicUrl }
}

// Clear the portrait from both the dedicated column and the legacy data field.
export async function removeCharacterPortrait(
  supabase: SupabaseClient,
  characterId: string,
  existingData: any,
): Promise<{ error: string } | undefined> {
  const newData = { ...existingData, photoDataUrl: '' }
  const { error } = await supabase
    .from('characters')
    .update({ portrait_url: null, data: newData })
    .eq('id', characterId)
  if (error) return { error: error.message }
}
