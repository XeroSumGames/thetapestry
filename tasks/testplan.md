# Pre-Playtest Smoke Check — Mon 2026-04-27

15 minutes, run after Vercel finishes deploying commit `73ea4cf` (or later). Verifies that everything shipped on 2026-04-26 still works on the live site before the table session.

If anything fails: ping me with the symptom and I'll patch tonight.

## 0. Prerequisites
- [ ] Wait ~60s after the last push for Vercel to deploy
- [ ] Hard-refresh the live site (`Ctrl+Shift+R`) to clear any cached assets — especially relevant for the new Minnie floorplan
- [ ] Open the Mongrels campaign as GM, jump to a tactical scene with at least one PC + one NPC token

---

## 1. Tactical map pan (commit 73ea4cf + earlier)
The big one. If pan is still twitchy after this, it needs a deeper fix.

- [ ] **Mouse drag pan** — click on an empty cell and drag. Should be smooth all the way through, even when the cursor briefly leaves the canvas (over the sidebar / scrollbar / browser chrome). No more freeze-and-resume judder.
- [ ] **Spacebar + drag** — hold spacebar, cursor changes to grab, drag works the same way (and works even if you mousedown on top of a token).
- [ ] **Arrow keys / WASD** — press and hold an arrow key (or W/A/S/D). Map should pan at a steady 60fps as long as the key is held. Diagonal pan with two keys held works.
- [ ] **Tab away mid-pan** — alt-tab to another window, come back. Pan should not still be running in the background.

## 2. Grenade / Molotov throw (commits 96a974a, 331571d, b61f4ba)
- [ ] Equip a Grenade on a PC (was bumped from Close → Medium = 100ft throw range).
- [ ] Click Attack → enter throw mode. Confirm range highlight extends ~33 cells out (100ft / 3ft per cell).
- [ ] Hover over a candidate cell — confirm **three Blast Radius bands** show (red Engaged ≤ 5ft, amber Close ≤ 30ft, faint amber Far ≤ 100ft) around the cursor cell.
- [ ] Pick a cell where another PC is in radius. Confirm the **friendly-fire confirm dialog** lists them by name + band before the throw fires. Cancel keeps you in throw mode.
- [ ] Pick a cell close enough to **yourself** that you'd be in the blast — confirm dialog now lists you with a `(YOU)` tag.
- [ ] After throwing, confirm the roll modal shows the **who-will-be-hit list** instead of `Cell (17, 14)` coords.
- [ ] On a successful hit, confirm the thrower's WP/RP went down if they were in radius (was previously buggy — splash skipped the attacker).

## 3. Minnie's vehicle popout (commit a45cecc + new floorplan)
- [ ] Open Minnie's vehicle popout (from any campaign that has her).
- [ ] Confirm the **new hand-drawn floorplan** is showing (the one with Shower / Wardrobe / Bed / Sofa-Bed / Dinette / Overhead Bed / Step Well labels).
- [ ] Click the floorplan image → confirm it enlarges to ~95vw/95vh in a black backdrop.
- [ ] Click outside the image → confirm it closes.
- [ ] Confirm Minnie's mounted weapon shows **M60 (Mounted)** (not Sniper's Rifle) — also should be in cargo line.

## 4. Vehicle Move button (commit bfc3a96)
- [ ] Place Minnie's vehicle token on the tactical map (object token).
- [ ] As GM, click the vehicle token → ObjectCard opens. Confirm a green **Move** button appears next to Close.
- [ ] Click Move → modal closes, map shows Move highlight. Click a valid cell within 10ft. Vehicle moves there.
- [ ] As a player listed in `controlled_by_character_ids` (a driver), confirm the Move button also appears for them.
- [ ] As a player NOT in the list, confirm the Move button is absent.
- [ ] Vehicle moves do NOT consume any combatant's action.

## 5. Inventory + Loot (commits earlier this session)
- [ ] Open an NPC card → click 🎒 → InventoryPanel opens with the NPC's gear.
- [ ] Add a stackable item (qty 3 of Hunting Knife) → click **Give** → confirm the qty picker shows `−`/`+`/[All] and defaults to **3** (full stack) for normal items.
- [ ] Add a Grenade to inventory → click **Give** → confirm qty picker defaults to **1** (single-use explosive).
- [ ] Pick a recipient PC, confirm the transfer + the receiver's bell shows `inventory_received` notification (assumes `notify_inventory_received` SQL has been run).
- [ ] Open a PC's character sheet → Ready Weapon → confirm:
  - **Equip from Inventory** section shows any inventory weapon with **→ 1°** and **→ 2°** buttons (PC) or just **READY →** (NPC)
  - Primary slot has **Unequip** button (PC only) when filled
  - Secondary slot has **Unequip** button (PC only) when filled
  - Switch / Reload / Unjam still work as before, auto-close modal

## 6. Log feed compact lines (commits b52a6c6, f13fdfa, 331571d)
After any combat round with mixed actions:
- [ ] Attack rows render as compact one-liners ("X used <weapon> to Attack Y") at **15px** body text.
- [ ] Grapple resolves to **"X grapples Y"** / **"X fails to grapple Y"** / **"X unsuccessfully attempts to grapple Y"** depending on opposed-roll outcome.
- [ ] Upkeep resolves to **"X tunes up <weapon>"** (success) / **"X maintains <weapon>"** / **"X fails upkeep — <weapon> degrades"** / **"X breaks <weapon> during upkeep"**.
- [ ] Coordinate ally bonuses now show **one** combined line ("🎯 X, Y, Z get +N CMod when attacking T") instead of one row per ally.
- [ ] Combat Started / Combat Ended banners render at **15px** body text.
- [ ] ▸ expand still reveals the dice breakdown for any compact row.

## 7. Kick player flow (commit 05bc59a)
- [ ] As GM, open another player's character sheet → click **Kick**.
- [ ] Confirm only **one** prompt appears (`Remove <name> from this session?`) — the duplicate "Remove from this campaign?" is gone.

## 8. NPC roster + popout (#20 verification)
- [ ] As a player (NOT GM), open an NPC's full card.
- [ ] Confirm it shows portrait, name, type badge, status (active/unconscious/etc.), recruit chip, First Impression CMod — and **nothing else**.
- [ ] Confirm RAPID stats, skills, weapon name, HP pip dots are all hidden from the player view.

---

## Bonus: SQL migrations check
If any of these have not been run in the live Supabase:
- [ ] `sql/notify-inventory-received.sql` — gates the cross-user inventory-receive notification
- [ ] `sql/campaigns-last-accessed.sql` — gates the My Stories chronological sort
- [ ] `sql/patch-minnie-m60.sql` — backfills already-seeded Mongrels campaigns to the M60 weapon

If anything in section 5 (notification) or 3 (M60 weapon) doesn't behave as expected, those SQL files are the likely culprits.

---

## During the playtest itself
Keep an eye out for the two parked items so we can fix after:
- **#1 damage math** — if `2+2d6 (6) = 8 raw` doesn't apply correctly, screenshot the log row's full breakdown
- **#2 failed-check action burn** — if a player rolls a Failure on a skill check and still has 2 actions left, screenshot + tell me which character / which skill
