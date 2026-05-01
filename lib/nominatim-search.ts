// lib/nominatim-search.ts
// US-first search wrapper around Nominatim's autocomplete. The
// canonical Tapestry use-case is US-based campaigns + locations
// (Distemperverse settings live in the US), so prioritising US
// matches reduces the "did you mean Tulsa, Tunisia?" problem in
// search dropdowns.
//
// Behavior:
//   1. Fire a US-only query (`countrycodes=us`). If results, return.
//   2. Else fall back to a global query. Returns those.
//
// Tradeoff: 2× latency on no-US-match queries. Acceptable for the
// autocomplete UX since the common case (US match) is single-fetch.

export interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

interface SearchOpts {
  /** Max results requested in each call. Mirrors Nominatim's limit param. */
  limit?: number
  /** AbortSignal to cancel in-flight requests when the input changes. */
  signal?: AbortSignal
  /** Override the default fetch behavior — test seam. */
  fetcher?: typeof fetch
}

/**
 * US-first Nominatim search. Queries with `countrycodes=us` first; if
 * the response is empty, falls back to an unscoped global query.
 * Returns whatever Nominatim returned (empty array if both calls
 * returned 0).
 */
export async function searchNominatimUSFirst(
  query: string,
  opts: SearchOpts = {},
): Promise<NominatimResult[]> {
  const limit = opts.limit ?? 5
  const fetcher = opts.fetcher ?? fetch
  const trimmed = query.trim()
  if (!trimmed) return []

  // 1) US-first query.
  const usUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&q=${encodeURIComponent(trimmed)}&limit=${limit}`
  const usRes = await fetcher(usUrl, { signal: opts.signal })
  const usData = (await usRes.json()) as NominatimResult[]
  if (usData.length > 0) return usData

  // 2) Fallback — global. Ignore quota concerns; the caller's
  // typical typing cadence is debounced.
  const globalUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=${limit}`
  const globalRes = await fetcher(globalUrl, { signal: opts.signal })
  return (await globalRes.json()) as NominatimResult[]
}
