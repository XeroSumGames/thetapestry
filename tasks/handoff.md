# Tapestry Handoff — 2026-04-30 close-out

Single-file picture of where things stand at end of session for the next clean chat to pick up.

---

## Where we are

**Communities flagship is 95% complete.** Phase E closed out fully this session — World Event CMod propagation, player subscriptions polish, "Start near existing community" wizard, and the Apprentice creation rewrite (Profession-based, with SRD per-skill cap + age + 3 trait words). Two remaining Phase E items are externally blocked:
- Per-community Campfire feed → blocked on Phase 4 Campfire (now scoped — see below).
- Lv4 Skill Trait auto-bonuses → locked on the all-or-nothing Trait list landing.

**Inventory system queue is closed.** All 5 items shipped: encumbrance time-tick, PC↔NPC trade, vehicle cargo unification (with vehicle enc cap tracking), shared community stockpile, Barter trade negotiation. Plus the InventoryItem shape is now the single source of truth across PCs / NPCs / vehicles / community stockpiles.

**Phase 4 (Campfire) was scoped today.** Major reframe: 85% of Campfire is already built (Forums A + B preview, War Stories, LFG, Timestamp tool, hub routing). The actual remaining work is cross-scope plumbing.

---

## What shipped this session (one line each)

Communities Phase E:
- World Event CMod propagation — `map_pins.cmod_*` columns + Weekly Morale slot with per-event opt-out
- Player subscriptions polish — denormalized count + ★ chip + subscriber-notify trigger + auto-status from Morale outcome
- "Start near existing community" wizard — fourth tile on /stories/new
- Apprentice creation rewrite — Profession-based (12 PROFESSIONS, +1 CDP per skill), 5-step wizard with age + 3 trait words

Inventory:
- Encumbrance time-tick (GM Tools → Time, -1 RP per hour overencumbered)
- PC ↔ NPC trade (give modal lists 👤 PCs / 🎭 NPCs / 🏘 communities)
- Vehicle cargo unification (InventoryItem shape, `cargoTotal/cap` Enc display)
- Community stockpile (`community_stockpile_items` table, 📦 section under Role Coverage, deposit via give modal)
- Barter negotiation (single-roll opposed check, rarity-weighted fairness gauge, two-way item move on Apply Deal)

