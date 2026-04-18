import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Verify caller is a Thriver
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', caller_id).single()
    if (!caller || caller.role !== 'thriver') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    // Prevent self-deletion
    if (user_id === caller_id) {
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })
    }

    // Clean up dependent data before deleting the user
    await supabase.from('notifications').delete().eq('user_id', user_id)
    await supabase.from('npc_relationships').delete().eq('character_id', user_id)
    await supabase.from('user_events').delete().eq('user_id', user_id)
    await supabase.from('visitor_logs').delete().eq('user_id', user_id)

    // Remove from campaigns
    const { data: memberRows } = await supabase.from('campaign_members').select('character_id').eq('user_id', user_id)
    const memberCharIds = (memberRows ?? []).map((m: any) => m.character_id).filter(Boolean)
    if (memberCharIds.length > 0) {
      await supabase.from('character_states').delete().in('character_id', memberCharIds)
    }
    await supabase.from('campaign_members').delete().eq('user_id', user_id)

    // Delete characters
    await supabase.from('characters').delete().eq('user_id', user_id)

    // Delete owned campaigns and their data
    const { data: ownedCamps } = await supabase.from('campaigns').select('id').eq('gm_user_id', user_id)
    for (const camp of ownedCamps ?? []) {
      await supabase.from('initiative_order').delete().eq('campaign_id', camp.id)
      await supabase.from('roll_log').delete().eq('campaign_id', camp.id)
      await supabase.from('chat_messages').delete().eq('campaign_id', camp.id)
      await supabase.from('character_states').delete().eq('campaign_id', camp.id)
      await supabase.from('campaign_members').delete().eq('campaign_id', camp.id)
      await supabase.from('campaign_pins').delete().eq('campaign_id', camp.id)
      await supabase.from('campaign_npcs').delete().eq('campaign_id', camp.id)
      await supabase.from('session_history').delete().eq('campaign_id', camp.id)
    }
    if (ownedCamps && ownedCamps.length > 0) {
      await supabase.from('campaigns').delete().in('id', ownedCamps.map((c: any) => c.id))
    }

    // Delete map pins
    await supabase.from('map_pins').delete().eq('user_id', user_id)

    // Delete profile, then auth user
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
