# Stability Audit - 2026-05-19

**First audit of this kind on this project.** Pattern + slash convention documented for future iterations:
- Slash: `/stability-audit` ([tasks/slash-conventions.md](slash-conventions.md))
- Pattern + gotchas: [tasks/lessons.md](lessons.md) "Stability-audit pattern + stale audit line numbers + Confidence-Ledger drift threshold"
- Periodic-review entry: [tasks/operating-mode.md](operating-mode.md) Sec. "Periodic reviews"
- Naming: future audits land at `tasks/stability-audit-YYYY-MM-DD.md`; dated; do not overwrite. After 5+ files, consider moving to `tasks/stability-audits/`.

Post-playtest structural read. Goal: surface load-bearing risk that is currently unattended. Not "no bugs" - "nothing important is being ignored."

Engagement type: read-only audit. No code edits in this pass. Fixes go through normal review with pre-ship 5-question checks.

Inputs read: `tasks/debug-handoff.md`, `tasks/health-pulse.md` (latest), `tasks/security-audit.md` (2026-05-19 16:23 UTC), `tasks/todo.md` (first 200 lines), `git log --since="14 days ago"` (542 commits), `git log --since="7 days ago"` (335 commits), live gates (tsc / font-sizes / role-literals / vitest / npm audit).

Today's HEAD: `20548a4` - significant drift from the chat-handoff HEAD (`d2ba6b6`).

---

## Top line

- **All gates green.** tsc clean, font-sizes OK, role-literals OK, 368 unit tests passing in 432ms, npm audit shows 0 high / 0 critical.
- **3 HIGH findings**, all from this morning's weekly security audit, all still unfixed at audit time:
  1. Session-attachments upload (table page :3518) - unsanitized filename in storage path, no size/type guard.
  2. Three more upload sites with the same shape (pin-attachments x2, note-attachments).
  3. `app/api/auth/verify-turnstile` POST - no rate limit, no body-size cap.
- **Confidence Ledger is stale.** Reads "174 unit tests"; actual count is **368** (5.3x off). Test count was also flagged stale on 2026-05-18 (160) and 2026-05-19 00:10 UTC (168). Pattern: tests get added without the ledger update.
- **HOPED-FOR backlog is empty per ledger but inaccurate** - ~50 commits today (post-2026-05-18 playtest) shipped Tier-2 recruit, vehicle fuel/brewing, advantages, FI streamline, table refactor extraction, feed narratives. None are in the ledger.
- **Risk Register colors look right** but most YELLOW items are demote candidates after the 2026-05-18 playtest. Worth a deliberate sweep next session.

---

## HIGH (action this week, ideally pre-paid-signups)

### H-1. Upload pipelines accept any filename / any type / any size

Affected sites:

| File | Line | Bucket | Path shape | Notes |
|---|---|---|---|---|
| `app/stories/[id]/table/page.tsx` | 3518 | `session-attachments` | `${sessionRow.id}/${file.name}` | raw filename, no contentType, no size check, no type check |
| `components/CampaignMap.tsx` | 760 | `pin-attachments` | `${campaignId}/${data.id}/${file.name}` | raw filename, no contentType, no size, no type |
| `components/MapView.tsx` | 978, 1056 | `pin-attachments` | `${userId}/${data.id}/${file.name}` | same shape; 1056 also passes `upsert: true` |
| `components/GmNotes.tsx` | 156 | `note-attachments` | `${campaignId}/${noteId}/${Date.now()}-${file.name}` | contentType is `file.type` (user-controlled header), no size check |
| `app/campfire/war-stories/page.tsx` | 410 | (per audit) | 10 MB cap is client-side only | bypassable |
| `app/rumors/[id]/edit/page.tsx` | 205 | (per audit) | contentType from `file.type` | unvalidated |

