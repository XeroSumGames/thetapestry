/**
 * Append an entry to a character's `data.progression_log` jsonb array.
 *
 * Read-modify-write — concurrent appends are rare (events are user-driven)
 * and the worst outcome is one missed entry. Errors swallow + console.warn;
 * never throws — call sites can `void` this without try/catch.
 *
 * The Progression Log is a permanent journey journal. Only durable life
 * events belong here (memory rule: feedback_progression_log_curation.md).
 * Combat math, dice economy, session ticks → roll_log instead.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LogEntry } from '../components/ProgressionLog'

export async function appendProgressionEntry(
  supabase: SupabaseClient,
  characterId: string,
  type: LogEntry['type'],
  text: string,
): Promise<void> {
  try {
    const { data } = await supabase.from('characters').select('data').eq('id', characterId).single()
    const base: any = (data as any)?.data ?? {}
    const prev = Array.isArray(base.progression_log) ? base.progression_log : []
    const entry: LogEntry = { date: new Date().toISOString(), type, text }
    await supabase.from('characters').update({
      data: { ...base, progression_log: [entry, ...prev] },
    }).eq('id', characterId)
  } catch (err: any) {
    console.warn('[progression_log] append failed:', err?.message ?? err)
  }
}
