// Reconcile scheduler (lib/realtime seam) - the guard rail between "several
// triggers want a refetch" and "the refetch actually runs".
//
// usePostgresSubscription's reconcile net fires from three independent
// triggers: SUBSCRIBED catch-up, tab-return-to-visible, and the slow poll.
// Unguarded, those stack (a tab flip during a reconnect fires two refetches
// back to back) and, worse, can interleave: a slow stale refetch resolving
// AFTER a newer one would clobber fresher state. This scheduler makes both
// impossible at the hook level:
//
//   - SERIALIZED: at most one reconcile runs at a time, so responses can
//     never resolve out of order relative to each other.
//   - COALESCED: a request while one is in flight queues exactly ONE trailing
//     run (the trigger's cause may postdate the in-flight fetch), and a
//     request within minGapMs of the last start is dropped - a reconcile
//     refetches full current DB state, so a just-ran reconcile already
//     covers it and the poll catches anything truly new.
//
// Callers' refetch functions should still guard against racing their OWN
// event-handler writes (see CampaignMap's loadSeqRef pattern) - this
// serializes reconcile-vs-reconcile, not reconcile-vs-handler.

export interface ReconcileScheduler {
  /** Ask for a reconcile. Bursts coalesce; runs never overlap. */
  request(): void
  /** Stop permanently. Pending trailing runs are cancelled. */
  dispose(): void
}

export function createReconcileScheduler(
  run: () => void | Promise<void>,
  opts?: { minGapMs?: number; now?: () => number },
): ReconcileScheduler {
  const minGap = opts?.minGapMs ?? 5000
  const now = opts?.now ?? Date.now
  let lastStartedAt = -Infinity
  let inFlight = false
  let trailing = false
  let disposed = false

  const kick = () => {
    inFlight = true
    lastStartedAt = now()
    Promise.resolve()
      .then(run)
      // A failed refetch is not fatal - the net's next trigger retries.
      .catch(() => {})
      .finally(() => {
        inFlight = false
        if (disposed) return
        if (trailing) { trailing = false; kick() }
      })
  }

  return {
    request() {
      if (disposed) return
      if (inFlight) { trailing = true; return }
      if (now() - lastStartedAt < minGap) return
      kick()
    },
    dispose() {
      disposed = true
      trailing = false
    },
  }
}
