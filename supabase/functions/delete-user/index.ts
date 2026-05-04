import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Storage buckets that hold files keyed by `<campaign_id>/...` — we clean
// these up per owned campaign before the campaign row is deleted, since
// storage objects aren't FK-linked to rows. portrait-bank is shared across
// users (Thriver library), so it's intentionally excluded here.
const CAMPAIGN_SCOPED_BUCKETS = [
  'pin-attachments',
  'note-attachments',
  'object-tokens',
  'campaign-npcs',
  'tactical-maps',
  'session-attachments',
]

// List everything inside a bucket prefix (recursively by listing each
// subfolder) and return the full paths. Supabase's list() only returns the
// immediate children of the prefix, so we recurse one level for
// <campaign_id>/<subdir>/<file> layouts.
async function listAllPaths(supabase: any, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = []
  const { data: top, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error || !top) return out
  for (const entry of top) {
    if (!entry.name) continue
    const full = `${prefix}/${entry.name}`
    // A storage "folder" shows up as an entry with no id/metadata. Recurse one level.
    if (entry.id == null) {
      const { data: inner } = await supabase.storage.from(bucket).list(full, { limit: 1000 })
      for (const child of inner ?? []) {
        if (child.name && child.id != null) out.push(`${full}/${child.name}`)
      }
    } else {
      out.push(full)
    }
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { user_id, caller_id } = await req.json()
    if (!user_id || !caller_id) {
      return new Response(JSON.stringify({ error: 'user_id and caller_id required' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Authorization. Two callers are allowed:
    //   1. A Thriver deleting any other user (the original moderation flow).
    //   2. A user deleting their OWN account (the /account "Danger Zone"
    //      flow — required for GDPR-style data-deletion compliance).
    // Anything else is rejected.
    const isSelfDelete = user_id === caller_id
    if (!isSelfDelete) {
      const { data: caller } = await supabase.from('profiles').select('role').eq('id', caller_id).single()
      if (!caller || caller.role !== 'thriver') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
      }
    }

    // ── Clean up dependent data before deleting the auth user ──
    //
    // Ordering matters for tables without FK CASCADE. Tables with
    // `ON DELETE CASCADE` on a column we wipe here (or a column that
    // points at auth.users with CASCADE) would self-clean, but listing
    // them explicitly is cheap and shields us against future schema
    // changes that weaken the cascade.

    await supabase.from('notifications').delete().eq('user_id', user_id)
    await supabase.from('user_events').delete().eq('user_id', user_id)
    await supabase.from('visitor_logs').delete().eq('user_id', user_id)

    // Collect the user's character ids — needed for relationships cleanup
    // AND the existing character_states cleanup. Previous code keyed
    // npc_relationships by user_id, which was always a no-op because
    // character_id references characters(id), not auth.users(id).
    const { data: memberRows } = await supabase.from('campaign_members').select('character_id').eq('user_id', user_id)
    const { data: ownedChars } = await supabase.from('characters').select('id').eq('user_id', user_id)
    const charIdSet = new Set<string>()
    for (const m of (memberRows ?? []) as any[]) { if (m.character_id) charIdSet.add(m.character_id) }
    for (const c of (ownedChars ?? []) as any[]) { if (c.id) charIdSet.add(c.id) }
    const charIds = [...charIdSet]

    if (charIds.length > 0) {
      // FIX: this delete was previously keyed off user_id instead of
      // character_id — a no-op that left orphan relationships behind.
      await supabase.from('npc_relationships').delete().in('character_id', charIds)
      await supabase.from('character_states').delete().in('character_id', charIds)
    }
    await supabase.from('campaign_members').delete().eq('user_id', user_id)

    // Characters — community_members.character_id → characters(id)
    // ON DELETE CASCADE handles the join cleanup automatically.
    await supabase.from('characters').delete().eq('user_id', user_id)

    // Notes the user wrote inside campaigns they don't own
    await supabase.from('player_notes').delete().eq('user_id', user_id)

    // Delete owned campaigns and all their campaign-scoped data
    const { data: ownedCamps } = await supabase.from('campaigns').select('id').eq('gm_user_id', user_id)
    const ownedIds = (ownedCamps ?? []).map((c: any) => c.id)

    for (const campId of ownedIds) {
      // Wipe campaign-scoped rows explicitly — many of these cascade via
      // `campaigns.id ON DELETE CASCADE` already, but listing them makes
      // cleanup order deterministic and guards against any weakened FK
      // added in future migrations.
      await supabase.from('initiative_order').delete().eq('campaign_id', campId)
      await supabase.from('roll_log').delete().eq('campaign_id', campId)
      await supabase.from('chat_messages').delete().eq('campaign_id', campId)
      await supabase.from('character_states').delete().eq('campaign_id', campId)
      await supabase.from('campaign_pins').delete().eq('campaign_id', campId)
      await supabase.from('campaign_npcs').delete().eq('campaign_id', campId)
      await supabase.from('session_history').delete().eq('campaign_id', campId)
      await supabase.from('player_notes').delete().eq('campaign_id', campId)
      await supabase.from('campaign_notes').delete().eq('campaign_id', campId)
      await supabase.from('campaign_snapshots').delete().eq('campaign_id', campId)
      await supabase.from('object_token_library').delete().eq('campaign_id', campId)
      // tactical_scenes deletes cascade into scene_tokens via FK, but
      // emptying the campaign proactively is cheap insurance.
      await supabase.from('tactical_scenes').delete().eq('campaign_id', campId)
      // Communities — deleting the community cascades into community_members,
      // community_morale_checks, and community_resource_checks via FK.
      await supabase.from('communities').delete().eq('campaign_id', campId)
      // All remaining campaign_members for this campaign (players other
      // than the user being deleted).
      await supabase.from('campaign_members').delete().eq('campaign_id', campId)

      // Storage buckets — objects aren't FK-linked, so the campaign row
      // delete leaves files orphaned. Clean every campaign-scoped bucket.
      for (const bucket of CAMPAIGN_SCOPED_BUCKETS) {
        const paths = await listAllPaths(supabase, bucket, campId)
        if (paths.length > 0) {
          const { error: rmErr } = await supabase.storage.from(bucket).remove(paths)
          if (rmErr) console.warn(`[delete-user] storage remove ${bucket}/${campId}:`, rmErr.message)
        }
      }
    }
    if (ownedIds.length > 0) {
      await supabase.from('campaigns').delete().in('id', ownedIds)
    }

    // Map pins the user submitted to the global map
    await supabase.from('map_pins').delete().eq('user_id', user_id)

    // Profile + auth user — last step, so partial failures above don't
    // strand an orphan auth account.
    await supabase.from('profiles').delete().eq('id', user_id)
    const { error } = await supabase.auth.admin.deleteUser(user_id)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
