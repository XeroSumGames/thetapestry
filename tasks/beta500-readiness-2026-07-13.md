# Beta-500 Readiness - precise task list (2026-07-13)

Scope: stability + functionality ONLY (no infra tiers, no legal). "Ready" =
500 strangers can play the core loop without hitting a correctness bug, losing
data, or finding an unguarded door. Every item below is verified OPEN against
code/docs as of `8bd9c44d`; sources: stability-audit-2026-07-09.md,
beta-readiness-roadmap-2026-07-10.md, the 2026-07-13 playtest.

Sizes: S = under an hour, M = a focused session, L = multi-session.

---

## GATE 1 - PROVE the shipped batch (needs Xero, 2 browsers; blocks everything)

~15 core-loop fixes from 2026-07-13 ride on unit tests only. Until these two
runs pass, "stable" is unproven.

- [ ] **1.1 (M)** Run `tasks/full-smoke-testplan-2026-07-13.xlsx` (2 windows).
      Covers: realtime trio (pins sidebar / roster / live damage), attacker
      damage+ammo, reroll-replaces, upkeep, sickness stress, loadout canon,
      no-infinite-reload, fire-spends-ammo.
- [ ] **1.2 (M)** Run `tasks/mechanics-verify-consolidated-testplan-2026-07-06.md`
      - the ~8 owed mechanics verifies. Drains the 3 chronic health-pulse
      HOPED-FOR items (FI Insight Die award `lib/useRollResolution.ts:264`,
      Stress Check 12-string narratives, vehicle popout broadcasts).
- [ ] **1.3 (S)** E2E full re-cert (`npm run test:e2e` against prod) after
      Gate 2 lands; update tasks/e2e-results.html in place. (E2E lane.)

## GATE 2 - Last combat-correctness holes (code; all specced)

- [ ] **2.1 (M) H4 Cover Fire is a no-op that costs an action.** Spec in
      roadmap: new `initiative_order.incoming_cmod` column (live migration +
      baseline mirror + types), Cover Fire writes -2 + spends a round of ammo
      (Xero ruled yes to both), `computeAttackCmod` adds the labeled term,
      cleared at the target's turn END (not activation). `page.tsx:4574`,
      `lib/table-roll-context.ts:240`.
- [ ] **2.2 (M) H10 Rest/Travel multiply the world clock by party size.**
      Xero ruling: "moving time affects everyone." Redesign: one party-rest
      advances the clock ONCE and recovers all party PCs (drainers already
      handle rations/infection globally). `CharacterCard.tsx:1293` (Rest),
      `:680` (Travel).
- [ ] **2.3 (S) M7 mortal/incap transition uses stale local state.**
      `useRollResolution.ts` ~:655/:689 - the "was previously >0" compare
      reads `targetEntry.liveState` while damage math uses freshState; a
      cross-client window misses or double-fires the countdown + stress.
      Compare against freshState.
- [ ] **2.4 (S) M8 two contradictory Env-Damage buttons.**
      `CharacterCard.tsx:531` vs `:619` - opposite Drowning math (flat
      rounds*3 with no hold-breath window vs canon `drowningDamage`).
      Collapse to ONE canon button; restores the locked button-order too.
- [ ] **2.5 (S) M4 applyDamageToPc/Npc announce deaths the DB rejected.**
      `lib/data/combat.ts:52` - check the write result BEFORE emitting the
      mortal-wound feed row / returning the optimistic patch.

## GATE 3 - Item/point economy integrity (nothing may vanish or dupe)

- [ ] **3.1 (M) H12 give-to-NPC/community/vehicle can destroy items.**
      `InventoryPanel.tsx:171` - receiver write is fire-and-forget, giver
      decremented unconditionally. Build an atomic RPC per PC->PC's
      `give_item_to_character` precedent (Puffer builds SQL, wires the 3 paths).
- [ ] **3.2 (S) H11 CDP deduct-then-apply, no rollback.**
      `CharacterEvolution.tsx:221` - a failed raise write eats the CDP.
      Apply-then-deduct, or refund on the catch.
- [ ] **3.3 (M) M11 barter half-applies + Dire Failure re-rolls free.**
      `page.tsx:10849` PC write commits before target write with no rollback
      (dupe+loss); `TradeNegotiationModal.tsx:365` allows unlimited re-rolls
      until success. Atomic trade RPC + disable re-roll after a Dire.
- [ ] **3.4 (S) M5 campaign clock non-atomic read-modify-write.**
      `lib/campaign-clock.ts:56` - two concurrent advances lose one bump AND
      double-run the drainers (2x rations/infection). Compare-and-set
      (`.eq` on the old clock value, retry on 0 rows) or a tiny RPC.

## GATE 4 - Communities flagship correctness

- [ ] **4.1 (S) M1 a successful Retention Check cancels the morale departures
      it must preserve** + writes `members_after: 0` for a community that kept
      everyone. `CommunityMoraleModal.tsx:405,438,548`.
