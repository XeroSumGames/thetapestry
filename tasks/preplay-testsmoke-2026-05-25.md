# Pre-Playtest Smoke - 2026-05-25

Covers everything shipped **2026-05-19** (the day after last playtest).
~70 commits across narrative polish, schema migrations, new modals,
and a pre-commit hook. Priority-ordered.

Run on `thetapestry.distemperverse.com` after Vercel deploy lands.
Hard-refresh each tab (Ctrl+Shift+R), keep DevTools Console open to
catch `console.warn` / `console.error`. **Sections marked [2-client]
require two browsers / two profiles.**

Two earlier testplans may still be open and should run alongside:
- [tasks/preplay-testsmoke-2026-05-17.md](preplay-testsmoke-2026-05-17.md) - 2026-05-15 → 17 ships
- [tasks/polish-pass-2026-05-14-testplan.md](polish-pass-2026-05-14-testplan.md) - 2026-05-14 batch

---

## Priority 1 - Load-bearing, high detection-cost if broken

### A. Recruit Tier-2 full flow (Phases A+B+C, 6287480 / 1951d77 / 57cc125)

Most invasive feature shipped today. Schema migration applied to live
(`sql/recruit-tier2-flags-2026-05-19.sql`). Three new columns: 
`community_members.temporary_until_morale`, `community_members.escape_pending`,
`campaign_npcs.recruit_locked_approaches`.

**End-to-end smoke (run in this order):**

1. **Convert + Intimidation Failure → lock the approach.**
   - PC opens Recruit modal, picks an NPC (call them "Marcus").
   - Approach: Convert. Skill: Intimidation.
   - Roll until you get Failure / Dire / Low Insight (no Success/Wild/HI).
   - **PASS:** roll log shows the recruit attempt; NO community membership row appears (Marcus does NOT join).
   - Close + reopen Recruit modal, pick Marcus again. **PASS:** Convert button is greyed out + 🔒 suffix + tooltip explains lock; warning banner "CONVERT locked on this NPC".
   - Cohort + Conscript still selectable.

2. **Plain Success → temporary recruit.**
   - PC opens Recruit modal, picks a different NPC ("Avery"), any community.
   - Approach: Cohort (or Conscript or Convert). Skill: pick any.
   - Roll to land on plain **Success** (not Wild Success, not High Insight).
   - **PASS:** Avery joins the community. CampaignCommunity tab shows Avery's row with a blue **"⏳ Temporary"** chip.
   - Progression log on the recruiter reads `"Recruited Avery as a temporary <Type> (drops at next Morale Check)"`.

3. **Conscript Failure → escape pending.**
   - PC opens Recruit modal, picks a third NPC ("Frankie"), any community.
   - Approach: Conscript. Skill: Intimidation/Manipulation/etc.
   - Accept the pressgang confirm prompt.
   - Roll to land on Failure / Dire / Low Insight.
   - **PASS:** Frankie joins the community (nominally complies). Row shows amber **"⏳ Escape Pending"** chip. GM-only **🏃 Fire Escape** button appears next to the × remove button.
   - Progression log reads `"Recruited Frankie as a Conscript (appears to comply, but will escape at the first opportunity)"`.

4. **Wild Success → permanent (no chip).**
   - PC opens Recruit modal, picks an NPC, any approach, any skill.
   - Roll to land on Wild Success or High Insight.
   - **PASS:** NPC joins, no chips on the row, no "temporary" log copy. Permanent commit.

5. **Morale-tick drainer.**
   - With Avery in the community as Temporary (from step 2), run a Morale Check on that community.
   - **PASS:** after morale resolves, Avery is removed from the active member list (departed with `left_reason='manual'`). Confirm via CampaignCommunity refresh.
   - **EDGE:** if the morale check ALSO selected Avery into `departureIds` (random pick), the morale-tick drainer's double-mark guard should skip her (she's already marked departing). No duplicate update; no error in console.

6. **GM Fire Escape.**
   - With Frankie in the community as Escape Pending (from step 3), GM clicks **🏃 Fire Escape**.
   - Confirmation dialog fires; click OK.
   - **PASS:** Frankie removed from the active member list. Chip disappears. Local state patch - list updates without a full refetch.

7. **All approaches locked edge case.**
   - Manually mark an NPC with `recruit_locked_approaches = ['cohort', 'conscript', 'convert']` via SQL or by triggering 3 separate Convert+Intimidation Failures on 3 different NPCs and consolidating. (Or just SQL: `UPDATE campaign_npcs SET recruit_locked_approaches = ARRAY['cohort','conscript','convert'] WHERE id = '<npc-id>';`).
   - Open Recruit, pick that NPC.
   - **PASS:** all 3 approach buttons greyed out with 🔒; red warning banner "All recruit approaches are permanently locked on this NPC. Prior Intimidation Failures have ruled out every approach. This NPC cannot be recruited." Roll button disabled.

