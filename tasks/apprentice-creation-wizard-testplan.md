# Testplan — Apprentice Creation Wizard (2026-04-29)

## What shipped

The §2a Apprentice creation flow from `tasks/spec-communities.md` —
the last non-gated Communities item.

**Trigger:** when the master PC clicks "Take as Apprentice" on a
Moment-of-High-Insight recruit, two new things happen alongside the
existing `recruitment_type='apprentice'` flip:

1. **2d6 auto-roll** on the Motivation (Table 7) and Complication
   (Table 6) tables — locked in, the player does NOT get to reroll
   per spec §2a.
2. **`community_members.apprentice_meta`** jsonb gets populated with
   `{ motivation, motivation_roll, complication, complication_roll,
   setup_complete: false }`. Wizard reads this on open.

**Wizard:** new modal `<ApprenticeCreationWizard>` with five steps —
Identity / Paradigm / RAPID / Skills / Confirm. Locked Motivation +
Complication chips persist across every step so the player knows what
they're working around.

- Step 1 — Name (default = NPC's current) + freeform Background.
- Step 2 — `<ParadigmPicker>` card grid of all 12 Paradigms with
  inline expand-to-detail on each card. Reusable component (future
  `/paradigms` sidebar page will use the same component).
- Step 3 — 3 CDP RAPID spend with ▲▼ buttons + budget tracker.
  Cannot reduce below the picked Paradigm's baseline; max +4 per attr.
- Step 4 — 5 CDP skills spend, same shape. Each click = one skill-step
  via `skillStepUp` (vocational -3 → 1 still costs 1 CDP).
- Step 5 — Confirm summary card, Save button.

**Save flow:**
- `campaign_npcs` UPDATE: name, all 5 RAPID columns, `skills` jsonb,
  `notes` (appends a structured Apprentice block, never overwrites GM
  notes).
- `community_members.apprentice_meta` UPDATE: same row + adds
  `paradigm`, `background`, `setup_complete: true`, `setup_at`.
- Master PC `progression_log` gets a Community-type entry:
  `⭐ Apprentice <name> set up — <Paradigm> (<Profession>).`

**Trigger button:** `⭐ Set Up Apprentice` chip on the NPC card,
visible to the master PC (PlayerNpcCard) and GM (NpcCard) when the
Apprentice's `apprentice_meta` exists but `setup_complete !== true`.
Hides automatically post-save.

## Pre-test setup

Required to run this fully:
- `sql/community-members-add-apprentice-meta.sql` applied (✓ confirmed
  on 2026-04-29).
- An active session with a community + at least one PC + at least one
  recruitable NPC.

## Test cases

### Critical path — happy
1. **Recruit triggers Moment of High Insight** — set up a Recruit roll,
   force double-6 (use Insight Die pre-roll if needed). Result modal
   shows the "⭐ Apprentice Eligible" panel.
2. **Click "Take as Apprentice"** — alert/console shouldn't error.
   Verify in Supabase:
   - `community_members.recruitment_type = 'apprentice'`
   - `community_members.apprentice_of_character_id = <master PC id>`
   - `community_members.apprentice_meta` is non-null with
     `motivation`, `motivation_roll`, `complication`,
     `complication_roll`, `setup_complete: false`.
   - **Master PC progression log** has a new top entry:
     `⭐ Took <NPC> as your Apprentice — Motivation: <X>, Complication: <Y>.`
3. **Open the Apprentice's NPC card** (master PC's view → PlayerNpcCard).
   `⭐ Set Up Apprentice` button visible above Search Remains.
4. **Click "Set Up Apprentice"** — wizard modal opens. Step pip strip
   highlights "identity". Locked Motivation + Complication chips
   visible at top (same values rolled in step 2).
5. **Step 1 — Identity** — name field defaults to the NPC's current
   name. Type a new name. Background textarea is optional. Click
   Continue.
6. **Step 2 — Paradigm** — card grid shows all 12 Paradigms. Click
   "Pick" on Rural Sheriff. Card border flips green. Continue is
   enabled.
7. **Step 3 — RAPID** — 5 attribute rows. Each shows the Rural Sheriff
   baseline (`base +2` for Acumen + Influence, etc.). Click ▲ on PHY
   three times. Budget tracker reads `0 CDP remaining` and Continue
   enables. ▼ on PHY confirms it can decrement back to baseline.
   Re-spend the 3 CDP somewhere else. Continue.
