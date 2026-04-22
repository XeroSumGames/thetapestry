# Plan: Communities, NPCs, and Recruitment (Phase B)

**Status**: Drafted, awaiting review. Do NOT start implementing until user signs off.

**Source spec**: `tasks/spec-communities.md` §2 (Recruitment Types), §3 (Recruitment Check), §9a/9b (UI), §11 Phase B.

---

## Context summary (from codebase audit)

- **Phase A DB + UI shipped.** Tables (`communities`, `community_members`, `community_morale_checks`, `community_resource_checks`) + RLS + `CampaignCommunity.tsx` with create/manage/role-assignment UI all live.
- **Gap found**: `CampaignCommunity` is mounted at `/communities/[id]` only — NOT as a tab in the GM Assets panel on the table page. GMs have to leave the table to manage their community. This blocks mid-session recruitment UX.
- **Gap found**: `npc_relationships` table is used in code (First Impression CMod, reveal level) but has no SQL definition in `sql/`. Likely exists in Supabase from an untracked migration. Must confirm before Phase B leans on `relationship_cmod`.
- **Recruitment is wholly unbuilt.** `community_members.recruitment_type` column exists with type enum, but nothing writes the recruitment flow. NPC card has no "Recruit" button.
- **First Impression already writes `relationship_cmod`** via `npc_relationships` — the primary input Recruitment needs is already flowing.

---

## Plan phases

### Step 0 — Pre-work (unblockers) — ~30 min

- [ ] **0.1** Write `sql/npc-relationships-schema.sql` to formalize the existing table (check + reveal + add IF NOT EXISTS). Columns confirmed from code: `id`, `campaign_id`, `npc_id`, `character_id`, `relationship_cmod int`, `revealed bool`, `reveal_level text`, `created_at`, `updated_at`. Includes RLS: campaign members read, GM writes, player writes their own relationship rows.
- [ ] **0.2** Mount `CampaignCommunity` as a new tab in the table page's GM Assets panel. Add `'community'` to the `gmTab` union in `app/stories/[id]/table/page.tsx`. Add tab button next to Pins/NPCs/Assets/Notes. Render `<CampaignCommunity campaignId={id} isGM={isGM} />` when tab is active. Don't break the existing `/communities/[id]` standalone route — both should work.
- [ ] **0.3** Verify Phase A UI still works with the new mount point. Manual smoke test: create a community, add an NPC manually, remove, rename.

**Ship gate**: commit `chore: mount Community tab in Assets panel + formalize npc_relationships schema` before starting Step 1.

---

### Step 1 — NPC card "Recruit" button — ~45 min

- [ ] **1.1** Add `onRecruit?: () => void` prop to `NpcCard.tsx`. Button renders in the header row next to Edit/Close. Green outline styling. Only visible when `onRecruit` is provided (GM view, campaign has at least one community).
- [ ] **1.2** Wire the callback in `app/stories/[id]/table/page.tsx` (and wherever NpcCard is mounted — scan for all render sites). Clicking opens a new `<RecruitmentModal />`.
- [ ] **1.3** Gate the button: only shown when (a) the NPC is revealed to at least one PC AND (b) the NPC is not already in a `community_members` row (no duplicate membership). Query on modal mount; cache in `campaignNpcs` state if it already loads relationships.
- [ ] **1.4** Hide the button for PCs in `PlayerNpcCard.tsx` — recruitment is a GM action (for Phase B; spec §10 "Who can recruit" says GM-only in MVP).

**Ship gate**: commit `feat: NPC card 'Recruit' button — opens recruitment modal (empty shell)`.

---

### Step 2 — Recruitment modal: approach + skill picker — ~1 hour

