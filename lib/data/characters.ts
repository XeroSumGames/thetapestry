import type { Json } from '../database.types'
import { db } from './db'

/** Create a character row for a user. Returns {data: {id, name}, error}. */
export function createCharacterForUser(userId: string, name: string, data: unknown) {
  return db().from('characters').insert({ user_id: userId, name, data: data as Json }).select('id, name').single()
}

/**
 * Merge a partial data blob into a character's JSON data column.
 * Used on /characters to persist between-sessions stat changes (WP, stress, etc.)
 * without a campaign context. We do a read-then-write here to avoid clobbering
 * unrelated fields in the blob.
 */
export async function updateCharacterDataField(charId: string, patch: Record<string, unknown>) {
  const { data: existing } = await db().from('characters').select('data').eq('id', charId).single()
  const base = (existing?.data && typeof existing.data === 'object' && !Array.isArray(existing.data)) ? existing.data as Record<string, Json> : {}
  const merged: Json = { ...base, ...patch as Record<string, Json> }
  return db().from('characters').update({ data: merged }).eq('id', charId)
}
