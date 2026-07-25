// Public "notify me at launch" capture. Deploy with --no-verify-jwt (anonymous
// visitors, no auth token):
// npx supabase functions deploy launch-signup --no-verify-jwt --project-ref jbudzglgtxeoaufpejrv

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

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

// Pragmatic email shape check; the real validation is the confirmation you'll
// send at launch. Bounds length so the body can't bloat a row.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SITE_NAMES: Record<string, string> = {
  tapestry: 'The Tapestry', tableau: 'The Tableau', table: 'The Table',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Body-size gate: this deploys --no-verify-jwt and its URL ships in the client
  // bundle, so the body is attacker-controlled. A legit signup is tiny.
  if (Number(req.headers.get('content-length') ?? 0) > 1024) return json('Payload too large', 413)

  try {
    const raw = await req.text()
    if (raw.length > 1024) return json('Payload too large', 413)
    const { email, site, source } = JSON.parse(raw)

    const vEmail = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : ''
    if (!EMAIL_RE.test(vEmail)) return json({ ok: false, error: 'invalid_email' }, 400)
    const vSite = typeof site === 'string' ? site.slice(0, 16) : null
    const vSource = typeof source === 'string' ? source.slice(0, 128) : null

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Insert; a duplicate (same email+site) is a no-op success, and we DON'T
    // re-notify on repeats.
    const { data: inserted, error } = await supabase
      .from('launch_signups')
      .upsert({ email: vEmail, site: vSite, source: vSource }, { onConflict: 'email,site', ignoreDuplicates: true })
      .select('id')

    if (error) return json({ ok: false, error: 'insert_failed' }, 500)
    const isNew = Array.isArray(inserted) && inserted.length > 0

    const response = json({ ok: true, already: !isNew })

    // Notify the owner on a genuinely new signup (background, non-blocking).
    if (isNew && RESEND_API_KEY) {
      const siteLabel = (vSite && SITE_NAMES[vSite]) || 'Xero Sum Games'
      const now = new Date().toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
      const body = [
        `New launch signup for ${siteLabel}.`,
        ``,
        `Email:  ${vEmail}`,
        `Site:   ${siteLabel}`,
        `Source: ${vSource || '-'}`,
        `Time:   ${now}`,
      ].join('\n')

      const sendEmail = async () => {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Xero Sum Games <noreply@distemperverse.com>',
              to: 'xerosumstudio@gmail.com',
              subject: `[${siteLabel}] Launch signup - ${vEmail}`,
              text: body,
            }),
          })
        } catch (_e) {
          console.error('signup email failed:', _e)
        }
      }
      const edgeRuntime = (globalThis as any).EdgeRuntime
      if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') edgeRuntime.waitUntil(sendEmail())
      else sendEmail()
    }

    return response
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
