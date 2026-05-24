# Testplan: Recruit into a Group - Phase 2 (the simpler Group card)

Shipped 2026-05-24. Change = the Community card (`components/CampaignCommunity.tsx`) now
reads the persisted `communities.stage` flag instead of guessing Group-vs-Community from
member count. A `stage='group'` row shows a simpler card; `stage='community'` is unchanged.

## What changed (behavior)
- Group vs Community label, and the gating of Morale / Publish / Role Coverage / per-member
  role dropdown, is now driven by `stage` (not `total >= 13`).
- A `stage='group'` row hides: Weekly Check / Morale, Publish-to-Tapestry, Role Coverage
  bars + Re-balance, and per-member role `<select>`.
- A `stage='group'` row still shows: header (name + Group chip + count), Homestead, Leader,
  roster, stockpile, community feed.
- Header name falls back to `<Leader>'s Group` if a name is ever missing (groups auto-name
  today, so this is belt-and-suspenders).

## Automated (already green)
- `npx tsc --noEmit` - clean.
- `node scripts/check-font-sizes.mjs` / `check-role-literals` / `check-em-dashes` /
  `check-arch` - all pass.
- `npm test` - 561 pass, incl. 7 new in `tests/lib/community-stage.test.ts`.

## Manual - golden path
1. In a campaign with NO existing community, open the table page and recruit an NPC
   (Recruit flow). Expect: a `stage='group'` row is created, named "<Roller>'s Group".
2. Open the Communities portal / panel for that campaign. Find the new row.
   - Header chip reads **Group** (amber), not Community.
   - Member-count line shows `· N more for Community` (N = 13 - total), and NOT a negative
     number.
   - Expand the card. Confirm these are ABSENT: "📊 Weekly Check" block, "🌐 The Tapestry"
     publish strip, "Role Coverage" bars + "⚖ Re-balance Roles", and the per-member role
     dropdown in the roster rows.
   - Confirm these are PRESENT: Homestead, Leader, roster (members listed), Stockpile,
     Community Feed.
3. Recruit a 2nd NPC into the same group. Confirm it joins the existing group (dropdown
   offers "<Roller>'s Group") and the card stays in Group mode.

## Manual - regression (existing communities must be untouched)
4. Open an EXISTING community (any pre-2026-05-24 row, stage='community'). Confirm:
   - Header chip reads **Community** (green).
   - Weekly Check, Publish, Role Coverage, and per-member role dropdowns all RENDER as before.
   - This holds even if the community currently has < 13 active members (previously it would
     have reverted to "Group" under the old count heuristic - now it stays Community).

## Manual - edge
5. (Pre-Phase-3) Grow a group to >= 13 members. Confirm it does NOT crash and the count hint
   no longer shows a negative. It stays a Group (promotion prompt is Phase 3, not yet shipped).

## Revert
Single conventional commit -> `git revert <sha>`. No schema/data change in this commit.
