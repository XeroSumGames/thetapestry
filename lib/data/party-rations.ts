// Party rations repository. Eat = consume one ration for each PC who has one.
// Generalizes the per-PC Luxury path to every ration type (Luxury also drops 1
// Stress per the RATIONS canon in lib/xse-schema.ts). All DB access lives here,
// not inline in the Campaign Sheet component (arch ratchet: .from stays in
// lib/data/**).

import { createClient } from '../supabase-browser'
import { reportSupabaseError } from '../supabase-errors'

export interface RationConsumeRow {
  character_id: string
  state_id: string
  name: string
  stress: number
  rations_type: string
  rations_count: number
}

export interface RationConsumeResult {
  /** Human-readable summary per PC who actually ate (for the feed row). */
  eaten: string[]
  error: string | null
}

/**
 * Consume one ration for each supplied PC that has any. Reads each character's
 * data blob (to preserve other fields), decrements rations.count, and for a
 * Luxury Ration drops Stress by 1 (min 0). Skips PCs with no rations.
 */
export async function consumeRationsForParty(rows: RationConsumeRow[]): Promise<RationConsumeResult> {
  const supabase = createClient()
  const eaten: string[] = []
  for (const p of rows) {
    if (p.rations_count <= 0) continue
    const { data: charRow, error: readErr } = await supabase
      .from('characters')
      .select('data')
      .eq('id', p.character_id)
      .maybeSingle()
    if (readErr) { reportSupabaseError(readErr, 'consumeRationsForParty:read'); continue }
    if (!charRow) continue

    const data = (charRow as any).data ?? {}
    const nextCount = Math.max(0, p.rations_count - 1)
    const newRations = { ...(data.rations ?? {}), type: p.rations_type, count: nextCount }
    const dropStress = p.rations_type === 'Luxury Rations' && p.stress > 0
    const newStress = dropStress ? Math.max(0, p.stress - 1) : p.stress

    const { error: cErr } = await supabase
      .from('characters')
      .update({ data: { ...data, rations: newRations } })
      .eq('id', p.character_id)
    if (cErr) { reportSupabaseError(cErr, 'consumeRationsForParty:char'); continue }

    if (dropStress) {
      const { error: sErr } = await supabase
        .from('character_states')
        .update({ stress: newStress, updated_at: new Date().toISOString() })
        .eq('id', p.state_id)
      if (sErr) reportSupabaseError(sErr, 'consumeRationsForParty:stress')
    }

    eaten.push(dropStress ? `${p.name} (Luxury, -1 Stress)` : `${p.name} (${p.rations_type.replace(' Rations', '')})`)
  }
  return { eaten, error: null }
}
