# E2E Systems Coverage - the comprehensive acceptance plan (2026-05-24)

Goal (Xero): automated tests that confirm the status of **as many rules and
systems as possible**, across the 4 accounts, **excluding the most fragile**,
with minimal human input. This plan is the blueprint; it grows the Playwright
suite (`e2e/`, `npm run test:e2e`) tier by tier on top of the Layer-1 console
sweep already shipping.

Source of truth for "how the game plays": `docs/beginners-guide.txt` (12
chapters) + the per-system guides (`communities-guide`, `module-system-guide`,
`tactical-map-guide`, `user-guide`).

---

## 1. The dividing line (what E2E does vs does NOT assert)

The 548 vitest unit tests already lock the **math/canon** (roll outcomes,
damage/DM/Stun, morale slots, encumbrance, CDP ladders, infection rules, etc.).
E2E must NOT re-assert dice numbers - rolls are random and that's vitest's job.

**E2E owns three things the unit tests can't reach:**
1. **Flow** - the multi-step UI actually completes (wizard saves, modal closes, button enables).
2. **Realtime propagation** - actor A acts -> contexts B/C/D update without refresh (the re-arch payoff).
3. **Persistence** - the change survived a reload / shows for another account (DB write landed).

Plus the standing **Layer-1 guarantee** on every route: zero console errors, zero in-scope failed requests (already shipping).

So combat is tested as "start -> attack -> a result lands in the log -> actions decrement -> nextTurn advances -> end combat" (flow + state + propagation), NOT "the d6 showed 4."

---

## 2. Accounts + data strategy

| Key | Who | Tier (assumed) | Use |
|---|---|---|---|
| `gm` | Xero | Thriver (admin) | GM of every test story; Thriver-only surfaces (moderation, instant pins, publish approval); the acting side of realtime. |
| `marv` | Marv (P1) | (unconfirmed) | Primary player context for 1->1 realtime + the wounded-PC owner. |
| `pesky` | Pesky Larue (P2) | (unconfirmed) | Fan-out target (GM acts -> all players see). |
| `percy` | Percy Bent (P3) | (unconfirmed) | Fan-out + 3-player combat. |

**Write policy (prod is the only env):**
- **Ephemeral test story per write-run.** Most write tests spin up a throwaway story (GM creates it, players join by code), exercise it, then **tear down via DB** (`npx supabase db query` deleting only rows the run created, keyed by a unique run tag). THE ARENA stays the stable read/realtime fixture; the suite never mutates real games.
- **Public-content writes get an `[E2E]` marker + teardown.** Campfire forum threads, war stories, LFG posts, world-map pins, and LISTED modules are publicly visible. Tests that create them title them `[E2E <runid>]`, keep them PRIVATE/unlisted where the system allows, and delete them in teardown. If reliable teardown isn't possible for a surface, that surface is read-only-tested (see exclusions).
- **No deletes of pre-existing content.** Teardown only removes run-created rows. Destructive UI delete buttons are exercised only against data the same test just created.

---

## 3. Fragility policy

### EXCLUDED - never automated (bright lines or no-win)
- Account signup / login automation (Turnstile + passwords; sessions are human-captured).
- Payments / Stripe / subscriptions.
- Email/password change on `/account` (sends real email / can lock the account out).
- Sending real messages/emails to **real** users; any all-user broadcast.
- Moderation **actions** at scale (ban, suspend, lock, hide, make-Thriver) - reputational/legal. (We DO read the moderation queue and assert pins land in it.)
- Deleting pre-existing user content; bulk ops on real data.
- `/campfire/forums2` voting - self-labeled "experimental, session-only".

### DEFERRED - needs a behavior-preserving hook first (then promoted)
- **TacticalMap `<canvas>`** token drag / fog / doors / ping. Pixel coords are fragile. Plan: add a tiny **JS-eval bridge** (a `window.__tacticalTestApi` exposing token grid positions + a `moveToken(id, gx, gy)` that routes through the SAME handler a drag does) OR `data-testid` position attributes. Until then, token-move is asserted via the realtime broadcast + `scene_tokens` DB row, not pixel position.

### INCLUDED - the bulk (see matrix). Random outcomes asserted as flow/state, not numbers.

