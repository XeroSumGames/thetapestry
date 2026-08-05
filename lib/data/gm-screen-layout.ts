// GM Screen persistence (Xero 2026-07-20 model):
//  - ONE shared STANDARD layout (gm_screen_standard_layout, single row id=1).
//    Everyone reads it; only Thrivers write it (RLS + client gate). This is the
//    canonical GM Screen arrangement - it replaces the earlier per-GM table.
//  - Per-campaign SCRATCH pad (campaigns.gm_scratch): on-the-fly GM notes, any
//    GM of the campaign can edit; folded into the session summary at End Session.
// All reads swallow errors to defaults (signed-out / missing row -> null/'').
import { db } from './db'
import { reportSupabaseError } from '../supabase-errors'
import type { Json } from '../database.types'
import { isThriver } from '../auth/roles'

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

function parseState(raw: unknown): GmScreenState | null {
  const s = raw as Record<string, unknown> | null
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

/** The shared standard layout (id=1). Null when missing -> page uses its baked default. */
export async function loadStandardLayout(): Promise<GmScreenState | null> {
  const { data, error } = await db().from('gm_screen_standard_layout').select('state').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return parseState(data.state)
}

/** Write the shared standard. RLS restricts this to Thrivers; a non-Thriver
 *  write simply errors and is swallowed (the UI also gates on isThriver). */
export async function saveStandardLayout(state: GmScreenState): Promise<void> {
  await db().from('gm_screen_standard_layout').upsert(
    { id: 1, state: state as unknown as Json, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  )
}

/** Is the signed-in user a Thriver (may edit the standard layout)? */
export async function isCurrentUserThriver(): Promise<boolean> {
  const supabase = db()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return isThriver(data?.role ?? null)
}

// The campaign's on-the-fly GM scratch lives in its own GM-only table
// (gm_scratch, RLS-gated to the campaign's GM) - NOT on the world-readable
// campaigns table, which would leak it to players.
export async function loadScratch(campaignId: string): Promise<string> {
  const { data } = await db().from('gm_scratch').select('text').eq('campaign_id', campaignId).maybeSingle()
  return data?.text ?? ''
}

export async function saveScratch(campaignId: string, text: string): Promise<void> {
  // Debounced background autosave - a swallowed error meant GM scratch notes
  // appeared to persist but were lost on reload with no signal anywhere.
  const { error } = await db().from('gm_scratch').upsert(
    { campaign_id: campaignId, text, updated_at: new Date().toISOString() },
    { onConflict: 'campaign_id' },
  )
  if (error) reportSupabaseError(error, 'gm-screen-layout.saveScratch')
}