### B. Stress Check cascade (ddf51e9, shipped earlier this week, full polish today)

Stress Check has two modes (mid-play CHECK button + at-max auto-fire) and a cascade where mid-play Failure at stress 4 auto-fires the at-max modal. [2-client] needed for the GM/player split testing of the at-max cascade.

1. PC at stress 0, click CHECK on stress bar. Force Failure. **PASS:** stress goes 0→1, narrative reads `STRESS CHECK <name> feels the weight`.
2. PC at stress 4, click CHECK. Force Failure. **PASS:** stress goes 4→5 AND the at-max modal opens AUTOMATICALLY after the mid-play modal closes.
3. PC at stress 5 (already there), fail the at-max check. **PASS:** Breaking Point modal opens.
4. PC at stress 5, succeed the at-max check (total ≥7). **PASS:** stress drops to 4. Narrative reads `STRESS CHECK <name> calms themselves down`.
5. Mid-play Dire Failure narrative: `STRESS CHECK <name> buckles under the pressure` (note: no "disastrously" per Xero 2026-05-19 polish).

### C. Coord Effort summary banner (137be68, polish today)

N participant chain rows now fold into ONE bespoke Tier A banner. Individual participant rolls visible in expanded ▸ view.

1. **[2-client]** Start a Coord Effort with 3 participants: PC + 2 others.
2. Lead rolls (Success). PASS: feed shows ONE banner row (uppercase `COORDINATED EFFORT` header, colored border) with narrative `<lead> successfully uses <skill> to coordinate an effort with <names>` after each participant has rolled.
3. Click ▸ on the banner. **PASS:** expanded view shows lead's dice math + per-participant rows.
4. Withdraw chip on a participant (per the earlier shipped retcon path): **PASS:** banner narrative updates (participant name drops from "with X, Y, Z" list); cmod/total retcon happens on the remaining participants.
5. Wild Success outcome: narrative reads `<lead> is wildly successful using <skill> to coordinate an effort with <names>`.

### D. Gut Instinct GM whisper modal (adb9382)

[2-client] needed. GM whisper-detail modal auto-opens on GM's client when a player resolves a Gut Instinct roll.

1. Player rolls Gut Instinct (either via single-PC short-circuit or via the special-check picker).
2. **PASS:** standard narrative row appears in feed for everyone.
3. **PASS:** GM's screen: amber-bordered modal auto-opens with `Gut Instinct - <outcome>` header + character name + textarea + Skip/Send Whisper buttons.
4. GM types a detail + clicks Send Whisper.
5. **PASS:** player's screen auto-flips to Chat tab; whisper line appears reading `Whisper from GM` + `Gut Instinct: <text>`.
6. **NEGATIVE TEST:** GM clicks Skip instead of Send. **PASS:** modal closes, no whisper sent, player sees only the feed row.
7. **SELF-ROLL EDGE:** GM rolls Gut Instinct on their own PC. **PASS:** modal does NOT auto-open (no point whispering to yourself).

### E. Tactical Map Share View button (6a4669b)

[2-client] needed. New 👁 Share View button top-right of tactical map, GM-only. Sibling of CampaignMap's button.

1. GM scrolls the tactical map to a specific area + zooms in.
2. GM clicks **👁 Share View**. **PASS:** button flashes green `✓ Shared` for ~1.5s.
3. **PASS:** player's tactical map smooth-scrolls to the same scroll position + matches the zoom + asset scale.
4. Player can keep panning after - not locked into follow mode.
5. **NEGATIVE TEST:** player does NOT have the Share View button (GM-only).

---

## Priority 2 - Visible regressions, lower stakes

### F. Narrative polish - 12 branches all updated

Open `tasks/roll-feed-log-preview.html` in a browser (hard-refresh). Compare against live feed rows after triggering each check type. Quick scan, not deep.

| Branch | Spot-check narrative |
|---|---|
| ATTRIBUTE CHECK | `ATTRIBUTE CHECK <name> successfully attempted to use their <attr>` |
| STRESS CHECK mid-play | `STRESS CHECK <name> feels the weight` (Failure) |
| STRESS CHECK at-max | `STRESS CHECK <name> calms themselves down` (Success) |
| STABILIZE | `STABILIZE <medic> stabilizes <target>` |
| HEAL | `HEAL <medic> treats <target> with a <kit>` |
| UNJAM | `UNJAM <name> unjams their <weapon>` |
| REPAIR | `REPAIR <name> repairs their <weapon>` |
| COORDINATED EFFORT | Tier A banner (see Section C) |
| DISTRACT | `<name> distracts <target>, breaking their focus` (Success) |
| RECRUIT | `<name> recruits <target> as a Cohort to <community>` (option D, no prefix) |
| VEHICLE Attack | `<crew> hits <target> using <vehicle>'s <weapon>` |
| VEHICLE Driving | `<driver> drives <vehicle>` |
| VEHICLE Brew | `<brewer> brews fuel in <vehicle>'s still` |
| FIRST IMPRESSION | `<X> makes a strong First Impression on <NPC>` (HI keeps bespoke "they did so well") |
| GROUP CHECK | `<names> are Successful at <skill>` (present tense, option c) |

