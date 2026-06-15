import { db } from './db'

/**
 * Merge a partial data blob into a character's JSON data column.
 * Used on /characters to persist between-sessions stat changes (WP, stress, etc.)
 * without a campaign context. We do a read-then-write here to avoid clobbering
 * unrelated fields in the blob.
 */
export async function updateCharacterDataField(charId: string, patch: Record<string, unknown>) {
  const { data: existing } = await db().from('characters').select('data').eq('id', charId).single()
  const merged = { ...(existing?.data ?? {}), ...patch }
  return db().from('characters').update({ data: merged }).eq('id', charId)
}
