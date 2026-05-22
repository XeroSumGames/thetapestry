// Data-access seam foundation (grand re-architecture Phase 1b, lib/data).
//
// THE RULE: raw `supabase.from(...)` lives ONLY in lib/data/**. Everywhere
// else calls a typed repository function (getCampaignNpcs(id), not
// supabase.from('campaign_npcs')...). Today there are 1,324 inline .from
// calls across 98 files duplicating table names + column shapes; a schema
// rename breaks them silently at runtime. Behind this seam a rename is one
// edit and a tsc error everywhere it matters. The check-arch ratchet
// enforces the rule (`.from(` outside lib/data fails CI if it rises).
//
// TYPING: the global browser client (lib/supabase-browser) is not yet
// parameterised with <Database> - doing that globally would surface tsc
// errors across all 98 current call sites at once. So we type the client
// LOCALLY here. Repositories built on db() get full column/row typing from
// lib/database.types (L0); the rest of the app is unaffected until it
// migrates onto the seam. When every consumer is migrated, the global
// client can be parameterised and this local cast removed.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'
import { createClient } from '../supabase-browser'

/** Convenience row/insert/update types keyed by table name (from L0). */
export type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']
export type Insert<T extends keyof Tables> = Tables[T]['Insert']
export type Update<T extends keyof Tables> = Tables[T]['Update']

/**
 * The typed Supabase client - the ONE handle every repository uses.
 * `db().from('campaign_npcs')` is fully typed against the schema.
 */
export function db(): SupabaseClient<Database> {
  return createClient() as unknown as SupabaseClient<Database>
}