Threat model:
- **Filename collision/traversal:** Supabase Storage accepts arbitrary path segments. A filename like `../../foo.exe` or `..%2F..%2Fwin.exe` could land in unexpected buckets/folders depending on how the storage backend resolves it.
- **Content-type confusion:** A user uploads `evil.html` with claimed `image/png` content-type; another client renders it as an image but a direct link serves it as HTML. XSS via stored payload.
- **Storage cost / DoS:** No size cap server-side. A malicious upload of large files can bloat the bucket and rack up storage cost.
- **Filename PII / discovery:** Raw filenames in public URLs leak whatever the uploader named the file. Less severe but still a privacy/leak vector at scale.

Fix shape (one helper, applied at all sites):
```ts
function safeUploadKey(rawName: string): { key: string; ext: string } { ... }
```
Sanitize filename to `[a-z0-9_-]+\.[ext]`; cap size by reading `file.size` against a per-bucket limit (e.g., 10 MB for attachments, 5 MB for note images); whitelist content-types per bucket (`image/*` for portraits, `image/*|application/pdf` for attachments).

Priority order: table page session-attachments first (highest discoverability), then GmNotes (uses user-supplied contentType which is the most direct XSS path), then the two pin-attachments sites.

### H-2. `verify-turnstile` POST is unprotected

`app/api/auth/verify-turnstile/route.ts`:

- No rate limit on the POST handler. A loop client-side can flood the Cloudflare verify API or exhaust your edge function invocation budget.
- No body-size cap. Token is whatever the client sends; `await req.json()` will parse any size.
- Fail-open in dev mode is fine; in production a misconfigured secret returns 500 (correct).

Fix shape: add an IP-keyed rate limit (Upstash, Vercel Edge Config, or a small in-memory token bucket via `@vercel/kv`). 30 req/min/IP is generous; CAPTCHA verify is not a hot path. Cap `req.text()` to 4KB before parsing JSON.

Stakes: today this is a "they could waste your Cloudflare quota" attack. After paid signups open, the same vector is a signup-fraud / account-creation funnel-poisoner.

### H-3. The 2026-05-19 ship batch is HOPED-FOR but the ledger says empty

Today's commit log (post-2026-05-18 playtest) shows ~50 substantive ships:

- **Tier-2 Recruit** (Phase A approach flags, Phase B morale-tick drainer + Escape Pending surface, Phase C modal locked-approach gates) - touches Recruit modal + new drainer + Initiative state machine adjacency.
- **Vehicles Q4-c (per-vehicle fuel storage via 55-Gal Drums) + Q4-d (brewing-supplies stockpile + Gather Materials)** - new inventory paths + new feed narratives + DRIVE/BREW/NAVIGATE prefix-CAPS narratives (`faa60ab`, supersedes `54c46a1`).
- **P3 Q4-b Advantages** (schema + library, GM grant dialog + player tab + Use button, Award-on-feed + C3-consumed broadcast) - touches roll_log writer.
- **FI streamline** (Phase 1 pure-helper extraction, Phase 2 single-modal flow, Phase 3 Insight Die spend + cutover) - touches the roll path.
- **`refactor(table): extract useHeaderMenus`** (`2426e5b`) - first chunk of decomposing the 10k-line table page.
- **First Impression RLS fix for non-GM players** (`c30a34d`) - auth boundary fix.
- **Sentry-capture supabase errors** (same commit) - improves observability.
- **GM Share View on tactical map** (`6a4669b`).
- **NPCs CLOSE ALL + Esc shortcut**, NPC folder reorder, player drag/drop in NPC tab.
- **GM-cascade playtest recorder + localStorage resume** (`653ff86`).
- **Online-players-sit-closest-to-GM** rearrange (`09e30ba`).
- **Stress Check narrative locked** (12 strings) + bespoke feed polish across HEAL / UNJAM / REPAIR / Stabilize / Gut Instinct / Group Check / First Impression.

None of this has been touched at a live table yet. The Confidence Ledger should list this as a HOPED-FOR batch the size of the 2026-05-13/14/15 trio that drained on 2026-05-18.

