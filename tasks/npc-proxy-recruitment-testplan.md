# NPC-Proxy Recruitment — Testplan (2026-05-02)

Verifies that a community's Leader NPC can recruit other NPCs into the community without a PC at the table — the off-screen growth path that closes Communities Phase B.

## Setup

- Pick a campaign you GM with at least one community that has a Leader NPC set
- The campaign needs at least one revealed NPC who is NOT in any community (will be the recruit target)
- Have one weapon/skill data set on the Leader NPC's sheet so SMod isn't 0

## Tests

### A — Button visible on community card

1. Open the campaign, switch to the Communities tab
2. **Expect:** in the Weekly Check row of the leader-set community, a "🤝 Recruit (Proxy)" button between Skip Week and Run Weekly Check

### B — Disabled when no Leader

1. On a community without a `leader_npc_id`
2. **Expect:** "🤝 Recruit (Proxy)" is greyed out; hovering shows "Set a Leader NPC first — proxy recruitment uses the leader as the roller."

### C — Modal opens with leader stat block

1. Click "🤝 Recruit (Proxy)" on a leader-set community
2. **Expect:**
   - Title reads "🤝 Recruit (NPC Proxy)" with the community name above it
   - Leader stat block shows the leader's name + INF
   - Target NPC dropdown is populated with revealed NPCs
   - NPCs already in another community are tagged "(in another community)"

### D — Approach changes suggested skills

1. Pick "convert" approach
2. **Expect:** Skill dropdown's "Suggested for convert" optgroup shows Inspiration + Psychology
3. Switch to "cohort"
4. **Expect:** Suggested skills change to Barter + Tactics + Inspiration

### E — Successful Cohort recruit

1. Pick a target NPC, approach "cohort", skill "Inspiration"
2. Click "🎲 Roll Recruitment"
3. If outcome ≥9:
   - **Expect:** result panel shows green border, "Wild Success" or "Success" in green, the dice + AMod/SMod/CMod breakdown, and copy "X joins <community> as a Cohort. Logged to the campaign feed."
4. Close modal
5. **Expect:** community member roster shows the new NPC as a Cohort

### F — Failure path leaves the community alone

1. Open the modal again, pick another target with high CMod negative (set GM CMod to -10) so the roll fails
2. Roll
3. **Expect:** red border, "Failure" or "Dire Failure", message "<leader> couldn't bring <target> in." No member added to the community

### G — Conscript guard

1. Pick approach "conscript", any target + Intimidation skill
2. Click Roll
3. **Expect:** browser confirm prompt about credible threat. Cancel — nothing rolled. Confirm — roll proceeds normally.

### H — Poaching CMod auto-applies

1. Pick a target NPC who's already in another community (the "(in another community)" tag)
2. **Expect:** CMod Breakdown shows "Poaching −3" line in red; Total CMod reflects -3 plus your GM dial

### I — Roll feed entry visible

1. After a successful roll, open the table page → roll feed
2. **Expect:** a recruit-flavored entry "🤝 <leader> recruited <target> as a Cohort to <community> (off-screen)" with the dice breakdown

### J — Incapacitated leader blocks the modal

1. Set the leader NPC's `wp_current` to 0 (in the NPC roster)
2. Click "🤝 Recruit (Proxy)" on the community
3. **Expect:** modal opens but shows "<leader> is incapacitated (WP 0) and can't proxy a recruitment roll." instead of the form

## Pass criteria

All ten tests pass on production. The community feed shows proxy recruits visibly distinct from PC recruits via the metadata flag (visual differentiation is a future polish — for now it just lives in `damage_json.proxy`).
