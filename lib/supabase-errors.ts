// Common Supabase / PostgREST error detection helpers. Centralized so
// every "feature gated on a missing migration" surface can show the
// same friendly fallback instead of leaking a raw schema-cache error
// to the user.

export interface SupabaseLikeError {
  message?: string | null
  code?: string | null
  details?: string | null
}

/** True when the error is PostgREST's "table or column not found in
 *  schema cache" — i.e. the migration hasn't been applied on this
 *  database yet. The PostgREST code for this is PGRST205, but match
 *  the message text too as a defensive belt for older clients. */
export function isMissingSchema(err: SupabaseLikeError | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST205') return true
  const msg = (err.message ?? '') + ' ' + (err.details ?? '')
  return /schema cache|does not exist|relation .* does not exist/i.test(msg)
}

/** Friendly fallback message when a feature is wired in code but the
 *  underlying SQL migration hasn't been applied yet. Used by feature
 *  pages to render a helpful banner pointing the GM/Thriver at the
 *  exact migration to run. */
export function missingSchemaMessage(featureName: string, migrationFile: string): string {
  return `${featureName} isn't enabled on this database yet — a Thriver needs to apply ${migrationFile} in Supabase. Once that's done, refresh and you're good.`
}
