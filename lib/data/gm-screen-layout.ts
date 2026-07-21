// Per-GM GM Screen layout persistence: card order, collapsed set, and active
// filter. ONE row per user in gm_screen_layouts (RLS: own row only), so a GM's
// arrangement follows their account across every table and device - not the
// per-browser localStorage the old free-float screen used. The state is a jsonb
// blob (mirrors the feature_checklist_state pattern) so its shape can evolve
// without a migration. All errors are swallowed to defaults: a signed-out user,
// a missing row, or (pre-migration) a missing table all just yield null and the
// page falls back to DEFAULT_ORDER.
import { db } from './db'
import type { Json } from '../database.types'

export interface GmScreenState {
  order: string[]
  collapsed: string[]
  filter: string
}

export async function loadGmScreenLayout(): Promise<GmScreenState | null> {
  const supabase = db()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return null
  const { data, error } = await supabase
    .from('gm_screen_layouts').select('state').eq('user_id', user.id).maybeSingle()
  if (error || !data) return null
  const s = data.state as Record<string, unknown> | null
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  const strs = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  return {
    order: strs(s.order),
    collapsed: strs(s.collapsed),
    filter: typeof s.filter === 'string' ? s.filter : 'all',
  }
}

export async function saveGmScreenLayout(state: GmScreenState): Promise<void> {
  const supabase = db()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return
  await supabase.from('gm_screen_layouts').upsert(
    { user_id: user.id, state: state as unknown as Json, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}
