# Finding - Realtime wrap-invariant bypass (~14 sites)

**Discovered by:** stability-audit M5 invariant check, 2026-05-30. **Lane:**
audit (Puffer); migration belongs to **Hunt & Peck** (the bypassing files
are all `app/`, `components/`, `lib/`-non-realtime).

**Severity:** MEDIUM (per audit). NOT a fire - the codebase still reports
errors via `reportSupabaseError` at many SQL-call sites, and Sentry catches
JS exceptions via the boundary in `app/layout.tsx`. What's missing is
realtime-handler-specific breadcrumbs / tags (the `wrapBroadcast` /
`wrapDbChange` enrichment), so when a realtime handler throws today, it
shows up in Sentry without the channel / event-name tag that makes triage
fast.

---

## What the invariant says

`lib/realtime/useCampaignChannel.ts:20` comment block claims:
> "Every handler is auto-wrapped with the Sentry guard (wrapBroadcast /
> wrapDbChange) - 100% coverage, not opt-in."

The hook implementation is correct: lines 96 + 110 wrap every handler at
the boundary, and `usePostgresSubscription.ts:51` does the same. The claim
is true **for code that uses the hooks**.

The gap: code that calls `supabase.channel(...)` directly skips the hook
entirely and therefore skips the wrap.

---

## The 14 bypass sites

Grouped by lane / area for migration planning. Hook-internal call sites
(`lib/realtime/*`) and pure-presence channels (no event handlers to wrap)
are exempt and excluded.

### Group A - sheet syncs (4 sites)
- `app/campaign-sheet/page.tsx:270` (`campaign_clock_<id>` broadcast)
- `app/campaign-sheet/page.tsx:281` (`campaign_pg_<id>` postgres_changes)
- `app/character-sheet/page.tsx:78` (`charsheet_<characterId>` mixed)
- `app/npc-sheet/page.tsx:86` (`npcsheet_<npcId>` mixed)
- `app/npc-sheet/page.tsx:92` (`initiative_<campaignId>` broadcast)

### Group B - map / pins (5 sites)
- `components/CampaignMap.tsx:951` (`campaign_pins_<id>`)
- `components/CampaignMap.tsx:961` (`campaign_npcs_map_<id>`)
- `components/CampaignMap.tsx:968` (`campaign_ping_<id>`)
- `components/CampaignMap.tsx:983` (`campaign_view_share_<id>`)
- `components/CampaignPins.tsx:168` (`campaign_pins_<id>`)

### Group C - feed / chat / notes (4 sites)
- `components/RollsFeed.tsx:228` (`rolls_<id>` broadcast)
- `components/TableChat.tsx:145` (`chat_<id>` broadcast)
- `components/GmNotes.tsx:494` (`gm_notes_share_<id>` send-only)
- `components/PlayerNotes.tsx:49` (`gm_notes_share_<id>` receive)

### Group D - popout (1 site)
- `app/scene-controls-popout/page.tsx:139` (`tactical_popout_<id>` mixed)

### Group E - lib hooks (3 sites)
- `lib/campaign-clock.ts:136` (`campaign_clock_<id>`)
- `lib/campaign-clock.ts:556` (`initiative_<id>`)
- `lib/campaign-clock.ts:828` (`campaign_clock_<id>`)
- `lib/hooks/useBellDropdown.ts:74` (dynamic channel name)

### Exempt (NOT a bypass; documented for completeness)
- `app/stories/[id]/table/page.tsx:1316` - presence channel only.
- `components/Sidebar.tsx:85` - presence channel only.
- `lib/realtime/useCampaignChannel.ts:86` - hook internal.
- `lib/realtime/broadcastOnce.ts:27` - hook internal.
- `lib/realtime/useGlobalPresence.ts:27` - presence-only hook internal.

---

## Why this matters

When a realtime handler throws today (e.g. a stale-closure read in an
inbound broadcast handler - which is the EXACT class of bug that drove
4 of today's 7 lessons), Sentry catches the JS exception but without:
- the channel name (`rolls_<id>`, `campaign_pins_<id>`, etc.)
- the event name (`token_moved`, `pin_added`, `campaign_clock_advanced`)
- the kind tag (`broadcast` vs `pg`)

So triaging a Sentry error like "TypeError reading 'character_id' of
undefined in CampaignMap.tsx:984" requires reading the surrounding code
to figure out which event fired. With the wrap, the tag would say
`kind=broadcast event=pin_added channel=campaign_pins_xxx` and the
triage starts from a known seam.

---

## Closure path (multi-step, NOT a single commit)

Each group above is a candidate for migration onto `useCampaignChannel`
or `usePostgresSubscription`. Two paths exist:

### Path A (preferred) - Migrate to the hooks
For each component, replace the hand-rolled
`supabase.channel(...).on(...).subscribe()` with a `useCampaignChannel({
broadcast: [...], postgres: [...] })` config. Auto-wrapped, auto-resubscribed
on key change, fresh-closure via the configRef pattern. This is the
**Grand Re-Arch's stated end-state** - the migration was paused after
Phase 7 (2-client suite proven) because no fresh bug was forcing it.

Estimated effort: ~1-2 hours per component for the simple sheet syncs +
RollsFeed/TableChat; ~3-4 hours for CampaignMap (4 channels in one
component). Total ~25-35 hours HP time spread across the 14 sites.

### Path B (interim) - Wrap-at-call-site
At each direct `.channel().on(...)` site, inline `wrapBroadcast(name, fn)`
or `wrapDbChange(name, fn)` around the handler. ~5 min per site, ~70 min
total. No behavior change; just enrichment. Trades the hook ergonomics
(fresh-closure, auto-resubscribe) for the Sentry tag at a smaller cost.

### Recommendation
**Path B as a stopgap, schedule Path A as the Grand Re-Arch finish line.**
Path B closes the Sentry-coverage gap fast; Path A is the right
architectural end-state but not urgent given today's coverage is "noisy
but reporting".

---

## Guardrail (for after migration completes)

When the 14 sites are migrated or wrap-at-call-site, add
`scripts/check-realtime-wrap.mjs` to the pre-commit: lint for
`supabase\.channel\(` outside `lib/realtime/*` + a small allowlist of
presence-only files (Sidebar, useGlobalPresence, table-presence). New
direct-channel sites then fail the pre-commit and force the migration
discipline going forward.

**Don't add the guardrail YET** - it would break pre-commit on every
existing bypass site. Add it AFTER Path B (cheapest) closes the existing
gap, or behind an ALLOWLIST-baseline ratchet.

---

## Route

Adding to `tasks/todo.md`:
- M5 stays open and is RECLASSIFIED from "audit only" to a real
  multi-step routed-to-HP migration. Severity stays MEDIUM (it's a Sentry
  enrichment gap, not a correctness defect).
- Recommended ship order for HP: Path B sweep first (~70 min), then add
  the guardrail script, then schedule Path A migration alongside other
  god-component decomposition work.