---

## 4. Per-system test matrix

Legend - **RT** = has realtime to assert across contexts. **Hooks** = app edits needed (all behavior-preserving). Tier = build order.

### A. Navigation + roles + presence  (Tier 1, STABLE)
- Sidebar nav renders per role; Thriver sees Tools, Survivor doesn't (role-gated visibility - the casing-bug class).
- Presence: GM + 3 players online -> "Survivors present: 4" (RT). **Hooks:** none.

### B. Character creation + sheet  (Tier 1-2, MODAL)
- Random Character: 1 click -> lands on edit page -> appears in `/characters`.
- Quick Character: 6-step, spend CDP pool, save -> appears in list.
- Paradigm: pick archetype -> final review -> save.
- Backstory wizard: walk all 10 steps (concept -> equipment) -> save. (Longer; Tier 2.)
- Sheet trackers: click WP/RP/Stress -> value persists on reload. **Hooks:** maybe `data-testid` on the WP/RP/Stress trackers.

### C. Story lifecycle + join  (Tier 1, MODAL, RT)
- GM creates a story (Custom setting) -> appears in My Stories -> gets invite code.
- Player joins via code -> appears on GM roster live (RT) + GM gets a notification.
- Player leaves -> drops off roster (RT). Teardown deletes the story.

### D. The Table + sessions  (Tier 1-2, MODAL, RT)
- GM Start Session -> session badge increments -> players notified (RT) -> dice enabled.
- Chat: GM types a message -> shows in players' log (RT).
- End Session modal (summary/cliffhanger) -> shows in `/stories/<id>/sessions`.

### E. Combat / initiative / rolls  (Tier 2, RANDOM -> flow only, RT) - HARDEST
- Start Combat (pick NPCs) -> initiative bar populates on GM + all players (RT, "IN COMBAT").
- Attack -> Roll modal -> a result row lands in the log -> actor actions 2->1->0 -> auto nextTurn.
- Damage applies: target WP/RP changes and **propagates** to the owner's context (RT; `npc_damaged` / character-state).
- **End-of-combat wound-infection MODAL** fires for the wounded PC's owner (the known-flaky one; lock it once puffer-fish's fix lands). **Hooks:** `data-testid` on initiative entries, the roll-result row, the infection modal.

### F. Tactical map  (Tier 3, CANVAS - DEFERRED until bridge)
- GM moves a token -> players see it move (RT) - via the JS-eval bridge + `scene_tokens` row.
- Scene activate / share / zoom / ping / door-open propagate (RT). **Hooks:** the `__tacticalTestApi` bridge.

### G. NPC roster  (Tier 2, MODAL, RT)
- Create NPC (modal) / Generate NPC / Clone (+ auto-numbered) / Edit / Delete (own test NPC).
- Reveal -> player sees it; Hide -> it disappears (RT).
- Apply damage from the table -> roster WP/RP updates live (RT). **Hooks:** `data-testid` on NPC cards + show/hide.

### H. Communities  (Tier 2, MODAL, RT) - flagship
- Create community (Group state) -> add PC + NPC members -> role assignment (Gatherer/Maintainer/Safety).
- Run Weekly Check: GM overrides the morale slots (deterministic given overrides) -> Fed/Clothed/Morale resolve -> history updates. (Slots are GM-set, so assertable beyond the random roll.)
- Stockpile deposit/withdraw -> the other client's open panel updates (RT, `stockpile-${id}` sub).
- Dashboard `/stories/<id>/community` renders history. **Hooks:** `data-testid` on the weekly-check modal + stockpile rows.

### I. Recruitment + apprentices  (Tier 2, MODAL, RANDOM->flow)
- Recruit modal: Cohort/Convert flow completes; Conscript shows the credible-threat gate (blocking confirm) - assert the gate appears (deterministic), not the roll.

### J. Inventory + items + trade  (Tier 2, MODAL, RT)
- Add item from catalog / custom item -> encumbrance recomputes -> persists.
- Trade between two PCs (two contexts) -> item moves, both sides update (RT). **Hooks:** `data-testid` on inventory rows.