**All HI outcomes should now end with:** `and has a Moment of Insight as to why it went so well` (long-form, locked 2026-05-19).
**All LI outcomes should end with:** `but has a Moment of Insight as to why it went so badly`.

**No mechanical bits in compact narratives** (rule locked today). Specifically check Stress Failure: should read `feels the weight`, NOT `feels the weight (+1 stress)`.

### G. Inspiration SMod relabel + double-count fix (f131736)

1. Open Recruit modal, pick a PC who has Inspiration as a skill.
2. **PASS:** the mod-stack breakdown shows `Inspiration skill SMod (+1/level)` (was `Inspiration skill (+1/level)`).
3. Pick `Inspiration` as the recruit skill itself.
4. **PASS:** Inspiration auto-bonus line reads `+0 (in SMod above)` so the player sees the double-count is suppressed.
5. Roll. **PASS:** total SMod = Inspiration level (not 2× Inspiration level).

### H. Em-dash sweep (87f0e46)

10 places swept to ASCII hyphen. Quick visual:
- NpcCard attack labels in feed
- CommunityMoraleModal Fed/Clothed/Morale/Retention weekly check rows
- ApprenticeCreationWizard tooltips
- CharacterCard Lasting Wound modal subtitle
- MapView marker tooltips
- PlayerNpcCard First Impression tooltip

**PASS:** no em-dash characters visible in any of these UIs (they all use `-` now).

### I. Drag-end grab-offset (d2ba6b6, last week)

Multi-cell tokens like Minnie. Click-drag Minnie by her center cell, release at a target. **PASS:** her top-left lands where you'd expect (grab point stays under cursor). NO jump past the cursor.

### J. Player bar online-first ordering (09e30ba)

GM view. With at least one online + one offline player. **PASS:** online players sit closest to the GM card. Have the offline player log in; **PASS:** they slide into position without a refresh.

### K. World Pin folder rename (d99d4da)

`/map` page sidebar. **PASS:** folder reads `A Timeline of the Dog Flu` (not `World Pin`).

### L. Minnie route-calc speed (5114437)

Route planner on campaign map. Set travel mode to Minnie. Drop two pins; pick a route. **PASS:** ETA reflects 22 mph (was 32 mph). For a 22-mile route, ETA should read ~1h instead of ~41 min.

---

## Priority 3 - Backend / less critical

### M. Pre-commit hook (1e6f540)

`scripts/check-preview-sync.mjs` enforces that `lib/roll-helpers.ts` or `components/RollsFeed.tsx` edits stage `tasks/roll-feed-log-preview.html` too.

1. Make a local edit to `lib/roll-helpers.ts` (e.g., add a comment).
2. `git add lib/roll-helpers.ts` (NOT the preview).
3. `git commit -m "test"`. **PASS:** commit BLOCKS with a clear multi-line remediation message + the `--no-verify` escape hatch.
4. Stage the preview too. Re-commit. **PASS:** commit succeeds.

### N. Health-pulse on the new test count (test infra)

Total tests should now be 349 (was 313 yesterday). Run `npm test` locally; **PASS:** 349 tests pass in <1s.

---

## After running

- PASSED → leave silent or check ✓ next to the step.
- FAILED → log a bug via the in-app bug report (exercises moderation tools).
- Once all P1+P2 pass, drain the HOPED-FOR drift entries 2026-05-19 from `tasks/health-pulse.md`.

---

## What's NOT in this testplan (intentionally)

- The 2026-05-19 advantages feature (`054c04d` + `47a1f36` + `2b8ce4b`) - owned by a parallel chat track; their testplan covers it.
- The 2026-05-19 vehicles fuel/brew-supplies expansion (`c31e564` + `f3b20fb`) - same.
- The First Impression streamline Phase 1-3 (`f9ca0ab` / `ae7eafd` / `e1d1da0`) - same.
- The DRIVE / BREW / NAVIGATE narrative supersede (`faa60ab` + `ba472f6`) - that's the parallel chat's version that REPLACED the narrative I shipped at `54c46a1`. Worth confirming the parallel-chat's narrative is what you want.

If those parallel tracks have their own preplay-testsmoke files, run those in parallel.
