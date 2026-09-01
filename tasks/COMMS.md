# COMMS.md - open questions, test plans, decisions in flight

Single source of truth for "what's open, what's answered" across all four
sessions. Route decisions through this file instead of asking Xero (or
each other) in scattered chat messages the others never see.

**Owned by the dedicated Comms channel** (`tasks/lane-protocol.md`,
"Comms channel" section, added 2026-08-02) - Comms is responsible for
keeping this current, verifying an OPEN item is actually
reachable/testable before packaging it as a test plan, and resolving
items into ANSWERED. Any session can still add an OPEN item directly -
don't wait for Comms to notice something needs asking - Comms picks it
up from there.

**This is not a duplicate of `tasks/active-lanes.md`** (that's "who's
touching what file right now") or `tasks/decisions.md` (that's the
append-only architectural-decision log, permanent record). This file is
for things actively waiting on an answer - a question for Xero, a test
plan that needs running before a fix can be called done, a cross-lane
call that needs the hub's ruling. Once resolved, the item moves to
ANSWERED here; if it was ALSO an architectural decision worth permanently
remembering, it gets its own entry in `decisions.md` too.

---

## OPEN

- **[2026-09-01] Three post-playtest notes from Xero that Puffer cannot interpret - need his words.**
  1. *"how to call out NPCs in the NPC bar?"* - unclear whether "call out" means summon into the scene, highlight/point at one for players, or something else.
  2. *"first impressions note working?"* - needs a repro. Which part failed: the roll itself, the CMod landing, the +/- chip on the card, or the GM being unable to see them? (The last is already a known gap, queued as item 4 in the 2026-08-18 batch.)
  3. *"a built in dice roller"* - Tapestry already has one; the roll log fired normally throughout the playtest traces. So this is either a discoverability problem (a player could not find it) or he means something specific, e.g. free-form "roll 2d6" rather than clicking a skill.

- **[2026-09-01] Two notes that are probably NOT software - confirm with Xero before anyone scopes them.**
  - *"battery free flashlight"* - reads as an equipment/setting item, i.e. rules content rather than a VTT feature.
  - *"solar panels - EZ bikes"* (carried over from 2026-08-18, still uninterpreted) - same class.
  If they are content, they belong in the rulebook/canon work, not a lane.

- **[2026-08-18] Xero's playtest notes, items 2-5 - ASK HIM ONE AT A TIME.**
  Raised by Puffer Fish. Xero's instruction, verbatim: *"ask me about these,
  1 at a time, so you can route them where they should go."* He then said
  *"have Comms ask me the questions."* Item 1 is already answered, do NOT
  re-ask it. What is needed back per item: build now / todo / needs a design
  decision from him / not Tapestry at all. Record the outcome here and in
  `todo.md`, and route to the owning lane.

  **2. pins & NPCs & Assets & GM Notes** (raw)
  - drag and drop npcs > players to put them in their own folders and/or
    sort them by role (Deputies, administrators, etc) and/or
    friendly's/hostiles, etc
  - what do you see when you open an NPC card?
  - make a mind map of the NPCs and where they met, their relationships, etc?
  - campaign sheet - add 'words' to character
  - logbook where you type - if you typed an @ it would link to an NPC. you
    could write your own impressions of that character.

  *Puffer note:* this is five unrelated asks under one heading. The
  foldering, the mind map and the @-mention logbook are three separate
  features of very different size. Split them before he prioritises or he
  will be answering about all three at once.

  **3. redesign the 'Character Tab' across the bottom** (raw)
  - buttons on THE character at the bottom
  - 1. hand raise, like on teams
  - 2. a button to INTERJECT

  *Puffer note:* worth asking whether hand-raise and interject are genuinely
  two mechanics or one. A raised hand the GM then grants is a different
  thing from a player interrupting directly, and it changes who holds
  control of the table.

  **4. GM should be able to see all 1st impressions via NPC cards** (raw)

  *Puffer note:* small, and Puffer can just build it. First Impression CMods
  already live per-PC per-NPC in `npc_relationships` and the player card
  renders them; the GM's NPC card does not aggregate them. One question for
  Xero: every PC's CMod listed on the NPC card, or only the non-zero ones?

  **5. Solar panels - EZ bikes** (raw)

  *Puffer note:* uninterpretable as written. May be setting/equipment content
  rather than software. Ask him plainly what it means before anyone
  estimates it.

- **[2026-08-18] Tour item 1 - two pieces deferred, schedule with Xero LATER (not now).**
  He chose to ship the two small fixes immediately (persistent tour, World
  Events step emphasis - both live in `78cbcffe`). These two remain:
  - **Fixed modal / moving arrow.** His note: *"keep the text all in the same
    place, have the arrows move?"* When raising it, flag the cost: every step
    currently carries its own hand-calibrated `pos`, tuned over a long stretch
    on 2026-08-18. Pinning the modal discards all of that. Confirm he accepts
    that before it starts.
  - **The tour opened over My Stories, not the dashboard, for Jon.** Puffer
    reads this as a BUG, not a preference - the tour is meant to fire on
    `/dashboard`. Needs reproducing. Ask Xero whether Jon can reproduce it and
    what Jon did immediately before it appeared.

---

## ANSWERED

- **[2026-09-01] Session notes visible to players - Xero: INTENDED, leave as-is.** All four fields (`gm_summary`, `cliffhanger`, `next_session_notes`, `session_log`) stay readable by every campaign member. His words: "publicly viewable... by players in the game, at least." No code change - current behaviour already matches. Scope boundary recorded: campaign members only, NOT world-readable. Written up in `decisions.md` 2026-09-01 with a do-not-fix note, because the `sessions` policy read cold looks exactly like the confidentiality bugs we fixed earlier this year and a future audit would otherwise flag it.