### K. World map + pins  (Tier 1-2, STABLE-ish, RT)
- GM drops a campaign pin on the test story -> appears for a player after reveal (RT, `map_pins`).
- Survivor drops a world pin -> lands in the moderation queue as Rumor (assert queue, don't approve).
- Whisper post -> shows for another context (RT). (Leaflet is DOM, not canvas - clickable, but pin-drop uses lat/lng; use the pin form, not map pixels.)

### L. Vehicle popout  (Tier 3, MODAL, RT) - puffer-fish owns current bugs
- Crew board/disembark -> tactical tokens update (RT). Show Arc -> cone toggles (RT). (Currently FAILING per the 2026-05-24 smoke; build the net once fixed.)

### M. Modules / Rumors  (Tier 1-2, STABLE)
- Browse + filter + sort (read).
- Publish a PRIVATE module from the test story -> appears in the create-story "start from module" list -> create a story from it (clone) -> content lands. Teardown removes both.

### N. Campfire social  (Tier 1, STABLE)
- New forum thread ([E2E] marked) -> appears in list -> reply -> teardown.
- LFG post -> "I'm Interested" from another context.
- War story post (if migration present; else assert the banner).
- **Thriver auto-approve:** a Thriver-authored post skips pending; a Survivor's doesn't (role behavior).

### O. Messages  (Tier 1, STABLE, RT)
- GM -> Marv DM: message shows in Marv's context live (RT). Teardown archives/deletes the convo (own data).

### P. Account / settings  (Tier 1, STABLE)
- Username + avatar change persist. (Email/password change EXCLUDED.)
- Settings toggles persist.

### Q. Moderation queue (read)  (Tier 1, STABLE)
- Thriver sees the queue; a submitted world pin appears as pending. (No approve/reject actions.)

---

## 5. Build sequencing

1. **Tier 1 (now-ish, low fragility, mostly zero new hooks):** A nav/presence, C story+join, N campfire, O messages, P account, M rumors browse, K pin-to-queue, Q moderation read. These prove most systems "alive + persistent + (where applicable) realtime" with minimal hooks.
2. **Tier 2 (the core value):** B character creation, D sessions, E combat flow+propagation, G NPC roster, H communities, I recruitment, J inventory, M publish->clone. Adds a handful of `data-testid`s (listed below).
3. **Tier 3 (after hooks/fixes):** F tactical map (needs the canvas bridge), L vehicle (after puffer-fish's fixes), E's infection modal (after the fix).

---

## 6. Hooks to add (all behavior-preserving, additive `data-testid` / one JS-eval bridge)

I'll add these incrementally, verify each via the suite + the gate set, and keep them minimal:
- `TacticalMap`: a `window.__tacticalTestApi` (read token grid positions; `moveToken` routing through the existing move handler). The one non-trivial hook; it's a god-component under the LOC ratchet, so it ships as its own verified commit.
- `data-testid` on: initiative entries + roll-result log row + infection modal (E); NPC cards + show/hide (G); weekly-check modal + stockpile rows (H); inventory rows (J); WP/RP/Stress trackers (B).

None change behavior; all are within the LOC grace band (verified per commit).

---

## 7. What I need from you (minimal)

1. **Capture the 3 player sessions** (you already did `gm`):
   `node e2e/capture-auth.mjs marv` then `pesky` then `percy`.
2. **One yes/no:** OK for the suite to **create-and-teardown throwaway data on prod** (a test story, test NPCs, `[E2E]`-marked forum/LFG posts, a private module) using the 4 accounts, cleaning up via DB after each run? (No real content is ever touched; teardown only removes run-created rows.) This is the only thing that unblocks the write-heavy tiers.
3. **FYI not a blocker:** the data-testid additions above are mine to make; I'll commit them verified. If any account among marv/pesky/percy is a **Ghost-tier** account, tell me which - it lets me cover the role-gated-visibility bug class; if none, I'll note that as a gap.

Everything else I drive autonomously: build tier by tier, run against prod with the captured sessions, self-verify (deploy-poll + re-run), report results, capture lessons/todo.

## 8. CI
E2E stays a separate, on-demand/pre-ship gate (not bolted to the fast push gate). Full-CI automation is still gated on the secrets/Turnstile decision in `tasks/todo.md`.
