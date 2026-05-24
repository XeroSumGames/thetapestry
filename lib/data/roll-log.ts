// Repository: roll_log (grand re-architecture Phase 3 migration).
//
// The feed/log table - the table page inserts to it constantly (rolls,
// action lines, banners) and clears it on session boundaries. Same
// behavior-preserving drop-in convention: returns the typed Supabase
// builder/result so call sites swap without changing behavior.

import { db, type Insert } from './db'

/** The typed roll_log insert shape - the target for the payload-typing pass. */
export type RollLogInsert = Insert<'roll_log'>

/**
 * Insert one or many roll_log rows. Drop-in for
 * `supabase.from('roll_log').insert(X)` - X may be a single row or an
 * array, and the returned builder still chains (`.select()` etc.).
 *
 * MIGRATION NOTE: the param is typed loosely (`any`) for now. This batch's
 * job is to centralise the table name + drop the seam-leakage ratchet
 * WITHOUT forcing call-site changes. The existing call sites build payloads
 * dynamically (and one stuffs a DamageResult into the Json `damage` column),
 * so strict `RollLogInsert` typing would surface payload mismatches that are
 * a separate tightening pass - done when this code is rebuilt into
 * useRollResolution (Phase 3). Tighten `rows` to `RollLogInsert | RollLogInsert[]` then.
 */
// Y11-e: the active session id, set by the table page's session lifecycle
// (setRollLogSession). insertRollLog stamps it onto every row that doesn't
// already carry one, so the feed can be scoped to the current session without
// wiping roll_log at session start. Module-level so all 20+ insert call sites
// get the stamp for free (no per-site change, no missed-site risk).
let _activeSessionId: string | null = null
export function setRollLogSession(id: string | null) {
  _activeSessionId = id
}

// Pure: inject session_id into a row (or each row of an array) when there's an
// active session AND the row didn't already specify one. No session -> rows
// pass through untouched (session_id stays NULL = "pre/outside-session" roll).
// Extracted so the stamping rule is unit-testable without the DB.
export function stampSessionId(rows: any, sessionId: string | null): any {
  if (!sessionId) return rows
  const stamp = (r: any) =>
    r && typeof r === 'object' && !Array.isArray(r) && r.session_id === undefined
      ? { ...r, session_id: sessionId }
      : r
  return Array.isArray(rows) ? rows.map(stamp) : stamp(rows)
}

export function insertRollLog(rows: any) {
  return db().from('roll_log').insert(stampSessionId(rows, _activeSessionId))
}

/** The bare roll_log delete builder, e.g. `deleteRollLog().eq('campaign_id', id)`. */
export function deleteRollLog() {
  return db().from('roll_log').delete()
}
