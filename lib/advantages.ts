// Advantage feature — tracked contextual CMod bonuses.
//
// See sql/advantages-2026-05-19.sql for the schema. Use case: GM gives
// a PC a "+1 CMod on next <skill>" credit after a roll outcome that
// earns one. The credit persists until the PC redeems it on a roll.
//
// Design choices (Xero 2026-05-19): A3 grant paths, B2 manual claim,
// C3 visibility (pending = holder + GM; consumed = whole campaign).
//
// This module owns the shape + the wrapper functions. UI surfaces
// (GM grant dialog, player advantages tab, Award button on roll feed)
// import from here so writes are consistent.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Advantage {
  id: string
  campaign_id: string
  character_id: string
  granted_by: string | null
  skill_name: string
  cmod_delta: number
  description: string
  source_roll_log_id: string | null
  created_at: string
  consumed_at: string | null
  consumed_roll_log_id: string | null
}

export interface GrantAdvantageArgs {
  supabase: SupabaseClient
  campaignId: string
  characterId: string
  grantedBy: string
  skillName: string
  cmodDelta: number
  description: string
  sourceRollLogId?: string | null
}

export interface GrantAdvantageResult {
  advantage: Advantage | null
  error: string | null
}

/** GM grant. INSERTs a pending advantage. RLS enforces GM-only on the
 *  INSERT policy; this wrapper just shapes the row and surfaces any
 *  RLS / DB error as a string for the caller to display. */
export async function grantAdvantage(args: GrantAdvantageArgs): Promise<GrantAdvantageResult> {
  const { supabase, campaignId, characterId, grantedBy, skillName, cmodDelta,
          description, sourceRollLogId } = args
  if (!skillName.trim()) return { advantage: null, error: 'skill_name required' }
  if (!description.trim()) return { advantage: null, error: 'description required' }
  if (!Number.isFinite(cmodDelta) || cmodDelta === 0) {
    return { advantage: null, error: 'cmod_delta must be a non-zero integer' }
  }
  const { data, error } = await supabase
    .from('advantages')
    .insert({
      campaign_id: campaignId,
      character_id: characterId,
      granted_by: grantedBy,
      skill_name: skillName.trim(),
      cmod_delta: cmodDelta,
      description: description.trim(),
      source_roll_log_id: sourceRollLogId ?? null,
    })
    .select()
    .single()
  if (error) return { advantage: null, error: error.message }
  return { advantage: data as Advantage, error: null }
}

/** Holder or GM consumes an advantage. Sets consumed_at + optional
 *  link to the roll_log row where it was used. RLS gates to
 *  holder/GM via the UPDATE policy. */
export async function consumeAdvantage(
  supabase: SupabaseClient,
  advantageId: string,
  consumedRollLogId: string | null = null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('advantages')
    .update({
      consumed_at: new Date().toISOString(),
      consumed_roll_log_id: consumedRollLogId,
    })
    .eq('id', advantageId)
    .is('consumed_at', null)        // idempotent: don't re-consume an already-consumed row
  if (error) return { error: error.message }
  return { error: null }
}

/** List pending (consumed_at IS NULL) advantages for a character.
 *  RLS already gates visibility (holder + GM); this just shapes the
 *  query so callers don't re-implement it. */
export async function listPendingAdvantages(
  supabase: SupabaseClient,
  characterId: string,
): Promise<{ rows: Advantage[]; error: string | null }> {
  const { data, error } = await supabase
    .from('advantages')
    .select('*')
    .eq('character_id', characterId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as Advantage[], error: null }
}

/** List ALL pending advantages across a campaign (for the GM view
 *  of the advantages tab). RLS scopes to consumed-by-anyone OR
 *  pending-by-this-user as GM. */
export async function listCampaignPendingAdvantages(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<{ rows: Advantage[]; error: string | null }> {
  const { data, error } = await supabase
    .from('advantages')
    .select('*')
    .eq('campaign_id', campaignId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
  if (error) return { rows: [], error: error.message }
  return { rows: (data ?? []) as Advantage[], error: null }
}

/** GM-only delete. For accidental grants. RLS enforces. */
export async function deleteAdvantage(
  supabase: SupabaseClient,
  advantageId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('advantages').delete().eq('id', advantageId)
  if (error) return { error: error.message }
  return { error: null }
}