8. **Step 4 — Skills** — full skill list inside a scrollable container.
   Skills above the Paradigm baseline highlight green. Click ▲ on
   Medicine\* (vocational, base -3) — first click should bump to 1
   (per `skillStepUp`). Spend all 5 CDP. Continue.
9. **Step 5 — Confirm** — summary card shows: Identity name + Paradigm
   + Background; final RAPID strip; final skills (only non-default).
   Click "✓ Save Apprentice".
10. **Post-save** — modal closes. NPC card's `⭐ Set Up Apprentice`
    button hides. NPC card refreshes to show new RAPID + skills +
    name. Notes section appended with the Apprentice block. Master
    PC's progression log gets a new entry:
    `⭐ Apprentice <name> set up — Rural Sheriff (Law Enforcement).`
11. **Supabase verification:**
    - `campaign_npcs.<id>.name`, `reason`, `acumen`, `physicality`,
      `influence`, `dexterity` reflect the wizard outputs.
    - `campaign_npcs.<id>.skills` jsonb has the new entries with
      level deltas applied (vocational -3 → 1 etc.).
    - `campaign_npcs.<id>.notes` ends with the Apprentice block:
      `── Apprentice ── / Paradigm: Rural Sheriff (Law Enforcement) /
      Motivation: ... / Complication: ... / Background: ...`
    - `community_members.<id>.apprentice_meta.setup_complete = true`.
    - `community_members.<id>.apprentice_meta.paradigm = 'Rural Sheriff'`.

### GM-side
12. **GM opens the same NPC's card** — `⭐ Set Up Apprentice` button
    visible to GM too (oversight). Clicking it opens the same wizard.
    Both can run it; whoever clicks Save first wins.
13. **After setup_complete=true**, GM no longer sees the trigger.
    Wizard cannot be re-opened. (Re-opening / editing post-setup is
    a follow-up; not in scope.)

### Edge cases
14. **Wild Success without High Insight** — should NOT show the Apprentice
    Eligible panel (per SRD §08 p.21 — only Moment of High Insight
    unlocks). Existing behavior, not changed by this commit.
15. **Master PC already has an Apprentice** — Apprentice Eligible
    panel hides (existing 1-per-PC enforcement at the recruit modal).
16. **Cancel mid-wizard** — Cancel button on Step 1 closes without
    persisting; ESC works on every step. apprentice_meta stays
    unchanged (Motivation + Complication still locked in from the
    Take click). Re-clicking "Set Up Apprentice" re-opens with the
    same locked values.
17. **Reset Paradigm** — picking a Paradigm in Step 2, going back to
    Step 1, then re-entering Step 2 and picking a different Paradigm
    resets the RAPID + skill deltas (new baselines invalidate the
    spend).
18. **Long Apprentice name** — Step 1 with a 60+ char name doesn't
    overflow the modal. NPC card's name renders cleanly post-save.
19. **No background** — leaving Background empty saves
    `(No background written.)` into the notes block; verify the
    structured block still reads cleanly.

### Reusable ParadigmPicker
20. **Visual smoke** — open the Paradigm step, hover/click "▾ +N more
    skills" on each card. Expanded list shows every skill with level
    2+ bolded green, level 1 in blue.
21. **Selection state** — picking a Paradigm flips its card to
    `✓ Picked` button; previously-picked Paradigm flips back to `Pick`.

## SQL migration
- `sql/community-members-add-apprentice-meta.sql` — applied 2026-04-29.

## Out of scope (deferred follow-ups)
- §2a 1-month training widget (PC trains Apprentice in PC's skills up
  to PC-level − 1) — needs game-time tracking; revisit when the CDP
  Calculator surface lands.
- Reuse PC's earned CDP on Apprentice (Distemper CRB rule) — same
  blocker as above.
- Re-edit the wizard post-setup — current flow is fire-once; if a
  player wants to revise their Apprentice's Paradigm or stats, GM
  edits the NPC directly via the existing NPC edit form.
- Player-facing Apprentice character sheet — for now the NPC card +
  notes block carries the bio.

## Rollback
Three new files (`lib/progression-log.ts` already shipped previously,
`components/ParadigmPicker.tsx`, `components/ApprenticeCreationWizard.tsx`),
plus edits to `app/stories/[id]/table/page.tsx`, `components/NpcCard.tsx`,
`components/PlayerNpcCard.tsx`. SQL migration is non-destructive
(idempotent ALTER + partial index). `git revert` cleanly removes the
behavior; existing apprentice_meta data persists harmlessly until the
next migration.