Risk: bugs in this batch only surface at the next playtest (per testplan `pre-playtest-smoke-2026-05-25`). Until then, every report from the running playtester group should be filtered through "is this in the 2026-05-19 batch?"

---

## MEDIUM (action in 1-2 weeks)

### M-1. npm moderate vulns (non-breaking pair available)

Today's audit (16:23 UTC):

- `brace-expansion` moderate (CVSS 6.5, DoS) - fix non-breaking.
- `ws` moderate (CVSS 4.4, uninitialized memory disclosure) - fix non-breaking.
- `postcss` moderate (CVSS 6.1, XSS in CSS stringify, build-time only) - fix breaking (via next major).
- `next` moderate - fix breaking (major).
- `@sentry/nextjs` moderate - fix breaking (major).

Action: run `npm audit fix` scoped to brace-expansion + ws only. The breaking majors are a separate decision (next major + sentry major both want test runs before commit, neither is urgent enough to ship blind).

### M-2. Confidence Ledger drift is recurring

Test count flagged stale 3 times in 4 days (160 → 168 → 174 → 368 today). Each flag prompts a manual ledger update; the update lags the test addition.

Action shape: add `npm test 2>&1 | grep "Tests"` parse to a `scripts/refresh-ledger.mjs` that rewrites the test-count line in `tasks/debug-handoff.md` §3. Or just accept it as a manual drain done at session-start. Either is fine; the current pattern (silent drift between drains) is what's wrong.

### M-3. todo.md is 1691 lines

`tasks/todo.md` keeps growing - the CURRENT OPEN section at the top is what should drive work, the rest is historical log. Today's health-pulse flagged duplicate entries (lines 56+57 dup lines 80+84; third copies at 580+621) and a shipped item (`- [ ] 1 orphan trigger`) still listed open. Pattern: items get added without checking whether they exist, and don't get closed when shipped.

Action: run the dedup the 12:05 UTC health-pulse already proposed (drop lines 56+57, close `Coordinated Effort bespoke chain summary` shipped via `137be68`). Then make a habit: at the end of each ship-session, close todo items in the same commit as the ship.

### M-4. 530 `as any` casts, 140 in the table page alone

Concentration matches the Risk Register's "10,000+ line client component" entry. Most are Supabase response shape casts - the type generation isn't covering everything. The table page has more casts per line than the rest of the codebase combined.

Action: this is part of the multi-week table-page decomposition (already in the Tech Debt Ledger). Each `useHeaderMenus`-style extraction is an opportunity to tighten types in the extracted hook. Don't address as a separate sweep - too risky, too little benefit per change.

### M-5. Polling interval at table page :3153

3-second `setInterval` polling `refetchVehicles` for the full session. Cleanup is correct (clears on unmount, also closes BroadcastChannel + listeners). But the channel + storage + focus already trigger refetch, so the 3s polling is a belt-and-suspenders fallback.

If a session has 6 players × 4 hours, that's 6 × 4800 = 28,800 unnecessary refetches per session at the API. Not a bug; a cost.

Action: measure first. If realtime is reliable for vehicle updates (likely - it works for everything else), drop the polling. Risk is low; rollback is one-line.

---

## LOW (when convenient)

### L-1. 4 stale TODO / FIXME / HACK comments

| File | Line | Comment |
|---|---|---|
| `lib/campaign-snapshot.ts` | 22 | `communities (Phase 4b) - TODO once the tables are in use` |
| `app/campfire/timestamp/page.tsx` | 8 | `follow-up Tapestry-side renderer (TODO)` |
| `app/tools/migrate-character-photos/page.tsx` | 30 | references `XXX` placeholder format |
| `app/stories/join/page.tsx` | 74 | `placeholder="XXXXXX"` (false positive - UI hint) |

Two are real (snapshot, timestamp). Either close as won't-do or convert to todo.md items.

