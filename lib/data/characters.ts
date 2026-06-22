import type { Json } from '../database.types'
import { db } from './db'

/** Create a character row for a user. Returns {data: {id, name, portrait_url}, error}. */
export function createCharacterForUser(userId: string, name: string, data: unknown, portraitUrl?: string | null) {
  return db()
    .from('characters')
    .insert({ user_id: userId, name, data: data as Json, ...(portraitUrl ? { portrait_url: portraitUrl } : {}) })
    .select('id, name, portrait_url')
    .single()
}

/** Batch-fetch portrait_url for a set of character ids. Returns a map keyed by id. */
export async function getCharacterPortraits(charIds: string[]): Promise<Record<string, string | null>> {
  if (charIds.length === 0) return {}
  const { data } = await db().from('characters').select('id, portrait_url').in('id', charIds)
  const map: Record<string, string | null> = {}
  for (const row of (data ?? [])) map[row.id] = (row as any).portrait_url ?? null
  return map
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
