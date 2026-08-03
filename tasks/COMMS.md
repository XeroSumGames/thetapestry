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

- **[2026-08-02] Manual verify needed: private-portrait upload flow (Puffer Fish).** Portrait-bank confidentiality fix shipped and verified live at the storage layer (see ANSWERED below), but the actual in-app upload flow has never been click-tested by a logged-in Thriver - no test credentials available to Puffer or HP this session. Ask Xero: log in as a Thriver, go to Create Tokens tool (`/tools/token-creator`), upload a portrait with "Private" checked (single-image or bulk mode, gender left unset), confirm it uploads successfully and shows up correctly in the portrait picker (e.g. character creation). ~2 minutes, not urgent/blocking.

---

## ANSWERED

*(dated log, newest first - move an item here the moment it's resolved,
don't let this file's OPEN section accumulate stale asks)*

- **[2026-08-02] portrait-bank read-side confidentiality - Xero decided option (a):** flip the bucket private, rework every `getPublicUrl()` consumer to signed URLs. Routed to Puffer Fish to schedule/implement. **CORRECTION (2026-08-02, Puffer Fish, before implementing) - re-opened pending Xero's re-confirmation:** scoping found `portrait_bank.url_256` etc. get copied PERMANENTLY into other tables the moment a portrait is picked (confirmed: `characters.data.photoDataUrl` via `StepXero.tsx`; almost certainly `campaign_npcs.portrait_url`/`scene_tokens.portrait_url` via the same shared picker used in `NpcRoster.tsx`/`CampaignPins.tsx`/`token-creator`). Signed URLs expire - a signed URL resolved at pick-time and baked into a character/NPC row goes silently, permanently broken the moment it expires, for every past AND future portrait pick. The real fix is bigger than "rework getPublicUrl() consumers" - it's "store the storage path everywhere a portrait reference is saved, resolve a fresh signed URL at render time, migrate every already-created row with a baked-in public URL." Also changes the (a) vs (b) tradeoff: under (b) (separate private bucket for just `private/<uid>/` uploads) the shared/public bank keeps working on permanent `getPublicUrl()` forever - zero expiry risk for the majority case; under (a) BOTH public and private portraits need the redesign. **RESOLVED (2026-08-03) - Xero switched to option (b):** separate private bucket for `private/<uid>/...` uploads only; public bank portraits keep plain `getPublicUrl()`, no redesign/expiry risk for them. Routed to Puffer Fish to build. **SHIPPED (2026-08-02, Puffer Fish):** `portrait-bank-private` bucket (public:false, own-uid RLS on SELECT/INSERT/DELETE) live; `uploadPrivatePortrait()` now uploads there and stores a 10-year signed URL instead of a public one (verified live Supabase accepts multi-year expiry, no cap) - zero consumer changes needed since every reader (`PortraitBankPicker`, NPC roster, random-pick) just uses whatever URL string is in the DB. The 4 existing private-portrait rows/objects (1 user) migrated: old public URL now 400s (object deleted), new bucket rejects unsigned/public-style access entirely ("Bucket not found" - it's not a public bucket), new signed URL confirmed serving the actual image (200, correct byte count). Old bucket's now-dead own-uid policies dropped. tsc/font/role/em-dash/arch/937 tests green, commit `15a8ab2d`, on `main`. **Not yet click-tested:** the in-app upload flow as a logged-in Thriver (Create Tokens tool's private-portrait path) - the storage-layer mechanism it depends on is verified live above, but nobody has driven the actual UI end-to-end since this shipped. Worth a 2-minute manual pass next time a Thriver's in the tool.
- **[2026-08-02] Account-deletion anonymize mismatch - Xero decided: build it for real.** Nullable `author_user_id` + "Anonymous" UI fallback across `forum_threads`/`war_stories`/`lfg_posts`/`whispers`, matching the existing `modules` pattern. Routed to Puffer Fish (schema) to coordinate with Hunt & Peck (UI half). **Schema half SHIPPED (2026-08-02, Puffer Fish, `cecc19c7`)** - live SQL applied + verified, `database.types.ts` regenerated. UI half handed to Hunt & Peck via direct session message with the concrete file list - not a from-scratch build, the display sites already fall back to `'Unknown'` on a missing author, just needs verification + Xero's call on 'Unknown' vs 'Anonymous' wording. **RESOLVED (2026-08-02) - fully complete end-to-end.** UI half shipped (`a750f516`), which also caught a real secondary bug (null in a PostgREST `.in()` array 400s the whole query, not a graceful degrade - fixed everywhere). That surfaced a second gap: the 3 reply tables (`forum_replies`/`lfg_post_replies`/`war_story_replies`) carry their OWN separate `author_user_id` FK, independent of the parent thread, and were still hard-cascading a replier's own account deletion out of someone else's thread. Same schema fix applied (Puffer Fish, `944b9e2b`), same UI fallback applied to `InlineRepliesPanel.tsx` (Hunt & Peck, `4404dcbd`). Nothing left owed on this item.
