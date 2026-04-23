# Test Plan — Phase C Communities (Weekly Morale + Fed/Clothed)

**Scope:** Weekly Check modal, Fed/Clothed/Morale roll persistence, consequence application (25/50/75% departures), 3-failure dissolution, roll-log cards.

**Ship date:** 2026-04-23.

**Pre-req:**
1. Run the new migration: `psql ... -f sql/community-members-add-morale-75-reason.sql` so `left_reason = 'morale_75'` is accepted. (Modal falls back to 'manual' if you skip this — it still persists, just with a less precise reason.)
2. Dev server running: `npm run dev` in the worktree.

---

## Setup (one-time, ~3 min)

1. Open a campaign you GM. Use The Arena (id `35ed2133-498a-43d2-bbd6-21da05233af2`) or any other where you have ≥13 NPCs available.
2. Open the table page (`/stories/<id>/table`).
3. Click **Community ▾ → Status** in the header to open the Community panel.
4. Expand (or create) a community. Add NPCs via "Add Member" until the total hits **13+** — the "Community" chip (green) should appear in the header, replacing the "Group" chip (amber).
5. Make sure a **Leader** is set (the dropdown under the community title). Leaderless will apply a −1 "A Clear Voice" slot.
6. Pick roles so role percentages are green on all three bars — we'll cover the understaffed-penalty case separately.

---

## Happy path — normal weekly check with Success result

**Goal:** Prove the basic loop rolls, displays, and persists correctly.

1. In the expanded community body, you should see a new **📊 Weekly Check** info strip (blue-bordered) between Leader and Pending Requests, showing "Week 1 · 0/3 consecutive failures" and a green **Run Weekly Check** button. *GM-only — verify by viewing as a non-GM player: the strip should not render.*
2. Click **Run Weekly Check**. Modal opens titled "Weekly Check — <community name>", week 1, <N> members, 0/3 failures.
3. Expected defaults: Fed/Clothed AMod=0, SMod=1, CMod=0; Morale Leader AMod=0, SMod=0; all 6 Morale slots show auto-calculated values; no banner.
4. Without changing anything, click **🎲 Run Weekly Check**. Modal advances to the **Results** stage.
5. Verify the three roll cards:
   - 🌾 Fed Check — dice, A/S/CMod breakdown, outcome colored (green/blue/amber/red), "→ next-Morale CMod: +N"
   - 🔧 Clothed Check — same shape
   - 📊 Morale — dice, "Slots:" row showing all six values, "Next week's Mood CMod:" line
6. Consequence panel below should say one of:
   - Green "Morale holds. No departures." (Success tier)
   - Amber "N member(s) leave" with names (Failure/Dire/Low Insight)
   - Red "Community Dissolves" (only on 3rd consecutive failure)
7. Click **Finalize & Save**. Modal closes, panel reloads.
8. Verify in the community panel:
   - Week counter advanced by 1 (next click shows "Week 2")
   - Consecutive failures: 0 if success, 1 if failure
   - Member count: unchanged on success; dropped by floor(total × 25%) on Failure, 50% on Dire, 75% on Low Insight
9. Open the **Logs** tab on the table page:
   - Three new cards visible in order: Fed, Clothed, Morale (most recent at top of feed — check ordering by timestamp)
   - Fed / Clothed cards: colored border by outcome, dice breakdown, "→ Next Morale CMod +N" footer
   - Morale card: slot breakdown, departure block (if any), consecutive-failure counter
10. Reload the page (`F5`). State persists — week counter, failure count, member count all survive reload.

## Reopen same community, second week

