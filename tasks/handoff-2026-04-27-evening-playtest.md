# Session Handoff — 2026-04-27 evening (Mongrels playtest, live-session sprint)

Shareable summary of the evening playtest sprint. Paste this into the parent chat to bring it up to speed.

## TL;DR
- **17 commits shipped to main during a live Mongrels playtest** — log-trim narrative pass, banner countdown fix, on-entry stress rule, Warren-bug, popout skill clicks, Distract/Coordinate dead-target filter, Stress Check log + GM-only Cancel, plus 13 fresh playtest items batch-parked into `tasks/todo.md`.
- **One game-design rule codified to memory**: "On-entry Stress pip for mortal/incap" (`memory/project_stress_on_mortal_incap.md`).
- **One scheduled remote agent** queued for **2026-04-30T16:00:00Z** (Thursday 10am MT) to sweep three combat-correctness bugs: routine `trig_01DgrfRt5ymUuU4fUf2jzq8N`.
- **Worktree**: `C:\TheTapestry\.claude\worktrees\dreamy-grothendieck-499c52` on branch `claude/dreamy-grothendieck-499c52` tracking main.

## What shipped tonight (oldest → newest)

| SHA | Subject |
|---|---|
| `a412fe4` | fix(log): attack one-liner shows Successfully/Unsuccessfully |
| `7a44cae` | docs(todo): park stale realtime subscription bug (GrumpyBattersby) |
| `c7dc1d0` | fix(popout): wire skill / weapon clicks from character sheet popout |
| `8113574` | feat(log): call out 3d6 Insight Die spend in extended roll card |
| `2336bd4` | feat(rules): on-entry Stress pip for mortal-wound or incap |
| `bf65ada` | docs(todo): park player-side loot from NPC popout |
| `1e10d6f` | fix(combat): incap recovery no longer un-mortal-wounds (Warren bug) |
| `1e5be82` | fix(combat): hide dead/mortal targets from Distract/Coordinate pickers + trim social-action log lines (rebased over two parallel-session commits `078c95b`, `990cbce`) |
| `5624c44` | fix(log): Unarmed compact line shows Successfully/Unsuccessfully |
| `3fde62f` | fix(banner): mortally wounded countdown now ticks per round |
| `74bcb16` | fix(log): Stabilize compact line shows Successfully/Unsuccessfully |
| `aef1bf8` | feat(stress-check): cancel button on the at-max prompt |
| `11df989` | fix: Stress Check log entry + tighter mortal/incap stress phrasing + gate at-max Cancel to GM only |
| `b70f5de` | docs(todo): batch-park 13 items from 2026-04-27 Mongrels playtest |

(Two commits also landed from a parallel Claude session — `078c95b` Perception/Gut Instinct list-self-only, `990cbce` narrative-check sentence wording. My 1e5be82 was rebased on top of both; no conflicts.)

## Headline rule changes
- **On-entry Stress pip for mortal/incap** — any character entering WP=0 (mortally wounded) OR RP=0 (incap) auto-fills 1 Stress pip (cap 5). Mortal preempts incap when both transitions fire on the same hit. Patched 6 PC damage paths (executeRoll main, insight-save decline, splash AoE, reroll, upkeep break, unjam break). Removed the old end-of-combat sweep — the on-entry mechanism replaces it. Memory: `memory/project_stress_on_mortal_incap.md`.
- **Warren bug fix** (incap recovery no longer un-mortal-wounds) — when a character has BOTH `death_countdown` AND `incap_rounds` running, the incap-expiry branch was silently bumping WP=0 → 1 even if the mortal countdown was still ticking. Now guarded against active death_countdown for both PC and NPC paths. ⚠ The 2026-04-30 scheduled agent will verify this guard isn't now wrongly blocking *legitimate* stabilized recovery (Cree didn't revive after Stabilize tonight; needs investigation).

