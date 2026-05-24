# Testplan: Recruit into a Group - Phase 3 (at-13 promotion)

Shipped 2026-05-24. When a Group reaches a combined 13 (party PCs + recruited NPCs),
the card shows a promote banner; the GM or the group's leader names it and promotes
it to a Community, which unlocks the full card.

## Counting rule (decisions.md 2026-05-24)
`combined = active campaign PCs (the party, from chars) + the group's active NPC members`.
NOT the enrolled-member count - the recruit flow doesn't enroll the roller PC, so an
enrolled count would miss the party. Canon: "a combined total of 13 or more PCs and NPCs."

## Automated (green)
- `npx tsc --noEmit` clean.
- `check-font-sizes` / `check-role-literals` / `check-em-dashes` / `check-arch` all pass
  (CampaignCommunity stayed within the LOC ratchet by extracting `CommunityPromoteBanner`).
- `npm test` - 568 pass; `tests/lib/community-stage.test.ts` covers the 12->false / 13->true
  boundary + community-stage->never-promote + negative clamps.

## Manual - golden path (promotion)
1. In a campaign whose party is P PCs, open a Group (recruit-founded). Its header shows
   `{P + recruitedNPCs} members ({P} PCs + {N} NPCs) · {13 - combined} more for Community`.
2. Recruit NPCs until combined (party PCs + group NPCs) reaches 13.
   - The always-visible header line flips to `· ⬆ ready to become a Community` (green).
   - Expand the card: a green "⬆ Ready to become a Community" banner sits at the top with
     the math ("Your party (P PCs) plus N recruited NPCs makes 13...") + a name input + a
     "Promote to Community" button (disabled until you type a name).
3. Type a Community name, click Promote, confirm the dialog. The card reloads as a full
   Community: chip reads "Community" (green), and Weekly Check / Publish-to-Tapestry /
   Role Coverage / per-member role dropdowns all appear.
4. Reload the page - it persists as a Community (stage flipped in the DB).

## Manual - gating / permissions
5. As a non-GM, non-leader member of a 13+ group: confirm the promote banner does NOT show
   (you still see the "ready to become a Community" header text, but no name input/button).
6. As the group's PC leader (leader_user_id = you): confirm the banner DOES show.

## Manual - edge / regression
7. A group below 13 combined: no banner, header shows "X more for Community". Confirm
   "more for Community" never goes negative.
8. An existing Community (stage='community'): never shows the promote banner regardless of
   member count (shouldPromoteToCommunity returns false for non-group stages).
9. Promote with a blank name: button stays disabled; if somehow triggered, an alert asks
   for a name and nothing is written.

## Revert
Single conventional commit -> `git revert <sha>`. No schema change in this commit. If a
group was promoted during the window, its stage stays 'community' (a user action, not a
deploy artifact); flip back via `UPDATE communities SET stage='group', name=NULL WHERE id=...`
if ever needed.