*(dated log, newest first - move an item here the moment it's resolved,
don't let this file's OPEN section accumulate stale asks)*

- **[2026-08-04] NPC card - map-pin click vs roster click - Xero picked a THIRD option, not (a) or (b) as posed.** ONE card component, opened from TWO trigger points (map pin AND roster list click) - not two separate implementations kept in sync. That one card is the `/npc-sheet` popout - i.e. standardize the ROSTER click to also open it, not the other way around. Its content needs to reach parity with everything currently shown in the roster's inline row (interactive First Impression roll, Recruit button, etc.), not just the read-only badges + My Notes it shows today (Xero attached a screenshot of the current popout as the layout reference to build on). Routed to Hunt & Peck.
- **[2026-08-04] Onboarding video (step 7 of the first-timer tour) - Xero: needs to be made, no existing video to reuse.** Details/scope to follow from Xero. Routed to Puffer Fish; keep the placeholder slot in HP's build until the video itself is ready.
- **[2026-08-04] Observability sweep "Batch 1" - Xero: yes, green-lit.** Routed to Hunt & Peck to ship.
- **[2026-08-03] Manual verify: private-portrait upload flow - packaged and delivered.** Puffer Fish's OPEN ask (click-test the in-app upload flow as a logged-in Thriver) was packaged as the "Portrait Bank 2026-08-03" tab in the smoke testing workbook and delivered to Xero. Not yet run; the workbook tab is now the tracking record for this, not this file.
- **[2026-08-02] portrait-bank read-side confidentiality - Xero decided option (a):** flip the bucket private, rework every `getPublicUrl()` consumer to signed URLs. Routed to Puffer Fish to schedule/implement. **CORRECTION (2026-08-02, Puffer Fish, before implementing) - re-opened pending Xero's re-confirmation:** scoping found `portrait_bank.url_256` etc. get copied PERMANENTLY into other tables the moment a portrait is picked (confirmed: `characters.data.photoDataUrl` via `StepXero.tsx`; almost certainly `campaign_npcs.portrait_url`/`scene_tokens.portrait_url` via the same shared picker used in `NpcRoster.tsx`/`CampaignPins.tsx`/`token-creator`). Signed URLs expire - a signed URL resolved at pick-time and baked into a character/NPC row goes silently, permanently broken the moment it expires, for every past AND future portrait pick. The real fix is bigger than "rework getPublicUrl() consumers" - it's "store the storage path everywhere a portrait reference is saved, resolve a fresh signed URL at render time, migrate every already-created row with a baked-in public URL." Also changes the (a) vs (b) tradeoff: under (b) (separate private bucket for just `private/<uid>/` uploads) the shared/public bank keeps working on permanent `getPublicUrl()` forever - zero expiry risk for the majority case; under (a) BOTH public and private portraits need the redesign. **RESOLVED (2026-08-03) - Xero switched to option (b):** separate private bucket for `private/<uid>/...` uploads only; public bank portraits keep plain `getPublicUrl()`, no redesign/expiry risk for them. Routed to Puffer Fish to build. **SHIPPED (2026-08-02, Puffer Fish):** `portrait-bank-private` bucket (public:false, own-uid RLS on SELECT/INSERT/DELETE) live; `uploadPrivatePortrait()` now uploads there and stores a 10-year signed URL instead of a public one (verified live Supabase accepts multi-year expiry, no cap) - zero consumer changes needed since every reader (`PortraitBankPicker`, NPC roster, random-pick) just uses whatever URL string is in the DB. The 4 existing private-portrait rows/objects (1 user) migrated: old public URL now 400s (object deleted), new bucket rejects unsigned/public-style access entirely ("Bucket not found" - it's not a public bucket), new signed URL confirmed serving the actual image (200, correct byte count). Old bucket's now-dead own-uid policies dropped. tsc/font/role/em-dash/arch/937 tests green, commit `15a8ab2d`, on `main`. **Not yet click-tested:** the in-app upload flow as a logged-in Thriver (Create Tokens tool's private-portrait path) - the storage-layer mechanism it depends on is verified live above, but nobody has driven the actual UI end-to-end since this shipped. Worth a 2-minute manual pass next time a Thriver's in the tool.
- **[2026-08-02] Account-deletion anonymize mismatch - Xero decided: build it for real.** Nullable `author_user_id` + "Anonymous" UI fallback across `forum_threads`/`war_stories`/`lfg_posts`/`whispers`, matching the existing `modules` pattern. Routed to Puffer Fish (schema) to coordinate with Hunt & Peck (UI half). **Schema half SHIPPED (2026-08-02, Puffer Fish, `cecc19c7`)** - live SQL applied + verified, `database.types.ts` regenerated. UI half handed to Hunt & Peck via direct session message with the concrete file list - not a from-scratch build, the display sites already fall back to `'Unknown'` on a missing author, just needs verification + Xero's call on 'Unknown' vs 'Anonymous' wording. **RESOLVED (2026-08-02) - fully complete end-to-end.** UI half shipped (`a750f516`), which also caught a real secondary bug (null in a PostgREST `.in()` array 400s the whole query, not a graceful degrade - fixed everywhere). That surfaced a second gap: the 3 reply tables (`forum_replies`/`lfg_post_replies`/`war_story_replies`) carry their OWN separate `author_user_id` FK, independent of the parent thread, and were still hard-cascading a replier's own account deletion out of someone else's thread. Same schema fix applied (Puffer Fish, `944b9e2b`), same UI fallback applied to `InlineRepliesPanel.tsx` (Hunt & Peck, `4404dcbd`). Nothing left owed on this item.
