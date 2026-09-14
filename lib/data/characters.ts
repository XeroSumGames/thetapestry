import type { Json } from '../database.types'
import { db } from './db'
import { mergeWizardEdit } from '../xse-engine'
import type { XSECharacter } from '../xse-schema'

/** Create a character row for a user. Returns {data: {id, name, portrait_url}, error}. */
export function createCharacterForUser(userId: string, name: string, data: unknown, portraitUrl?: string | null) {
  return db()
    .from('characters')
    .insert({ user_id: userId, name, data: data as Json, ...(portraitUrl ? { portrait_url: portraitUrl } : {}) })
    .select('id, name, portrait_url')
    .single()
}

/** Batch-fetch portrait for a set of character ids. Returns a map keyed by id.
 *  Prefers portrait_url column; falls back to data->>'photoDataUrl' for characters
 *  built before the portrait_url column existed. */
export async function getCharacterPortraits(charIds: string[]): Promise<Record<string, string | null>> {
  if (charIds.length === 0) return {}
  const { data } = await db().from('characters').select('id, portrait_url, data').in('id', charIds)
  const map: Record<string, string | null> = {}
  for (const row of (data ?? [])) {
    const col = (row as any).portrait_url as string | null
    const blob = (row as any).data
    const legacy = (blob && typeof blob === 'object' && !Array.isArray(blob))
      ? (blob as Record<string, unknown>).photoDataUrl as string | null ?? null
      : null
    map[row.id] = col ?? legacy
  }
  return map
}

/**
 * Merge a partial data blob into a character's JSON data column.
 * Used on /characters to persist between-sessions stat changes (WP, stress, etc.)
 * without a campaign context. We do a read-then-write to avoid clobbering
 * unrelated fields in the blob.
 *
 * CRITICAL: the read error must abort the write. If the read fails (network,
 * expired token, statement timeout) we do NOT treat a null result as "empty
 * blob" - merging the patch into `{}` and writing it back would replace the
 * ENTIRE data column (name, RAPID, skills, inventory) with just the patch,
 * destroying the character sheet. On a failed or empty read we return the
 * error and write nothing. (Same class as the 2026-07-09 Feature Manifest bug.)
 */
export async function updateCharacterDataField(charId: string, patch: Record<string, unknown>) {
  const { data: existing, error: readErr } = await db().from('characters').select('data').eq('id', charId).single()
  if (readErr || !existing) {
    return { data: null, error: readErr ?? { message: `character ${charId} not found`, details: '', hint: '', code: 'PGRST116', name: 'PostgrestError' } as any }
  }
  const base = (existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)) ? existing.data as Record<string, Json> : {}
  const merged: Json = { ...base, ...patch as Record<string, Json> }
  return db().from('characters').update({ data: merged }).eq('id', charId)
}

/**
 * Save an edit from the classic character wizard. buildCharacter() output
 * is built from a blank template, so it must never be written wholesale -
 * fresh-reads the row and merges only the wizard-owned fields (via
 * mergeWizardEdit) before writing name/data/portrait_url back together.
 * 2026-08-01 audit: the previous inline wholesale write silently reset
 * inventory/progression_log/session_notes/lastingWounds/relationships/
 * cdp/insightDice/stressLevel/breakingPoint on every save.
 */
export async function saveWizardCharacterEdit(
  charId: string,
  character: XSECharacter,
  fallbackName: string,
  portraitUrl: string | null,
) {
  const { data: existing, error: readErr } = await db().from('characters').select('data').eq('id', charId).single()
  if (readErr || !existing) {
    return { data: null, error: readErr ?? { message: `character ${charId} not found`, details: '', hint: '', code: 'PGRST116', name: 'PostgrestError' } as any }
  }
  const base = (existing.data && typeof existing.data === 'object' && !Array.isArray(existing.data)) ? existing.data as Record<string, Json> : {}
  const merged = mergeWizardEdit(base, character) as Json
  return db()
    .from('characters')
    .update({ name: character.name || fallbackName, data: merged, portrait_url: portraitUrl })
    .eq('id', charId)
}