### L-2. `app/dashboard/page.tsx:52` accesses `profile.role` directly

Per the security audit: lowercased manually, stored as `userRole` for display. Not a security bypass (actual permission branches use `roleIsThriver`), but erodes the "never touch .role directly" invariant. Swap to a `getDisplayRole(profile)` helper.

### L-3. Realtime channel cleanup count

19 files use `.channel(` subscriptions; 23 files reference `removeChannel | unsubscribe` (54 occurrences). Different file counts mean cross-references are working - each subscribing file also cleans up. No spot-checked file leaks a channel. Calling this **OK** but worth a deliberate audit when the table page decomposes (channels in a 10k-line file are hard to track).

---

## Risk Register triage (proposed updates)

These changes need a second look + a deliberate decision. Not auto-applied here:

- **`lib/campaign-clock.ts`** - currently YELLOW with a demote-candidate note (one playtest green, one cycle to demote). Recommend demote to GREEN after 2026-05-25 playtest if drainers behave again.
- **`roll_log` writer path** - currently YELLOW. Same recommendation - demote after 2026-05-25 playtest. **But:** the Advantages broadcast (`2b8ce4b`) and FI single-modal cutover (`ae7eafd`, `e1d1da0`) add new write paths. Hold YELLOW one more cycle than otherwise.
- **Initiative state machine** - currently YELLOW. The Tier-2 Recruit morale-tick drainer (`1951d77`) and approach-flags work (`6287480`) touch adjacency. Hold YELLOW.
- **TacticalMap canvas** - currently YELLOW. GM Share View (`6a4669b`) is a small additive feature; should not block demote. Recommend demote to GREEN after 2026-05-25 playtest.
- **`app/stories/[id]/table/page.tsx`** - currently YELLOW (10k+ lines). `useHeaderMenus` extraction is the FIRST real decomposition. Hold YELLOW until 3-4 extractions in.

---

## What we did NOT audit (intentional scope cuts)

- E2E correctness of the 2026-05-19 ship batch. That's the 2026-05-25 playtest's job. We confirmed the batch exists and is HOPED-FOR; we did not verify any feature plays correctly.
- Performance profiling. Risk Register flags TacticalMap and the table page as suspect; this audit didn't measure render times or memory.
- SQL/RLS coverage. The schema-drift report (`tasks/schema-drift-report-2026-05-17.md`) and weekly security audit cover this; today's audit found 15 orphan tables tracked in todo.md.
- Sentry error patterns. Worth a separate look. The audit confirmed Sentry is wired (filters + realtime tests are in the suite) but did not query the dashboard.

---

## Recommended next moves, in order

1. **Apply `npm audit fix` scoped to brace-expansion + ws** (one command, non-breaking, clears M-1's non-breaking pair).
2. **Patch H-2 (verify-turnstile rate limit + body cap)** - small file, isolated, blocks a pre-paid-signup concern.
3. **Patch H-1 by writing the `safeUploadKey` helper + applying at all 4-6 sites** - biggest H-grade win, one-session work.
4. **Drain Confidence Ledger** - bump 174 → 368 tests, add 2026-05-19 HOPED-FOR batch, dedupe todo.md per 12:05 UTC health-pulse.
5. **2026-05-25 playtest** - verifies the HOPED-FOR batch. Demote YELLOW items per Risk Register triage above.
6. **`/architecture-review`** (weekly) - re-read this doc, check what's been actioned, refresh.

---

## Audit hygiene

This doc supersedes itself: when a new stability audit runs, archive this one and write a new dated file. Do not edit this in place.

Trigger conditions for next audit:
- After 2026-05-25 playtest (verify HOPED-FOR drain + Risk Register demotes).
- If a new HIGH lands in `security-audit.md` and isn't fixed within 48 hours.
- If `todo.md` CURRENT OPEN passes 30 items without a prune.
- If commit volume exceeds 50/day for 5+ consecutive days (signal that change rate exceeds verification rate).