- [ ] **2.1** New file `components/RecruitmentModal.tsx`. Props: `npc`, `campaignId`, `communities[]` (if multiple; modal starts with community picker if >1), `onClose`, `onRecruited`.
- [ ] **2.2** Step 1 UI: three approach cards (Cohort / Conscript / Convert) with flavor text from spec §2. Apprentice picked later as a toggle — it's not an approach, it's a modifier.
- [ ] **2.3** Step 2 UI: skill picker auto-suggests per approach (Cohort → Barter/Tactics, Conscript → Intimidation/Tactics, Convert → Inspiration/Psychology). Free-pick fallback for house-rule flex. SMod pulls from the roller PC's skills; AMod pulls from the PC's relevant RAPID (INF for most social).
- [ ] **2.4** Step 3 UI: CMod review. Auto-fills:
    - First Impression bonus = `npc_relationships.relationship_cmod` for the rolling PC vs this NPC (may be null/0 if never rolled First Impression).
    - GM freeform +/- CMod input.
  - Show running total below dice line.
- [ ] **2.5** Roller selection: defaults to the active combatant PC (if combat) or a PC dropdown (otherwise). GM can override.

**Ship gate**: commit `feat: Recruitment modal steps 1-3 — approach + skill + CMod preview`. Roll step still a stub.

---

### Step 3 — Recruitment roll + outcome table — ~1 hour

- [ ] **3.1** Add roll logic to the modal: 2d6 + AMod + SMod + CMod. Reuse `executeRoll`'s dice-rolling patterns; do NOT route through the main attack flow (Recruitment is a pre-combat / out-of-combat social check). A lighter standalone resolver inside the modal is fine.
- [ ] **3.2** Outcome mapping per spec §3:
    - 14+: Wild Success
    - 6+6: Moment of High Insight (overlay; still treat as Wild Success for join logic, unlocks Apprentice option)
    - 9–13: Success
    - 4–8: Failure
    - 0–3: Dire Failure
    - 1+1: Moment of Low Insight (overlay; dire-failure + escalation flavor)
  - Per-approach copy for each bucket (cohort/conscript/convert have different flavor strings — spec §3 table).
- [ ] **3.3** Outcome screen: dice animation → result banner (green/red/amber) → "Confirm" button that commits the outcome.
- [ ] **3.4** Commit success → INSERT `community_members` row:
    - `community_id` (selected community)
    - `npc_id` (the NPC being recruited)
    - `character_id` null (NPC member)
    - `recruitment_type` = 'cohort' | 'conscript' | 'convert' | 'apprentice' if toggle enabled
    - `apprentice_of_character_id` = roller PC if apprentice toggled
    - `role` = 'unassigned' (GM assigns later)
    - `joined_at` now, `joined_week` = community.week_number
- [ ] **3.5** Commit failure / dire failure → no DB write other than roll_log. Show flavor + "Close" button.

**Ship gate**: commit `feat: Recruitment roll + outcome + community_members insert`.

---

### Step 4 — Apprentice toggle + constraints — ~30 min

- [ ] **4.1** Apprentice toggle only rendered on Wild Success / High Insight outcomes. Spec §2: "Only 1 Apprentice per PC."
- [ ] **4.2** On toggle, INSERT sets `recruitment_type = 'apprentice'` + `apprentice_of_character_id = rollerPcId`.
- [ ] **4.3** Validation: query `community_members WHERE apprentice_of_character_id = <rollerPcId>`. If any exist, toggle is disabled with tooltip "PC already has an apprentice (<name>)".

**Ship gate**: commit `feat: Apprentice flag on Wild Success recruits — 1 per PC constraint`.

---

### Step 5 — Roll log integration — ~30 min

- [ ] **5.1** Write a `roll_log` row for every recruitment attempt. Outcome string examples:
    - Success: `Vera Oakes recruited Nolan Penn as Cohort`
    - Failure: `Vera Oakes failed to recruit Nolan Penn`
    - Dire: `Vera Oakes alienated Nolan Penn`
  - `outcome` column = `'recruit'` (new category; add to feed renderer styling).
  - `damage_json` carries `{ npc_id, community_id, recruitment_type, approach, skill_name }` for future auditing / Phase C recoverability.
