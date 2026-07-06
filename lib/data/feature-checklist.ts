// Data layer for the /tools/feature-manifest verification checklist.
// State is one JSONB blob per user in feature_checklist_state (RLS: own row
// only), so a Thriver's progress persists across browsers + devices. The table
// is new and not yet in the generated Database types, hence the `as any` casts.
import { db } from './db'
import { isThriver } from '../auth/roles'

export type ChecklistCell = { d?: boolean; f?: boolean } // d = verified, f = flagged
export type ChecklistState = Record<string, ChecklistCell>

/** True if the given user's profile role is Thriver (gate for the tool). */
export async function isThriverUser(userId: string): Promise<boolean> {
  const { data } = await db().from('profiles').select('role').eq('id', userId).maybeSingle()
  return isThriver(data)
}

/** Load a user's saved checklist blob (empty object if none / malformed). */
export async function loadFeatureChecklist(userId: string): Promise<ChecklistState> {
  const { data } = await db()
    .from('feature_checklist_state' as any)
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()
  const state = (data as any)?.state
  return state && typeof state === 'object' && !Array.isArray(state) ? (state as ChecklistState) : {}
}

/** Upsert the user's checklist blob. Returns true on success. */
export async function saveFeatureChecklist(userId: string, state: ChecklistState): Promise<boolean> {
  const { error } = await db()
    .from('feature_checklist_state' as any)
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return !error
}
