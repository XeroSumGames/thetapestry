// IMPORTANT: Deploy with --no-verify-jwt flag - Ghost visitors have no auth token
// npx supabase functions deploy log-visit --no-verify-jwt --project-ref jbudzglgtxeoaufpejrv

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UAParser } from 'https://esm.sh/ua-parser-js@1.0.37'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const THRIVER_EMAIL = Deno.env.get('THRIVER_EMAIL')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null)
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS })
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
    return json('Payload too large', 413)
  }

  try {
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return json('Payload too large', 413)
    }
    const body = JSON.parse(rawBody)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // --- Exit beacon: "how long they stayed". A pagehide/visibility beacon
    // updates the dwell on the pageview row it was given (the row id returned by
    // the pageview insert below). No email, no visit count. duration_ms is
    // clamped to a sane range so a forged beacon can't poison the column. ---
    if (body && body.type === 'exit') {
      const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null
      let dur = int(body.duration_ms)
      if (dur !== null) dur = Math.max(0, Math.min(dur, 6 * 60 * 60 * 1000)) // 0..6h
      if (id && dur !== null) {
        await supabase
          .from('visitor_logs')
          .update({ duration_ms: dur, ended_at: new Date().toISOString() })
          .eq('id', id)
      }
      return json({ ok: true })
    }

    // --- Pageview ---
    const {
      session_id, page, referrer, user_id, country_code, region, city, latitude, longitude, ip_hash,
      site, full_path, screen_w, screen_h, language,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    } = body

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? null

    // Input validation - every body field is attacker-controlled (this
    // function deploys --no-verify-jwt and its URL ships in the client
    // bundle). Reject a non-UUID user_id and bound every string so the
    // body cannot poison analytics or bloat rows.
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

    // Enrichment fields (2026-07-24). All optional + nullable; older beacons that
    // don't send them just log null. site distinguishes tapestry/tableau/table.
    // If the beacon didn't send a site, infer it from the request Origin - this
    // tags every caller (the static generators + not-yet-updated apps) correctly
    // with zero client changes. An explicit body.site always wins.
    let vSite = clip(site, 16)
    if (!vSite) {
      const origin = (req.headers.get('origin') ?? req.headers.get('referer') ?? '').toLowerCase()
      if (origin.includes('thetable.xerosumgames.com')) vSite = 'table'
      else if (origin.includes('thetableau.xerosumgames.com')) vSite = 'tableau'
      else if (origin.includes('distemperverse.com')) vSite = 'tapestry'
    }
    const vFullPath = clip(full_path, 512)
    const vLang = clip(language, 32)
    const vScreenW = int(screen_w)
    const vScreenH = int(screen_h)
    const vUtmSource = clip(utm_source, 128)
    const vUtmMedium = clip(utm_medium, 128)
    const vUtmCampaign = clip(utm_campaign, 128)
    const vUtmTerm = clip(utm_term, 128)
    const vUtmContent = clip(utm_content, 128)

    // Device/browser/OS parsed SERVER-SIDE from the UA header (not a body field),
    // so it's trustworthy and covers every caller, old or new. Bots flagged so
    // the dashboard can exclude them.
    const uaStr = (req.headers.get('user-agent') ?? '').slice(0, 512)
    const ua = new UAParser(uaStr).getResult()
    const vBrowser = ua.browser?.name ? String(ua.browser.name).slice(0, 64) : null
    const vOs = ua.os?.name ? String(ua.os.name).slice(0, 64) : null
    const isBot = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|preview|monitor/i.test(uaStr)
    const vDevice = isBot ? 'bot' : (ua.device?.type ? String(ua.device.type).slice(0, 16) : 'desktop')

    // Email-gate visit count keys off the SERVER-observed IP (ip_address),
    // NEVER a body field. The real connecting IP can't be forged by the caller.
    let visitNumber = 1
    if (ip) {
      const { count } = await supabase
        .from('visitor_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
      visitNumber = (count ?? 0) + 1
    }

    // Insert the visit log; return the id so the client can post a dwell beacon.
    const { data: inserted } = await supabase
      .from('visitor_logs')
      .insert({
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
        site: vSite,
        full_path: vFullPath,
        user_agent: uaStr || null,
        device_type: vDevice,
        browser: vBrowser,
        os: vOs,
        screen_w: vScreenW,
        screen_h: vScreenH,
        language: vLang,
        utm_source: vUtmSource,
        utm_medium: vUtmMedium,
        utm_campaign: vUtmCampaign,
        utm_term: vUtmTerm,
        utm_content: vUtmContent,
      })
      .select('id')
      .single()

    // Build the response now (with the row id) and return immediately. Anything
    // below uses EdgeRuntime.waitUntil so the email send doesn't block the client.
    const response = json({ ok: true, id: inserted?.id ?? null })

    // Email gate (Xero pref 2026-05-08): fire ONLY on the very first
    // visit from a brand-new IP. Bot suppression by city stays.
    const suppressedCities = ['san jose', 'ashburn', 'boardman', 'council bluffs']
    const isSuppressedCity = vCity && suppressedCities.includes(vCity.toLowerCase())
    const isNewVisitor = visitNumber === 1
    if (isNewVisitor && !isBot && RESEND_API_KEY && THRIVER_EMAIL && !isSuppressedCity) {
      const isGhost = !vUserId
      const location = [vCity, vRegion, vCountry].filter(Boolean).join(', ') || 'Unknown'
      const locShort = [vCity, vCountry].filter(Boolean).join(', ')

      // Which SITE was hit, in plain brand terms. site is set by the beacon or
      // inferred from Origin above; fall back to the umbrella brand.
      const SITE_NAMES: Record<string, string> = {
        tapestry: 'The Tapestry', tableau: 'The Tableau', table: 'The Table',
      }
      const siteLabel = (vSite && SITE_NAMES[vSite]) || 'Xero Sum Games'

      const kind = isGhost ? 'New Visitor' : 'Signed-in User'
      const subject = `[${siteLabel}] ${kind}${locShort ? ' - ' + locShort : ''}`

      const now = new Date().toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })

      const device = `${vDevice}${vBrowser ? ' / ' + vBrowser : ''}${vOs ? ' / ' + vOs : ''}`
      const pageLine = vFullPath && vFullPath !== vPage ? `${vPage}  (${vFullPath})` : (vPage ?? 'unknown')

      const body = [
        `Site:     ${siteLabel}`,
        `Page:     ${pageLine}`,
        `Visitor:  ${isGhost ? 'New (first visit from this IP)' : 'Signed-in user'}`,
        `Location: ${location}`,
        `Device:   ${device}`,
        `Referrer: ${vReferrer || 'Direct'}`,
        `Time:     ${now}`,
        `Session:  ${vSession?.slice(0, 8) ?? 'unknown'}`,
      ].join('\n')

      const sendEmail = async () => {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Xero Sum Games <noreply@distemperverse.com>',
              to: 'xerosumstudio@gmail.com',
              subject,
              text: body,
            }),
          })
        } catch (_emailErr) {
          console.error('Email send failed:', _emailErr)
        }
      }
      const edgeRuntime = (globalThis as any).EdgeRuntime
      if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
        edgeRuntime.waitUntil(sendEmail())
      } else {
        sendEmail()
      }
    }

    return response
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
