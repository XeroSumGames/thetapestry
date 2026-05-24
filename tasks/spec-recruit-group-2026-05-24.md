# Spec: Recruit into a Group (not a forced Community)

Canon conformance (`tasks/tapestry-rules-canon.md:746`): PCs + recruited NPCs form a **Group**; it becomes a **Community** only at 13+ combined members (Morale Checks). The recruit flow wrongly forces founding+naming a Community at recruit #1. Xero-approved 2026-05-24: implement via a `stage` flag on `communities` (not a separate table). Defaults this session: unnamed group displays as "\<Leader\>'s Group"; at-13 auto-prompts to name.

## Phase 0 - schema (DONE 2026-05-24)
`sql/recruit-group-stage-2026-05-24.sql` applied live:
- `communities.stage text NOT NULL DEFAULT 'community'` (CHECK in ('group','community')). Existing rows = 'community'.
- `communities.name` now NULLABLE (a Group has no name until promotion).

## Phase 1 - recruit flow creates a Group, not a Community
- Recruit pick-step modal (`app/stories/[id]/table/page.tsx:9501`, "Pick target & approach" `:9534`): when the campaign has NO existing community/group, recruiting must NOT force "found a new one" + NAME + Make-Public. Instead: first recruit auto-creates a `communities` row with `stage='group'`, `name=NULL`, no public/morale. Subsequent recruits join that group.
- Recruits still land in `community_members` tied to the group row (unchanged plumbing).
- The community dropdown should offer the existing Group (shown as "\<Leader\>'s Group") + still allow picking an existing full Community if one exists.

## Phase 2 - the Group card (simpler than Community)
- `components/CampaignCommunity.tsx` renders communities. Add a `stage==='group'` view: roster + recruit only. HIDE morale checks, public/LFG toggle, activity-block assignments, weekly Morale cadence - those gate on `stage==='community'`.
- Display name: `name ?? "<Leader>'s Group"` everywhere a community name renders (AUDIT: grep `.name` readers on community rows - the nullable name is the risk surface; fall back, never render "null"/empty).

## Phase 3 - promotion at member 13
- Combined count = campaign PCs (the party) + the group's NPC members (`community_members`). Canon "13 or more PCs and NPCs."
  - OPEN (resolve in build): exact PC-counting rule - all campaign PCs, or only those "in" the group? Lean: all active campaign PCs + the group's recruited NPCs.
- When a recruit pushes combined >= 13: auto-pop a "Name your Community" prompt (the leader/GM names it) -> UPDATE `stage='community'`, set `name`. Unlocks the full Community card + Morale cadence.
- Edge: if the GM founds a Community directly (not via growth), that path still creates `stage='community'` with a name (unchanged).

## Tests
- `weaponCausesWoundInfection`-style pure helpers where possible (e.g. a `combinedMemberCount()` / `shouldPromoteToCommunity()` helper -> unit test the 12->13 boundary).
- Manual: recruit into a fresh campaign (no name prompt), grow to 13 (promotion prompt fires), verify the simple Group card vs full Community card.

## Risks
- Nullable `name` - audit every community-name reader (display/sort/search) for null safety. The single biggest regression surface.
- Communities is the flagship (Phases A-E shipped) - coordinate with puffer-fish; don't break Morale/activity-block paths for real communities (gate them on stage).
- The recruit pick-step + result modals live in the table page (post-re-arch) - respect the LOC ratchet (new render logic -> components/).
