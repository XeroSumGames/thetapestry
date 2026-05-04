# Community + Member type consolidation — 2026-05-01 testplan

`Community` / `Member` shapes were redefined in 3 files with subtle drift between them. Pulled into one canonical source. One PR. Ship to live.

## What changed

- New file: [lib/types/community.ts](lib/types/community.ts) — canonical row shapes for the `communities` and `community_members` tables, plus the `CommunityStatus` / `Role` / `RecruitmentType` / `MemberStatus` / `LeftReason` / `WorldVisibility` enums. Source of truth aligned with `sql/communities-phase-a.sql` and the accumulated `sql/community-members-add-*.sql` migrations.
- [components/CampaignCommunity.tsx](components/CampaignCommunity.tsx) — drops its local `Community` / `Member` / `Role` / `RecruitmentType` definitions; imports from the canonical file.
- [components/CommunityMoraleModal.tsx](components/CommunityMoraleModal.tsx) — same.
- [app/stories/[id]/community/page.tsx](app/stories/[id]/community/page.tsx) — same.

## Why

Pre-extraction the three files had **non-identical** shapes:
- CampaignCommunity had the most complete shape (12-column `Community`, 13-column `Member` inc. `current_task`, `assignment_pc_id`).
- CommunityMoraleModal had a narrower `Community` (no `description`, `homestead_pin_id`, `world_visibility`) and `Member` (no `joined_at`, `left_at`, `status`, etc.).
- The dashboard page had a different mix again — narrower `Community` but with `created_at` + `dissolved_at` fields the others omitted.

Whenever a SQL migration added a column the type drift got worse. Now there's one place to update.

No DB migration. No functional behavior change. Pure refactor — `tsc --noEmit` is the gate.

## Test plan

### A. Type-only verification
- [ ] `npx tsc --noEmit` passes.
- [ ] `node scripts/check-font-sizes.mjs` passes.

### B. Smoke (5 min)
- [ ] Open `/stories/<id>/community` (campaign-scoped community dashboard) — page renders, communities list, morale/resources/members tabs all work as before.
- [ ] Open the inline `<CampaignCommunity>` panel from the table page — Add Member, role pickers, recruitment-type dropdowns work as before.
- [ ] Open the Weekly Morale Check modal — fields render, the Run Weekly Check button still produces the right Fed/Clothed/Morale chain.

### C. Subtle drift check (3 min)
The canonical type now exposes fields that some files weren't reading before (e.g. CommunityMoraleModal can now see `description`, `world_visibility`). No code changed to consume them — just freshens the typing surface.

- [ ] Confirm CampaignCommunity's auto-assign / role rebalance still works.
- [ ] Confirm CommunityMoraleModal's leader resolution + departure list still work.

## Rollback

`git revert <commit>` then redeploy. No DB or schema changes; new file is removable in isolation.
