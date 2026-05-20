// Common Supabase / PostgREST error detection helpers. Centralized so
// every "feature gated on a missing migration" surface can show the
// same friendly fallback instead of leaking a raw schema-cache error
// to the user.

import * as Sentry from '@sentry/nextjs'

export interface SupabaseLikeError {
  message?: string | null
  code?: string | null
  details?: string | null
  hint?: string | null
}

/** Log a Supabase error to console AND Sentry. Supabase errors come back
 *  as response objects, NOT thrown exceptions - so they slip past
 *  Sentry.captureException entirely unless something explicitly reports
 *  them. The 2026-05-18 playtest surfaced this when a player hit a 42501
 *  RLS rejection on First Impression: visible in their browser console,
 *  invisible in Sentry. This helper closes that gap.
 *
 *  Tags the captured event with `supabase_error_code` so we can filter
 *  Sentry by code. `context` is the call-site label (e.g. "first-impression",
 *  "barter") and goes onto the message + breadcrumb. */
export function reportSupabaseError(err: SupabaseLikeError | null | undefined, context: string): void {
  if (!err) return
  console.error(`[${context}] supabase error:`, err)
  try {
    Sentry.captureException(new Error(`[${context}] supabase ${err.code ?? 'error'}: ${err.message ?? '(no message)'}`), {
      tags: {
        supabase_error_code: err.code ?? 'unknown',
        supabase_context: context,
      },
      extra: {
        message: err.message,
        details: err.details,
        hint: err.hint,
      },
    })
  } catch {
    // Sentry init may be incomplete on cold start; swallow.
  }
}

/** True when the error is PostgREST's "table or column not found in
 *  schema cache" - i.e. the migration hasn't been applied on this
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
  return `${featureName} isn't enabled on this database yet - a Thriver needs to apply ${migrationFile} in Supabase. Once that's done, refresh and you're good.`
}
