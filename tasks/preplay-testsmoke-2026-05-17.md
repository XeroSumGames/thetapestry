# Pre-Playtest Smoke — 2026-05-17

Covers everything shipped **2026-05-15 → 2026-05-17** (37 commits since
the Polish-pass / Thriver-godmode testplans were written).

Existing testplans that ALSO need running if you haven't yet:
- [tasks/polish-pass-2026-05-14-testplan.md](polish-pass-2026-05-14-testplan.md) — 2026-05-14 batch
- [tasks/thriver-godmode-sweep-testplan.md](thriver-godmode-sweep-testplan.md) — Thriver godmode UI sweep

Run on `thetapestry.distemperverse.com` after Vercel deploy lands. Hard-
refresh each tab (Ctrl+Shift+R), keep DevTools Console open to catch
`console.warn` / `console.error`. Two browsers / two profiles required
for any test marked **[2-client]**.

---

## Priority 1 — Load-bearing, high detection-cost if broken

### A. Vehicle drag-end grab-offset (shipped today, d2ba6b6)

The fix that prompted this testplan. Easy to miss because 1x1 PCs are
mostly unaffected.

1. Load a tactical scene with **Minnie (3x3)** placed.
2. Click-drag Minnie by her **center cell** (not the top-left corner).
3. Release at a target cell several cells away.
4. **PASS:** Minnie's top-left lands where you'd expect — the grab
   point stays under your cursor. **FAIL:** Minnie jumps +N cells
   past the cursor.
5. Repeat grabbing by **bottom-right cell** and **edge cells**.
6. Repeat with any other multi-cell token (vehicle tokens, large NPCs).
7. Edge case: drag toward the grid boundary so the anchor would land
   off-grid. **PASS:** clamps to grid bounds, no off-map tokens.

### B. Vehicle passenger model (8ee54f4 + 16e33d6 + 9030953 + 052e52b)

Aboard tokens are filtered from canvas render, replaced by a count
badge on the vehicle. Critical because it's the model the rest of the
vehicle work assumes.

1. Spawn vehicle (e.g. Minnie). Confirm placed at top-left (1,1) by
   default — never top-right.
2. Assign 2+ PCs to seats. **PASS:** PC tokens disappear from the
   canvas; a small count badge ("2", "3", etc.) appears on the
   vehicle token.
3. Move the vehicle. **PASS:** passengers don't leave ghost tokens
   behind; the badge moves with the vehicle.
4. **[2-client]** Same scene open as GM and as the seated player.
   Player perspective should match: no ghost token of their own PC
   sitting next to the vehicle.
5. Click DISEMBARK on a seated PC. **PASS:** that PC's token
   reappears adjacent to the vehicle, badge count decrements by 1.
6. Cross-tab signal smoke: with vehicle sheet open in a popout AND
   the campaign-sheet open in another tab, change the vehicle's
   fuel/HP on one. **PASS:** the other tab updates within ~1 sec
   without a manual refresh.

### C. Coordinated Effort — per-participant Withdraw with retcon (64eb3db)

Full retcon (Option B) — every other participant's already-logged
roll gets cmod -1, total -1, outcome recomputed. Most complex shipped
recently, easy to silently break.

1. **[2-client]** Start a Coordinated Effort with 3 participants:
   one PC + two others (PC or NPC). Roll all three.
2. Confirm chain banner shows all 3 participant rolls in the log.
3. Click 🚪 Withdraw on participant #2 (after their roll is logged).
4. **PASS:**
   - Participant #1 and #3's log rows update in place: cmod decremented
     by 1, total decremented by 1, outcome (Success/Failure/etc.)
     recomputed if the total now crosses a tier boundary.
   - Participant #2's row is removed (or marked withdrawn — confirm
     visual).
   - Chain banner shows only #1 and #3.
5. Withdraw participant #3. **PASS:** chain auto-ends when only #1
   remains.
6. Edge case: confirm WS / HI / LI / DF outcome flips actually
   recompute (try a Withdraw that should knock a Success down to a
   Failure).

### D. Heal-LI cascade → Wound Infection check (e1163fc)

Heal-LI auto-fires the patient's Wound Infection check on the
patient's client (not the medic's). Easy to break if the broadcast
pipeline regresses.

1. **[2-client]** Medic-PC logged in on client A, patient-PC on client B.
2. Medic rolls Medicine* heal on patient — force Low Insight (re-roll
   if needed; the test is the LI path).
3. **PASS:** Patient's client B opens a Wound Infection check modal
   automatically. Medic's client A does NOT.
4. Insight-die opt-out: have the medic spend an Insight Die BEFORE
   the post-resolve fires (flips LI to a higher tier). **PASS:** no
   infection cascade fires.
5. NPC patient variant: medic heals an NPC with LI. **PASS:** the
   medic's client drains the pending check via
   `pendingInfectionChecksRef` (no broadcast needed).
6. Self-heal LI. **PASS:** infection modal opens locally on the
   medic's own client.

### E. Day-0 Lasting Damage modal + Table 12 auto-apply (c4bc13b + ab5a6ae)

Canon §06 lasting-damage flow. Persists pending check across reload.

1. Drive a PC to Mortally Wounded → Down → Stabilized, OR otherwise
   trigger a Lasting Damage check on Day 0.
