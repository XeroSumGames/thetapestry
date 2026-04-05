import { createClient } from './supabase-browser'

const SESSION_KEY = 'tapestry_session_id'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

export async function logVisit(page: string) {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('visitor_logs').insert({
    session_id: getSessionId(),
    page,
    referrer: document.referrer || null,
    is_ghost: !user,
  })
}

export async function logEvent(eventType: string, metadata?: object) {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('user_events').insert({
    user_id: user.id,
    event_type: eventType,
    metadata: metadata ?? null,
  })
}

export async function logFirstEvent(eventType: string, metadata?: object) {
  if (typeof window === 'undefined') return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // Check if this event type already exists for this user
  const { data: existing } = await supabase
    .from('user_events')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_type', eventType)
    .limit(1)
  if (existing && existing.length > 0) return
  await supabase.from('user_events').insert({
    user_id: user.id,
    event_type: eventType,
    metadata: metadata ?? null,
  })
}