Map / scene:
- Cell PX persistence (`tactical_scenes.cell_px` hydrated on popout open with scene-id-keyed guard)
- Grid settings persistence (`show_grid` / `grid_color` / `grid_opacity` columns + same hydration pattern)
- Cell PX min dropped 20 → 5
- GM Screen drag + resize + lock (with 8th GM Notes panel, ssr:false to avoid SSR Supabase failure)
- Map Setup popout reuse-map dropdown (lists every uploaded map across all the GM's campaigns)
- Delete Map / Delete Scene confirms moved to in-app modal
- Pin category icon picker on campaign pins (shared lib/pin-categories.ts)
- 🌍 → 🗺️ button toggle in tactical mode (drops a token_type='pin' minimal-emoji marker)
- Tactical X removes only this pin's markers (not the campaign pin)
- New `scene_tokens.campaign_pin_id` for the pin marker linkage

Other:
- Comic reader popout (`/reader-popout?pin=<id>` with single/spread/fit toggles, slider, keyboard nav)
- /rumors All-settings filter → Sort By
- /stories/new — Custom Setting moves Starting Location above Module picker
- Paradigm Pick → Step 4 (Final Review)
- Mode-aware sidebar tab default (Pins for campaign, NPCs for tactical)
- NPC roster MAP/UNMAP per-folder button (places markers without revealing)
- Paradigms intro text width fix (drops the 780px cap)

---

## Phase 4 — Campfire (NEXT MAJOR WORK)

**Scoped today; ready to start. Full plan in [tasks/todo.md](todo.md) under "🚀 Phase 4 — Campfire". Memory: `project_phase_4_campfire.md`.**

The 85% that's already built (audit at /campfire):
- Forums (Discourse-style threads + a Reddit-style "Forums B" preview)
- War Stories (cross-campaign feed with attachments)
- LFG (GM/Player bulletin board with interest roster + invite-via-DM)
- Timestamp tool (Discord `<t:UNIX:f>` generator)
- Hub routing

The 15% that's actually Phase 4:

| Phase | Item | Size | Notes |
|---|---|---|---|
| 4A | Per-setting feed layer | 2-3 days | foundational, do first |
| 4B | Promotion + moderation flow | 2 days | depends on 4A |
| 4C | Setting hubs (DZ + Kings Crossroads only) | 2-3 days | depends on 4A + 4B |
| 4D | Per-community Campfire feed | 1 day | closes spec-communities §2; can interleave |
| 4E | Polish wave (pagination, FTS, reactions, threading, notif UI, inline tokens, formal invites, LFG filters) | 1-2 days each | opportunistic |

**Locked design decisions (do not re-litigate without Xero):**
1. Forums design parked — both A and B disliked, no rework yet
2. Thriver approval ONLY when content leaves the GM's group (campaign-internal = no review)
3. Setting hubs = DZ + Kings Crossroads only (other settings deferred)
4. Community feed = ship auto-posts first, parse back if noisy
5. Default scope on new posts = campaign-private

**Explicit non-goals:** Forum redesign, hubs for Mongrels/Chased/Custom/Arena, Homebrew tab, user profiles/reputation.

---

## Inventory followups (left in queue, all small)

- Apprentice CDP transfer — master PC's earned CDP can flow to Apprentice
- PC ↔ Vehicle item transfer
- Withdrawal-to-PC on community stockpile (today GM removes + manually adds)
- Realtime sub on `community_stockpile_items`
- Multi-round haggling (Barter currently single-roll)
- Barter Lv4 cheat-doubling (locked behind Lv4 Trait list)
- Auto-relationship-penalty on Dire/Low Insight Barter outcome

---

## Active backlog (not blocked, ready to pick up)

Recent friction items in [tasks/todo.md §"🎯 From 2026-04-29 chat"](todo.md):
- Empty-adventure module clone fails on null pin name
- Gut Instinct results presentation rework
- First Impression → straight to roll modal
- Modal unification across Stress / Breaking Point / Lasting Wound / Recruit / Stabilize / Distract / Coordinate / Group / Gut Instinct / First Impression

Mongrels playtest backlog (§"🎯 From 2026-04-27"):
- Initiative lag investigation
- Hide-NPCs reveal UX streamlining
- King's Crossing Mall tactical scenes + handouts
- `/tools/reseed-campaign?id=…` for re-seeding existing campaigns

Big features still on the spec but unstarted:
- **Modules System Phase A** ([tasks/spec-modules.md](spec-modules.md)) — entire MVP unbuilt: publish wizard + tables + clone-on-campaign-create. Supersedes GM Kit v1.
- **Doors / Line of sight / Dynamic lighting** on tactical maps — separate big lifts.
- **CDP Calculator** at `/characters/[id]/evolve`.
- **"What They Have" overhaul** — character creation step needs all weapon families (Heavy / Demolitions / Explosives currently missing).

---

## Backburner (don't touch unless specific trigger)

- **Campaign calendar** — deferred. Triggers: forgetting Skip Week → frozen community for 4+ sessions, world events that should've ended still applying, wanting "X days passed" auto-consumption, encumbrance tick wanting auto-fire.
- **Thriver godmode UI sweep** — DB-side done; UI sweep pending (widen `isGM &&` → `(isGM || isThriver) &&` across admin affordances).

---

## Tooling state

- **All SQL migrations applied** (user confirmed earlier in session).
- **Worktree clean.** `claude/nervous-cohen-894724` is up to date with `origin/main`.
- **Primary worktree** at `C:/TheTapestry` synced via `git -C C:/TheTapestry pull origin main` after every push (per memory feedback_working_directory).
- **No outstanding test plans needing user verification.** All 2026-04-30 features have test plans in `tasks/`.

---

## Memory rules in play (quick checklist for the incoming chat)

- Carlito font default (Barlow Condensed killed 2026-04-29)
- Min inline fontSize = 13px (guardrail at `scripts/check-font-sizes.mjs`)
- Header buttons = 28px height, use `hdrBtn()` helper
- Carlito + `#cce0f5` as the safe text-on-dark combo (NEVER `#3a3a3a`)
- Push to live, test on live (Vercel = dev env, user is only real user)
- After every push from worktree, `git -C C:/TheTapestry pull origin main`
- User does NO git ops — Claude does ALL of them end-to-end
- Don't ask "want to break?" — user finds it patronizing
- Long-term fix > quick fix; surface latent bugs even when off-request
- Communities flagship = treat Phase E items as priority
- Lv4 Skill Traits ship together or not at all — don't piecemeal

---

## Suggested first move for the next chat

Start **Phase 4A (per-setting feed layer)**. It's the foundational primitive — 4B / 4C / 4D all need the `setting` discriminator. Single migration + compose UX changes on three feed surfaces (forum_threads, war_stories, lfg_posts). ~2-3 days estimate.

If Xero pivots, the next-best targets are:
- **Modules MVP Phase A** — biggest greenfield content engine, single coherent feature
- **Modal unification** — chips away at the "every roll modal looks slightly different" friction
- **"What They Have" overhaul** — closes a recurring complaint about character creation