2. **PASS:** modal opens automatically; rolls Table 12; auto-applies
   the result to character (chip appears on CharacterCard's red strip).
3. Mid-modal: reload the page. **PASS:** the pending check resumes
   on reload (no silent loss).
4. **[2-client]** GM force-applies a Lasting Wound from NPC card to
   a PC. **PASS:** chip appears on player's CharacterCard.

---

## Priority 2 — Visible regressions, lower stakes

### F. Lasting Wounds chips on cards (6342556 + 0efa08c)

Data has been written for weeks but UI just landed.

1. PC with any lasting wound entry → CharacterCard. **PASS:** red chip
   strip between HP block and Skills, each chip names canon Table-12
   wound, hover shows effect string.
2. NPC with `lasting_wounds` jsonb entry → NpcCard. Same chip strip
   between HP and Skills.

### G. 🚨 HIDE ALL panic button on NPC roster (6342556)

Single-click cross-folder reveal-reset.

1. As GM, reveal several NPCs to players across multiple folders.
2. **[2-client]** Confirm player sees the revealed NPCs.
3. Hit 🚨 HIDE ALL.
4. **PASS:** every NPC across every folder goes hidden in one click
   (`campaign_npcs.hidden_from_players=true` + `npc_relationships.revealed=false`
   + `scene_tokens.is_visible=false`). Player's view goes blank for
   NPCs immediately.
5. Show/Hide toggle on the roster: flipping it should now also flip
   `hidden_from_players` in lockstep (not just the local UI state).

### H. Vehicle sheet redesign + MOVE HERE buttons (c6c8ad1 + 5a54773)

1. Open a vehicle sheet (popout). **PASS:** new layout, MOVE HERE
   button on every popout slot.
2. Click MOVE HERE on a passenger slot for an unseated PC.
   **PASS:** confirm-gate fires, then auto-snaps PC to the seat using
   the rotation-aware offset map (Minnie floorplan: driver right-front,
   navigator right-mid, shooter center, brewer far-left, passengers
   spread across back).
3. NPC navigator: in vehicle sheet, pick an NPC for the navigator
   seat. **PASS:** Navigate-skill picker shows PHY/DEX/RSN/INF for the
   NPC (not stuck at 0). ACU still missing on NPCs (known schema gap;
   not this testplan's scope).

### I. Pin sidebar — search + folders + route planner (88dbeb5 + 6bf1c31 + 338924a + f9ce776 + 95ce889)

1. Pin sidebar: search box filters pins by name. **PASS:** typing
   narrows the list live.
2. GM-shared folders visible in player view.
3. Route planner: enable Route mode. Click two pins.
   **PASS:** OSRM-driven road route renders A→B with ETA.
4. Alt+click a third pin while in Route mode.
   **PASS:** that pin becomes a waypoint snapped to its coords;
   route recomputes.
5. Toggle travel mode (car / foot / etc.).
   **PASS:** ETA updates without re-routing manually.
6. QuickAddModal pin picker: open the modal.
   **PASS:** uses unified `PIN_CATEGORIES` + 8-col icon grid; colors
   match canon palette.

### J. GM Notes draft persistence (2f9d41f)

1. Open GM Notes. Type into a new note (don't save).
2. Switch to another tab in the same surface (or another tab in the
   browser).
3. Come back. **PASS:** draft text is still there.
4. Reload page. **PASS:** draft persists from localStorage.

### K. Token Creator rename + Tools sidebar reorder (5e953ee + 6cb0e94 + 6549151)

1. Sidebar → Tools section. **PASS:** order is
   Moderation / Logs / Create Tokens / Character Photos / ...
2. Click "Create Tokens". **PASS:** lands at `/tools/token-creator`
   (renamed from `/tools/portrait-resizer`).

---

## Priority 3 — Backend / moderation paths

### L. Moderation email triggers (2922c72)

Thrivers receive email on bug / module / war-story / LFG / forum
moderation events.

1. As a Thriver, trigger a moderation event (approve/reject a pending
   item). **PASS:** email lands in the Thriver's inbox within ~1 min.
2. Negative test: a NON-moderation user action (creating a character)
   does NOT trigger a moderation email.

### M. Bug Report tools (1685d55 + 8a05989 + 026d65a)

1. Bug reports section → click RESPOND on a bug.
   **PASS:** modal opens for reply; submitting sends an in-app
   notification to the reporter.
2. Click Export JSON. **PASS:** downloads a JSON file of bug reports.
3. Bug icon is 🐞 (ladybug), not 🐛 (caterpillar), everywhere.

---

## Priority 4 — Drift catch-up (still HOPED-FOR)

These were shipped 2026-05-13 / 2026-05-14 and the existing testplans
cover them, but they're 3-4 days unplaytested. Cross-link from the
relevant section in the prior testplans:

- **2026-05-13 Phase 3 drainers** — campaign-clock drainers for
  ration / heal / subsistence ticks. Section in
  [polish-pass-2026-05-14-testplan.md](polish-pass-2026-05-14-testplan.md).
- **2026-05-14 batch** — Coord Effort base, Healing on time-tick,
  Year-0 calendar, Export Session Log, Weapon Repair, die3 in
  expanded log, Luxury Ration consume.

If those weren't run yet, run them in the same session.

---

## What's NOT in this testplan (explicitly)

- **Healing on GM time-tick** — design locked 2026-05-13 but **not
  yet built**. The 5 open implementation Qs are still open
  (see [spec-healing.md](spec-healing.md)).
- **Intimidation skill removal** — blocked on 4 design Qs.
- **Lv4 Skill Traits** — blocked on full list from Xero.
- **Coordinated Effort summary banner** — not built yet.

---

## After running

- Anything that PASSED → mark in this file (`✓` next to the step) or
  leave silent.
- Anything that FAILED → log a bug. Include browser, console output,
  reproduction steps. Filing a bug via the in-app bug report path is
  best because it exercises the new RESPOND/Export JSON tools too.
- Once all P1+P2 sections pass, the drift entries for
  2026-05-15/16/17 ships can be drained from the health-pulse log.
