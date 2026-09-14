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

**Question numbering (2026-09-14, Xero's ask):** every question actually put
to Xero from here on gets a global sequential tag (`Q1`, `Q2`, ...), NOT
renumbered retroactively for anything asked before this date. Next number to
assign: **Q12**.

---

## OPEN

- **[2026-09-14, Q10] Campaign Sheet "Relax" button - what Tactic mechanic should it use?** Currently a placeholder alert. Audit's proposed shape: spend a Tactic to clear a Stress pip - but there's no existing mechanic to reuse (unlike Rest and Eat, which just wire up code that already ships elsewhere). Needs Xero's ruling: which Tactic(s) qualify, and how often can this be used?

- **[2026-08-18] Xero's playtest notes, items 2-5 - ASK HIM ONE AT A TIME.**
  Raised by Puffer Fish. Xero's instruction, verbatim: *"ask me about these,
  1 at a time, so you can route them where they should go."* He then said
  *"have Comms ask me the questions."* Item 1 is already answered, do NOT
  re-ask it. What is needed back per item: build now / todo / needs a design
  decision from him / not Tapestry at all. Record the outcome here and in
  `todo.md`, and route to the owning lane.

  **2. pins & NPCs & Assets & GM Notes** (raw)
  - make a mind map of the NPCs and where they met, their relationships, etc?
  - logbook where you type - if you typed an @ it would link to an NPC. you
    could write your own impressions of that character.

  *Puffer note:* this is five unrelated asks under one heading. The
  foldering, the mind map and the @-mention logbook are three separate
  features of very different size. Split them before he prioritises or he
  will be answering about all three at once.

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

- **[2026-09-14, Q11] Mikey Shevik - Xero: (1) he left the game.** He noticed Mikey is still listed on the Story page's own Party list (screenshot: Party (6), REMOVE button per member) - "that's likely on me," self-serving the removal via the existing REMOVE button and testing whether it correctly drops him from Party Status too. No build needed for this instance; HP should stand by in case his test finds the REMOVE action doesn't actually clear campaign_members (would then be a real bug, not user error).
- **[2026-09-14, Q9] Drag-and-drop NPC folders/sorting - fully resolved.** (a) Friendly/hostile does NOT become an automatic grouping - "another folder", i.e. Xero names it himself like any other folder. (b) Player characters do NOT get folder/sort treatment - NPCs only. Full scope: players get drag-and-drop to move NPCs between existing (GM- or player-named) folders and reorder within them; no auto-grouping, no PC folders. Routed to the hub.
- **[2026-09-14, Q8] Item 3 (Character Tab redesign) - hand-raise and interject are ONE mechanic, not two - Xero: "one thing".** Build it as a single control: a hand-raise button (like Teams) that IS the interject mechanism, GM-mediated - not two separate buttons/systems. Routed to the hub.
- **[2026-09-14, Q7] Campaign Sheet punch list - Xero: audit it and bring suggestions, he has ideas but wants to see ours first.** Framing, important: **"right now this sheet provides no real value to the players. I want to change that or remove it."** This is a value-proposition question, not just a bug/feature list - the audit needs to answer "does this page earn its place" before proposing polish. Routed to the hub. **Audit result (hub, `f9db4432`):** VERDICT = keep the page. The "no value" read traces to one thing - 3 of 4 action buttons (Eat, Rest, Relax) are placeholders that just pop a "Phase 3 will do this" alert; the rest of the page (clock, live status, streaming heals, timeline, export log) is real and working. Rest and Eat are normal builds with no ruling needed, routed to HP. Relax needs a Tactic-mechanic ruling - see Q10.
- **[2026-09-14, Q6] "Campaign sheet - add 'words' to character" - Xero expanded this into two concrete, immediately-routable pieces.**
  1. **BUG - Party Status accuracy:** the Campaign Sheet's Party Status list shows characters who shouldn't be there (named: Mikey Shevik, Cruz Zwick, District Zero campaign). Needs reproducing - check whether they left the party, died, or the list just isn't filtering correctly. Routed to Hunt & Peck.
  2. **FEATURE - NPC cards on the sheet:** the Campaign Sheet should show a small NPC card for every NPC the party has met. Routed to the hub for sizing/design (relates to the item-2 NPC-card work already in flight).
  The open-ended "better tools" part of his answer is tracked separately as Q7 below - not resolved yet.
- **[2026-09-14, Q5] "Battery-free flashlight" - Xero: setting item, not software.** Belongs in the rulebook/canon work, not a lane. No routing needed.
- **[2026-09-14, Q4] "A built-in dice roller" - Xero: wants a visible DICE button that opens a visual roller.** Not a discoverability gap with the existing `/r 1d6+3` chat-command syntax - a separate UI: a button somewhere on screen opens a visual dice roller covering everything commonly used, 1d3 through 1d20. Additive alongside the existing `/r` command, not a replacement. Routed to the hub.
- **[2026-09-14, Q2] "First impressions note working?" + item 4 (GM NPC-card visibility) - resolved as ONE item, Xero: "I should be able to see all of their FIRST IMPRESSIONS with different player characters" when opening an NPC card.** Screenshot attached of the current `/npc-sheet` popout (George Meeker), which has no First Impression display at all. Answers both: (a) the "not working" report was the known GM-visibility gap, not a roll/CMod/chip bug; (b) item 4's outstanding sub-question - "all" means every PC's CMod listed, not filtered to non-zero. Small build, routed to the hub.
- **[2026-09-14, Q3] Fog-of-war scene desync - Xero: "go".** Keep the private-prep scene stickiness; HP builds the non-GM-viewer banner ("GM is on a different scene") + DB-hydrate on load/refresh so a new joiner lands on the currently-shared scene. Routed to Hunt & Peck.
- **[2026-09-14, Q1] "How to call out NPCs in the NPC bar?" - Xero: highlight/point one out so players notice it** (not summon into scene). Routed to the hub.
- **[2026-09-01] Session notes visible to players - Xero: INTENDED, leave as-is.** All four fields (`gm_summary`, `cliffhanger`, `next_session_notes`, `session_log`) stay readable by every campaign member. His words: "publicly viewable... by players in the game, at least." No code change - current behaviour already matches. Scope boundary recorded: campaign members only, NOT world-readable. Written up in `decisions.md` 2026-09-01 with a do-not-fix note, because the `sessions` policy read cold looks exactly like the confidentiality bugs we fixed earlier this year and a future audit would otherwise flag it.

*(dated log, newest first - move an item here the moment it's resolved,
don't let this file's OPEN section accumulate stale asks)*

- **[2026-08-04] NPC card - map-pin click vs roster click - Xero picked a THIRD option, not (a) or (b) as posed.** ONE card component, opened from TWO trigger points (map pin AND roster list click) - not two separate implementations kept in sync. That one card is the `/npc-sheet` popout - i.e. standardize the ROSTER click to also open it, not the other way around. Its content needs to reach parity with everything currently shown in the roster's inline row (interactive First Impression roll, Recruit button, etc.), not just the read-only badges + My Notes it shows today (Xero attached a screenshot of the current popout as the layout reference to build on). Routed to Hunt & Peck.
- **[2026-08-04] Onboarding video (step 7 of the first-timer tour) - Xero: needs to be made, no existing video to reuse.** Details/scope to follow from Xero. Routed to Puffer Fish; keep the placeholder slot in HP's build until the video itself is ready.
- **[2026-08-04] Observability sweep "Batch 1" - Xero: yes, green-lit.** Routed to Hunt & Peck to ship.
- **[2026-08-03] Manual verify: private-portrait upload flow - packaged and delivered.** Puffer Fish's OPEN ask (click-test the in-app upload flow as a logged-in Thriver) was packaged as the "Portrait Bank 2026-08-03" tab in the smoke testing workbook and delivered to Xero. Not yet run; the workbook tab is now the tracking record for this, not this file.
- **[2026-08-02] portrait-bank read-side confidentiality - Xero decided option (a):** flip the bucket private, rework every `getPublicUrl()` consumer to signed URLs. Routed to Puffer Fish to schedule/implement. **CORRECTION (2026-08-02, Puffer Fish, before implementing) - re-opened pending Xero's re-confirmation:** scoping found `portrait_bank.url_256` etc. get copied PERMANENTLY into other tables the moment a portrait is picked (confirmed: `characters.data.photoDataUrl` via `StepXero.tsx`; almost certainly `campaign_npcs.portrait_url`/`scene_tokens.portrait_url` via the same shared picker used in `NpcRoster.tsx`/`CampaignPins.tsx`/`token-creator`). Signed URLs expire - a signed URL resolved at pick-time and baked into a character/NPC row goes silently, permanently broken the moment it expires, for every past AND future portrait pick. The real fix is bigger than "rework getPublicUrl() consumers" - it's "store the storage path everywhere a portrait reference is saved, resolve a fresh signed URL at render time, migrate every already-created row with a baked-in public URL." Also changes the (a) vs (b) tradeoff: under (b) (separate private bucket for just `private/<uid>/` uploads) the shared/public bank keeps working on permanent `getPublicUrl()` forever - zero expiry risk for the majority case; under (a) BOTH public and private portraits need the redesign. **RESOLVED (2026-08-03) - Xero switched to option (b):** separate private bucket for `private/<uid>/...` uploads only; public bank portraits keep plain `getPublicUrl()`, no redesign/expiry risk for them. Routed to Puffer Fish to build. **SHIPPED (2026-08-02, Puffer Fish):** `portrait-bank-private` bucket (public:false, own-uid RLS on SELECT/INSERT/DELETE) live; `uploadPrivatePortrait()` now uploads there and stores a 10-year signed URL instead of a public one (verified live Supabase accepts multi-year expiry, no cap) - zero consumer changes needed since every reader (`PortraitBankPicker`, NPC roster, random-pick) just uses whatever URL string is in the DB. The 4 existing private-portrait rows/objects (1 user) migrated: old public URL now 400s (object deleted), new bucket rejects unsigned/public-style access entirely ("Bucket not found" - it's not a public bucket), new signed URL confirmed serving the actual image (200, correct byte count). Old bucket's now-dead own-uid policies dropped. tsc/font/role/em-dash/arch/937 tests green, commit `15a8ab2d`, on `main`. **Not yet click-tested:** the in-app upload flow as a logged-in Thriver (Create Tokens tool's private-portrait path) - the storage-layer mechanism it depends on is verified live above, but nobody has driven the actual UI end-to-end since this shipped. Worth a 2-minute manual pass next time a Thriver's in the tool.
- **[2026-08-02] Account-deletion anonymize mismatch - Xero decided: build it for real.** Nullable `author_user_id` + "Anonymous" UI fallback across `forum_threads`/`war_stories`/`lfg_posts`/`whispers`, matching the existing `modules` pattern. Routed to Puffer Fish (schema) to coordinate with Hunt & Peck (UI half). **Schema half SHIPPED (2026-08-02, Puffer Fish, `cecc19c7`)** - live SQL applied + verified, `database.types.ts` regenerated. UI half handed to Hunt & Peck via direct session message with the concrete file list - not a from-scratch build, the display sites already fall back to `'Unknown'` on a missing author, just needs verification + Xero's call on 'Unknown' vs 'Anonymous' wording. **RESOLVED (2026-08-02) - fully complete end-to-end.** UI half shipped (`a750f516`), which also caught a real secondary bug (null in a PostgREST `.in()` array 400s the whole query, not a graceful degrade - fixed everywhere). That surfaced a second gap: the 3 reply tables (`forum_replies`/`lfg_post_replies`/`war_story_replies`) carry their OWN separate `author_user_id` FK, independent of the parent thread, and were still hard-cascading a replier's own account deletion out of someone else's thread. Same schema fix applied (Puffer Fish, `944b9e2b`), same UI fallback applied to `InlineRepliesPanel.tsx` (Hunt & Peck, `4404dcbd`). Nothing left owed on this item.
