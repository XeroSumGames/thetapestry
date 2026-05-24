# Architecture-Path Test Strategy - what Playwright gates, stage by stage

**Companion to:** `tasks/architecture-path.md` (the staged plan) + `tasks/e2e-final-test-handoff-2026-05-24.md` (the Playwright suite brief) + `tasks/phase7-acceptance-2client-testplan.md` (the A-F scenario sheet the suite automates).

**The thesis:** the Playwright suite is not a side-track or a "do it at the end" item. It is the **gate that lets every architecture stage move safely.** The new risk posture is behavior-preserving + validated-per-slice (playtesters are live; break-things-OK is over). "Validated" for a realtime app means a 2-client smoke - which no unit test can do. So the suite is on the critical path: it must mature ahead of Stage C, not after.

**The unlock (why this is happening now):** moving the 2-client smoke from "Xero + two browser windows" to Playwright multi-context **takes Gate 0 off the calendar.** The suite can programmatically SEED the vehicle + community fixtures into THE ARENA, so Section B (vehicle) no longer has to wait for the 2026-05-25 Minnie playtest. Phase 7 can close on automation.

---

## Division of labor (two lanes)

- **Puffer-fish chat (here):** owns the architecture work - writes the migrations (Stage A), the conditions subsystem (Stage B), the client-state layer (Stage C). Defines the acceptance criteria each stage must meet.
- **Playwright chat (the hand-off target):** owns the suite - builds + runs the multi-context specs that PROVE each stage is behavior-preserving. Reports green/red back through the shared substrate (commits, todo.md, the Phase 7 results block).

Coordination is append-only docs + commits, never direct messaging. This doc is the contract between the two.

---

## The gate map

| Arch stage | What must be proven | Playwright coverage | Stays manual / out of scope |
|---|---|---|---|
| **Gate 0 - close Phase 7** | the 6 migrated god-components are behavior-preserving across 2 clients | **the whole job right now:** console/network sweep (all routes) + propagation Sections C/D/E + seeded Section B + combat A2/A3 + infection modal F | combat dice math (A2) is the most fragile; acceptable to assert outcome-class not exact dice |
| **Stage A - infra/typed** | no behavior change; migrations capture live state | **regression only:** existing suite stays green after each migration + typed-payload refactor. No new specs needed | the migration dry-runs themselves (SQL, puffer-fish) |
| **Stage B - conditions** | infection/lasting-wound/stress/MW unify with no behavior change | a dedicated **conditions spec**: apply each condition -> chip appears on both clients; clock expiry clears it; Restore wipes the whole set; no-stacking gate holds | GM canon-judgement calls |
| **Stage C - client-state** | each component migration is behavior-preserving | **the regression net:** re-run the full suite per migrated component (must stay green); the PILOT component (MapView/vehicle) gets its propagation spec re-pointed at the new state layer to prove parity | the table page migrates last, under the most coverage |
| **Stage D - test pyramid** | this IS the build-out | seam-contract tests (repo shape, channel payload) + the golden combat-path E2E + the always-on console sweep | - |

**Reading the table:** Gate 0 is the entire near-term Playwright mission. Stages A/B/C then lean on the suite as a regression net - the same specs, re-run, must stay green as each behavior-preserving change lands. Stage D is the suite itself maturing (contract tests + golden path) so it is a real pyramid, not just an E2E cap.

---

## Gate 0 - the near-term Playwright mission (detailed)

This is what the hand-off asks the Playwright chat to finish. Current scaffold (verified on disk): `playwright.config.ts`, `e2e/_fixtures.ts`, `e2e/_console.ts`, `e2e/auth.setup.ts`, `e2e/console-network.spec.ts`, `e2e/role-nav.spec.ts`, 4 captured auth states (gm/marv/pesky/percy). So console-sweep + role-nav are underway; the realtime + combat + seeding work is the gap.

**Build order (highest value / lowest flake first):**

1. **Arena fixture seeding + teardown** (the unlock). A vehicle is an entry in `campaigns.vehicles` JSONB (via the `update_vehicle_in_campaign` SECURITY DEFINER RPC, not a `vehicles` table); a community is a `communities` row + `community_stockpile_items` rows (the `stockpile-${campaignId}-{communityIds}` sub uses an IN-filter, so seed >=1 community with >=1 item). Highest-value seed: one named vehicle + 1 mounted weapon, one community + 1 stockpile item. Seed via `npx supabase db query --linked` or the RPC; tear down after. This is what lets Section B run in the Arena instead of waiting for Minnie.
2. **Propagation Sections C / D / E** (Playwright's strength - cross-context DOM assertions): NPC reveal (C), stockpile deposit + the community-create resubscribe (D, the highest-value step - the dynamic IN-filter resubscribe is most likely to regress), map pins + whispers (E). GM context acts -> player context asserts within ~2s, no reload, no resubscription console spam.
3. **`data-testid` hooks for canvas token-move** (Sections B + A3). The tactical map is a `<canvas>`; token position needs a DOM hook or a JS-eval bridge. Small, behavior-preserving app edits - but they touch the table page / TacticalMap, which are under the LOC ratchet, so verify `node scripts/check-arch.mjs` stays green and put render logic in components, not inline.
4. **Combat A2 + infection modal F** (most fragile, last). Random dice + modal branches + feed-text parsing. Assert outcome-CLASS and the itemized-CMod breakdown structure rather than exact dice. F is the end-of-combat infection modal on the wounded PC owner's window - the one combat-logic thing still unverified.

**Gate 0 is CLOSED when:** all of Section A-F pass headless in the suite (or are explicitly logged as manual-only with rationale), the console/network sweep is green on every route, and the run is repeatable. That is the evidence to demote Realtime YELLOW -> GREEN and promote the re-arch HOPED-FOR -> PLAYTESTED.

---

## Hard constraints the suite must honor (bright lines)

- **Prod is the only env.** All writes go against THE ARENA (`35ed2133-498a-43d2-bbd6-21da05233af2`) + the disposable accounts. NEVER touch a real campaign (Minnie is real).
- **No** account creation, payments/Stripe, deleting user-generated content, sending messages/emails, content-moderation actions, or bulk ops on real user data.
- **Passwords are never automated.** Xero captures `storageState` once via `node e2e/capture-auth.mjs <key>`; the suite reuses the gitignored session JSON.
- **Be a polite guest on prod:** capped concurrency (already set in the config), seed/teardown around fixture writes.
- **Don't break the existing gates:** the suite is additive. `npx tsc --noEmit`, `npm test` (548 vitest), `node scripts/check-arch.mjs`, font/role/em-dash/preview-sync, depcruise all stay green. Any `data-testid` app edits are behavior-preserving and ratchet-clean.

---

## Forward gates (so the Playwright chat knows the full arc)

When Gate 0 closes, the suite does not stop - it becomes the per-stage regression net:
- **Stage A landings** (infra migrations, typed payloads): re-run the full suite; it must stay green (these are no-behavior-change by construction, so a red is a real regression).
- **Stage B** (conditions): puffer-fish ships the unified model; the Playwright chat adds the conditions spec above and proves apply/clear/expire/Restore/no-stacking across 2 clients.
- **Stage C** (client-state): each migrated component must keep the suite green; the pilot component's propagation spec is re-pointed at the new state layer to prove parity before the table page migrates.

The suite is the thing that makes "behavior-preserving" a checked fact instead of an assertion. That is why it leads.
