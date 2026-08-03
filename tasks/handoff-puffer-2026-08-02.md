# Puffer Fish handoff - 2026-08-02 (mid-context-exhaustion handoff)

Written because the writing session ran out of context mid-task. State at
write time verified live, not from memory - **still treat every fact below
as a claim to re-verify from git/disk, per the Handoff accuracy contract.**

## Where you are, who you are

- **You are Puffer Fish, and as of 2026-08-02 you are the HUB** of a new
  four-session coordination model for TheTapestry. Read
  `tasks/lane-protocol.md` in full (the "Hub & Spoke model" and "Comms
  channel" sections especially) and `tasks/HUB-LIVE.md` before doing
  anything else - they explain the model this handoff assumes you already
  understand.
- Worktree: `D:\Coding\VTTs\TheTapestry-puffer`, branch `lane/puffer`.
- HEAD at write time: `61545849` (clean except 5 untracked, pre-existing,
  NOT-yours stray files under `tasks/_work/` - old May 2026 diagnostic
  scripts, unrelated to this session, leave them alone unless Xero asks).
- `npm install` already run in this worktree - don't redo it.

## The four-session model (built THIS session, 2026-08-02)

- **Puffer Fish (you) = hub.** Only session that reviews/merges/pushes
  SQL/RLS/shared-hot-file work to `main`. Live claim: `tasks/HUB-LIVE.md`.
- **Hunt & Peck = spoke.** Session id `local_768fb632-be00-4533-8515-6b35bd0e7402`
  ("Tapestry | HP"), worktree `D:\Coding\VTTs\TheTapestry` (the primary
  checkout, branch `main`). Self-ships UI/feature work; hands you a SHA
  for anything SQL/RLS/hot-file.
- **Playwright/E2E = spoke.** Session id `local_164a2ea8-1b2f-414a-89af-f523ad3fb795`
  ("Tapestry | E2E"), worktree `D:\Coding\VTTs\TheTapestry-e2e`. Self-ships
  spec-only work. Already fixed the orphaned `[E2E ...]` test-campaign
  problem themselves (a Playwright teardown project, commit `5f64a396` on
  `lane/e2e`) - not something you need to chase.
- **Comms = the 4th session, brand new this session.** Session id
  `local_06d29c36-1657-448e-a310-9546d6559161` ("Tapestry | Comms"),
  worktree `D:\Coding\VTTs\TheTapestry-comms`, branch `lane/comms`
  (created + `npm install`'d this session). Owns `tasks/COMMS.md` (open
  questions / ANSWERED log) and `tasks/The Tapestry Smoke Testing.xlsx`.
  Routes anything needing Xero's live/manual attention. **Known
  quirk:** Comms has twice told me something was "logged to COMMS.md"
  before actually pushing - always `git fetch origin` and read the file
  fresh before trusting a claim from any session, including this one.
- **Coordination mechanism:** `mcp__ccd_session_mgmt__send_message`
  (target session id from `mcp__ccd_session_mgmt__list_sessions`, matched
  by title/cwd) - NOT relayed by Xero. He explicitly confirmed this
  twice this session: he will not carry messages between sessions unless
  strictly told to. Never write "or have Xero relay it" in a hand-off
  message to another session.
- Key docs: `tasks/HUB-LIVE.md` (who's hub), `tasks/COMMS.md` (open
  items), `tasks/lane-protocol.md` (full mechanics + a "Hard-earned
  rules" section), `tasks/decisions.md` (the architectural decision log -
  has 4 new entries from this session explaining all of the above with
  full alternatives-considered reasoning, read it if anything above is
  unclear).

## What happened this session, in order (condensed - full detail in git log)

1. Continued the 2026-08-01 audit into wave 3 (6 parallel agents: DM
   system, GM-kit, storage RLS, `/moderate` admin, campfire/forum beyond
   the earlier fix, account/auth flows) - found and fixed ~10 more real
   bugs (5 CRITICAL incl. `profiles` self-unsuspend + TheTableau
   cross-platform role escalation, `portrait-bank` write-side hole,
   moderation self-approval recurring on 5 MORE tables for a total of 7
   across the whole audit).
2. Built the hub-and-spoke model (docs + `HUB-LIVE.md` + `COMMS.md`),
   corrected my own wrong claim that Xero manually relays between
   sessions (he corrected me directly), rolled it out to HP and E2E via
   direct session messages.
3. First real hub/spoke exchange: HP shipped an NPC<->map-pin feature,
   correctly flagged (didn't touch) a wide-open `campaign_npcs` RLS
   policy that let any campaign member overwrite `hidden_from_players` -
   undoing the 2026-08-01 fog-of-war fix. You investigated, scoped a
   narrow fix (verified every write call site first), shipped it
   (`sql/fix-campaign-npcs-hidden-flag-gm-only-2026-08-02.sql`).
4. Built the Comms channel (4th session + worktree) per Xero's explicit
   ask to mirror TheTableau's setup, gave it a full kickoff block.
5. Comms relayed Xero's decision on the account-deletion anonymize
   promise (`app/account/page.tsx` says content is anonymized on
   deletion; the FKs said cascade-delete) - "build it for real." **Schema
   half SHIPPED**, commit `cecc19c7`:
   `sql/fix-account-deletion-anonymize-2026-08-02.sql` - made
   `author_user_id` nullable + `ON DELETE SET NULL` on
   `forum_threads`/`war_stories`/`lfg_posts`/`whispers`, matching the
   existing `modules` pattern. `database.types.ts` regenerated. **UI half
   also SHIPPED by HP** - commit `a750f516` "fix(campfire): anonymized
   (null) authors no longer break feed name lookups", landed on `main`
   while this handoff was being written. This whole item is DONE -
   nothing further needed, just noting it for completeness.
6. Comms also relayed Xero's decision on `portrait-bank` confidentiality
   - **THIS IS THE IN-FLIGHT TASK, see below, NOT STARTED.**

## IN-FLIGHT TASK: portrait-bank confidentiality fix - option (b), NOT YET IMPLEMENTED

**Nothing has been written for this yet - no code, no SQL. This section
is the full plan, written from investigation already done, so the next
session can execute directly without re-investigating from scratch.**

### The original bug (write-side already fixed 2026-08-01)

`portrait-bank` storage bucket is `public: true` - Supabase serves every
object via an unauthenticated CDN URL with **zero RLS evaluation for
reads**, regardless of any policy. "Private" character portraits
(`private/<uid>/...` paths) are fully readable by anyone with/guessing
the URL. Write-side (uploading into someone ELSE's private folder) was
already closed 2026-08-01: `sql/fix-portrait-bank-private-upload-2026-08-01.sql`.

### Decision history (full detail in `tasks/COMMS.md` ANSWERED + `tasks/decisions.md`)

1. Xero first chose option (a): flip the WHOLE bucket private, rework
   every `getPublicUrl()` consumer to signed URLs.
2. Before implementing, scoping found a serious problem: `portrait_bank`
   URLs get **copied permanently** into other tables the instant a
   portrait is picked - confirmed `characters.data.photoDataUrl` via
   `components/wizard/StepXero.tsx`'s `PortraitBankPicker` `onPick`
   handler (`onChange({ photoDataUrl: url })`). The SAME picker is also
   wired into `components/NpcRoster.tsx`, `components/CampaignPins.tsx`,
   `app/tools/token-creator/page.tsx` - each almost certainly bakes the
   URL into `campaign_npcs.portrait_url` / `scene_tokens.portrait_url`
   the same way (not independently confirmed for those 3, only StepXero
   was traced end-to-end). Signed URLs EXPIRE - a signed URL resolved at
   pick-time and baked into a persisted row goes silently, permanently
   broken the moment the signature expires, for every character/NPC that
   ever used the bank, **including ones created before this ships**
   (their `photoDataUrl`/`portrait_url` already contains a baked-in
   OLD-style public URL that would ALSO need migrating).
3. Reported this back through Comms. Xero re-decided: **option (b)** -
   separate private bucket for `private/<uid>/...` uploads only; the
   shared/public bank stays on plain `getPublicUrl()` forever, zero
   redesign/expiry risk for it (the majority-use-case). Confirmed live in
   `tasks/COMMS.md` ANSWERED as of commit `61545849`.

### IMPORTANT - a wrinkle in option (b) you must not miss

**`PortraitBankPicker.tsx` shows BOTH public AND the current user's own
private portraits in the SAME picker** (confirmed by reading the file -
line ~36-38, the query explicitly ORs `is_private.eq.false` with
`is_private.eq.true AND created_by.eq.<uid>`). `onPick(p.url_256)` fires
identically regardless of which kind was picked. **This means the
"baked-in URL that expires" problem from option (a) is NOT fully solved
by moving to option (b) - it still applies to the private subset**,
just with a much smaller blast radius (private portraits are far less
used than the shared bank - confirmed only **4 existing private-portrait
rows total, all from 1 user**, queried live this session). Do NOT
implement option (b) as "just swap buckets and call `createSignedUrl()`
once at upload time, store the result exactly like `getPublicUrl()` was
stored" without accounting for this - that would silently reproduce the
option (a) bug at a smaller scale, and nobody would notice until it
breaks weeks later.

### The plan I was landing on (verify this reasoning yourself before building - I did NOT get to implement or verify it)

Rather than a full app-wide "store path, resolve fresh at every render
site" redesign (which is what a technically-perfect fix would require,
touching every place `photoDataUrl`/`portrait_url`-shaped fields render
across the whole app), the pragmatic call I was leaning toward: **use a
very long-lived signed URL (e.g. 10 years,
`expiresIn = 60*60*24*365*10` seconds) generated ONCE at upload time,
and store that string in `portrait_bank.url_256`/`url_56`/`url_32`
exactly like `getPublicUrl()`'s result is stored today.** This means:

- **Zero consumer code needs to change** - every existing read site
  (`PortraitBankPicker.tsx`, `NpcRoster.tsx`, `lib/data/npc-roster.ts`,
  `lib/data/portrait-bank.ts`'s `fetchRandomPortrait`) keeps working
  exactly as-is, because the value in the DB is still just a plain URL
  string, it just happens to have a signature+long expiry embedded
  instead of being a permanent public URL. Minimal-footprint, matches
  "don't touch what doesn't need touching" given this only affects 4
  existing rows / low future volume.
- Closes the actual confidentiality goal (no longer an unauthenticated,
  RLS-bypassing, guessable/enumerable public CDN path - requires a valid
  signature token).
- **I have NOT verified Supabase's `createSignedUrl` actually accepts a
  10-year `expiresIn` without erroring or silently capping it** - this
  was the very next thing to check before writing any code. Verify this
  FIRST (a throwaway test call, or check Supabase's current docs/source
  for any documented ceiling) before committing to this design. If there
  IS a hard cap (some backends cap around 7 days due to underlying S3
  v4 signature limits), you need a different approach - possibly a
  scheduled edge function that periodically re-signs and updates
  `portrait_bank` rows for `is_private=true`, OR fall back to the fuller
  render-time-resolution redesign after all, scoped just to the 4
  existing + future private rows (much smaller than the option-(a)
  version of that same redesign would have been).
- I was about to run `count-private-portraits.sql` (already did - 4 rows,
  1 user) as the last investigation step before starting to write the
  actual migration SQL when context ran out.

### Concrete next steps, in order

1. **Verify the `createSignedUrl` long-expiry assumption** (see above) -
   don't build on an unverified premise, that's exactly the mistake that
   already happened once on this same task (option (a) was scoped wrong
   the first time; don't let the option (b) implementation repeat it).
2. Create a new storage bucket, e.g. `portrait-bank-private`,
   `public: false`. Live SQL / Supabase CLI, same process as every other
   live-DB change this session (`npx supabase db query --linked -f
   <file>.sql`, confirm intent isn't needed further since Xero already
   decided this - build it - but verify in `pg_proc`/bucket listing after
   applying, same rigor as every fix tonight).
3. RLS on the new bucket: INSERT/SELECT scoped to
   `(storage.foldername(name))[1] = auth.uid()::text` (own-uid path),
   mirroring the existing `authenticated_upload_private_portraits` /
   `authenticated_read_own_private_portraits` pattern from
   `sql/token-library-phase2-schema-2026-06-12.sql` - just pointed at the
   new bucket id instead of `portrait-bank`.
4. Update `lib/data/portrait-bank.ts`'s `uploadPrivatePortrait()` to
   upload into the new bucket instead of `portrait-bank`'s `private/`
   prefix (path convention within the new bucket can just be
   `<uid>/256/<id>.jpg` etc., dropping the now-redundant `private/`
   prefix since the bucket itself provides the separation), and call
   `createSignedUrl(path, <verified-safe-expiry>)` instead of
   `getPublicUrl()`.
5. **`app/tools/token-creator/page.tsx` has its OWN inline duplicate
   upload logic** for private portraits (does NOT go through
   `lib/data/portrait-bank.ts` - grepped this session, found 2+ separate
   inline upload blocks around line 319-337 and 488-501, plus a "recrop"
   flow at ~378-380 that assumes "URL stays identical" - that assumption
   breaks if you ever DO need to re-sign, worth a comment at minimum).
   These need the same bucket/signed-URL treatment - don't fix only the
   `lib/data/portrait-bank.ts` half and miss this file.
6. **Migrate the 4 existing `is_private=true` rows**: for each, move the
   actual storage objects from `portrait-bank/private/<uid>/...` to
   `portrait-bank-private/<uid>/...` (Supabase storage `move` or
   download+reupload+delete-original), then update the row's
   `url_256`/`url_56`/`url_32` to a freshly-generated signed URL from the
   new location. Only 4 rows, 1 user - small, verifiable by hand.
7. **Delete the old `private/` objects from the `portrait-bank` bucket**
   once migrated - leaving stale copies in the still-public bucket
   defeats the entire point of the fix. Verify they're actually gone,
   not just that the DB rows were updated.
8. Clean up the now-obsolete `authenticated_upload_private_portraits` /
   `authenticated_read_own_private_portraits` policies on the OLD
   `portrait-bank` bucket (the `private/` path convention there is being
   retired) - but re-check the write-side fix from
   `sql/fix-portrait-bank-private-upload-2026-08-01.sql` isn't relying on
   `private/` paths being excludable in a way that breaks if you remove
   those policies out of order. Read that file before touching this.
9. **Browser-verify before calling it done** - this touches real
   already-uploaded user images. At minimum: confirm the 1 affected
   user's 4 portraits still display correctly after migration, confirm a
   NEW private upload works end-to-end, confirm the old public URLs for
   those 4 rows now 404/403 (proving the security fix actually took).
10. Update `tasks/COMMS.md` (move the portrait-bank item's resolution
    note), `tasks/todo.md`, and the standard test-per-fix gates
    (tsc/arch/font/role/em-dash/`npm test`) before committing. Full
    `pg_proc`/bucket-listing verification after applying any live SQL,
    matching every other fix this session.

## Standing gotchas learned THIS session (don't relearn them)

- **`check-arch.mjs --save` only ever LOWERS a LOC ceiling** (Math.min
  against the previous baseline) - a genuine feature-driven growth needs
  `--save --force`, or the gate keeps failing on later unrelated commits.
  Verify with a plain (no-flag) run afterward, don't trust the save
  command's own success message.
- **`sql/_baseline/schema.sql` is a STATIC SNAPSHOT that does NOT
  auto-update** when you apply live SQL - it went stale relative to live
  DB after ~20 fixes this session and was never re-exported. When in
  doubt about current live schema/RLS state, query the live DB directly
  (`information_schema`, `pg_policy`, `pg_trigger`) rather than trusting
  `schema.sql`. Worth a dedicated re-export pass at some point
  (`npx tsx scripts/export-canon.ts` is for rules canon, NOT this - check
  if there's an equivalent schema-dump script, or hand-verify the
  mirroring convention other commit messages reference).
- **Xero does not relay between sessions, ever, unless explicitly told
  to** - confirmed twice this session. Always
  `mcp__ccd_session_mgmt__send_message` directly.
- **Verify a claim from ANY session (including Comms) by reading the
  actual file/DB state before trusting it** - Comms said something was
  committed/pushed twice this session when it wasn't yet (a timing race,
  not malice, but still needs checking every time).
- **This worktree needed `npm install` after being created/after a big
  pull** - a "Cannot find module" on a package clearly in `package.json`
  is a stale-`node_modules` symptom, not a real regression.
- Git Bash mangles Windows backslash paths in `git worktree add` -
  landed a worktree in a garbage nested path once this session
  (`D:/Coding/VTTs/TheTapestry/CodingVTTsTheTapestry-comms` instead of
  `D:/Coding/VTTs/TheTapestry-comms`). Always use forward-slash paths for
  git commands in this shell, verify with `git worktree list` after.

## Everything else from before this session

All prior wave-1/wave-2 audit fixes (21 + 17 = 38 fixes) are shipped,
live, verified, and closed out - see `tasks/todo.md`'s dated "Shipped"
sections and `tasks/handoff-puffer-2026-08-01.md` for that history if
needed. Nothing outstanding from before this session except the two
items covered above (both now decided, one shipped, one in-flight).
