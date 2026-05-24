// Repository: sessions table (Y11-e roll-log session-archive). Keeps the
// campaign session lifecycle reads/writes behind the data seam so the table
// page stays free of raw `.from('sessions')`.

import { db } from './db'

export function insertSession(row: { campaign_id: string; session_number: number; started_at: string }) {
  return db().from('sessions').insert(row)
}

/**
 * The active (un-ended) session id for a campaign, or null. Used to re-establish
 * the roll-log stamper after a page reload mid-session (startSession sets it
 * directly; this recovers it when the page loads into an already-active session).
 */
export async function activeSessionIdForCampaign(campaignId: string): Promise<string | null> {
  const { data } = await db()
    .from('sessions')
    .select('id')
    .eq('campaign_id', campaignId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}
