// IMPORTANT: Deploy with --no-verify-jwt flag - Ghost visitors have no auth token
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

  // Body-size cap (stability-audit 2026-06-29, M-2): this function deploys
  // --no-verify-jwt and its URL ships in the client bundle, so the body is
  // fully attacker-controlled. Reject an oversized payload BEFORE parsing so a
  // flood of huge POSTs can't burn parse CPU + invocation cost. content-length
  // is the cheap front gate; the text-length recheck below catches a missing or
  // spoofed header (e.g. chunked encoding). A legit visit payload is well under 2 KB.
  const MAX_BODY_BYTES = 2048
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return new Response('Payload too large', {
      status: 413,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response('Payload too large', {
        status: 413,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
    const { session_id, page, referrer, user_id, country_code, region, city, latitude, longitude, ip_hash } = JSON.parse(rawBody)

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? null

    // Input validation - every body field is attacker-controlled (this
    // function deploys --no-verify-jwt and its URL ships in the client
    // bundle). Reject a non-UUID user_id and bound every string so the
    // body cannot poison analytics or bloat rows.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null)
    const vUserId = typeof user_id === 'string' && UUID_RE.test(user_id) ? user_id : null
    const vSession = clip(session_id, 64)
    const vPage = clip(page, 256)
    const vReferrer = clip(referrer, 512)
    const vCountry = clip(country_code, 8)
    const vRegion = clip(region, 128)
    const vCity = clip(city, 128)
    const vLat = typeof latitude === 'number' ? latitude : null
    const vLong = typeof longitude === 'number' ? longitude : null
    const vIpHash = clip(ip_hash, 128)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Email-gate visit count keys off the SERVER-observed IP (ip_address),
    // NEVER a body field. Previously it counted the body-supplied ip_hash,
    // so omitting ip_hash made every request read as visitNumber 1 and fire
    // a "new visitor" email - an unauthenticated Resend-quota mailbomb. The
    // real connecting IP can't be forged by the caller, so the gate is
    // sound. (Analytics still stores the body ip_hash separately, below -
    // that dedup column's semantics are intentionally unchanged.)
    let visitNumber = 1
    if (ip) {
      const { count } = await supabase
        .from('visitor_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
      visitNumber = (count ?? 0) + 1
    }

    // Insert the visit log
    await supabase.from('visitor_logs').insert({
      session_id: vSession,
      page: vPage,
      referrer: vReferrer,
      is_ghost: !vUserId,
      user_id: vUserId,
      ip_address: ip,
      ip_hash: vIpHash,
      country_code: vCountry,
      region: vRegion,
      city: vCity,
      latitude: vLat,
      longitude: vLong,
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
    // by city stays - ip_hash 1 from Ashburn is still a bot.
    const suppressedCities = ['san jose', 'ashburn', 'boardman', 'council bluffs']
    const isSuppressedCity = vCity && suppressedCities.includes(vCity.toLowerCase())
    const isNewVisitor = visitNumber === 1
    if (isNewVisitor && RESEND_API_KEY && THRIVER_EMAIL && !isSuppressedCity) {
      const isGhost = !vUserId
      const locationParts = [vCity, vRegion, vCountry].filter(Boolean)
      const location = locationParts.length > 0 ? locationParts.join(', ') : 'Unknown'

      const subject = isGhost
        ? `[The Tapestry] New Visitor${locationParts.length > 0 ? ' - ' + [vCity, vCountry].filter(Boolean).join(', ') : ''}`
        : `[The Tapestry] Survivor Active${locationParts.length > 0 ? ' - ' + [vCity, vCountry].filter(Boolean).join(', ') : ''}`

      const now = new Date().toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })

      const visitLine = `Visit number: first visit from this IP.`

      const body = isGhost
        ? `A visitor just arrived at The Tapestry.\n\nPage: ${vPage}\nLocation: ${location}\nTime: ${now}\nReferrer: ${vReferrer || 'Direct'}\nSession: ${vSession?.slice(0, 8) ?? 'unknown'}\n${visitLine}`
        : `A survivor is active on The Tapestry.\n\nPage: ${vPage}\nLocation: ${location}\nTime: ${now}\nReferrer: ${vReferrer || 'Direct'}\nSession: ${vSession?.slice(0, 8) ?? 'unknown'}\n${visitLine}`

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
