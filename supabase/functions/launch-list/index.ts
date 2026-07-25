// Secret-gated read of the launch mailing list, for TheTable's /mailinglist page
// (which has no auth). The list is ONLY returned when the request carries the
// correct secret, checked against SIGNUP_LIST_SECRET (a function env secret,
// never shipped in the client bundle). Deploy with --no-verify-jwt.
// npx supabase functions deploy launch-list --no-verify-jwt --project-ref jbudzglgtxeoaufpejrv

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LIST_SECRET = Deno.env.get('SIGNUP_LIST_SECRET') ?? ''

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (Number(req.headers.get('content-length') ?? 0) > 1024) return json('Payload too large', 413)

  try {
    const raw = await req.text()
    if (raw.length > 1024) return json('Payload too large', 413)
    const { secret } = JSON.parse(raw)

    // Reject when unconfigured or mismatched. Length-guard then compare.
    if (!LIST_SECRET || typeof secret !== 'string' || secret.length > 256 || secret !== LIST_SECRET) {
      return json({ ok: false, error: 'unauthorized' }, 401)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await supabase
      .from('launch_signups')
      .select('email, site, source, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) return json({ ok: false, error: 'query_failed' }, 500)
    return json({ ok: true, count: data?.length ?? 0, signups: data ?? [] })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
