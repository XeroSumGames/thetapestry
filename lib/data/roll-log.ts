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
export function insertRollLog(rows: any) {
  return db().from('roll_log').insert(rows)
}

/** The bare roll_log delete builder, e.g. `deleteRollLog().eq('campaign_id', id)`. */
export function deleteRollLog() {
  return db().from('roll_log').delete()
}
