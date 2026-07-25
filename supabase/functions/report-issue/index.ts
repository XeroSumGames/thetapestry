// Public issue-report capture from the free generators. message required; email
// OPTIONAL (so the reporter can be replied to). Inserts + emails the owner.
// Deploy with --no-verify-jwt.
// npx supabase functions deploy report-issue --no-verify-jwt --project-ref jbudzglgtxeoaufpejrv

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCE_NAMES: Record<string, string> = {
  apegenerator: 'Planet of the Apes generator',
  space1999: 'Space: 1999 generator',
  'dredd-generator': 'Judge Dredd generator',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  // Reports carry free text, so allow a larger (but still bounded) body.
  if (Number(req.headers.get('content-length') ?? 0) > 8192) return json('Payload too large', 413)

  try {
    const raw = await req.text()
    if (raw.length > 8192) return json('Payload too large', 413)
    const { source, message, email, page_url } = JSON.parse(raw)

    const vMessage = typeof message === 'string' ? message.trim().slice(0, 4000) : ''
    if (!vMessage) return json({ ok: false, error: 'message_required' }, 400)

    // Email is OPTIONAL. If given, it must look valid; if blank, that's fine.
    let vEmail: string | null = null
    if (typeof email === 'string' && email.trim()) {
      const e = email.trim().toLowerCase().slice(0, 254)
      if (!EMAIL_RE.test(e)) return json({ ok: false, error: 'invalid_email' }, 400)
      vEmail = e
    }

    const vSource = typeof source === 'string' ? source.slice(0, 32) : null
    const vPageUrl = typeof page_url === 'string' ? page_url.slice(0, 512) : null
    const ua = (req.headers.get('user-agent') ?? '').slice(0, 512) || null

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await supabase.from('issue_reports').insert({
      source: vSource,
      message: vMessage,
      email: vEmail,
      page_url: vPageUrl,
      user_agent: ua,
    })
    if (error) return json({ ok: false, error: 'insert_failed' }, 500)

    const response = json({ ok: true })

    if (RESEND_API_KEY) {
      const sourceLabel = (vSource && SOURCE_NAMES[vSource]) || vSource || 'a generator'
      const now = new Date().toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      })
      const body = [
        `New issue report from the ${sourceLabel}.`,
        ``,
        `Message:`,
        vMessage,
        ``,
        `Reply-to: ${vEmail || '(not provided)'}`,
        `Page:     ${vPageUrl || '-'}`,
        `Time:     ${now}`,
      ].join('\n')

      const sendEmail = async () => {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Xero Sum Games <noreply@distemperverse.com>',
              to: 'xerosumstudio@gmail.com',
              subject: `[Issue] ${sourceLabel}${vEmail ? ' - ' + vEmail : ''}`,
              text: body,
              ...(vEmail ? { reply_to: vEmail } : {}),
            }),
          })
        } catch (_e) {
          console.error('issue email failed:', _e)
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
