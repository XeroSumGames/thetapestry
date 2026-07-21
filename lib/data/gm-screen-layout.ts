// Per-GM GM Screen layout persistence: freeform card positions (x/y/width),
// collapsed set, and active filter. ONE row per user in gm_screen_layouts
// (RLS: own row only), so a GM's arrangement follows their account across every
// table and device - not the per-browser localStorage the old screen used. The
// state is a jsonb blob so its shape can evolve without a migration. All errors
// swallow to defaults: signed-out, missing row, or a missing table all yield
// null and the page falls back to DEFAULT_POSITIONS.
import { db } from './db'
import type { Json } from '../database.types'

// h is optional: unset = auto-height (card grows to show all its content); a
// number = a height the GM set by dragging the card's corner (content scrolls).
export interface CardPos { x: number; y: number; w: number; h?: number }
export interface GmScreenState {
  positions: Record<string, CardPos>
  collapsed: string[]
  filter: string
}

function isPos(v: unknown): v is CardPos {
  return !!v && typeof v === 'object'
    && typeof (v as CardPos).x === 'number'
    && typeof (v as CardPos).y === 'number'
    && typeof (v as CardPos).w === 'number'
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
  const positions: Record<string, CardPos> = {}
  const rawPos = s.positions
  if (rawPos && typeof rawPos === 'object' && !Array.isArray(rawPos)) {
    for (const [k, v] of Object.entries(rawPos)) if (isPos(v)) positions[k] = { x: v.x, y: v.y, w: v.w, ...(typeof v.h === 'number' ? { h: v.h } : {}) }
  }
  const collapsed = Array.isArray(s.collapsed) ? s.collapsed.filter((x): x is string => typeof x === 'string') : []
  const filter = typeof s.filter === 'string' ? s.filter : 'all'
  return { positions, collapsed, filter }
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
