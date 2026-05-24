# E2E Full-Suite Build Plan - "test every system" (2026-05-24)

The ordered build plan to take the Playwright suite from the Gate-0 critical-path
subset (~12 green items) to the widest honest coverage of the 14-chapter
Beginners-Guide. This is the *how/in-what-order* companion to the two *what* docs:
- `tasks/beginners-guide-testplan.md` - chapter-by-chapter coverage map (the checklist).
- `tasks/e2e-systems-coverage-testplan-2026-05-24.md` - engineering-lens matrix (systems A-Q + reconciliation).

Cross-reference tags below: **[Ch N.M]** = guide chapter item; **[Sys X]** = systems-matrix letter.

---

## The honest coverage ceiling (read first)

"Test every system end-to-end" is NOT fully reachable headlessly. Three buckets
can never be a green headless assertion, by policy or by physics:

**A. PERMANENTLY EXCLUDED (bright lines / no-win) - will never be automated:**
- Account signup / login automation beyond the soft-Turnstile auto-login already in place.
- Payments / Stripe / subscriptions.
- Email or password change on `/account` (sends real email / can lock the account out).
- Sending real messages/emails to REAL users; any all-user broadcast.
- Moderation ACTIONS at scale (ban/suspend/lock/hide/make-Thriver). We DO read the queue and assert a pin lands in it; we never action it.
- Deleting pre-existing user content; bulk ops on real data.
- `/campfire/forums2` voting (self-labelled experimental, session-only).
- Exact dice values - the 548 vitest unit tests own the math; E2E asserts flow/outcome-class only.

**B. DEFERRED until one behavior-preserving hook lands (then promoted to green):**
- Everything on the tactical `<canvas>`: token drag, fog paint/erase, travelling
  vision circle, doors, ping, range circles. Needs `window.__tacticalTestApi`
  (read token grid pos + `moveToken(id,gx,gy)` routed through the SAME handler a
  drag uses). One non-trivial additive hook; TacticalMap is a god-component under
  the LOC ratchet, so the hook ships as its own verified commit.

**C. DICE-GATED - stays MANUAL until a deterministic GM-damage hook exists:**
- Combat attack-roll outcome + CMod breakdown (A2), mortal-wound Insight trade,
  end-combat infection modal (F). The apply-logic only fires behind a random
  attack; we can assert it manually (the locked phase7 2-client smoke) but not
  deterministically headless without a "GM sets damage = N" path.

Everything else - the DOM flows, the realtime propagation, the persistence
checks - IS buildable. That is the prize, and it is large.

---

## Decision needed from Xero (ONE gate unblocks Phase 1-2)

Gate 0 only ever *seeded reversibly into The Arena* (revealed an existing NPC,
deposited into an existing community, restored on teardown). The broader suite
needs to **create-and-teardown throwaway top-level content on prod**:

- A throwaway **story** (GM creates, players join by code, exercised, then
  DB-deleted by run tag).
- `[E2E <runid>]`-marked **public posts** (forum thread, LFG, war story) kept
  private/unlisted where the system allows, deleted in teardown.
- A **private module** published from the throwaway story, cloned, both removed.

Policy guardrails (from the systems doc, section 2): throwaway data only; unique
run tag; teardown removes ONLY run-created rows; never touch pre-existing
content; The Arena stays the stable read/realtime fixture. No bright line is
crossed (no signup, payments, email, real-user contact, or real-content delete).

**The ask:** OK to create-and-teardown throwaway stories + `[E2E]`-marked
posts/modules on prod under those guardrails? Yes unblocks Phases 1-2 below.
(If no: those specs fall back to read-only assertions, a real coverage loss.)

---

## Build order

Each spec follows the proven shape: skip-guard via `canAuth()`; per-account
`browser.newContext({ storageState: AUTH.<key> })`; mutate via the acting
account's own Supabase REST session; assert RT by rendered text OR a
`waitForResponse(GET /rest/v1/<table>)` refetch; restore/delete in `finally`.
Run in the main checkout (`npm run test:e2e`), commit via an isolated worktree
off origin/main (the shared-checkout procedure in the handoff).

### PHASE 1 - Tier 1: foundational journeys + read surfaces (low fragility, ~0 new hooks)

| # | Spec file | Asserts | Tags | RT? | Needs decision? |
|---|---|---|---|---|---|
| 1 | `story-lifecycle.spec.ts` | GM creates throwaway story -> invite code; player joins by code -> GM roster updates live + GM notified; player leaves -> drops off; DB teardown deletes story | [Ch6.1-6.3][Sys C] | yes | YES (throwaway story) |
| 2 | `messages-dm.spec.ts` | GM -> Marv DM shows in Marv's context live; teardown deletes the convo (own data) | [Sys O] | yes | minor (own convo) |
| 3 | `campfire-social.spec.ts` | forum thread `[E2E]` + reply; LFG post + "I'm Interested" from another context; war-story Thriver auto-approve vs Survivor pending; teardown | [Ch13.2-13.4][Sys N] | no | YES (public posts) |
| 4 | `presence.spec.ts` | GM + N players online -> "Survivors present: N"; Thriver hover-list shows who | [Ch1.3][Sys A] | yes | no |
| 5 | `world-pin-to-queue.spec.ts` | Survivor drops a world pin -> lands in moderation queue as Rumor (assert queued, do NOT approve); Thriver world pin goes live immediately | [Ch2.1-2.2][Sys K/Q] | yes | minor (own pin, no action) |
| 6 | `rules-deeplinks.spec.ts` | 8 sections + 4 appendices reachable; deep links `/rules/combat`, `/rules/appendix-tables`, `/rules/equipment/item-traits` render | [Ch5.2][Sys R] | no | no |
| 7 | `account-settings.spec.ts` | username + avatar change persist on reload; a settings toggle persists (email/pw EXCLUDED) | [Ch (P)] | no | no |