## 13 new playtest items parked in `tasks/todo.md`
All under the new "From 2026-04-27 Mongrels playtest" section at the top of `tasks/todo.md`. Five buckets:

**Combat correctness** (5):
1. 🤖 Distract didn't decrement next-round actions on Cree (silent RLS suspected; needs `.select()` + broadcast + maybe `sql/initiative-order-rls-fix.sql`)
2. 🤖 Stabilize should always consume an action (verify the `actionPreConsumedRef` flow)
3. 🤖 Post-Stabilize state — Cree didn't revive (verify Warren-fix guard not blocking, audit Stabilize success branch)
4. Stabilize button only picks one wounded target (need filter + picker)
5. Initiative lag — Xero will solo-repro before action

**Permissions** (1):
6. Hide NPCs from players on Start Combat — full roster currently leaks via realtime to player clients

**Rules / mechanics** (2):
7. Crossbow + bow need reload between shots
8. Weapon DB SRD audit — Club missing, full diff against XSE SRD v1.1.17 needed

**UX** (3):
9. Streamline mission login flow
10. Drag-to-bottom-left blocked by popup (likely the locked notification panel — fix is `pointer-events: none` during drag, NOT moving the panel; position is locked per memory)
11. Map pinging too clunky (consider explicit Ping toolbar button)

**Long-term map features** (3):
12. Dynamic lighting
13. Doors
14. Line of sight

Items 1–3 (🤖) are queued for the **scheduled sweep**. Don't grab them manually unless something blocks playtest before Thursday.

## Older parked items still live
- NPC inventory: primary/secondary weapons not counting toward encumbrance
- Player-side loot Search Remains button on NPC popout (~150-line feature designed)
- Insight Die spend tracked on `roll_log` (current detection ~83%, needs schema column for 100%)
- Stale realtime subscriptions (the GrumpyBattersby tab-backgrounding bug — proposed `visibilitychange` listener fix)
- SRD wording sweep, King's Crossing Mall content, etc.

See full list at `tasks/todo.md`.

## Mid-playtest diagnostic threads still open

- **Cree / Basil "no damage" reports** — Scout Voss attacks rolled hits with damage calc shown in log, but PCs took no damage. Hypothesis: when newWP would be 0 AND target has Insight Dice > 0, the insight-save modal fires for the PLAYER's tab and waits on their decision before applying WP. If the player's tab has the stale-realtime bug, they never see the modal — damage stays unapplied indefinitely. Diagnostic checklist: GM's DevTools console for `[damage] PC target ... WP: X → 0` lines + any `SILENT RLS FAIL` warnings. Ask if Basil's/Cree's player saw an Insight Save popup.
- **GrumpyBattersby's stale tab** — captured in todo as a real bug; visibilitychange + channel-rebuild fix designed but not shipped (too risky mid-session).

## Memory updates this session
- New: `memory/project_stress_on_mortal_incap.md` (the on-entry Stress rule)
- MEMORY.md updated with the index entry

## Next steps for Xero
1. **Solo lag repro** — confirm whether the perceived initiative lag from tonight is real or playtest-jitters. If real, file a bug with details (combatant count, network conditions). The scheduled sweep won't touch this.
2. **Verify Cree's revival timeline** — confirm whether the post-Stabilize agent finds a real bug or whether Cree's failure to revive was a player-side display lag. The scheduled agent will report back either way.
3. **Decide on hide-NPCs flag** — should there be a global "reveal to players" boolean on `campaign_npcs`, or per-instance reveal events? Affects Start Combat picker, NPC roster visibility, asset panel.
4. **Weapon DB audit** — when motivated, run the SRD diff. `pdftotext docs/Rules/'XSE SRD v1.1.17 (Small).pdf'` per CLAUDE.md, compare against `lib/weapons.ts`.

## How to share with the parent chat
This file lives at `tasks/handoff-2026-04-27-evening-playtest.md`. Paste the TL;DR + commit table + the 13-item bucket counts. The parent chat already has the same git history once `git pull` runs.
