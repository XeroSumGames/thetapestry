# Handoff - the "final test": Playwright E2E acceptance suite (2026-05-24)

Mission brief for a SEPARATE window. The puffer-fish chat continues architecture/risk work; this window builds the comprehensive E2E smoke.

## Mission
Build a **Playwright E2E acceptance suite** that walks the platform per `docs/Beginners-Guide` (+ the per-system guides), using **multi-context browsers** (GM + player + Ghost), as the durable "final test" / regression gate. The headline assertions - the whole point - are:
1. **Zero console errors + zero failed network requests** on every route (the Phase 6 payoff: prod console is now silent; this locks it).
2. **Realtime propagation**: context A (GM) acts -> assert context B (player) updates without refresh. This is what the just-finished Grand Re-Architecture was about (all realtime now on `lib/realtime/useCampaignChannel` etc).

Runs headless, in CI, separate from the 548 vitest unit tests.

## Why now
Just finished the Grand Re-Architecture: Phase 5 migrated all 6 god-components onto the `lib/data/*` + `lib/realtime/*` seams; Phase 6 drove prod console 115 -> 0 (diagnostics route through `trace()` into the recorder buffer). A manual 2-client smoke (2026-05-24, `tasks/phase7-rearch-acceptance-smoke-2026-05-23.md`) PASSED on prod. This suite turns that one-time manual pass into a permanent automated gate.

## What the manual smoke ALREADY proved (don't re-derive)
- Console SILENT on prod (`/table` load + during live combat-start + token-move). Tracking verified real.
- `trace()` telemetry lands in the recorder buffer as `{kind:'custom', data:{label, ...}}`, not console.
- Realtime combat-start + token-move (TacticalMap, the hardest seam) propagate GM->player live.
- Presence works.
- Wound-infection WARNING feed rows fire. STILL UNVERIFIED: the end-of-combat infection MODAL for a wounded PC owner (the one combat-logic thing; bake it into the combat E2E).

