# Spec: "Save as Pregen" button + user-generated pregen library

**Status:** APPROVED - decisions locked 2026-06-18. SQL written (`sql/pregen-library-2026-06-18.sql`), pending live-apply go. UI is build-ready for Hunt & Peck.
**Origin:** Xero - instead of hand-transcribing old pregen PDFs into canon, let Thrivers/GMs publish any character they build as a pregen. Turns pregen creation into a self-serve flow.
**Lanes:** Puffer Fish owns the DB table + RLS + moderation wiring (SQL). Hunt & Peck owns the UI (button, /pregen page, My Survivor surfacing). E2E adds coverage after.

---

## The button
- New **PREGEN** button in the character builder action bar, **between PRINT CHARACTER and SAVE CHARACTER** (`app/characters/new/page.tsx` ~line 238; mirror in `app/characters/quick/page.tsx`).
- Styling: same height/family as the existing buttons; green outline (matches "Print") so Save stays the lone red primary.
- **Who sees it:**
  - **Thriver** -> visible. Clicking publishes the pregen straight to the **global library, auto-approved** (consistent with the Thriver auto-approve rule for LFG/forum/war-stories).
  - **GM (Survivor role who owns >=1 campaign)** -> visible. Clicking submits to the **moderation queue (pending)** AND immediately lists it on their own **My Characters / My Survivor** view (visible to them while pending).
  - **Everyone else (plain Survivor player, Ghost)** -> button hidden. They just Save normally.

## Data model (new table - Puffer/SQL)
`pregen_library` - separate from `characters` (pregens are reusable templates, not owned playable characters; mirrors the `world_npcs` moderation shape):

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| author_id | uuid -> profiles | who published it |
| name | text | character name |
| data | jsonb | the full XSECharacter blob (same shape `characters.data` uses) |
| portrait_url | text null | from character photo if set |
| setting | text null | associates to a setting (e.g. `chased`) so it can surface on matching story pages |
| module_id | uuid null | optional tighter association to a specific module/story |
| moderation_status | text | `pending` / `approved` / `rejected` (default depends on author role) |
| approved_by | uuid null | set on approve/reject |
| approved_at | timestamptz null | |
| created_at | timestamptz default now() | |

- **RLS:** author can read their own rows (any status); everyone can read `approved` rows; only Thrivers can update `moderation_status` (approve/reject). Insert allowed for Thrivers + GMs.
- **Realtime:** if /moderate subscribes to new pregen submissions via postgres_changes, add `pregen_library` to `sql/_baseline/publication.sql` + live publication in the same change (per AGENTS.md realtime rule).

## Flow
1. User builds a character through the wizard, reaches step 9.
2. Clicks **PREGEN**.
3. App serializes `buildCharacter(state)` -> inserts a `pregen_library` row:
   - Thriver: `moderation_status = 'approved'`, `approved_by = self`, `approved_at = now()`.
   - GM: `moderation_status = 'pending'`.
   - `setting` defaults from the campaign they came in via (`returnStoryId`'s campaign setting) if present, else null/selectable.
4. Confirmation toast: Thriver = "Added to the pregen library."; GM = "Submitted for approval - it's in your characters now and will go live once approved."

## Moderation queue (extend `app/moderate/page.tsx`)
- Add a **Pregens** section alongside NPCs / Communities / Modules, same pending/approved/rejected filter.
- Approve -> `moderation_status='approved'` + approved_by/at; pregen now appears on global `/pregen`.
- Reject -> `moderation_status='rejected'`; stays only on the author's personal view with a "not approved" tag.
- Notify the author on approve/reject (reuse the module_approved/rejected notification pattern already in moderate/page.tsx).

## Global `/pregen` page (NEW route - H&P)
- Mockup already built: `tasks/pregen-page-mockup-v1.html`.
- Reads `pregen_library WHERE moderation_status='approved'` + the curated hardcoded sets (`CHASED_PREGENS`/`EMPTY_PREGENS`) as "official."
- Filter bar (All / by setting / by archetype) + search. Card per pregen with portrait-or-initials, role, blurb, "Use this character" -> runs the existing `buildCharacterFromPregen`-equivalent insert into `characters` + assigns.

## Story-page "Pre-generated for this story"
- Already mocked in the story redesign. Source = curated hardcoded pregens for that setting + approved `pregen_library` rows where `setting`/`module_id` matches. "Pick a different pre-generated character" -> `/pregen`.

## My Survivor / My Characters surfacing (H&P)
- The GM's own submitted pregens show on `app/characters/page.tsx` (their library) with a status chip (Pending / Approved / Rejected), so a pending pregen is visible to them before it goes global. (Confirm with Xero this is the "MY SURVIVOR page" he means.)

---

## Decisions - LOCKED 2026-06-18
1. **Who gets the button:** Thrivers (auto-approve) + GMs (Survivor who owns >=1 campaign; moderated). Plain Survivor players and Ghosts do NOT see it - keeps the library curated. (Enforced in RLS: non-Thriver insert requires owning a campaign AND can only write `pending`.)
2. **"My Survivor page" = the `/characters` "My Characters" list.** A GM's submitted pregen shows there with a status chip (Pending / Approved / Rejected) while it works through moderation.
3. **Setting tagging:** auto-tag from the campaign's setting when built in a story context (`returnStoryId`'s campaign), dropdown fallback when there's no campaign context.

## DB - DONE (Puffer)
`sql/pregen-library-2026-06-18.sql` - table + indexes + RLS, mirrors the modules moderation shape. Hardening baked into RLS: non-Thrivers can only insert/keep `pending` rows (no self-approve), GM insert gated on owning a campaign, Thriver god-read/update/delete. **Not yet applied live** - awaiting Xero's go (bright-line: schema change). H&P should treat the table/columns as fixed contract.

## Hunt & Peck build checklist
- [ ] PREGEN button between Print/Save in `app/characters/new/page.tsx` + `app/characters/quick/page.tsx`; show only when `is_thriver(role)` OR user owns >=1 campaign.
- [ ] `lib/data/` helper to insert into `pregen_library` (all DB access through `lib/data/**` per arch ratchet) - serialize `buildCharacter(state)`, set status by role, auto-tag setting from `returnStoryId` campaign.
- [ ] Confirmation toast per role.
- [ ] `/characters` status chips for the author's own pregens (Pending/Approved/Rejected).
- [ ] Pregens section in `app/moderate/page.tsx` (approve/reject + author notification, reuse module_approved/rejected pattern). If it subscribes via postgres_changes, add `pregen_library` to `sql/_baseline/publication.sql` + live in the same change.
- [ ] New `/pregen` route (mockup: `tasks/pregen-page-mockup-v1.html`) reading approved rows + curated `CHASED_PREGENS`/`EMPTY_PREGENS`.
- [ ] Story-page "Pre-generated for this story" sources approved rows matching `setting`/`module_id` + curated set.

## Out of scope / parked
- The Intimidation-not-in-canon gap is now independent of this feature. If builder-created pregens should be able to train Intimidation, that canon decision (add to SKILLS, pick attribute) still needs a separate go - it does NOT block this feature. David's existing entry stays as-is.
