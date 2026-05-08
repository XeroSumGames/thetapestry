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
    const { session_id, page, referrer, user_id, country_code, region, city, latitude, longitude, ip_hash } = await req.json()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? null

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Count prior visits from this IP hash. visitNumber === 1 means
    // we've never seen this hash before; that's the gate the email
    // alert uses (see below). The per-session "first visit" check
    // that used to live here was dropped 2026-05-08 — it sent on
    // every new browser session, which spammed the inbox for repeat
    // visitors.
    let visitNumber = 1
    if (ip_hash) {
      const { count } = await supabase
        .from('visitor_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_hash', ip_hash)
      visitNumber = (count ?? 0) + 1
    }

    // Insert the visit log
    await supabase.from('visitor_logs').insert({
      session_id,
      page,
      referrer: referrer || null,
      is_ghost: !user_id,
      user_id: user_id || null,
      ip_address: ip,
      ip_hash: ip_hash || null,
      country_code: country_code || null,
      region: region || null,
      city: city || null,
      latitude: latitude || null,
      longitude: longitude || null,
    })

    // Build the response now and return immediately. Anything below uses
    // EdgeRuntime.waitUntil so the email send doesn't block the client.
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

    // Email gate (Xero pref 2026-05-08): fire ONLY on the very first
    // visit from a brand-new ip_hash. The old rule sent on every new
    // browser session and added an isRepeatSurvivor cap at >5 visits;
    // in practice that meant returning visitors still got hit on each
    // fresh session, while Xero's own daily traffic + a long tail of
    // logged-in repeat visitors ran the visitNumber so high that
    // emails went silent. New rule is binary: visitNumber === 1, no
    // session-level retries, no signed-in/ghost split. Bot suppression
    // by city stays — ip_hash 1 from Ashburn is still a bot.
    const suppressedCities = ['san jose', 'ashburn', 'boardman', 'council bluffs']
    const isSuppressedCity = city && suppressedCities.includes(city.toLowerCase())
    const isNewVisitor = visitNumber === 1
    if (isNewVisitor && RESEND_API_KEY && THRIVER_EMAIL && !isSuppressedCity) {
      const isGhost = !user_id
      const locationParts = [city, region, country_code].filter(Boolean)
      const location = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown'

      const subject = isGhost
        ? `[The Tapestry] New Visitor${locationParts.length > 0 ? ' — ' + [city, country_code].filter(Boolean).join(', ') : ''}`
        : `[The Tapestry] Survivor Active${locationParts.length > 0 ? ' — ' + [city, country_code].filter(Boolean).join(', ') : ''}`

      const now = new Date().toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })

      const visitLine = ip_hash
        ? `Visit number: This is their ${visitNumber}${visitNumber === 1 ? 'st' : visitNumber === 2 ? 'nd' : visitNumber === 3 ? 'rd' : 'th'} visit from this location.`
        : ''

      const body = isGhost
        ? `A visitor just arrived at The Tapestry.\n\nPage: ${page}\nLocation: ${location}\nTime: ${now}\nReferrer: ${referrer || 'Direct'}\nSession: ${session_id?.slice(0, 8) ?? 'unknown'}\n${visitLine}`
        : `A survivor is active on The Tapestry.\n\nPage: ${page}\nLocation: ${location}\nTime: ${now}\nReferrer: ${referrer || 'Direct'}\nSession: ${session_id?.slice(0, 8) ?? 'unknown'}\n${visitLine}`

      const sendEmail = async () => {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'The Tapestry <noreply@distemperverse.com>',
              to: 'xerosumstudio@gmail.com',
              subject,
              text: body,
            }),
          })
        } catch (_emailErr) {
          console.error('Email send failed:', _emailErr)
        }
      }
      // Deno Deploy / Supabase Edge supports EdgeRuntime.waitUntil for
      // background work that outlives the response. Fall back to a plain
      // fire-and-forget if it's not present.
      const edgeRuntime = (globalThis as any).EdgeRuntime
      if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
        edgeRuntime.waitUntil(sendEmail())
      } else {
        sendEmail()
      }
    }

    return response
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