### PHASE 2 - Tier 2: the core game systems (adds a few additive `data-testid`s)

| # | Spec file | Asserts | Tags | RT? | Hook |
|---|---|---|---|---|---|
| 8 | `character-create-methods.spec.ts` | Quick (6-step) saves + lists; Paradigm pick -> review -> save; Backstory wizard (10 steps) -> save; WP/RP/Stress click -> persists on reload | [Ch4.2-4.5][Sys B] | no | testid on trackers |
| 9 | `session-lifecycle.spec.ts` | Start Session -> counter increments + players notified + dice enabled; chat GM->players; End Session modal -> shows in `/sessions` | [Ch7.1-7.3][Sys D] | yes | none |
| 10 | `combat-flow.spec.ts` | Start Combat -> initiative bar on GM + all players ("IN COMBAT"); attack -> roll modal -> a result row lands -> actions 2->1->0 -> auto nextTurn; damage propagates to owner; CMod itemized terms | [Ch9.1-9.4][Sys E] | yes | testid on initiative + roll row |
| 11 | `npc-roster-crud.spec.ts` | create/generate/clone(+auto-number)/edit/delete own NPC; apply damage -> roster WP/RP live; Populate 1A:2F:3G:4B; publish to World Library; Conscript credible-threat gate; Apprentice unlocks ONLY on double-6 | [Ch10.1,10.3-10.6][Sys G/I] | yes | testid on NPC cards |
| 12 | `communities-lifecycle.spec.ts` | create community + 13-member chip (green/amber/red); add/remove members + role assign (Gatherer/Maintainer/Safety); Weekly Check w/ GM slot overrides -> Fed/Clothed/Morale resolve + history; Re-balance/Skip/Retention | [Ch12.1-12.3,12.7][Sys H] | partial | testid on weekly-check modal |
| 13 | `inventory-trade.spec.ts` | add catalog item + custom item -> encumbrance recomputes -> persists; trade PC<->PC across two contexts -> both update live | [Sys J] | yes | testid on inventory rows |
| 14 | `rumors-publish-clone.spec.ts` | publish a PRIVATE module from the throwaway story -> appears in start-from-module list -> clone -> content lands; version "update available" + "Your clone" chip + diff; teardown both | [Ch14.2-14.4][Sys M] | no | YES (publish/clone) |

### PHASE 3 - Tier 3: gated on the canvas bridge / a damage hook (the honestly-hard set)

| # | Item | Asserts | Tags | Blocked on |
|---|---|---|---|---|
| 15 | `__tacticalTestApi` bridge (own commit) | additive read-token-pos + `moveToken` through existing handler | infra | - |
| 16 | `tactical-token-move.spec.ts` | GM moves token -> player's map moves; `scene_tokens` row + RT broadcast | [Ch8.2][Sys F] | #15 |
| 17 | `fog-of-war.spec.ts` | paint/rect/erase + Fog All/Clear All persist across reload; 6-cell travelling vision circle respects walls(block)/doors(pass) | [Ch8.3-8.4][Sys F] | #15 |
| 18 | `tactical-propagate.spec.ts` | scene activate/share/zoom/ping/door-open propagate; range circles Engaged 5ft/Move 9ft/Weapon | [Ch8.5-8.6][Sys F] | #15 |
| 19 | `vehicle-popout.spec.ts` | seat assign + 30ft gate + MOVE HERE; board/disembark + aboard badge; Show Arc cone; fuel install/transfer/refill; Gather Materials -> brew banner; shared cargo PC<->vehicle | [Ch11][Sys L][Gate0 B] | #15 + puffer-fish vehicle fixes |
| 20 | `combat-infection.spec.ts` | mortal wound -> +1 Stress + Insight trade; End Combat -> infection modal on wounded owner | [Ch9.6-9.7][Gate0 A2/F] | deterministic GM-damage hook |

---

## Teardown discipline (non-negotiable)

- Every write spec carries a unique `runId` (e.g. `[E2E ${Date.now().toString(36)}]`).
- Reversible-where-possible (capture original -> restore), delete-only-what-we-created otherwise.
- Teardown in `finally` so a mid-test failure still cleans up.
- The Arena's pre-existing rows are read/restored, never deleted.
- Pre-flight a teardown dry-count before any DELETE that could match >1 row.

## Verification per spec

- Green headless on prod via `npm run test:e2e` (auto-login mints sessions first).
- New `data-testid`s: verify the four gates (tsc, font-sizes, role-literals, em-dashes) + the unit suite stay green; each hook is behavior-preserving and within the LOC grace band.
- Capture lessons + todo in the SAME commit as each ship (no "want me to add this?").
- Update `tasks/beginners-guide-testplan.md` status flags as each item goes green.

## Effort shape (honest, not a quote)

- Phase 1: 7 specs, mostly DOM + a couple RT, no app hooks. The fastest coverage win.
- Phase 2: 7 specs + ~5 small `data-testid` additions. The bulk of the game's value.
- Phase 3: 1 infra hook commit + 5 specs; the hardest, partly gated on another lane and on a damage hook. Some of this stays MANUAL (documented, not green) by design.

Net: Phases 1-2 (14 specs) take coverage from ~12 green items to the large
majority of DOM + realtime systems. Phase 3 closes the canvas/vehicle/infection
gap as far as it can go; the dice-gated remainder stays the documented manual
smoke.
