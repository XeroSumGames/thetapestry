# Testplan: Recruit into a Group - Phase 1 (2026-05-24)

**What shipped:** recruiting into a NEW collection of NPCs now creates a **Group** (`communities.stage='group'`), not a forced named Community. Naming is optional (auto "\<Roller\>'s Group" if blank); the public toggle is gone from the new-group flow. Phase 0 schema (`stage` column, name nullable) was applied earlier. Source: `app/stories/[id]/table/page.tsx` (executeRecruitRoll + recruit pick-step modal).

**Live site:** https://thetapestry.distemperverse.com (Vercel deploy after push).

## Golden path
1. In a campaign with NO communities yet, open Recruit (NPC card -> Recruit). The Community section reads **"No group yet - this recruit starts one. Naming is optional..."** - NO required name field blocking the roll, NO "make public" toggle.
2. Pick PC + NPC + approach + skill, leave the group name BLANK, Roll. On success the NPC joins.
   - **DB verify:** `communities` has a new row with `stage='group'`, `name='<RollerName>'s Group'`, `status='forming'`, `world_visibility` default (not published). `community_members` has the NPC tied to that row.
3. **Optional name:** repeat in a fresh campaign but type a name (e.g. "The Greenhouse") -> row created with that name, still `stage='group'`.
4. **Recruit #2 joins the existing group:** open Recruit again -> the group appears in the dropdown as "\<name\> (1 member)". Pick it -> the 2nd NPC joins the SAME group (no new row).
5. **Feed/result:** the recruit result modal + roll-feed log show the group name ("\<Roller\>'s Group" or the typed name).

## Regression / canRoll
- Roll button enabled with a blank group name (was previously blocked until a name was typed).
- Recruiting into an EXISTING full Community (stage='community') still works unchanged.
- Conscription pressgang confirm + poaching -3 CMod hint still fire.

## KNOWN half-state (Phase 2 pending - NOT a bug)
- A `stage='group'` row currently still renders in the Communities panel with the FULL community card (Morale button, public toggle, activity blocks). Phase 2 will gate those on `stage='community'` and show a simpler Group card. Morale is GM-manual (no cron), so nothing auto-applies to a group - just don't manually morale-check a group until Phase 2.

## Gates (green at ship)
- `npx tsc --noEmit`, font/role/em-dash/arch guardrails, `npm test` (554) - all green.

## Next (spec `tasks/spec-recruit-group-2026-05-24.md`)
- Phase 2: simpler Group card in `components/CampaignCommunity.tsx`; gate morale/public/activity-blocks on `stage='community'`.
- Phase 3: at-13 combined members (campaign PCs + group NPCs) auto-prompt to name -> flip `stage='community'`.

## Rollback
Single commit. `git revert <sha> --no-edit && git push origin main`. (The schema column stays; harmless.)
