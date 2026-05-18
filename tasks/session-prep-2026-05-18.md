# Session Prep — 2026-05-18

What's new at the table since your last playtest. Skim 5 min before kickoff.

---

## Behavioral changes (you might mistake these for bugs if you forget)

### Vehicles
- **Passengers VANISH inside the vehicle.** Their tokens disappear from
  the canvas; a count badge ("2", "3") rides on the vehicle token. This
  is correct — not a bug, not a desync.
- **One-click DISEMBARK** drops the PC adjacent to the vehicle.
- **Drag Minnie by any cell.** Grab her by center / corner / wherever —
  her top-left stays offset under your cursor. No more "she jumped past
  where I dropped her."
- **NPC navigator picker** shows PHY / DEX / RSN / INF correctly now
  (was stuck at 0). ACU still missing on NPCs — known schema gap, not
  fixed this cycle.
- **MOVE HERE button** on every popout slot in the vehicle sheet —
  auto-snaps PC to seat with rotation-aware offset (driver right-front,
  navigator right-mid, shooter center, brewer far-left).

### Healing
- **Heal-LI auto-fires the Wound Infection check** on the PATIENT'S
  client, not the medic's. If you (as GM) heal a player and nothing
  pops on your screen, that's correct — the modal opened on their
  side. Watch their screen, not yours.
- **Self-heal LI opens locally** (medic = patient).
- **Insight-die opt-out works pre-cascade.** If the medic spends an
  Insight Die to flip the outcome before post-resolve fires, no
  infection cascade.

### Combat / canon
- **Day-0 Lasting Damage modal auto-fires** when a PC enters Mortally
  Wounded → Down → Stabilized. Don't dismiss it. Auto-rolls Table 12,
  auto-applies the chip to the CharacterCard. Reload-safe (pending
  check persists).
- **Lasting Wound chips on cards** — both PC (CharacterCard) and NPC
  (NpcCard) show a red chip strip between HP and Skills. Hover for the
  effect string. Data has been writing for weeks; UI just caught up.
- **Coordinated Effort Withdraw chip** — every active participant gets
  a 🚪 Withdraw chip on the chain banner. Withdrawing fires a full
  retcon (Option B): every other participant's logged roll gets
  cmod -1, total -1, outcome recomputed if it crosses a tier. Chain
  auto-ends when only one remains.

### GM tools / surfaces
- **🚨 HIDE ALL panic button** on the NPC roster toolbar, next to the
  Show/Hide toggle. One click hides every NPC across every folder
  (`hidden_from_players=true` + `revealed=false` + `is_visible=false`).
  Use it if you need to nuke NPC visibility fast.
- **Show/Hide toggle flips RLS** in lockstep now (not just local UI).
- **GM Notes draft persists** across tab switches + page reloads
  (localStorage). Type freely, never lose it again.
- **Sidebar Tools section** is now: Moderation / Logs / Create Tokens
  / Character Photos / ... ("Create Tokens" was "Resize Portraits".)

### Map / pins
- **Pin sidebar search box** at the top — type to filter pins live.
- **Route planner** (in Route mode): click 2 pins for an OSRM-driven
  road route + ETA. Alt+click a third pin to add it as a waypoint.
  Travel-mode toggle (car / foot) recomputes ETA without re-routing.
- **QuickAddModal pin picker** is unified to canon `PIN_CATEGORIES`
  with an 8-col icon grid + canon colors.
- **"World Pin" folder is now "A Timeline of the Dog Flu"** —
  cosmetic rename only, DB value `world_event` unchanged.

### Moderation
- **Email triggers** fire to Thrivers on every moderation event (bugs,
  modules, war stories, LFG, forum).
- **Bug Reports** has RESPOND (reply to reporter via in-app notif) +
  Export JSON.
- **Bug icon is 🐞** (ladybug) everywhere, was 🐛 (caterpillar).

---

## Things you should NOT see during the session

If you see any of these, file a bug right away — these were validated
in the smoke test, so they're regressions:

- Minnie jumping past your cursor on drag-release
- Ghost PC tokens left behind when a vehicle moves
- Coordinated Effort chain rows NOT updating their cmod when someone
  withdraws
- Heal-LI medic-side popup (should be patient-side)
- Day-0 Lasting Damage modal failing to fire / failing to persist
  through reload
- Sentry pipeline dark (run a test in DevTools if suspicious — F12 →
  Network → filter `monitoring` → should see 200 OK responses)

---

## Sentry status

Pipeline verified alive 2026-05-18 (tunnel returns 200 OK, SDK loaded,
config clean). If something throws unexpectedly during the session,
it should land in https://xero-sum-games.sentry.io/issues — check
there post-session for anything you didn't notice live.

---

## Stand-down

Don't ship anything from now until post-playtest. SRE rule: no
load-bearing changes inside the playtest window. If a player reports
something mid-session, capture it via bug report — don't try to fix
it live.
