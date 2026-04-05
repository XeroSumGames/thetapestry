import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
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
      .eq('role', 'Thriver')

    if (!thrivers || thrivers.length === 0 || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ sent: 0, reason: !RESEND_API_KEY ? 'no_api_key' : 'no_thrivers' }))
    }

    const emails = thrivers.map((t: any) => t.email).filter(Boolean)

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