- [ ] **4.2 (S) M2 Retention Check drops every CMod slot except Mood**,
      contradicting its own spec comment. `CommunityMoraleModal.tsx:463`.
- [ ] **4.3 (S) M3 recruit "Current group" default inline-creates a NEW group
      every recruit** (party fragments into duplicate one-member groups; the
      2026-06-12 ship changed the label, not the semantics). `page.tsx:3970` -
      default must RESOLVE to the roller's existing group when one exists.
- [ ] **4.4 (S) L6 a founding leader who leaves keeps the leader seat**
      (Clear Voice CMod wrong forever after). `CampaignCommunity.tsx:1456` -
      departure check matches `invited_by_user_id`, which founder rows never set.

## GATE 5 - Strangers-proofing (500 unknown users, app-layer doors)

- [ ] **5.1 (S) H16 token-creator Bulk Upload has NO Thriver gate** and
      `portrait_bank` INSERT RLS does not backstop - any signed-in user can
      inject images into the shared portrait pool every campaign browses.
      `app/tools/token-creator/page.tsx:618` + `handleBulkUploadAll:567`.
- [ ] **5.2 (S) M15 stuck-observer joins.** An existing observer re-joining
      via a normal invite stays invisible forever. `app/stories/join/page.tsx:56`
      (23505 branch never clears the flag) + `app/join/[code]/page.tsx:45`
      (never touches it).
- [ ] **5.3 (S) M16 pin/community attachment uploads bypass prepareUpload** -
      no size cap, no MIME whitelist, raw filename in the path.
      `QuickAddModal.tsx:267,374`.
- [ ] **5.4 (M) M14 initiative-channel broadcasts are fully trusted.** Any
      authenticated user with the campaign UUID can broadcast `player_kicked`
      (force-redirect players off the table), `recorder_stop`, `logs_cleared`,
      or spam `turn_advance_requested`. Add a sender/GM check in the handlers
      (payload sender + membership/GM validation), `page.tsx:191-214`.
- [ ] **5.5 (S) M17 module publish / GM-kit export silently truncate at
      PostgREST's 1000-row cap.** `lib/modules.ts:686` + `lib/gm-kit.ts:62` -
      paginate with `.range()` loops. At 500 users someone WILL publish a big
      campaign and ship a truncated module.

## GATE 6 - First-session functional polish (what a stranger hits in hour one)

- [ ] **6.1 (S) Combat-path browser alert()s -> in-app toasts.** At minimum the
      table-page combat gates (broken-weapon attack `page.tsx:~5994`, out-of-
      ammo/out-of-throws siblings, session-kick alerts at `:187/:194`). The
      other ~330 sites can wait; these fire mid-fight.
- [x] **6.2 SHIPPED 2026-07-13 (`58943ba9`).** NpcCard weapon chips show an amber loaded/clip (+N clips) readout; the Attack button gates on an empty clip (EMPTY, disabled). Also answers smoke 10: the NPC's Attack IS the sword button on its card.
- [ ] **6.3 (M) T3-6 jargon tooltips** (CDP / RAPID / AMod / SMod / CMod) on
      first-encounter surfaces - sheet + roll modal.
- [ ] **6.4 (S) David Battersby pregen bio** - Chased-era backstory shipping in
      the pre-Chased EMPTY setting. Needs Xero's corrected text; apply via
      UPDATE + mirror `sql/seed-official-pregens.sql`.
- [ ] **6.5 (M) Recorder observability spec** (`tasks/spec-recorder-observability.md`,
      already written): network/RPC failure capture + state snapshots. Not a
      player feature - it is how 500 users' bug reports become diagnosable
      instead of "clicked it, nothing happened."

---

## Sequence (fastest path to "open the doors")

1. **Gate 1.1 + 1.2 NOW** (Xero, ~90 min at 2 browsers) - proves the base.
2. **Gate 2** (one focused session) -> combat loop correctness-complete.
3. **Gate 5** (one focused session) - small items, closes every stranger door.
4. **Gate 3 + 4** (1-2 sessions; the two RPCs are the only real weight).
5. **Gate 6** while Gates 3/4 verify; **Gate 1.3** E2E re-cert last.
6. Final: one full playtest evening with 3-4 real players on the release build.

PROGRESS 2026-07-13 (post-smoke): Gate 1.1 RUN by Xero - realtime trio VERIFIED,
PC ammo canon verified; owed re-verify: reroll (11), NPC-side ammo spend (10a,
now visible), stress pip (14b), firing arc (20). Fixed from the run: reloads
retune 1d6->1d3 (`c079466f`), NPC ammo display + empty gate (`58943ba9`),
PHY-check alerts -> in-card notice (`e6e10cec`). Open question to Xero: smoke
14a "no PHY check" is likely the LOCKED Dire-Failure='auto' canon (2026-05-09),
not a bug - awaiting his confirm or canon change.

Everything here is file:line-precise; any lane can pick any box up cold.
