// IMPORTANT: Deploy with --no-verify-jwt flag — Ghost visitors have no auth token
// npx supabase functions deploy log-visit --no-verify-jwt --project-ref jbudzglgtxeoaufpejrv

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const THRIVER_EMAIL = Deno.env.get('THRIVER_EMAIL')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { session_id, page, referrer, user_id, country_code, region, city, latitude, longitude } = await req.json()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? null

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check if this session already has a log entry (for email throttling)
    const { data: existing } = await supabase
      .from('visitor_logs')
      .select('id')
      .eq('session_id', session_id)
      .limit(1)

    const isFirstVisit = !existing || existing.length === 0

    // Insert the visit log
    await supabase.from('visitor_logs').insert({
      session_id,
      page,
      referrer: referrer || null,
      is_ghost: !user_id,
      user_id: user_id || null,
      ip_address: ip,
      country_code: country_code || null,
      region: region || null,
      city: city || null,
      latitude: latitude || null,
      longitude: longitude || null,
    })

    // Send email on first visit per session (non-blocking)
    if (isFirstVisit && RESEND_API_KEY && THRIVER_EMAIL) {
      const isGhost = !user_id
      const subject = isGhost
        ? '[The Tapestry] New Visitor'
        : '[The Tapestry] Survivor Active'

      const now = new Date().toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })

      // Build location string
      const locationParts = [city, region, country_code].filter(Boolean)
      const location = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown'

      const body = isGhost
        ? `A visitor just arrived at The Tapestry.\n\nPage: ${page}\nTime: ${now}\nLocation: ${location}\nReferrer: ${referrer || 'Direct'}\nSession: ${session_id?.slice(0, 8) ?? 'unknown'}`
        : `A survivor is active on The Tapestry.\n\nPage: ${page}\nTime: ${now}\nLocation: ${location}\nReferrer: ${referrer || 'Direct'}\nSession: ${session_id?.slice(0, 8) ?? 'unknown'}`

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'The Tapestry <noreply@distemperverse.com>',
            to: THRIVER_EMAIL,
            subject,
            text: body,
          }),
        })
      } catch (_emailErr) {
        console.error('Email send failed:', _emailErr)
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
