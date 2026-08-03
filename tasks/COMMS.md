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

- **[2026-08-03, Puffer Fish] portrait-bank fix needs re-scoping - option (a) is bigger than framed.** Portrait URLs get baked permanently into `characters.data.photoDataUrl` / `campaign_npcs.portrait_url` / `scene_tokens.portrait_url` at pick-time (confirmed in `StepXero.tsx`, `NpcRoster.tsx`, `CampaignPins.tsx`, `token-creator`). Signed URLs expire (minutes-hours) - if baked in at pick-time, portraits go silently dead weeks later, including for characters/NPCs created BEFORE this ships. Real fix (either option): store the storage PATH, resolve a fresh signed URL at render-time everywhere a portrait displays, plus migrate every already-created row's baked-in URL. Under (a) (bucket-wide private), BOTH public and private portraits need this. Under (b) (separate bucket for private only), only private portraits need it - public bank stays plain `getPublicUrl()` forever, zero expiry risk. **Needs: confirm (a) knowing it's now a full portrait-reference redesign + migration, or reconsider given the corrected scope.** Puffer Fish is NOT implementing until re-confirmed.


---

## ANSWERED

*(dated log, newest first - move an item here the moment it's resolved,
don't let this file's OPEN section accumulate stale asks)*

- **[2026-08-02] portrait-bank read-side confidentiality - Xero decided option (a):** flip the bucket private, rework every `getPublicUrl()` consumer to signed URLs. Routed to Puffer Fish to schedule/implement. **CORRECTION (2026-08-02, Puffer Fish, before implementing) - re-opened pending Xero's re-confirmation:** scoping found `portrait_bank.url_256` etc. get copied PERMANENTLY into other tables the moment a portrait is picked (confirmed: `characters.data.photoDataUrl` via `StepXero.tsx`; almost certainly `campaign_npcs.portrait_url`/`scene_tokens.portrait_url` via the same shared picker used in `NpcRoster.tsx`/`CampaignPins.tsx`/`token-creator`). Signed URLs expire - a signed URL resolved at pick-time and baked into a character/NPC row goes silently, permanently broken the moment it expires, for every past AND future portrait pick. The real fix is bigger than "rework getPublicUrl() consumers" - it's "store the storage path everywhere a portrait reference is saved, resolve a fresh signed URL at render time, migrate every already-created row with a baked-in public URL." Also changes the (a) vs (b) tradeoff: under (b) (separate private bucket for just `private/<uid>/` uploads) the shared/public bank keeps working on permanent `getPublicUrl()` forever - zero expiry risk for the majority case; under (a) BOTH public and private portraits need the redesign. Not implementing until Xero re-confirms knowing the corrected scope.
- **[2026-08-02] Account-deletion anonymize mismatch - Xero decided: build it for real.** Nullable `author_user_id` + "Anonymous" UI fallback across `forum_threads`/`war_stories`/`lfg_posts`/`whispers`, matching the existing `modules` pattern. Routed to Puffer Fish (schema) to coordinate with Hunt & Peck (UI half). **Schema half SHIPPED (2026-08-02, Puffer Fish, `cecc19c7`)** - live SQL applied + verified, `database.types.ts` regenerated. UI half handed to Hunt & Peck via direct session message with the concrete file list - not a from-scratch build, the display sites already fall back to `'Unknown'` on a missing author, just needs verification + Xero's call on 'Unknown' vs 'Anonymous' wording.
