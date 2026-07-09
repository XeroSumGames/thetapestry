// Data layer for the /tools/feature-manifest verification checklist.
// State is one JSONB blob per user in feature_checklist_state (RLS: own row
// only), so a Thriver's progress persists across browsers + devices.
import { db } from './db'
import { isThriver } from '../auth/roles'

export type ChecklistCell = { d?: boolean; f?: boolean } // d = verified, f = flagged
export type ChecklistState = Record<string, ChecklistCell>

/** True if the given user's profile role is Thriver (gate for the tool). */
export async function isThriverUser(userId: string): Promise<boolean> {
  const { data } = await db().from('profiles').select('role').eq('id', userId).maybeSingle()
  return isThriver(data)
}

/**
 * Load a user's saved checklist blob.
 *
 * Returns null when the QUERY fails - a failed load must never read as "no
 * saved state", because the page whole-blob upserts on every tick and would
 * overwrite the user's real checklist with an empty one on the next click.
 * A missing row or malformed blob (genuinely nothing worth keeping) is {}.
 */
export async function loadFeatureChecklist(userId: string): Promise<ChecklistState | null> {
  const { data, error } = await db()
    .from('feature_checklist_state')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  const state = data?.state
  return state && typeof state === 'object' && !Array.isArray(state) ? (state as ChecklistState) : {}
}

/**
 * Drop cells whose feature id is not in the current manifest. Saved blobs can
 * carry ids from older layouts of the list (the 2026-07-06 restructure dropped
 * 12); orphaned cells inflate the done/flagged counts past what the page can
 * display, so they are pruned at load time.
 */
export function pruneChecklistToKnownIds(state: ChecklistState, knownIds: ReadonlySet<string>): ChecklistState {
  const pruned: ChecklistState = {}
  for (const id of Object.keys(state)) {
    if (knownIds.has(id)) pruned[id] = state[id]
  }
  return pruned
}

/** Upsert the user's checklist blob. Returns true on success. */
export async function saveFeatureChecklist(userId: string, state: ChecklistState): Promise<boolean> {
  const { error } = await db()
    .from('feature_checklist_state')
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return !error
}
