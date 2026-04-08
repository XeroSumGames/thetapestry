import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { user_id, caller_id } = await req.json()
    if (!user_id || !caller_id) {
      return new Response(JSON.stringify({ error: 'user_id and caller_id required' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify caller is a Thriver
    const { data: caller } = await supabase.from('profiles').select('role').eq('id', caller_id).single()
    if (!caller || caller.role !== 'Thriver') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    }

    // Prevent self-deletion
    if (user_id === caller_id) {
      return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400 })
    }

    // Delete from auth.users (cascades to profiles via trigger/FK)
    const { error } = await supabase.auth.admin.deleteUser(user_id)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    // Clean up profile row if cascade didn't handle it
    await supabase.from('profiles').delete().eq('id', user_id)

    return new Response(JSON.stringify({ ok: true }))
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
