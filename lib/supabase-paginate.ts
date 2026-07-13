// Page through a Supabase select past PostgREST's default 1000-row cap.
//
// A bare `.select('*')` silently returns at most 1000 rows - fine for reads
// that feed a UI, but a DATA-LOSS bug for anything that PERSISTS the result
// (a published module snapshot, a GM-kit backup zip): a campaign with >1000
// scene_tokens would ship a truncated copy and the diff would read the dropped
// rows as "removed". Pass a factory that applies `.range(from, to)` to the same
// query and this loops until a short page comes back.

export async function fetchAllRows<T = any>(
  makeRangeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeRangeQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}
