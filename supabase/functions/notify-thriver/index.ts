import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Pre-launch audit Y2: gate this function on the service-role key.
  // The only legitimate caller is the DB pg_net trigger
  // (call_notify_thriver in sql/restore-call-notify-thriver.sql), which
  // sends `Authorization: Bearer <service_role_key>`. Without this gate
  // anyone with the function URL could spam every Thriver's inbox.
  const authHeader = req.headers.get('Authorization') ?? ''
  const expected = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  if (authHeader !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const { type, title, body, link } = await req.json()

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), { status: 400 })
    }

    // Get all Thriver emails
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: thrivers } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'thriver')

    if (!thrivers || thrivers.length === 0 || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ sent: 0, reason: !RESEND_API_KEY ? 'no_api_key' : 'no_thrivers' }))
    }

    const emails = thrivers.map((t: any) => t.email).filter(Boolean)

    // BUG FIX 2026-05-12: the hardcoded `to: 'xerosumstudio@gmail.com'`
    // meant every iteration of this loop emailed the same defunct
    // address while ignoring the per-Thriver `email` variable just
    // fetched on line 30. Now uses the loop variable so each Thriver
    // gets the notification at their own registered address.
    let sent = 0
    for (const email of emails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'The Tapestry <noreply@distemperverse.com>',
          to: email,
          subject: `[The Tapestry] ${title}`,
          text: `${body}${link ? `\n\n${link}` : ''}`,
        }),
      })
      if (res.ok) sent++
    }

    return new Response(JSON.stringify({ sent }))
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
