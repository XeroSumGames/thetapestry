import { db, type Insert, type Update } from './db'
import type { ModerationStatus } from './moderation'

export function insertPregen(row: Insert<'pregen_library'>) {
  return db().from('pregen_library').insert(row)
}

export function loadApprovedPregens(setting?: string) {
  let q = db()
    .from('pregen_library')
    .select('*, profiles!pregen_library_author_id_fkey(username)')
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
  if (setting) q = q.eq('setting', setting)
  return q
}

export function loadAuthorPregens(userId: string) {
  return db()
    .from('pregen_library')
    .select('id, name, setting, moderation_status, created_at, portrait_url')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
}

export function loadPregensByStatus(status: ModerationStatus) {
  return db()
    .from('pregen_library')
    .select('*')
    .eq('moderation_status', status)
    .order('created_at', { ascending: false })
}

export function updatePregen(id: string, patch: Update<'pregen_library'>) {
  return db().from('pregen_library').update(patch).eq('id', id)
}

export function deletePregen(id: string) {
  return db().from('pregen_library').delete().eq('id', id)
}