- [ ] **5.2** Feed renderer: recruitment rows get a custom style card (green border for success, amber for failure, red for dire). Similar to `sprint` / `defer` / `loot` existing patterns.
- [ ] **5.3** compactRollSummary branch: narrative one-liner per approach. `Vera Oakes inspired Nolan Penn to join the Greenhouse` / `Vera Oakes failed to win Nolan Penn over`.

**Ship gate**: commit `feat: recruitment log entries + feed card styling`.

---

### Step 6 — First Impression integration polish — ~20 min

- [ ] **6.1** Verify Step 2.4 actually pulls `relationship_cmod`. If `npc_relationships` row doesn't exist for this PC+NPC pair, show a hint: "No First Impression yet — roll one from the NPC card for a CMod input."
- [ ] **6.2** If PC rolled First Impression *in this session* (no prior relationship row), cache it locally so the modal picks it up without a DB re-fetch.

**Ship gate**: commit `feat: Recruitment modal surfaces First Impression CMod prominently`.

---

## Testing plan (to `tasks/testplan.md` on implementation day)

1. **Happy path Cohort**: Revealed NPC → GM clicks Recruit → Cohort/Barter/+0 CMod → Success → NPC appears in community member list with "Cohort" label.
2. **Apprentice path**: Same but Wild Success → toggle Apprentice ON → insert sets apprentice_of_character_id.
3. **Apprentice cap**: PC already has an apprentice → toggle disabled with tooltip.
4. **Convert flavor**: Pick Convert → skill list narrows to Inspiration/Psychology → win the roll → recruitment_type = 'convert', not 'cohort'.
5. **Dire Failure**: Bad CMod → 1+1 → Moment of Low Insight card shown, no membership written, roll_log entry reads alienation.
6. **Multi-community selector**: Create 2 communities → open Recruit → step 0 shows picker.
7. **No community case**: Campaign with zero communities → Recruit button hidden on NPC card OR modal shows "Create a community first" CTA.
8. **Already-member guard**: Recruit a recruited NPC → button disabled OR modal shows "already a member".
9. **RLS**: Non-GM player tries to open Recruit → button not rendered; direct API call rejected by campaign_members policy.
10. **Feed log**: All outcomes land in roll_log with custom styling, compact line reads narratively.

---

## Decisions — locked by user

- **DECISION 1 — Community tab location**: BOTH. New tab in the GM Assets panel on the table page AND keep the standalone `/communities/[id]` route.
- **DECISION 2 — Who rolls Recruitment**: Always a PC. Roller picker in the modal lists all alive PCs in the campaign (not just the active combatant). No NPC rollers, no GM-side roll. (NPCs might recruit for their community later via GM proxy — that's a Phase D concern.)
- **DECISION 3 — Combat action cost**: No. Recruitment is out-of-combat only. Modal may open during combat but the roll does NOT advance the turn or decrement `actions_remaining`.
- **DECISION 4 — Manual Add kept**: Yes. Existing "+ Add Member" stays on `CampaignCommunity` for Founders and GM retcon.
- **DECISION 5 — Approach tooltips**: Single-sentence flavor for now. Revisit with deeper tooltip in a future polish pass (logged below).

### Follow-ups logged from these decisions

- [ ] **Polish** Deeper approach tooltip — "Why this approach?" with rules context (commitment duration, SRD references, when to pick each). Part of a future Communities UX pass, not Phase B MVP.
- [ ] **Phase D candidate** NPC-proxy recruitment — GM rolls on behalf of a Community's Leader NPC to recruit other NPCs. Needed if a community grows itself off-screen while PCs are elsewhere. Design dependency: Activity Blocks (Phase D).

---

## Out of scope (explicit non-goals for this round)

- Morale Checks (Phase C).
- Resource Checks — Fed / Clothed (Phase C).
- Activity Blocks + End Week flow (Phase D).
- Cross-campaign / Tapestry Layer publishing (Phase E).
- Apprentice task delegation (PC-via-proxy actions; Phase D).
- World map overlay for communities (Phase E).

---

## Review section — filled in AFTER implementation

*Not yet started.*