1. Open the modal again. The "Mood Around The Campfire" slot should now show the **prior check's next-week CMod** (non-zero if last week was non-Success, 0 if Success).
2. The Additional freeform slot resets to 0 each open (by design — it's event-specific).
3. Run another weekly check. Verify the Mood slot feeds into the Morale roll total correctly — cross-check by adding all six slot values + Additional in your head, and matching the "CMod" breakdown on the Morale card.

---

## Understaffed community — "Enough Hands" penalty

**Goal:** Verify the mechanical −1/−2/−3 CMod fires when role quotas are missed.

1. Move NPCs so Gatherers < 33% of NPCs (e.g. put most in Unassigned or Safety). Note: Re-balance Roles also fires on panel re-load, so open the modal immediately after manually dragging NPCs into the wrong roles — don't navigate away.
2. Verify the modal's "Enough Hands" slot shows a negative CMod (−1 per understaffed group, max −3). The "auto" chip confirms it's computed.
3. Try: zero the Safety role entirely. Enough Hands should hit at least −1 (Safety missing), AND "Someone To Watch Over Me" should show −1 (Safety < 5%).

---

## Leaderless penalty — "A Clear Voice"

1. If the Leader dropdown won't let you select a blank option, directly null both `leader_user_id` and `leader_npc_id` via Supabase Studio on the row.
2. Open the weekly check modal. "A Clear Voice" slot should show **−1** (auto).

---

## Cancel preserves DB

1. Open the modal. Click **🎲 Run Weekly Check** to advance to Results.
2. Click **Cancel (discard)** on the result stage.
3. Verify via the panel — week counter UNCHANGED, consecutive_failures UNCHANGED, member count UNCHANGED.
4. Verify via Logs tab — no new fed/clothed/morale cards.
5. Refresh and confirm same. (Good — all-at-once persistence works.)

---

## Dissolution path — 3 consecutive failures

**Goal:** Prove the community flips to `status='dissolved'` and all members are removed.

This is dice-random, so either (a) cheat by editing `consecutive_failures` directly via Supabase Studio to 2, OR (b) farm failures the slow way.

### Fast path (recommended):

1. In Supabase Studio (or psql), update the community: `UPDATE communities SET consecutive_failures = 2 WHERE id = '<your id>'`.
2. Reload the table page.
3. Community panel shows "2/3 consecutive failures · one more failure dissolves the community" in red.
4. Open Weekly Check modal — header banner also shows the warning.
5. Set Fed AMod/SMod/CMod, Clothed AMod/SMod/CMod, and all Morale A/S to aggressive negatives (e.g. AMod=−5 each) so the Morale roll lands in Dire Failure / Low Insight territory reliably.
6. Click **Run Weekly Check**. On the Result stage:
   - Consequence panel should be RED "⚠ Community Dissolves" with a count of scattered members
   - The finalize button is also red: "Finalize — Dissolve Community"
7. Click **Finalize — Dissolve Community**.
8. Verify:
   - Community header now shows "Dissolved" (red chip)
   - All members moved to removed state (the body member roster is empty)
   - DB: `communities.status = 'dissolved'`, `dissolved_at IS NOT NULL`; all `community_members` rows have `left_at` set and `left_reason='dissolved'`
   - Logs tab: Morale card has red border + "⚠ Community dissolved — 3 consecutive failures" caption
9. Try to open the modal on a dissolved community — the "Run Weekly Check" strip should NOT render (gate: `status==='active'`).

---

## Departure priority order

**Goal:** Confirm the weighted departure picker leaves the right NPCs.

1. Set up a community with a mix: 3 Apprentice NPCs, 3 Cohort NPCs, 3 Convert NPCs, 3 Conscript NPCs, 3 Unassigned NPCs, 2 founder PCs. Total 15+.
2. Force a Failure outcome (25% = 4 members leave). Aggressive-negative modifiers as above.
3. Run, Finalize. Verify via panel:
   - The 4 who left should be drawn from Unassigned first, then Cohort. Apprentices + Conscripts + Founders should all be intact.
4. Set the community back up (manually remove `left_at` in DB or just re-add members). Force Dire Failure (50% = 7 leave). Expect: all 3 Unassigned + all 3 Cohort + 1 Convert.
5. Force Low Insight (1+1 on the Morale dice — this is RNG. If you can't force it, skip this step.). Expect 75% leave, Apprentices still last to go.

**Note:** PCs should never appear in the departure list. Verify by checking that all 2 founder PCs stay.

---

## Edge cases / regressions

- [ ] **<13 members guard** — reduce below 13. Modal opens but shows amber warning "Only N members. Morale Checks require 13+." The Run button is disabled (grey).
- [ ] **Community with no Fed/Clothed history** — first week's "Mood Around The Campfire" should display 0, not crash.
- [ ] **Slot override** — put a manual value in the Enough Hands override input. Roll. The Morale card's CMod breakdown should use your override, not the computed auto value.
- [ ] **Additional CMod propagates** — set Additional to +5. Roll. The Morale card's CMod total should include +5.
- [ ] **Roll-log cards Both tab** — switch feed tab to Both. Fed/Clothed/Morale rolls should render as simplified character-card rows with the stored label (emoji stripped).
- [ ] **TypeScript** — `npx tsc --noEmit` exits 0 (verified at commit).
- [ ] **Font size guardrail** — `node scripts/check-font-sizes.mjs` reports OK (verified at commit).

---

## Known deferrals (not in Phase C scope)

- **Retention Check** on 3rd failure — SRD §08 p.22 allows a fast-acting leader to salvage fragments. Not implemented; dissolution is immediate. Flagged in tasks/todo.md Phase C section.
- **End Week / Activity Blocks** — Phase D.
- **Inspiration Lv4 "Beacon of Hope"** auto +4 CMod — Phase D.
- **Psychology* Lv4 "Insightful Counselor"** auto +3 CMod (tenure-gated) — Phase D.
- **Morale history dashboard** — Phase D.

If any of these surface as a blocker during table play, bump them up in the todo.