## Accounts + data (for Playwright `storageState`)
- **GM:** Xero - `xerosumgames@gmail.com` (user id `5806fd27-fcac-4163-b8a8-61476150962c`)
- **Player:** MARV - `tony_bushell@hotmail.com` (user id `02c22e46-acd0-44d5-b8ff-1b70e8d2fd00`)
- **Test campaign:** THE ARENA - `35ed2133-498a-43d2-bbd6-21da05233af2` (stand-alone throwaway; GM=Xero, MARV is a player). Use a DISPOSABLE campaign for any writes; seed + teardown.
- Auth: capture `storageState` per account once (Xero won't enter passwords for you - he logs in, you save the session JSON), reuse across runs. Supabase auth is client-side; the session cookie/localStorage is what storageState captures.

## Hard constraints (bright lines - the suite must NOT automate these)
- No account creation, no payments/Stripe, no deleting user-generated content, no sending messages/emails, no content-moderation actions, no bulk ops on real user data. Test only against the disposable campaign/accounts.
- Live site = `thetapestry.distemperverse.com` (no staging; prod IS the env). Prefer a disposable campaign so the suite never touches real games.
- Combat is the hardest surface: attack->roll->damage->infection->lasting-wound is stateful + random + multi-modal. Use deterministic DOM/role selectors and handle outcome branches. (This is where the end-of-combat infection-modal check lives.)

## Technical approach
- **Playwright** (`npm i -D @playwright/test`, `npx playwright install`), `playwright.config.ts`, specs in `e2e/`. Add `"test:e2e": "playwright test"` (keep `"test": "vitest run"` separate - do NOT merge; CI runs both).
- **Multi-context**: one `browser.newContext({ storageState })` per role (GM/player/Ghost) in the same test; act in one, `expect(...).toPass()`/`toBeVisible()` in the other. This is Playwright's native strength and the reason it beats Claude coordinate-driving the Chrome extension (deterministic, repeatable, headless, CI).
- **Selectors**: role/text/test-id, NOT pixel coordinates. The tactical map is a `<canvas>` - token drag/assert needs a DOM hook or a JS-eval bridge; may need adding `data-testid`s to a few spots (small app edits, behavior-preserving).
- **Console/network asserts**: `page.on('console', ...)` collect errors; `page.on('requestfailed'/'response', ...)` collect non-2xx; assert empty per route. This is the cheapest, highest-value layer - do it FIRST across every route.
- **Scenario source**: `docs/Beginners-Guide`, `docs/beginners-guide.txt`, `docs/communities-guide.txt`, `docs/module-system-guide.txt`, `docs/tactical-map-guide.txt`, `docs/user-guide.txt`, and the manual scenario list in `tasks/phase7-rearch-acceptance-smoke-2026-05-23.md`.

## Suggested first slice (highest value, lowest fragility)
1. Install Playwright + config; capture both `storageState`s (Xero logs in -> save).
2. **Console-error + failed-network sweep** across every route (dashboard, /map, /rules, /stories, a /table, /vehicle popout, communities, /rumors, /moderate). Asserts the Phase 6 silence is permanent. Fast, robust, catches regressions broadly.
3. **One realtime propagation spec**: GM context moves a token / starts combat -> player context asserts the update (the thing we did by hand). Add `data-testid`s as needed.
4. Grow combat / communities / vehicle / map from there, guided by the Beginners-Guide.

## Project specifics
- **This is NOT the Next.js you know** - read `node_modules/next/dist/docs/` before framework code. See `AGENTS.md` + `CLAUDE.md`.
- Backend: Supabase. Seed/inspect via `npx supabase db query --linked -f sql/<file>.sql`.
- Don't break the existing gates: `npx tsc --noEmit`, `npm test` (548 vitest), `node scripts/check-arch.mjs` (the seam/LOC/console ratchets - `.from` 1039 / `.channel` 22 / console 0), font/role/em-dash/preview-sync, `npm run arch:depcruise`. E2E is additive.

## Working dir + git
- `C:\TheTapestry` (main checkout). Worktree pattern: `.claude/worktrees/<name>` on `claude/<name>` for non-trivial work.
- Push to main (Vercel deploy = dev env; no staging). Claude does ALL git/merge/push end-to-end, never asks. After a worktree push, pull into the main checkout.

## Hard rules (project-wide)
No em-dashes/en-dashes anywhere (ASCII hyphen only). 13px min inline fontSize (banned combo 13px+#3a3a3a -> use #cce0f5). Never capital-case role literals (use isThriver/THRIVER from lib/auth/roles). Capture lessons+todo in the same response as any ship. Testplans named by topic (e.g. `tasks/<topic>testplan.md`). Ask clarifying Qs inline in chat, never the AskUserQuestion modal.

## Current state
HEAD `74c66d6` (derive: `git rev-parse --short HEAD`). 548 vitest green; arch ratchets green; Phase 5 + Phase 6 (console) complete + smoke-validated on prod. No Playwright in the repo yet (greenfield).

---

## Cross-lane note (puffer-fish, 2026-05-24) - append-only, coordinate don't clobber

Added by the puffer-fish lane while you were mid-build. Pointers only; your specs + fixtures stay yours.

- **Scenario source upgrade.** There is now a unified manual acceptance sheet: **`tasks/phase7-acceptance-2client-testplan.md`** (Sections A-F, with PASS conditions derived from each surface's actual seam wiring - vehicle/NpcRoster/community-stockpile/MapView channel names + handlers). Use it alongside `phase7-rearch-acceptance-smoke-2026-05-23.md` as your scenario source - it is the structured per-surface checklist your specs automate, and it maps 1:1 to your two headline assertions.
- **Fixture overlap (the durable fix for "fixtures only live in a real campaign").** Sections B (vehicle) + D (community/stockpile) need fixtures that today exist ONLY in the live Minnie campaign. Data model so you can seed them into THE ARENA + tear down: a **vehicle** is an entry in `campaigns.vehicles` JSONB (managed via the tactical map / the `update_vehicle_in_campaign` SECURITY DEFINER RPC, not a `vehicles` table); a **community** is a `communities` row + `community_stockpile_items` rows (the `stockpile-${campaignId}-{communityIds}` sub uses an IN-filter, so seed >=1 community with >=1 stockpile item). Highest-value seed: one named vehicle + 1 mounted weapon, one community + 1 stockpile item. Programmatic seeding here is the long-term answer to the manual sheet's "vehicle only in Minnie" blocker.
- **Automation map (from the Risk view) - where to spend effort.** Cleanest/lowest-flake (do first): the console/network sweep (all routes) + DOM-propagation across contexts (NPC reveal, stockpile deposit, the community-create resubscribe, map pins + whispers). Needs small app edits: canvas token-move (Sections B + A3) wants `data-testid` hooks or a JS-eval bridge to read token positions. Most fragile, do last: combat math (the CMod itemization in A2 - random dice + modal branches + feed-text parsing) and the end-of-combat infection modal (Section F).
- **Risk Register tie-in.** Realtime channels is **YELLOW** (`tasks/debug-handoff.md` Sec 1) post-re-arch; this suite (and/or the manual sheet) is its demote-gate. When your propagation specs go green across vehicle/community/map, that is the evidence to demote.
- **Coordination channel** is the shared substrate (this note, `tasks/todo.md`, commits) - no direct messaging between lanes. Your "Current state" above now lags disk (the scaffold exists: `e2e/console-network.spec.ts`, `_fixtures.ts`, `_console.ts`, `playwright.config.ts`) - refresh it when you next touch this file.

### Cross-lane note (puffer-fish, 2026-05-23) - this suite is now on the CRITICAL PATH

The architecture work beyond the re-arch is planned: `tasks/architecture-path.md` (staged plan) + `tasks/architecture-test-strategy.md` (how this suite gates each stage). Two things that change your priorities:

1. **You unblock Gate 0 (Phase 7 close).** Because Playwright multi-context can SEED the vehicle + community fixtures into THE ARENA, Section B (vehicle) no longer waits for the 2026-05-25 Minnie playtest - the whole A-F acceptance can close on automation. Fixture seeding (vehicle = `campaigns.vehicles` JSONB via the `update_vehicle_in_campaign` RPC; community = `communities` row + `community_stockpile_items` rows) is the highest-value next piece. See the strategy doc's "Gate 0 build order."
2. **After Gate 0, you become the regression net for Stages A/B/C.** Behavior-preserving is the new posture (playtesters are live); your green run is what makes "behavior-preserving" a checked fact, not an assertion. Stage B will need a new conditions spec (apply/clear/expire/Restore/no-stacking, 2-client); Stage C re-runs the full suite per migrated component. The strategy doc's gate map has the details.

Net: finishing the A-F suite + Arena seeding is the gate the entire forward plan waits on. It leads, it does not trail.
