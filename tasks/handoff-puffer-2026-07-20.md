# Puffer Fish handoff - 2026-07-20

State at write time: **on `main`, clean, HEAD `2a232ff6`, 924 unit tests green**,
all gates (tsc / arch / font / role / em-dash) green. Derive every fact below
from git/disk before acting - treat this as hypothesis.

## Who you are
Puffer Fish lane: architecture / risk / audit / security / SQL / observability /
operating docs. Read CLAUDE.md + AGENTS.md + tasks/operating-mode.md, then this.
North star: TheTapestry stable/polished/fun for the 9/1 Kickstarter; Beta-500
proves it. You are the ADVISOR - set direction, drive, validate the path, never
ask "what's next".

## Bright lines (confirm intent, then I do it)
- Live SQL migrations / `supabase db query --linked -f` / edge-function deploy:
  confirm INTENT with Xero, then I run the CLI + verify in pg_proc. I apply, not Xero.
- No infra/tier-upgrade recommendations unless something is BROKEN.
- ASCII hyphens only (no en/em dash) in code, docs, chat.
- Every change ships straight to `main` (Vercel = live). Push from a worktree, then pull into the main checkout.
- Checklists / testplans / smoke tests are delivered as **.xlsx** (A:Item | B:desc | C:pass/fail | D:notes), not just markdown. Build with openpyxl.

## Locked canon set this session (do NOT re-fumble)
- **Ammo loadout** (`lib/weapon-loadout.ts`, tested): PC = FULL clip + **1d3**
  reloads (revolver 12-24, never 36); NPC = **1d6-1** loaded (scarce, deliberate)
  + 1d3 reloads. Firing spends ammo on ANY outcome incl. miss / no target.
- Presence idle threshold = 1 hour (`lib/realtime/useGlobalPresence.tsx` IDLE_MS).
- Community: PCs ARE members ("4 players + 9 members = 13"); departures stay NPC-only.

## The master plan: tasks/beta500-readiness-2026-07-13.md
Six gates. This session shipped **~19 items**: all of Gate 4 (communities),
all of Gate 5 (strangers-proofing), Gate 3 (3.2 CDP refund + 3.4 atomic clock),
Gate 2 (M4/M7/M8 clean combat), plus the smoke-run fixes (ammo retune, NPC ammo
on card, infection-as-in-card-notice), the H1/H2/H3/H5/H8/H9 combat cluster
earlier, the read-swallow data-loss cluster (1 CRITICAL + 5), and the realtime
"stale-until-refresh" class (pins sidebar / lobby roster / useCampaignChannel
reconcile net). Plus the gm-screen Sentry null-deref (`66bea03f`).

### STILL OPEN (verify each against code before starting):
**Gate 1 - PROVE IT (Xero, 2 browsers - the real gate, blocks confidence):**
- 1.1 run `full-smoke-testplan-2026-07-13.xlsx`; 1.2 run
  `mechanics-verify-consolidated-testplan-2026-07-06.md` (drains the 3 chronic
  HOPED-FOR: FI Insight Die award `lib/useRollResolution.ts`, Stress 12-string
  narratives, vehicle popout broadcasts); 1.3 E2E re-cert after Gate 2 lands.
  Also `newfixes-smoke-testplan-2026-07-13.xlsx` covers this session's fixes.

**Gate 2 - the two HEAVY combat items (need deliberate passes):**
- 2.1 **H4 Cover Fire** is a no-op that still costs an action. Xero ruled: (a)
  the -2 must STICK to the target's next action, (b) Cover Fire spends a round of
  ammo. Needs a LIVE MIGRATION: `ALTER TABLE initiative_order ADD COLUMN
  incoming_cmod integer NOT NULL DEFAULT 0` (+ mirror sql/_baseline/schema.sql +
  lib/database.types.ts). Wiring: Cover Fire (`page.tsx:~4574`) writes -2 +
  decrements attacker ammo; do NOT add incoming_cmod to `activateUpdate`'s reset
  (so it survives to the target's turn); `computeAttackCmod`
  (`lib/table-roll-context.ts:~240`, next to `aim`) adds it as a labeled term;
  clear it at the target's turn END in `nextTurn`.
- 2.2 **H10 Rest/Travel** each call `advanceClock` per PC -> a 4-PC rest = +96h +
  4x rations/infection. Xero ruled: "moving time affects everyone" - redesign so
  ONE party-rest advances the clock once + recovers all party PCs.
  `CharacterCard.tsx` Rest (~:1293) + Travel (~:680).

**Gate 3 - two atomic RPCs (live migrations):**
- 3.1 H12 give-to-NPC/community/vehicle can DESTROY items (receiver write
  fire-and-forget, giver decremented regardless). Build an atomic RPC like
  PC->PC's `give_item_to_character`; wire the 3 paths (`InventoryPanel.tsx:~171`).
- 3.3 M11 barter half-applies (dupe+loss) + free Dire re-rolls. Atomic trade RPC
  + disable re-roll after a Dire (`page.tsx:~10849`, `TradeNegotiationModal.tsx`).

**Gate 5 residual:**
- 5.4 M14 initiative-channel broadcasts are fully trusted (any auth user with the
  campaign UUID can broadcast player_kicked / logs_cleared / turn_advance). Real
  fix wants Supabase PRIVATE channels + RLS, not app-only; low exploit likelihood.

**Gate 6 - polish (mostly no input):**
- 6.1 combat-path browser `alert()`s -> in-app toasts (start with broken-weapon
  attack + session-kick; ~330 total sites, do the combat ones first).
- 6.3 jargon tooltips (CDP/RAPID/AMod/SMod/CMod). 6.4 David Battersby pregen bio
  (needs Xero's text). 6.5 recorder observability spec (already written).

## Roadmap (post-Beta-500, in tasks/todo.md CURRENT OPEN top)
- **GM Screen redesign** = replace the hand-rolled free-float drag (the 2026-07-20
  crash class) with a grid-snapped SORTABLE card grid. Xero PICKED the blend:
  filter chips **All > Combat > Reference > GM Notes**, collapsible, auto-fit
  reflow, drag-to-reorder, **per-GM** saved layout. Working interactive mockup:
  scratchpad `gm-screen-redesign-mockup.html` (artifact
  https://claude.ai/code/artifact/7ef8b6d3-97c0-4cd1-bf5f-315ef35e85f3). Build on
  react-grid-layout / dnd-kit sortable. `app/gm-screen/page.tsx`.
- **Campaign Builder tool** (future): author GM Notes / Session Zero / NPCs / pins
  as seeded content; the GM Notes card pulls from it (EMPTY Session Zero is the
  example shape). Scope a spec when it comes up.

## SUBSTRATE HYGIENE - do this first
`tasks/todo.md` CURRENT OPEN has HIGH lines still marked `[ ]` that are actually
SHIPPED (H3/H5/H8/H11/H14/H16/Reload + the beta500 Gate 3/4/5 items). The
health-pulse has flagged this "stale-open" drift ~19 consecutive runs. Reconcile
todo.md against the beta500 doc + git log and close them, so the pulse goes quiet.
